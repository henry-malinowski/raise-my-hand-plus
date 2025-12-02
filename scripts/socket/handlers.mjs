import { MODULE_ID } from "../raise-my-hand.mjs";
import NotificationPopout from "../applications/apps/notification-popout.mjs";
import { playSoundWithReplacement } from "../handlers/helpers.mjs";

/** Animation timing constants (in milliseconds) - must match CSS defaults */
const FADE_DURATION = 200;  // 0.2s fade-in/fade-out
const WAVE_DURATION = 1750; // 1.75s waving animation

/** @type {Object|null} Track single popout instance and user id that raised the hand */
let handRaisedPopout = null;

/**
 * Check if a user has their hand raised based on enabled toggle notification modes.
 * Only checks for indicators that are relevant in toggle mode (playerList and popout).
 * @param {string} userId - The ID of the user to check
 * @param {object} handSettings - The hand settings object containing notification modes
 * @returns {boolean} True if the hand appears to be raised
 */
export function isHandRaised(userId, handSettings) {
  const notificationModes = handSettings.general.notificationModes;

  // Check for player list icon (only if playerList mode is enabled)
  if (notificationModes.has("playerList")) {
    const playerName = document.querySelector(`[data-user-id="${userId}"] > .player-name`);
    if (playerName?.querySelector('.raise-my-hand-indicator')) return true;
  }

  // Check for active popout (only if popout mode is enabled)
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

  // Create new icon element with fade-in and waving animation
  const icon = Object.assign(document.createElement('span'), {
    className: 'raise-my-hand-indicator fas fa-hand-paper fade-in waving'
  });
  icon.dataset.userId = id;
  playerName.appendChild(icon);

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
}

/**
 * Remove all player list icons from all player names.
 * Clears any pending timeouts and applies fade-out animation before removal.
 * @returns {void}
 */
export function clearPlayerListIcons() {
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
 * @returns {void}
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
 * @returns {void}
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
 * @returns {void}
 */
export async function createXCardPopout(id) {
  const xCardSettings = game.settings.get(MODULE_ID, "xCardSettings");

  const user = game.users.get(id);

  // Get the name of the user or an empty string if anonymous
  const name = xCardSettings.anonymousWarning ? "" : (user?.name ?? "");

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
