import { MODULE_ID } from "../raise-my-hand.mjs";
import NotificationPopout from "../applications/apps/notification-popout.mjs";
import { playSoundWithReplacement } from "../handlers/helpers.mjs";
import { getGmQueue, getGmUrgentUsers, broadcastQueueState } from "./socket.mjs";
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
 * Local mirror of the speaking queue, synced from the GM via syncQueueState.
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
 * Check if a user has their hand raised based on enabled toggle notification modes.
 * Only checks for indicators that are relevant in toggle mode (playerList and popout).
 * @param {string} userId - The ID of the user to check
 * @param {HandSettingsData} handSettings - The hand settings object containing notification modes
 * @returns {boolean} True if the hand appears to be raised
 */
export function isHandRaised(userId, handSettings) {
  // Check in-memory state (survives DOM re-renders)
  if (raisedHands.has(userId)) return true;

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
  ui.notifications.info("raise-my-hand.UINOTIFICATION", { format: {name}, permanent});
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

  // Determine icon class based on queue position (position 1 = speaking → megaphone)
  const useQueue = game.settings.get(MODULE_ID, "enableQueue") && isToggleMode;
  const position = useQueue ? localQueue.getPosition(id) : 0;
  const isSpeaking = position === 1;
  const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

  // Create new icon element with fade-in and waving animation
  const icon = Object.assign(document.createElement('span'), {
    className: `raise-my-hand-indicator fas ${iconClass} fade-in waving`
  });
  icon.dataset.userId = id;

  // Set queue state: speaking (green, no number) or waiting (yellow, show position - 1)
  if (useQueue && position > 0) {
    if (isSpeaking) {
      icon.classList.add('speaking');
    } else {
      icon.dataset.queuePosition = position - 1;
    }
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
 * Remove the player list icon from the player's name if it exists.
 * Clears any pending timeout and applies fade-out animation before removal.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function removePlayerListIcon(id) {
  raisedHands.delete(id);
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

  // Also remove the camera queue badge for this user
  const cameraBadge = document.querySelector(`#camera-views .camera-view[data-user="${id}"] .raise-my-hand-queue-badge`);
  cameraBadge?.remove();
  emitStateChanged();
}

/**
 * Remove all player list icons from all player names.
 * Clears any pending timeouts and applies fade-out animation before removal.
 * @returns {void}
 */
export function clearPlayerListIcons() {
  raisedHands.clear();
  urgentUsers.clear();
  localQueue.clear();
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
  await popout.render({force: true});
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

  const tool = ui.controls.controls["tokens"]?.tools["raise-hand"];

  // Lower the toggle if it's currently active
  if (tool?.active) {
    tool.active = false;
    ui.controls.render();
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

  const promises = [popout.render({force: true})];

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
 * Handle a request to join the speaking queue.
 * Only the active GM processes this; other GMs and players ignore it.
 * @param {string} userId - The user ID requesting to join
 * @returns {void}
 */
export function requestQueueJoin(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  const gmQueue = getGmQueue();
  if (gmQueue.add(userId) !== -1) {
    broadcastQueueState();
  }
}

/**
 * Handle a request to remove a user from the speaking queue.
 * Only the active GM processes this; other GMs and players ignore it.
 * @param {string} userId - The user ID to remove
 * @returns {void}
 */
export function requestQueueRemove(userId) {
  if (game.users.activeGM?.id !== game.userId) return;
  const gmQueue = getGmQueue();
  if (gmQueue.remove(userId)) {
    getGmUrgentUsers().delete(userId);
    broadcastQueueState();
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
  const gmUrgent = getGmUrgentUsers();

  if (gmUrgent.has(userId)) {
    gmUrgent.delete(userId);
  } else {
    gmUrgent.add(userId);
    getGmQueue().remove(userId);
  }
  broadcastQueueState();
}

/**
 * Sync the queue state from the GM to all clients.
 * Updates the local queue mirror and refreshes queue position badges
 * on player list icons and camera views.
 * @param {string[]} orderedUserIds - The queue in order
 * @param {string[]} urgentUserIds - The user IDs marked as urgent
 * @returns {void}
 */
export function syncQueueState(orderedUserIds, urgentUserIds = []) {
  localQueue.replace(orderedUserIds);
  urgentUsers.clear();
  for (const id of urgentUserIds) urgentUsers.add(id);

  // Update queue position badges, speaking state, and urgent state on all existing player list icons
  document.querySelectorAll('.raise-my-hand-indicator').forEach(icon => {
    const userId = icon.dataset.userId;
    const position = localQueue.getPosition(userId);
    const isSpeaking = position === 1;

    // Swap icon between megaphone (speaking) and hand (waiting)
    icon.classList.toggle('fa-bullhorn', isSpeaking);
    icon.classList.toggle('fa-hand-paper', !isSpeaking);
    icon.classList.toggle('speaking', isSpeaking);

    // Position 1 = speaking (no number), position 2+ = show position - 1
    if (position > 1) {
      icon.dataset.queuePosition = position - 1;
    } else {
      delete icon.dataset.queuePosition;
    }
    // Apply or remove urgent class
    icon.classList.toggle('urgent', urgentUsers.has(userId));
  });

  // Update queue position badges on camera views and cinematic
  updateCameraQueueBadges();
  emitStateChanged();
}

/**
 * Re-apply raised hand indicators on the player list after a re-render.
 * In toggle mode, recreates indicators for all users whose hand is raised
 * but whose DOM elements were destroyed by a player list re-render.
 * In queue+toggle mode, also restores queue position badges.
 * @returns {void}
 */
export function reapplyQueueIndicators() {
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (!handSettings.general.isToggle) return;
  if (!handSettings.general.notificationModes.has("playerList")) return;

  const useQueue = game.settings.get(MODULE_ID, "enableQueue");
  const users = useQueue ? localQueue.getAll() : [...raisedHands];

  for (const userId of users) {
    const playerName = document.querySelector(`[data-user-id="${userId}"] > .player-name`);
    if (!playerName) continue;
    if (playerName.querySelector('.raise-my-hand-indicator')) continue;

    const position = useQueue ? localQueue.getPosition(userId) : 0;
    const isSpeaking = position === 1;
    const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

    const icon = Object.assign(document.createElement('span'), {
      className: `raise-my-hand-indicator fas ${iconClass}`
    });
    icon.dataset.userId = userId;

    if (useQueue) {
      if (isSpeaking) {
        icon.classList.add('speaking');
      } else if (position > 1) {
        icon.dataset.queuePosition = position - 1;
      }
      if (urgentUsers.has(userId)) {
        icon.classList.add('urgent');
      }
    }

    playerName.appendChild(icon);
  }
  emitStateChanged();
}

/**
 * Update or remove queue position badges on all camera views.
 * Adds a badge overlay to each camera-view element whose user is in the queue,
 * and removes badges for users no longer in the queue.
 * @returns {void}
 */
export function updateCameraQueueBadges() {
  document.querySelectorAll('#camera-views .camera-view').forEach(cameraView => {
    const userId = cameraView.dataset.user;
    if (!userId) return;

    let badge = cameraView.querySelector('.raise-my-hand-queue-badge');
    const position = localQueue.getPosition(userId);
    const isUrgent = urgentUsers.has(userId);
    const showBadge = position > 0 || isUrgent;

    if (showBadge) {
      const isSpeaking = position === 1;
      const iconClass = isSpeaking ? 'fa-bullhorn' : 'fa-hand-paper';

      if (!badge) {
        badge = Object.assign(document.createElement('div'), {
          className: 'raise-my-hand-queue-badge'
        });
        badge.innerHTML = `<i class="fas ${iconClass}"></i><span class="queue-position"></span>`;
        cameraView.appendChild(badge);
      } else {
        const icon = badge.querySelector('i');
        icon.className = `fas ${iconClass}`;
      }
      badge.querySelector('.queue-position').textContent = (!isSpeaking && position > 1) ? position - 1 : '';
      badge.classList.toggle('speaking', isSpeaking);
      badge.classList.toggle('urgent', isUrgent);
    } else if (badge) {
      badge.remove();
    }
  });
}
