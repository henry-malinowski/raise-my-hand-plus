import { MODULE_ID } from "../raise-my-hand.mjs";
import NotificationPopout from "../applications/apps/notification-popout.mjs";
import { playSoundWithReplacement } from "../handlers/helpers.mjs";
import { getGmQueue, getGmUrgentUsers, getGmSpeakerUserId, setGmSpeakerUserId, isGmSceneActive, setGmSceneActive, broadcastQueueState, getSocket } from "./socket.mjs";
import QueueState from "../data/QueueState.mjs";

/**
 * Fire the state change hook so external modules can react to hand/queue changes.
 * @returns {void}
 * @private
 */
function emitStateChanged() {
  Hooks.callAll("raise-my-hand.stateChanged");
}

/**
 * Animation timing constants (in milliseconds) - must match CSS defaults.
 * @type {number}
 * @private
 */
const FADE_DURATION = 200;  // 0.2s fade-in/fade-out

/**
 * Animation timing constants (in milliseconds) - must match CSS defaults.
 * @type {number}
 * @private
 */
const WAVE_DURATION = 1750; // 1.75s waving animation

/**
 * Track the single hand-raised popout instance and the user ID that raised the hand.
 * @type {{popout: NotificationPopout, id: string}|null}
 * @private
 */
let handRaisedPopout = null;

/**
 * Local mirror of scene participants, synced from the GM via syncQueueState.
 * @type {QueueState}
 * @private
 */
const localQueue = new QueueState();

/**
 * Track which users currently have their hand raised in toggle mode.
 * This is the source of truth for re-applying indicators after DOM re-renders.
 * @type {Set<string>}
 * @private
 */
const raisedHands = new Set();

/**
 * Local mirror of which users are marked as urgent speakers.
 * Synced from the GM alongside the queue state.
 * @type {Set<string>}
 * @private
 */
const urgentUsers = new Set();

/**
 * Local mirror of the current speaker.
 * @type {string|null}
 * @private
 */
let localSpeakerUserId = null;

/**
 * Local mirror of whether the GM has opened the RP scene.
 * @type {boolean}
 * @private
 */
let localSceneActive = false;

/**
 * Track camera indicators which should be re-applied on this client after camera view re-renders.
 * @type {Set<string>}
 * @private
 */
const cameraIndicators = new Set();
const SPEAKER_INDICATION_ID = "raise-my-hand-speaker-indication";

/**
 * Track the current large overlay type so badge refreshes do not remove
 * non-speaker messages such as scene-start requests.
 * @type {{type: "speaker"|"request"|"scene", userId: string, text: string}|null}
 * @private
 */
let activeSceneIndication = null;

/**
 * Check if a user has their hand raised based on enabled toggle notification modes.
 * Only checks for indicators that are relevant in toggle mode (playerList and popout).
 * @param {string} userId - The ID of the user to check
 * @param {HandSettingsData} handSettings - The hand settings object containing notification modes
 * @returns {boolean} True if the hand appears to be raised
 */
export function isHandRaised(userId, handSettings) {
  // Check in-memory state (survives DOM re-renders)
  if (raisedHands.has(userId)) return true;

  // In spotlight mode, the synced participant list is also a raised-hand state.
  if (handSettings.general.isToggle && game.settings.get(MODULE_ID, "enableQueue") && localSceneActive) {
    if (localQueue.getPosition(userId) > 0) return true;
  }

  // Check for active popout (only if popout mode is enabled)
  const notificationModes = handSettings.general.notificationModes;
  if (notificationModes.has("popout")) {
    if (handRaisedPopout?.id === userId) return true;
  }

  return false;
}

/**
 * Create a localized UI notification with the name of the player who raised the hand.
 * @param {string} name - The name of the player who raised the hand.
 * @param {boolean} permanent - True if the notification should be permanent, false if it should be temporary.
 * @returns {void}
 * @see {@link https://foundryvtt.com/api/classes/foundry.applications.ui.Notifications.html Notifications}
 */
export function createUiNotification(name, permanent) {
  ui.notifications.info("raise-my-hand.UINOTIFICATION", { format: { name }, permanent });
}

/**
 * Escape text for safe HTML insertion.
 * @param {string} value - The untrusted text.
 * @returns {string} Escaped text.
 */
function escapeHtml(value) {
  const text = String(value ?? "");
  return foundry.utils.escapeHTML?.(text)
    ?? text.replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
}

/**
 * Get the in-character display name for a user, falling back to the user name.
 * @param {User} user - Foundry user document.
 * @returns {string}
 * @private
 */
function getUserDisplayName(user) {
  const character = user?.character;
  if (character?.name) return character.name;
  if (typeof character === "string") {
    const actor = game.actors?.get?.(character);
    if (actor?.name) return actor.name;
  }
  return user?.name ?? "";
}

/**
 * Get the first visible word of a display name for compact speaker UI.
 * @param {User} user - Foundry user document.
 * @returns {string}
 * @private
 */
function getShortUserDisplayName(user) {
  return getUserDisplayName(user).trim().split(/\s+/)[0] ?? "";
}

/**
 * Get the banner accent color for an indication type.
 * @param {"speaker"|"request"|"scene"|"urgent"} type - Indication type.
 * @returns {string}
 * @private
 */
function getSceneIndicationColor(type) {
  switch (type) {
    case "urgent": return "var(--raise-my-hand-red)";
    case "request": return "var(--raise-my-hand-yellow)";
    case "scene": return "var(--raise-my-hand-blue)";
    case "speaker":
    default: return "var(--raise-my-hand-green)";
  }
}

/**
 * Pick the participant who may accept the available spotlight.
 * Urgent hands take priority over yellow hands while preserving queue order.
 * @returns {string|null}
 * @private
 */
function getNextQueueUserId(queue, urgentUserIds) {
  const candidates = queue.getAll();
  return candidates.find(id => urgentUserIds.has(id)) ?? candidates[0] ?? null;
}

/**
 * Pick the GM-authoritative participant who may accept the available spotlight.
 * @returns {string|null}
 * @private
 */
function getNextSpotlightUserId() {
  return getNextQueueUserId(getGmQueue(), getGmUrgentUsers());
}

/**
 * Set the current speaker to the next eligible participant.
 * @param {string|null} [excludeUserId=null] - User ID to avoid selecting.
 * @returns {string|null} The new speaker user ID.
 * @private
 */
function advanceSpotlight(excludeUserId = null) {
  const gmQueue = getGmQueue();
  const gmUrgent = getGmUrgentUsers();
  const candidates = gmQueue.getAll().filter(id => id !== excludeUserId);
  const nextSpeaker = candidates.find(id => gmUrgent.has(id)) ?? candidates[0] ?? null;
  if (nextSpeaker) gmUrgent.delete(nextSpeaker);
  setGmSpeakerUserId(nextSpeaker);
  return nextSpeaker;
}

/**
 * Pick the locally visible participant who may accept the available spotlight.
 * @returns {string|null}
 * @private
 */
function getNextLocalSpotlightUserId() {
  if (!localSceneActive || localSpeakerUserId) return null;
  return getNextQueueUserId(localQueue, urgentUsers);
}

/**
 * Check if a user is the locally visible up-next participant.
 * @param {string} userId - User ID to check.
 * @returns {boolean}
 * @private
 */
function isNextLocalSpotlightUser(userId) {
  return getNextLocalSpotlightUserId() === userId;
}

/**
 * Get the local queue position text for a non-speaking participant.
 * @param {string} userId - User ID to check.
 * @param {boolean} isSpeaking - Whether the user is currently speaking.
 * @returns {string}
 * @private
 */
function getQueuePositionText(userId, isSpeaking) {
  if (isSpeaking) return "";
  const position = localQueue.getPosition(userId);
  return position > 0 ? String(position) : "";
}

/**
 * Remove the speaker indication overlay.
 * @returns {void}
 */
function removeSpeakerIndication() {
  activeSceneIndication = null;
  document.querySelector(`#${SPEAKER_INDICATION_ID}`)?.remove();
}

/**
 * Remove the separate urgent indication overlay.
 * @returns {void}
 */
function removeUrgentIndication() {
  document.querySelector("#raise-my-hand-urgent-indication")?.remove();
}

/**
 * Read the client-saved speaker indication position.
 * @returns {{x: number, y: number}|null}
 * @private
 */
function getSpeakerIndicationPosition() {
  const value = game.settings.get(MODULE_ID, "speakerIndicationPosition");
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y };
}

/**
 * Clamp the speaker banner position inside the viewport.
 * @param {number} x - Desired left position in pixels.
 * @param {number} y - Desired top position in pixels.
 * @param {HTMLElement} banner - The speaker banner element.
 * @returns {{x: number, y: number}}
 * @private
 */
function clampSpeakerIndicationPosition(x, y, banner) {
  const width = banner?.offsetWidth || 260;
  const height = banner?.offsetHeight || 68;
  const maxX = Math.max(0, (globalThis.window?.innerWidth || 0) - width);
  const maxY = Math.max(0, (globalThis.window?.innerHeight || 0) - height);

  return {
    x: Math.round(Math.min(Math.max(0, x), maxX)),
    y: Math.round(Math.min(Math.max(0, y), maxY))
  };
}

/**
 * Apply a saved/free-position style to the speaker banner.
 * @param {HTMLElement} banner - The speaker banner element.
 * @param {{x: number, y: number}|null} position - Saved position, or null for default.
 * @returns {void}
 * @private
 */
function applySpeakerIndicationPosition(banner, position) {
  if (!banner) return;

  if (!position) {
    banner.classList.remove("is-positioned");
    banner.style.left = "";
    banner.style.top = "";
    return;
  }

  const clamped = clampSpeakerIndicationPosition(position.x, position.y, banner);
  banner.classList.add("is-positioned");
  banner.style.left = `${clamped.x}px`;
  banner.style.top = `${clamped.y}px`;
}

/**
 * Get the current speaker indication banner.
 * @returns {HTMLElement|null}
 * @private
 */
function getSpeakerBanner() {
  return document.querySelector(`#${SPEAKER_INDICATION_ID}`)?.querySelector(".raise-my-hand-speaker-banner") ?? null;
}

/**
 * Make an indication banner draggable and save the speaker position.
 * @param {HTMLElement} banner - The speaker banner element.
 * @returns {void}
 * @private
 */
function bindSpeakerIndicationDrag(banner) {
  if (!banner || banner.dataset.dragBound === "true") return;
  banner.dataset.dragBound = "true";

  banner.addEventListener("pointerdown", event => {
    if (event.button != null && event.button !== 0) return;
    event.preventDefault?.();
    event.stopPropagation?.();

    const rect = banner.getBoundingClientRect?.() ?? { left: 0, top: 0 };
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    let current = clampSpeakerIndicationPosition(rect.left, rect.top, banner);

    const move = moveEvent => {
      current = clampSpeakerIndicationPosition(moveEvent.clientX - offsetX, moveEvent.clientY - offsetY, banner);
      if (current) applySpeakerIndicationPosition(getSpeakerBanner() ?? banner, current);
    };

    const up = upEvent => {
      upEvent.stopPropagation?.();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      current = clampSpeakerIndicationPosition(upEvent.clientX - offsetX, upEvent.clientY - offsetY, banner);
      if (!current) return;
      applySpeakerIndicationPosition(getSpeakerBanner() ?? banner, current);
      game.settings.set(MODULE_ID, "speakerIndicationPosition", current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

/**
 * Build queue items for the top speaking banner, urgent first and then normal queue order.
 * @returns {{id: string, name: string, urgent: boolean, position: number}[]}
 * @private
 */
function getTalkingQueueItems() {
  const queuedUserIds = localQueue.getAll().filter(userId => userId !== localSpeakerUserId);
  const sortedUserIds = [
    ...queuedUserIds.filter(userId => urgentUsers.has(userId)),
    ...queuedUserIds.filter(userId => !urgentUsers.has(userId))
  ];

  return sortedUserIds.map((userId, index) => {
    const user = game.users.get(userId);
    return {
      id: userId,
      name: getShortUserDisplayName(user) || userId,
      urgent: urgentUsers.has(userId),
      position: index + 1
    };
  });
}

/**
 * Render the inline talking queue for the top speaking banner.
 * @returns {string} Queue HTML, or an empty string.
 * @private
 */
function renderTalkingQueueHtml() {
  const items = getTalkingQueueItems();
  if (items.length === 0) return "";

  const itemHtml = items.map(item => `
        <li class="raise-my-hand-talking-queue-item ${item.urgent ? "urgent" : "normal"}">
          <span class="raise-my-hand-talking-queue-position">${item.position}</span>
          <span class="raise-my-hand-talking-queue-name">${escapeHtml(item.name)}</span>
        </li>
      `).join("");

  return `
      <ol class="raise-my-hand-talking-queue" aria-label="Talking queue">
        ${itemHtml}
      </ol>
    `;
}

/**
 * Get the local raise-hand control if Foundry's controls UI is ready.
 * Socket updates can arrive before the controls application exists.
 * @returns {object|undefined} The raise-hand tool, if available.
 * @private
 */
function getRaiseHandControl() {
  return ui.controls?.controls?.["tokens"]?.tools?.["raise-hand"];
}

/**
 * Render Foundry controls if the controls UI is ready.
 * @param {object} [options] - Render options forwarded to Foundry.
 * @returns {void}
 * @private
 */
function renderControls(options) {
  ui.controls?.render?.(options);
}

/**
 * Reflect synced scene membership on the local Raise Hand toggle.
 * @returns {void}
 * @private
 */
function syncLocalRaiseHandControl() {
  const tool = getRaiseHandControl();
  if (!tool) return;

  const active = localSceneActive && localQueue.getPosition(game.userId) > 0;
  tool.active = active;
  tool.title = localSpeakerUserId === game.userId
    ? "raise-my-hand.controls.raise-hand.finish"
    : `raise-my-hand.controls.raise-hand.toggle.${active}`;
}

/**
 * Show the reusable top-screen indication banner.
 * @param {string} userId - The user ID associated with the indication.
 * @param {string} text - Localized text to show.
 * @param {"speaker"|"request"|"scene"} [type="speaker"] - Indication type.
 * @param {boolean} [shouldShowAvatar=true] - Whether speaker indications may show the user's avatar.
 * @returns {void}
 * @private
 */
function showSceneIndication(userId, text, type = "speaker", shouldShowAvatar = true) {
  if (!game.settings.get(MODULE_ID, "speakerIndication") || !userId) {
    removeSpeakerIndication();
    return;
  }

  const user = game.users.get(userId);
  if (!user || !document.body) return;
  activeSceneIndication = { type, userId, text };
  const showAvatar = type === "speaker" && shouldShowAvatar;
  const queueHtml = type === "speaker" || type === "request" ? renderTalkingQueueHtml() : "";

  let root = document.querySelector("#raise-my-hand-speaker-indication");
  if (!root) {
    root = Object.assign(document.createElement("div"), {
      id: SPEAKER_INDICATION_ID,
      className: "raise-my-hand-speaker-indication"
    });
    document.body.appendChild(root);
  }
  root.style.setProperty("--raise-my-hand-speaker-color", getSceneIndicationColor(type));

  root.innerHTML = `
    <div class="raise-my-hand-speaker-banner" role="status" aria-live="polite">
      ${showAvatar ? '<div class="raise-my-hand-speaker-avatar"></div>' : ""}
      <div class="raise-my-hand-speaker-text">${escapeHtml(text)}</div>
      ${queueHtml}
    </div>
  `;

  const banner = root.querySelector(".raise-my-hand-speaker-banner");
  applySpeakerIndicationPosition(banner, getSpeakerIndicationPosition());
  bindSpeakerIndicationDrag(banner);

  if (showAvatar && user.avatar) {
    root.querySelector(".raise-my-hand-speaker-avatar").style.backgroundImage = `url("${user.avatar.replace(/["\\]/g, "\\$&")}")`;
  }
}

/**
 * Show or hide the optional top-screen speaker indication.
 * @param {string|null} speakerUserId - The current speaker user ID.
 * @returns {void}
 */
function updateSpeakerIndication(speakerUserId) {
  if (!game.settings.get(MODULE_ID, "speakerIndication")) {
    removeSpeakerIndication();
    removeUrgentIndication();
    return;
  }

  if (!speakerUserId) {
    if (activeSceneIndication?.type === "speaker") removeSpeakerIndication();
    return;
  }

  const user = game.users.get(speakerUserId);
  if (!user) return;

  const name = getShortUserDisplayName(user);
  const messageKey = speakerUserId === game.userId
    ? "raise-my-hand.SPEAKER_INDICATION_SELF"
    : "raise-my-hand.SPEAKER_INDICATION";
  const fallbackText = speakerUserId === game.userId ? "You are speaking" : `${name} speaks`;
  const text = game.i18n.format?.(messageKey, { name }) ?? fallbackText;
  showSceneIndication(speakerUserId, text);
}

/**
 * Show an indication on the GM when a player starts an RP scene.
 * @param {string|null} starterUserId - The player who requested the scene start.
 * @returns {void}
 * @private
 */
export function showSceneStartRequestIndication(starterUserId) {
  if (!starterUserId) return;
  const user = game.users.get(starterUserId);
  if (!user || user.isGM) return;

  const isSelf = starterUserId === game.userId;
  const text = game.i18n.format?.(
    isSelf ? "raise-my-hand.RP_SCENE_START_REQUEST_SELF" : "raise-my-hand.RP_SCENE_START_REQUEST",
    {}
  ) ?? (isSelf ? "You want to start RP scene" : "Someone wants to start RP scene");
  showSceneIndication(starterUserId, text, "request", false);
}

/**
 * Clear the pending RP scene request indication.
 * @returns {void}
 */
export function clearSceneStartRequestIndication() {
  if (activeSceneIndication?.type === "request") removeSpeakerIndication();
}

/**
 * Show an indication to players when the GM starts the RP scene.
 * @returns {void}
 * @private
 */
function showSceneStartedIndication() {
  if (game.user.isGM) return;

  const userId = game.userId || localQueue.getAll()[0];
  if (!userId) return;

  const text = game.i18n.format?.("raise-my-hand.RP_SCENE_STARTED", {}) ?? "RP scene started";
  showSceneIndication(userId, text, "scene");
}

/**
 * Show or clear the urgent-speaker waiting indication.
 * @returns {void}
 * @private
 */
function updateUrgentWaitingIndication() {
  removeUrgentIndication();
}

/**
 * Render or update the small badge shown over a user's camera view.
 * Reuses the queue badge structure so camera and queue indications stay visually consistent.
 * @param {HTMLElement} cameraView - The camera view element.
 * @param {object} state - Badge display state.
 * @param {string} state.iconClass - Font Awesome icon class to show.
 * @param {string} [state.positionText=""] - Queue position text, if any.
 * @param {boolean} [state.isSpeaking=false] - Whether this user is first in queue.
 * @param {boolean} [state.isUrgent=false] - Whether this user is urgent.
 * @param {boolean} [state.isNext=false] - Whether this user may accept the spotlight.
 * @param {boolean} [state.isCameraIndicator=false] - Whether this is a non-queue camera hand indicator.
 * @returns {HTMLElement} The badge element.
 */
function renderCameraBadge(cameraView, {
  iconClass,
  positionText = "",
  isSpeaking = false,
  isUrgent = false,
  isNext = false,
  isCameraIndicator = false
}) {
  let badge = cameraView.querySelector('.raise-my-hand-queue-badge');

  if (!badge) {
    badge = Object.assign(document.createElement('div'), {
      className: 'raise-my-hand-queue-badge'
    });
    badge.innerHTML = `<i class="fas ${iconClass}"></i><span class="queue-position"></span>`;
    cameraView.appendChild(badge);
  } else {
    const icon = badge.querySelector('i');
    if (icon) icon.className = `fas ${iconClass}`;
  }

  const queuePosition = badge.querySelector('.queue-position');
  if (queuePosition) queuePosition.textContent = positionText;

  badge.classList.toggle('speaking', isSpeaking);
  badge.classList.toggle('urgent', isUrgent);
  badge.classList.toggle('next', isNext);
  badge.classList.toggle('raise-my-hand-camera-indicator', isCameraIndicator);

  return badge;
}

/**
 * Get all rendered camera views, including popped-out camera windows.
 * This mirrors Foundry's own camera lookup, which does not scope to #camera-views.
 * @returns {HTMLElement[]} Camera view elements with a user id.
 * @private
 */
function getCameraViews() {
  return [...document.querySelectorAll(".camera-view")]
    .filter(cameraView => Boolean(cameraView.dataset?.user));
}

/**
 * Get all rendered camera views for one user.
 * @param {string} id - The user ID.
 * @returns {HTMLElement[]} Camera view elements for the user.
 * @private
 */
function getCameraViewsForUser(id) {
  return getCameraViews().filter(cameraView => cameraView.dataset.user === id);
}

/**
 * Remove the non-queue camera indicator for a user on this client.
 * @param {string} id - The user ID.
 * @returns {void}
 * @private
 */
function removeCameraIndicator(id) {
  cameraIndicators.delete(id);

  for (const cameraView of getCameraViewsForUser(id)) {
    const cameraBadge = cameraView.querySelector(".raise-my-hand-queue-badge");
    if (!cameraBadge) continue;
    if (cameraBadge.dataset.timeoutId) clearTimeout(parseInt(cameraBadge.dataset.timeoutId));
    cameraBadge.remove();
  }
}

/**
 * Append the player list icon to the player's name with fade-in and waving animation.
 * In toggle mode, the icon persists until explicitly removed.
 * In non-toggle mode, the icon is removed after animation + holdTime completes with fade-out.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function appendPlayerListIcon(id) {
  const playerName = document.querySelector(`[data-user-id="${id}"] > .player-name`);
  if (!playerName) return;

  // Remove existing icon if present (to restart animation)
  const existingIcon = playerName.querySelector('.raise-my-hand-indicator');
  if (existingIcon) {
    // Clear any pending timeout
    if (existingIcon.dataset.timeoutId) {
      clearTimeout(parseInt(existingIcon.dataset.timeoutId));
    }
    existingIcon.remove();
  }

  // Get settings
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  const isToggleMode = handSettings.general.isToggle;
  const holdTime = (handSettings.playerList.holdTime ?? 0) * 1000; // Convert to ms

  // Track raised hand state for toggle mode (survives DOM re-renders)
  if (isToggleMode) raisedHands.add(id);

  // Determine icon class based on current speaker state
  const useQueue = game.settings.get(MODULE_ID, "enableQueue") && isToggleMode;
  const isSpeaking = useQueue && localSpeakerUserId === id;
  const isUrgent = useQueue && !isSpeaking && urgentUsers.has(id);
  const isNext = useQueue && !isSpeaking && isNextLocalSpotlightUser(id);
  const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

  // Create new icon element with fade-in and waving animation
  const icon = Object.assign(document.createElement('span'), {
    className: `raise-my-hand-indicator fas ${iconClass} fade-in waving`
  });
  icon.dataset.userId = id;

  // Set scene state: speaker (green), urgent (red), or participant (yellow)
  if (useQueue) {
    icon.classList.toggle('speaking', isSpeaking);
    icon.classList.toggle('urgent', isUrgent);
    icon.classList.toggle('next', isNext);
    const positionText = getQueuePositionText(id, isSpeaking);
    if (positionText) icon.dataset.queuePosition = positionText;
    else delete icon.dataset.queuePosition;
  }

  playerName.appendChild(icon);
  emitStateChanged();

  // In non-toggle mode, fade-out and remove after animation + holdTime completes
  if (!isToggleMode) {
    // Total time: fade-in + wave + holdTime, then fade-out
    const displayTime = FADE_DURATION + WAVE_DURATION + holdTime;

    const timeoutId = setTimeout(() => {
      // Check if icon still exists and hasn't been manually removed
      const stillExists = playerName.querySelector(`.raise-my-hand-indicator[data-user-id="${id}"]`);
      if (stillExists === icon) {
        // Remove waving, add fade-out
        icon.classList.remove('fade-in', 'waving');
        icon.classList.add('fade-out');

        // Remove after fade-out completes
        setTimeout(() => {
          if (icon.parentNode) icon.remove();
        }, FADE_DURATION);
      }
    }, displayTime);

    // Store timeout ID for potential early cleanup
    icon.dataset.timeoutId = timeoutId.toString();
  }
}

/**
 * Append a hand indicator badge to the user's camera view.
 * In toggle mode, the indicator persists and re-applies after camera re-renders.
 * In non-toggle mode, the indicator is removed after animation + holdTime completes.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function appendCameraIndicator(id) {
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  const isToggleMode = handSettings.general.isToggle;
  const holdTime = (handSettings.camera?.holdTime ?? 0) * 1000;
  const isQueueMode = game.settings.get(MODULE_ID, "enableQueue") && isToggleMode;
  if (isQueueMode) return;

  if (isToggleMode) cameraIndicators.add(id);

  const cameraViews = getCameraViewsForUser(id);
  if (cameraViews.length === 0) {
    emitStateChanged();
    return;
  }

  for (const cameraView of cameraViews) {
    const badge = renderCameraBadge(cameraView, {
      iconClass: 'fa-hand-paper',
      isCameraIndicator: true
    });

    if (badge.dataset.timeoutId) {
      clearTimeout(parseInt(badge.dataset.timeoutId));
      delete badge.dataset.timeoutId;
    }

    if (!isToggleMode) {
      const displayTime = FADE_DURATION + WAVE_DURATION + holdTime;
      const timeoutId = setTimeout(() => {
        if (badge.parentNode) badge.remove();
      }, displayTime);
      badge.dataset.timeoutId = timeoutId.toString();
    }
  }

  emitStateChanged();
}

/**
 * Remove the player list icon from the player's name if it exists.
 * Clears any pending timeout and applies fade-out animation before removal.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function removePlayerListIcon(id) {
  raisedHands.delete(id);
  removeCameraIndicator(id);

  const icon = document.querySelector(`[data-user-id="${id}"] > .player-name > .raise-my-hand-indicator`);
  if (icon) {
    // Clear any pending timeout
    if (icon.dataset.timeoutId) {
      clearTimeout(parseInt(icon.dataset.timeoutId));
    }
    // Apply fade-out animation, then remove
    icon.classList.remove('fade-in', 'waving');
    icon.classList.add('fade-out');
    setTimeout(() => {
      if (icon.parentNode) icon.remove();
    }, FADE_DURATION);
  }

  emitStateChanged();
}

/**
 * Remove all player list icons from all player names.
 * Clears any pending timeouts and applies fade-out animation before removal.
 * @returns {void}
 */
export function clearPlayerListIcons() {
  const wasSceneActive = localSceneActive;
  raisedHands.clear();
  urgentUsers.clear();
  cameraIndicators.clear();
  localQueue.clear();
  localSpeakerUserId = null;
  localSceneActive = false;
  removeSpeakerIndication();
  removeUrgentIndication();
  const tool = getRaiseHandControl();
  if (tool?.active) {
    tool.active = false;
    tool.title = "raise-my-hand.controls.raise-hand.toggle.false";
    renderControls();
  }
  if (wasSceneActive) renderControls({ reset: true });
  // Remove all camera queue badges and cinematic badges
  document.querySelectorAll('.raise-my-hand-queue-badge').forEach(badge => badge.remove());
  emitStateChanged();
  document.querySelectorAll(`.player-name > .raise-my-hand-indicator`).forEach(icon => {
    // Clear any pending timeout
    if (icon.dataset.timeoutId) {
      clearTimeout(parseInt(icon.dataset.timeoutId));
    }
    // Apply fade-out animation, then remove
    icon.classList.remove('fade-in', 'waving');
    icon.classList.add('fade-out');
    setTimeout(() => {
      if (icon.parentNode) icon.remove();
    }, FADE_DURATION);
  });
}

/**
 * Create a popout with the player's name and image.
 * @param {string} id - The ID of the player who raised the hand.
 * @param {string} imagePath - The path to the image to display in the popout.
 * @returns {Promise<void>}
 */
export async function createHandPopout(id, imagePath) {
  const user = game.users.get(id);
  if (!user) {
    console.warn(`${MODULE_ID} | User ${id} not found`);
    return;
  }
  const name = user.name;

  const popout = new NotificationPopout({
    templateData: { imagePath, name },
    window: {
      icon: 'fas fa-hand-paper fa-lg',
      title: `${name} ${game.i18n.localize("raise-my-hand.CHATMESSAGE")}`,
      resizable: false
    }
  });
  handRaisedPopout = { popout, id };
  await popout.render({ force: true });
}

/**
 * Close the hand popout if it exists and is associated with the player.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {Promise<void>}
 */
export async function closeHandPopout(id) {
  // Only close if it's the current user's popout
  if (handRaisedPopout?.id !== id) return;

  await handRaisedPopout.popout?.close();
  handRaisedPopout = null;
}

/**
 * Lower the hand toggle control for a specific user.
 * @param {string} id - The ID of the user whose hand toggle should be lowered
 * @returns {void}
 */
export function lowerHandForUser(id) {
  // Only lower if it's the current user's toggle
  if (id !== game.userId) return;

  const tool = getRaiseHandControl();

  // Lower the toggle if it's currently active
  if (tool?.active) {
    tool.active = false;
    renderControls();
  }
}

/**
 * Create a popout with the X-card image and play the X-card sound if enabled.
 * @param {string} id - The ID of the user who triggered the X-card.
 * @returns {Promise<void>}
 */
export async function createXCardPopout(id) {
  const xCardSettings = game.settings.get(MODULE_ID, "xCardSettings");

  const user = game.users.get(id);

  // Get the name of the user or an empty string if anonymous
  const ANONYMOUS_STRING = "";
  const name = xCardSettings.anonymousWarning ? ANONYMOUS_STRING : (user?.name ?? ANONYMOUS_STRING);

  const popout = new NotificationPopout({
    classes: ["themed", "theme-dark"],
    templateData: { imagePath: `modules/${MODULE_ID}/assets/ui/xcard.svg`, name },
    window: {
      title: game.i18n.localize("raise-my-hand.ui.xcard.title"),
      icon: 'fas fa-times fa-xl',
      resizable: false
    }
  });

  const promises = [popout.render({ force: true })];

  // Sound X-Card
  if (xCardSettings.source !== "none") {
    const soundPath = xCardSettings.source === "default"
      ? `modules/${MODULE_ID}/assets/sounds/alarm.ogg`
      : xCardSettings.overridePath;

    // Play the sound
    // Since this function is a socket handler, it should only play for the local user
    promises.push(playSoundWithReplacement({
      src: soundPath,
      volume: xCardSettings.soundVolume / 100,  // Convert percentage to decimal
      autoplay: true
    }));
  }

  await Promise.all(promises);
}

// --- Hand State Tracking ---

/**
 * Track a user's hand as raised (all clients).
 * Decoupled from playerList notification so state is tracked
 * regardless of which notification modes are enabled.
 * @param {string} id - The user ID
 * @returns {void}
 */
export function trackHandRaised(id) {
  raisedHands.add(id);
  emitStateChanged();
}

// --- Queue Handlers ---

/**
 * Get the local queue mirror instance.
 * @returns {QueueState}
 */
export function getLocalQueue() {
  return localQueue;
}

/**
 * Get the set of user IDs with raised hands.
 * @returns {Set<string>}
 */
export function getRaisedHands() {
  return raisedHands;
}

/**
 * Get the set of user IDs marked as urgent speakers.
 * @returns {Set<string>}
 */
export function getUrgentUsers() {
  return urgentUsers;
}

/**
 * Get the current speaker user ID.
 * @returns {string|null}
 */
export function getSpeakerUserId() {
  return localSpeakerUserId;
}

/**
 * Check whether the local client sees an active RP scene.
 * @returns {boolean}
 */
export function isSceneActive() {
  return localSceneActive;
}

/**
 * Handle a request to join the scene participant list.
 * Only the active GM processes this; other GMs and players ignore it.
 * @param {string} userId - The user ID requesting to join
 * @returns {void}
 */
export function requestQueueJoin(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  const gmQueue = getGmQueue();
  const position = gmQueue.add(userId);
  if (position === -1) return;

  if (!isGmSceneActive()) {
    broadcastQueueState();
    const socket = getSocket();
    socket?.executeForEveryone(showSceneStartRequestIndication, userId);
    return;
  }

  broadcastQueueState();
}

/**
 * Handle a request to remove a user from the scene participant list.
 * Only the active GM processes this; other GMs and players ignore it.
 * @param {string} userId - The user ID to remove
 * @returns {void}
 */
export function requestQueueRemove(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  const gmQueue = getGmQueue();
  if (gmQueue.remove(userId)) {
    getGmUrgentUsers().delete(userId);
    if (getGmSpeakerUserId() === userId) {
      advanceSpotlight();
    }
    if (isGmSceneActive()) {
      broadcastQueueState();
    } else {
      broadcastQueueState();
      if (gmQueue.length === 0) {
        const socket = getSocket();
        socket?.executeForEveryone(clearSceneStartRequestIndication);
      }
    }
  }
}

/**
 * Handle a request to toggle urgent status for a user.
 * Urgent is independent of the queue — just a red hand indicator.
 * Only the active GM processes this.
 * @param {string} userId - The user ID requesting urgent status
 * @returns {void}
 */
export function requestUrgent(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  if (getGmSpeakerUserId() === userId) return;
  const gmUrgent = getGmUrgentUsers();
  const gmQueue = getGmQueue();

  if (gmUrgent.has(userId)) {
    gmUrgent.delete(userId);
  } else {
    if (gmQueue.getPosition(userId) === 0) gmQueue.add(userId);
    gmUrgent.add(userId);
    if (!isGmSceneActive()) {
      const socket = getSocket();
      socket?.executeForEveryone(showSceneStartRequestIndication, userId);
    }
  }
  broadcastQueueState();
}

/**
 * Toggle the spotlight for a participant.
 * A user can snatch only when no one is speaking. The current speaker can release
 * the spotlight and remain in the scene as a yellow hand.
 * @param {string} userId - The user ID requesting the spotlight toggle
 * @returns {void}
 */
export function requestSpotlightToggle(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  if (!isGmSceneActive()) return;

  const gmQueue = getGmQueue();
  if (gmQueue.getPosition(userId) === 0) return;

  const currentSpeaker = getGmSpeakerUserId();
  if (currentSpeaker === userId) {
    getGmUrgentUsers().delete(userId);
    gmQueue.remove(userId);
    advanceSpotlight();
    broadcastQueueState();
    return;
  }

  if (currentSpeaker) return;
  if (getNextSpotlightUserId() !== userId) return;

  const gmUrgent = getGmUrgentUsers();
  gmUrgent.delete(userId);
  setGmSpeakerUserId(userId);
  broadcastQueueState();
}

/**
 * Delay the current speaker's turn and pass spotlight to the next participant.
 * The speaker remains in the queue, but moves behind the current waiters.
 * @param {string} userId - The user ID requesting to delay
 * @returns {void}
 */
export function requestSpotlightDelay(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  if (!isGmSceneActive()) return;
  if (getGmSpeakerUserId() !== userId) return;

  const gmQueue = getGmQueue();
  if (!gmQueue.moveToBack(userId)) return;
  getGmUrgentUsers().delete(userId);
  advanceSpotlight(userId);
  broadcastQueueState();
}

/**
 * Open the RP scene so players can join by raising hands.
 * Only the active GM processes this.
 * @param {string|null} starterUserId - Optional player who requested scene start.
 * @returns {void}
 */
export function requestSceneStart(starterUserId = null) {
  if (game.users.activeGM?.id !== game.userId) return;
  setGmSceneActive(true);
  if (starterUserId && !game.users.get(starterUserId)?.isGM) {
    getGmQueue().add(starterUserId);
  }
  const firstRequester = getNextSpotlightUserId();
  if (firstRequester) {
    getGmUrgentUsers().delete(firstRequester);
    setGmSpeakerUserId(firstRequester);
  }
  broadcastQueueState();
}

/**
 * Terminate the RP scene and clear all participants, urgent hands, and speaker.
 * Only the active GM processes this.
 * @returns {void}
 */
export function requestSceneEnd() {
  if (game.users.activeGM?.id !== game.userId) return;

  getGmQueue().clear();
  getGmUrgentUsers().clear();
  setGmSpeakerUserId(null);
  setGmSceneActive(false);

  const socket = getSocket();
  socket?.executeForEveryone(clearPlayerListIcons);
  broadcastQueueState();
}

/**
 * Sync the queue state from the GM to all clients.
 * Updates the local participant mirror and refreshes scene badges
 * on player list icons and camera views.
 * @param {string[]} orderedUserIds - The queue in order
 * @param {string[]} urgentUserIds - The user IDs marked as urgent
 * @param {string|null} speakerUserId - The current speaker user ID
 * @param {boolean} sceneActive - Whether the RP scene is active
 * @returns {void}
 */
export function syncQueueState(orderedUserIds, urgentUserIds = [], speakerUserId = null, sceneActive = orderedUserIds.length > 0 || Boolean(speakerUserId)) {
  const wasSceneActive = localSceneActive;
  localQueue.replace(orderedUserIds);
  urgentUsers.clear();
  for (const id of urgentUserIds) urgentUsers.add(id);
  localSpeakerUserId = speakerUserId;
  localSceneActive = Boolean(sceneActive);
  const shouldShowSceneStarted = !wasSceneActive && localSceneActive && !localSpeakerUserId;

  if (!localSceneActive && localQueue.length === 0) {
    clearPlayerListIcons();
    if (wasSceneActive !== localSceneActive) renderControls({ reset: true });
    return;
  }

  if (!localSceneActive) {
    updateCameraQueueBadges();
    if (activeSceneIndication?.type === "request") {
      showSceneStartRequestIndication(activeSceneIndication.userId);
    }
    emitStateChanged();
    return;
  }

  syncLocalRaiseHandControl();
  if (wasSceneActive !== localSceneActive) {
    renderControls({ reset: true });
    syncLocalRaiseHandControl();
  }

  reapplyQueueIndicators();

  // Update speaker and urgent state on all existing player list icons
  document.querySelectorAll('.raise-my-hand-indicator').forEach(icon => {
    const userId = icon.dataset.userId;
    const isSpeaking = userId === localSpeakerUserId;
    const isUrgent = !isSpeaking && urgentUsers.has(userId);
    const isNext = !isSpeaking && isNextLocalSpotlightUser(userId);
    const positionText = getQueuePositionText(userId, isSpeaking);

    // Swap icon between megaphone (speaking) and hand (scene participant)
    icon.classList.toggle('fa-bullhorn', isSpeaking);
    icon.classList.toggle('fa-hand-paper', !isSpeaking);
    icon.classList.toggle('speaking', isSpeaking);
    icon.classList.toggle('urgent', isUrgent);
    icon.classList.toggle('next', isNext);
    if (positionText) icon.dataset.queuePosition = positionText;
    else delete icon.dataset.queuePosition;
  });

  // Update scene badges on camera views and cinematic
  updateCameraQueueBadges();
  if (shouldShowSceneStarted) {
    if (game.user.isGM) clearSceneStartRequestIndication();
    else showSceneStartedIndication();
  } else {
    updateUrgentWaitingIndication();
  }
  emitStateChanged();
}

/**
 * Re-apply raised hand indicators on the player list after a re-render.
 * In toggle mode, recreates indicators for all users whose hand is raised
 * but whose DOM elements were destroyed by a player list re-render.
 * In spotlight+toggle mode, also restores speaker and urgent state.
 * @returns {void}
 */
export function reapplyQueueIndicators() {
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (!handSettings.general.isToggle) return;

  const useQueue = game.settings.get(MODULE_ID, "enableQueue") && localSceneActive;
  if (!useQueue && !handSettings.general.notificationModes.has("playerList")) return;
  const users = useQueue ? localQueue.getAll() : [...raisedHands];

  for (const userId of users) {
    const playerName = document.querySelector(`[data-user-id="${userId}"] > .player-name`);
    if (!playerName) continue;
    if (playerName.querySelector('.raise-my-hand-indicator')) continue;

    const position = useQueue ? localQueue.getPosition(userId) : 0;
    const isSpeaking = useQueue && userId === localSpeakerUserId;
    const isUrgent = useQueue && !isSpeaking && urgentUsers.has(userId);
    const isNext = useQueue && !isSpeaking && isNextLocalSpotlightUser(userId);
    const positionText = useQueue ? getQueuePositionText(userId, isSpeaking) : "";
    const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

    const icon = Object.assign(document.createElement('span'), {
      className: `raise-my-hand-indicator fas ${iconClass}`
    });
    icon.dataset.userId = userId;

    if (useQueue) {
      if (isSpeaking) {
        icon.classList.add('speaking');
      }
      if (isUrgent) {
        icon.classList.add('urgent');
      }
      if (isNext) {
        icon.classList.add('next');
      }
      if (positionText) {
        icon.dataset.queuePosition = positionText;
      }
    }

    playerName.appendChild(icon);
  }
  emitStateChanged();
}

/**
 * Update or remove scene/queue badges on all camera views.
 * Adds a badge overlay to each camera-view element whose user is in the scene,
 * and removes badges for users no longer in the scene.
 * @returns {void}
 */
export function updateCameraQueueBadges() {
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  const hasPendingSceneRequest = !localSceneActive && localQueue.length > 0;
  const useQueue = game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle && (localSceneActive || hasPendingSceneRequest);
  const useCameraIndicators = !useQueue && handSettings.general.notificationModes.has("camera");

  getCameraViews().forEach(cameraView => {
    const userId = cameraView.dataset.user;
    if (!userId) return;

    let badge = cameraView.querySelector('.raise-my-hand-queue-badge');
    const isParticipant = useQueue && localQueue.getPosition(userId) > 0;
    const isSpeaking = useQueue && userId === localSpeakerUserId;
    const isUrgent = useQueue && !isSpeaking && urgentUsers.has(userId);
    const isNext = useQueue && !isSpeaking && isNextLocalSpotlightUser(userId);
    const showCameraIndicator = useCameraIndicators && cameraIndicators.has(userId);
    const showBadge = useQueue ? (isParticipant || isUrgent || isSpeaking) : showCameraIndicator;

    if (showBadge) {
      const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

      badge = renderCameraBadge(cameraView, {
        iconClass,
        positionText: useQueue ? getQueuePositionText(userId, isSpeaking) : '',
        isSpeaking,
        isUrgent,
        isNext,
        isCameraIndicator: !useQueue
      });
    } else if (badge) {
      badge.remove();
    }
  });

  updateSpeakerIndication(localSpeakerUserId);
}
