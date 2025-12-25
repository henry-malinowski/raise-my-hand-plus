import { MODULE_ID } from "../raise-my-hand.mjs";
import * as socketHandlers from "./handlers.mjs";

/**
 * The socketlib socket instance for this module.
 * Initialized during the 'socketlib.ready' hook.
 * @type {Socket|null} The socketlib Socket instance, or null if not yet initialized
 * @private
 * @see {@link https://github.com/farling42/foundryvtt-socketlib socketlib}
 */
let socket = null;

/**
 * Get the socketlib socket instance for this module.
 * @returns {Socket|null} The socketlib Socket instance, or null if not yet initialized
 * @see {@link https://github.com/farling42/foundryvtt-socketlib socketlib}
 */
export function getSocket() {
  return socket;
}

/**
 * Get the IDs of all active GMs.
 * @returns {string[]} An array of user IDs of all active GMs.
 */
export function getActiveGmUserIds() {
  return game.users.filter(user => user.isGM && user.active).map(user => user.id);
}

/**
 * Execute a handler function conditionally based on scope.
 * In either case, the current user will also execute the handler locally.
 * For "gm-only" scope, executes for all GMs and the current user (if not a GM).
 * For "all-players" scope, executes for everyone.
 * @param {"gm-only"|"all-players"} scope - The scope string indicating who should receive the handler
 * @param {Function} handler - The handler function to execute (must be registered with socket.register)
 * @param {...any} args - Arguments to pass to the handler
 * @returns {void}
 * @see {@link https://github.com/farling42/foundryvtt-socketlib/blob/381254339c721344aabb0f56e48cc6d2d1b6a604/src/socketlib.js#L87 socketlib}
 */
export function conditionalExecute(scope, handler, ...args) {
  if (!socket) {
    console.warn(`${MODULE_ID} | Socket not initialized, cannot execute handler`);
    return;
  }
  if (scope === "gm-only") {
    socket.executeForAllGMs(handler, ...args);

    // If the current user is not a GM, execute the handler for that user as well
    // so they see their own notifications (Hand Raise, X-Card)
    if (!game.user.isGM) {
      socket.executeAsUser(handler, game.userId, ...args);
    }
  } else {
    socket.executeForEveryone(handler, ...args);
  }
}

/**
 * Initialize the socketlib socket and register all socket callbacks.
 * Called during the 'socketlib.ready' hook. 
 * @returns {void}
 */
export function initSocket() {
  socket = socketlib.registerModule(MODULE_ID);

  socket.register("createUiNotification", socketHandlers.createUiNotification);
  socket.register("appendPlayerListIcon", socketHandlers.appendPlayerListIcon);
  socket.register("removePlayerListIcon", socketHandlers.removePlayerListIcon);
  socket.register("clearPlayerListIcons", socketHandlers.clearPlayerListIcons);
  socket.register("createHandPopout", socketHandlers.createHandPopout);
  socket.register("closeHandPopout", socketHandlers.closeHandPopout);
  socket.register("createXCardPopout", socketHandlers.createXCardPopout);
  socket.register("lowerHandForUser", socketHandlers.lowerHandForUser);
}
