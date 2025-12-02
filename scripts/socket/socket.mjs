import { MODULE_ID } from "../raise-my-hand.mjs";
import * as socketHandlers from "./handlers.mjs";

/** @type {Socket|null} The socketlib socket instance */
let socket = null;

/**
 * Get the socket instance.
 * @returns {Socket|null} The socket instance
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
 * In either case, the current user will receive execute the handler as well.
 * @param {"gm-only"|"all-players"} scope The scope string indicating who should receive the handler
 * @param {function} handler the handler function to execute
 * @param  {...any} args arguments to pass to the handler
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
    if (!game.user.isGM)
    {
      socket.executeAsUser(handler, game.userId, ...args);
    }
  } else {
    socket.executeForEveryone(handler, ...args);
  }
}

/**
 * Initialize the socket and register all socket callbacks.
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
