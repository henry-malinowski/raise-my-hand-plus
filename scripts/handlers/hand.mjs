import { MODULE_ID } from "../raise-my-hand.mjs";
import { checkAndUpdateTimeout } from "./helpers.mjs";
import { conditionalExecute, getActiveGmUserIds, getGmQueue, getSocket } from "../socket/socket.mjs";
import { playSoundWithReplacement } from "./helpers.mjs";
import { appendPlayerListIcon, appendCameraIndicator, createUiNotification, createHandPopout, removePlayerListIcon, closeHandPopout, lowerHandForUser, trackHandRaised, requestQueueJoin, requestQueueRemove, requestUrgent, requestSpotlightToggle, requestSceneStart, requestSceneEnd, isHandRaised, isSceneActive } from "../socket/handlers.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Toggle the hand raise/lower state.
 * @param {boolean} active - True if the hand should be raised, false if it should be lowered.
 * @returns {void}
 */
export function toggle(active) {
  active ? raise({ skipTimeout: true }) : lower();
  ui.controls.controls["tokens"].tools["raise-hand"].title = `raise-my-hand.controls.raise-hand.toggle.${active}`;
  ui.controls.render();
}

/**
 * Raise the hand and trigger all enabled notification modes.
 * Checks timeout to prevent spam, then executes all enabled notification handlers (playerList, ui, chat, popout, aural) in parallel.
 * @param {object} [options={}] - Options for raising the hand
 * @param {boolean} [options.skipTimeout=false] - Skip the timeout check (used by toggle mode)
 * @returns {Promise<void>}
 */
export async function raise({ skipTimeout = false } = {}) {
  // Check timeout to prevent spam and update timestamp
  if (!skipTimeout && !checkAndUpdateTimeout()) return;

  const id = game.userId;
  const player = game.users.get(id);
  if (!player) {
    console.warn(`${MODULE_ID} | Current user not found`);
    return;
  }
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  const isSceneMode = game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle;
  if (isSceneMode && !isSceneActive()) {
    if (!game.user.isGM) {
      const socket = getSocket();
      socket?.executeForAllGMs(requestQueueJoin, id);
    }
    return;
  }

  // --- Local Async Helper Functions ---

  const showPlayerListIcon = async () => {
    // Always show icon; appendPlayerListIcon handles toggle vs non-toggle behavior internally
    conditionalExecute(handSettings.playerList.scope, 
        appendPlayerListIcon, id);
  };

  const showUiNotification = async () => {
    const isPermanent = handSettings.ui.permanent;
    conditionalExecute(handSettings.ui.scope, 
      createUiNotification, player.name, isPermanent);
  };

  const showCameraIndicator = async () => {
    const isQueueMode = game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle;
    if (isQueueMode) return;

    conditionalExecute(handSettings.camera?.scope ?? "all-players", appendCameraIndicator, id);
  };

  /**
   * Show a chat notification with the player's name and optional image.
   * @returns {Promise<void>}
   * @see {@link https://foundryvtt.com/api/classes/foundry.documents.ChatMessage.html ChatMessage}
   */
  const showChatNotification = async () => {
    // Build template data object
    const templateData = {
      playerAvatar: player.avatar,
      ...handSettings.chat
    };

    // Render template
    const message = await renderTemplate(`modules/${MODULE_ID}/templates/sidebar/chat-hand.hbs`, templateData);

    const chatData = {
      speaker: null,
      content: message,
      ...(handSettings.chat.scope === "gm-only" && { whisper: ChatMessage.getWhisperRecipients("GM") })
    };
    ChatMessage.create(chatData, {});
  };

  const showPopoutNotification = async () => {
    const source = handSettings.popout.source;
    const imagePaths = {
      default: `modules/${MODULE_ID}/assets/ui/hand.svg`,
      avatar: player.avatar,
      custom: handSettings.popout.overridePath,
    };
    const imagePath = imagePaths[source];

    conditionalExecute(handSettings.popout.scope, 
      createHandPopout, id, imagePath);
  };

  const playAuralNotification = async () => {
    const userType = (handSettings.aural.scope === "gm-only") ? 
      getActiveGmUserIds() : true; // true indicates all users

    const source = handSettings.aural.source;
    const soundPath = source === "default" 
      ? `modules/${MODULE_ID}/assets/sounds/bell01.ogg` 
      : handSettings.aural.overridePath;

    await playSoundWithReplacement({
      src: soundPath,
      volume: handSettings.aural.soundVolume / 100,  // Convert percentage to decimal
      autoplay: true
    }, userType);
  };

  // --- Execution ---

  // Always track raised hand state on all clients in toggle mode,
  // independent of which notification modes are enabled.
  if (handSettings.general.isToggle) {
    const socket = getSocket();
    socket?.executeForEveryone(trackHandRaised, id);
  }

  const handlers = {
    playerList: showPlayerListIcon,
    camera: showCameraIndicator,
    ui: showUiNotification,
    chat: showChatNotification,
    popout: showPopoutNotification,
    aural: playAuralNotification
  };

  const notificationModes = Array.from(handSettings.general.notificationModes ?? []);
  const tasks = notificationModes.reduce((acc, mode) => {
    if (handlers[mode]) acc.push(handlers[mode]());
    return acc;
  }, []);

  await Promise.all(tasks);

  // Request to join the scene participant list if enabled
  if (game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle) {
    const socket = getSocket();
    socket?.executeForAllGMs(requestQueueJoin, id);
  }
}

/**
 * Remove the hand raised indicator from the player's name and close the hand popout if it exists.
 * @returns {void}
 */
export function lower() {
  const socket = getSocket();
  const id = game.userId;

  // always attempt remove regardless of settings as they
  // could've changed after the hand was raised
  // and they become no-ops if it's not applicable anyway
  socket?.executeForEveryone(removePlayerListIcon, id);
  socket?.executeForEveryone(closeHandPopout, id);

  // Request removal from the scene participant list
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle) {
    socket?.executeForAllGMs(requestQueueRemove, id);
  }
}

/**
 * Toggle urgent speaking status for the current user.
 * When queue mode is active, this marks the user as needing to speak urgently.
 * If the user's hand is not raised, it will be raised and the toggle asserted.
 * @returns {void}
 */
export function urgentSpeak() {
  const id = game.userId;
  const socket = getSocket();
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  const isSceneMode = game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle;
  if (isSceneMode && !isSceneActive()) {
    if (!game.user.isGM) {
      const tool = ui.controls.controls["tokens"]?.tools["raise-hand"];
      if (tool?.toggle && !tool.active) {
        tool.active = true;
        tool.title = "raise-my-hand.controls.raise-hand.toggle.true";
        ui.controls.render();
      }
      raise({skipTimeout: true});
    }
    return;
  }

  // Ensure hand is raised (assert toggle if not already active)
  const tool = ui.controls.controls["tokens"]?.tools["raise-hand"];
  if (tool?.toggle && !tool.active) {
    raise({ skipTimeout: true });
    tool.active = true;
    tool.title = "raise-my-hand.controls.raise-hand.toggle.true";
    ui.controls.render();
  }

  // If player list mode is enabled, ensure the icon exists for everyone
  if (handSettings.general.notificationModes.has("playerList")) {
    conditionalExecute(handSettings.playerList.scope, appendPlayerListIcon, id);
  }

  // Request urgent toggle on the GM
  socket?.executeForAllGMs(requestUrgent, id);
}

/**
 * Toggle the current user's spotlight.
 * If no one is speaking, this user becomes the green speaker. If this user is
 * already speaking, they release the spotlight and remain a yellow participant.
 * @returns {boolean} Whether the action handled the keypress.
 */
export function snatchSpotlight() {
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (!handSettings.general.isToggle) return false;
  if (!game.settings.get(MODULE_ID, "enableQueue")) return false;

  if (game.user.isGM) {
    if (isSceneActive()) {
      toggleRpScene();
      return true;
    }

    if (game.users.activeGM?.id === game.userId && getGmQueue().length > 0) {
      toggleRpScene();
      return true;
    }
    return false;
  }

  if (!isSceneActive()) return false;
  if (!isHandRaised(game.userId, handSettings)) return false;

  const socket = getSocket();
  socket?.executeForAllGMs(requestSpotlightToggle, game.userId);
  return true;
}

/**
 * Toggle the GM-owned RP scene active state.
 * Active scene lets players join by raising hands. Ending clears all scene state.
 * @returns {void}
 */
export function toggleRpScene() {
  if (!game.user.isGM) return;

  const handler = isSceneActive() ? requestSceneEnd : requestSceneStart;
  if (game.users.activeGM?.id === game.userId) {
    handler();
    return;
  }

  const socket = getSocket();
  socket?.executeForAllGMs(handler);
}

/**
 * Lower the hand for a specific user (used by context menu).
 * @param {string} userId - The ID of the user whose hand should be lowered
 * @returns {void}
 */
export function lowerForUser(userId) {
  const socket = getSocket();

  // Remove the player list icon and close any popout for the specified user
  socket?.executeForEveryone(removePlayerListIcon, userId);
  socket?.executeForEveryone(closeHandPopout, userId);

  // Lower the hand toggle control for the target user (only affects their client)
  socket?.executeAsUser(lowerHandForUser, userId, userId);

  // Request removal from the scene participant list
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle) {
    socket?.executeForAllGMs(requestQueueRemove, userId);
  }
}
