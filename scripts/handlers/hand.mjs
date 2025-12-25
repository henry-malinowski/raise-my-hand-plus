import { MODULE_ID } from "../raise-my-hand.mjs";
import { checkAndUpdateTimeout, timeoutPassed } from "./helpers.mjs";
import { conditionalExecute, getActiveGmUserIds, getSocket } from "../socket/socket.mjs";
import { playSoundWithReplacement } from "./helpers.mjs";
import { appendPlayerListIcon, createUiNotification, createHandPopout, removePlayerListIcon, closeHandPopout, lowerHandForUser } from "../socket/handlers.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/**
 * Toggle the hand raise/lower state.
 * @param {boolean} active - True if the hand should be raised, false if it should be lowered.
 * @returns {void}
 */
export function toggle(active) {
  // If trying to raise hand, check timeout first
  if (active && !timeoutPassed()) {
    // forcibly deassert the control and return
    ui.controls.controls["tokens"].tools["raise-hand"].active = false;
    ui.controls.render();
    return;
  }

  active ? raise() : lower();
  ui.controls.controls["tokens"].tools["raise-hand"].title = `raise-my-hand.controls.raise-hand.toggle.${active}`;
  ui.controls.render();
}

/**
 * Raise the hand and trigger all enabled notification modes.
 * Checks timeout to prevent spam, then executes all enabled notification handlers (playerList, ui, chat, popout, aural) in parallel.
 * @returns {Promise<void>}
 */
export async function raise() {
  // Check timeout to prevent spam and update timestamp
  if (!checkAndUpdateTimeout()) return;

  const id = game.userId;
  const player = game.users.get(id);
  if (!player) {
    console.warn(`${MODULE_ID} | Current user not found`);
    return;
  }
  const handSettings = game.settings.get(MODULE_ID, "handSettings");

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
  const handlers = {
    playerList: showPlayerListIcon,
    ui: showUiNotification,
    chat: showChatNotification,
    popout: showPopoutNotification,
    aural: playAuralNotification
  };

  const tasks = handSettings.general.notificationModes.reduce((acc, mode) => {
    if (handlers[mode]) acc.push(handlers[mode]());
    return acc;
  }, []);

  await Promise.all(tasks);
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
}
