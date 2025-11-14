import NotificationPopup from "./NotificationPopup.mjs";
import { socket, MODULE_ID } from "./module.js";

/** @type {Object|null} Track single popup instance and user id that raised the hand */
let handRaisedPopup = null;

/** @type {number} Timestamp of last hand raise/X-card action (0 = never) */  
let lastSentNotification = 0;

/** @type {Sound|null} Track the module's currently playing sound */
let currentPlayingSound = null;

// ----------------
// Helper Functions
// ----------------
/**
 * Get a setting from the module's settings if it exists, Error otherwise.
 * @param {string} setting - The setting to get.
 * @throws {Error} If the setting is not specified or does not exist.
 * @returns {any} The setting's value if it exists.
 */
const getSetting = (setting) => game.settings.get(MODULE_ID, setting);

/**
 * Get the IDs of all active GMs.
 * @returns {string[]} An array of user IDs of all active GMs.
 */
const getActiveGmUserIds = () => game.users.filter(user => user.isGM && user.active).map(user => user.id);

/**
 * Check if the timeout has passed since the last hand raise/X-card action.
 * @returns {boolean} True if timeout has passed or is disabled, false if too soon
 */
function timeoutPassed() {
  const timeoutSeconds = getSetting("notificationTimeout");
  const now = Date.now();
  return (now - lastSentNotification) >= (timeoutSeconds * 1000);
}

/**
 * Wrapper for the AudioHelper.play() method to stop the previous sound if it exists.
 *
 * @param {object} data        An object configuring the audio data to play. See AudioHelper.play for details.
 * @param {string} data.src    The audio source file path, either a public URL or a local path relative to the public directory.
 * @param {boolean|object} [socketOptions=false]  Socket emit options passed straight through to AudioHelper.play.
 * @returns {Promise<Sound|void>}  A Promise that resolves to a Sound instance, or nothing if autoplay is false.
 */
async function playSoundWithReplacement(data, socketOptions=false) {
  // Stop the previous sound if it exists (stop() is idempotent and checks .playing internally)
  try {
    await currentPlayingSound?.stop();
  } catch (error) {
    console.warn("Error stopping previous sound:", error);
  }
  
  // Play the new sound and store the reference
  // AudioHelper.play() returns a Sound or void (if autoplay is false)
  const sound = await foundry.audio.AudioHelper.play(data, socketOptions);
  // Only store the sound if it was actually created (not undefined)
  if (sound) {
    currentPlayingSound = sound;
  }
}

// ----------------
// Core Functions
// ----------------

/**
 * Toggle the hand raise/lower state.
 * @param {Event} event - The event that triggered the toggle.
 * @param {boolean} active - True if the hand should be raised, false if it should be lowered.
 * @returns {void}
 */
export function toggle(active) {
  // If trying to raise hand, check timeout first
  if (active && !timeoutPassed()) {
    // Reverse the toggle state - the button has already been toggled by Foundry
    document.querySelector(`[data-tool="raise-hand"]`)?.setAttribute('aria-pressed', 'false');
    return;
  }

  active ? raiseHand() : lowerHand();
}

/**
 * raiseHand - core socket callbacks & settings:
 * - showEmojiHandCallback:      showEmojiIndicator + handToogleBehavior
 * - createUiNotificationSocket: showUiNotification (+makeUiNotificationPermanent, showUiNotificationOnlyToGM)
 * - CHAT (not a socket):        showUiChatMessage (+showUiChatMessageOnlyForGM, showImageChatMessage, chatMessageImageUserArt, chatimagepath, chatimagewidth)
 * - createHandPopupSocket:      showDialogImage
 * - SOUND (hand chime):         handsound, handsoundvolume
 */
export async function raiseHand() {
  // Check timeout to prevent spam
  if (!timeoutPassed()) return;

  // Update timestamp
  lastSentNotification = Date.now();

  const id = game.userId;
  const player = game.users.get(id); // get the player Document
        
  // SHOW HAND NEXT TO PLAYER NAME
  if (getSetting("showEmojiIndicator") && getSetting("handToogleBehavior")) {
    socket.executeForEveryone(appendEmojiHandSocket, id);
  }

  // SHOW NOTIFICATION
  if (getSetting("showUiNotification")) {
    const isPermanent = getSetting("makeUiNotificationPermanent");
    
    if (getSetting("showUiNotificationOnlyToGM")) {
      socket.executeForAllGMs(createUiNotificationSocket, player.name, isPermanent);
    } else {
      socket.executeForEveryone(createUiNotificationSocket, player.name, isPermanent);
    }
  }  

  // CHAT
  if (getSetting("showUiChatMessage")) {
    let message = `<div class="raise-my-hand-msg"><h3>${player.name}</h3><h4>${game.i18n.localize("raise-my-hand.CHATMESSAGE")}</h4>`;

    if (getSetting("showImageChatMessage")) {
      const chatImageWidth = getSetting("chatimagewidth");
      const imagePath = getSetting("chatMessageImageUserArt") ? player.avatar : getSetting("chatimagepath");

      message += `<p><img src="${imagePath}" width="${chatImageWidth}%"></p>`;
    }

    message += `</div>`;
    
    let chatData = {
      speaker: null,
      content: message,
      ...(getSetting("showUiChatMessageOnlyForGM") && { whisper: ChatMessage.getWhisperRecipients("GM") })
    };
    ChatMessage.create(chatData, {});
  }

  // SHOW HAND (OR USER IMAGE) POPUP
  if (getSetting("showDialogMessage")) {
    const imagePath = getSetting("chatMessageImageUserArt") ? player.avatar : getSetting("chatimagepath");
    socket.executeForEveryone(createHandPopupSocket, id, imagePath);
  }
  
  // SOUND
  if (getSetting("playSound")) {
    let userType = getSetting("playSoundGMOnly") ? getActiveGmUserIds() : true;

    await playSoundWithReplacement({
      src: getSetting("warningsoundpath"),
      volume: getSetting("warningsoundvolume"),
      autoplay: true
    }, userType);
  }
}

/**
 * Remove the hand raised indicator from the player's name and close the hand popup if it exists.
 * @returns {void}
 */
export function lowerHand() {
  const id = game.userId;
  if (getSetting("showEmojiIndicator")) {
    socket.executeForEveryone(removeEmojiHandSocket, id);              
  }

  if (getSetting("showDialogMessage")) {
    socket.executeForEveryone(closeHandPopupSocket, id);
  }
}

/**
 * Show the X-card dialog to the configured recipients.
 * @returns {void}
 */
export function showXCardDialog() {
  // Check timeout to prevent spam (same as raiseHand)
  if (!timeoutPassed()) return;

  // Update timestamp
  lastSentNotification = Date.now();
  const id = game.userId;

  if (getSetting("xcardgmonly")) {
    socket.executeForAllGMs(createXCardPopupSocket, id);
  } else {
    socket.executeForEveryone(createXCardPopupSocket, id);
  }
}

// ----------------
// Socket Callbacks
// ----------------
/**
 * Create a localized UI notification with the name of the player who raised the hand.
 * @param {string} name - The name of the player who raised the hand.
 * @param {boolean} permanent - True if the notification should be permanent, false if it should be temporary.
 * @returns {void}
 */
export function createUiNotificationSocket(name, permanent) {
  ui.notifications.info("raise-my-hand.UINOTIFICATION", { format: {name}, permanent});
}

/**
 * Append the hand raised indicator to the player's name.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function appendEmojiHandSocket(id) {
  const playerName = document.querySelector(`[data-user-id="${id}"] > .player-name`);
  if (!playerName?.querySelector('.raise-my-hand-indicator')) {
    playerName.appendChild(Object.assign(document.createElement('span'), { 
      className: 'raise-my-hand-indicator fas fa-hand-paper' 
    }));
  }
}

/**
 * Remove the hand raised indicator from the player's name if it exists.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export function removeEmojiHandSocket(id) {
  document.querySelector(`[data-user-id="${id}"] > .player-name > .raise-my-hand-indicator`)?.remove();
}

/**
 * Create a popup with the player's name and image.
 * @param {string} id - The ID of the player who raised the hand.
 * @param {string} imagePath - The path to the image to display in the popup.
 * @returns {void}
 */
export async function createHandPopupSocket(id, imagePath) {
  const name = game.users.get(id).name;

  const popup = new NotificationPopup({
    templateData: { imagePath, name },
    window: {
      icon: 'fas fa-hand-paper fa-lg',
      title: `${name} ${game.i18n.localize("raise-my-hand.CHATMESSAGE")}`,
      resizable: false
    }
  });
  handRaisedPopup = { popup, id };
  await popup.render({force: true});
}

/**
 * Close the hand popup if it exists and is associated with the player.
 * @param {string} id - The ID of the player who raised the hand.
 * @returns {void}
 */
export async function closeHandPopupSocket(id) {
  if (handRaisedPopup?.id === id) {
    await handRaisedPopup.popup?.close();
    handRaisedPopup = null;
  }
}

/**
 * Create a popup with the X-card image and play the X-card sound if enabled.
 * @returns {void}
 */
export async function createXCardPopupSocket(id) {
  const name = game.users.get(id).name;

  const popup = new NotificationPopup({
    classes: ["themed", "theme-dark"],
    templateData: { imagePath: `modules/${MODULE_ID}/assets/xcard.svg`, name },
    window: {
      title: game.i18n.localize("raise-my-hand.ui.xcard.title"),
      icon: 'fas fa-times fa-xl',
      resizable: false
    }
  });

  const promises = [popup.render({force: true})];
  
  // Sound X-Card
  if (getSetting("xcardsound")) {      
    promises.push(playSoundWithReplacement({
      src: `modules/${MODULE_ID}/assets/alarm.ogg`,
      volume: getSetting("xcardsoundvolume"),
      autoplay: true
    }, true));    
  }

  await Promise.all(promises);
}
