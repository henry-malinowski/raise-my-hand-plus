import { MODULE_ID } from "../raise-my-hand.mjs";
import { checkAndUpdateTimeout } from "./helpers.mjs";
import { conditionalExecute } from "../socket/socket.mjs";
import { createXCardPopout } from "../socket/handlers.mjs";

/**
 * Show the X-card dialog to the configured recipients.
 * @returns {void}
 */
export function showXCardDialog() {
  // check enabled here because it could be called via a Keybind
  const xCardSettings = game.settings.get(MODULE_ID, "xCardSettings");
  if (!xCardSettings.isEnabled) return;

  // Check timeout to prevent spam and update timestamp
  if (!checkAndUpdateTimeout()) return;

  // Get the user ID and X-Card settings for the socket message
  const id = game.userId;

  conditionalExecute(xCardSettings.scope, createXCardPopout, id);
}
