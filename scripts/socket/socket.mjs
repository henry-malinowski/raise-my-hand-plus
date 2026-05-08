import { MODULE_ID } from "../raise-my-hand.mjs";
import * as socketHandlers from "./handlers.mjs";
import QueueState from "../data/QueueState.mjs";

/**
 * The socketlib socket instance for this module.
 * Initialized during the 'socketlib.ready' hook.
 * @type {Socket|null} The socketlib Socket instance, or null if not yet initialized
 * @private
 * @see {@link https://github.com/farling42/foundryvtt-socketlib socketlib}
 */
let socket = null;

/**
 * The authoritative scene participant list, only meaningful on the active GM client.
 * @type {QueueState}
 * @private
 */
const gmQueue = new QueueState();

/**
 * The authoritative set of urgent speakers, only meaningful on the active GM client.
 * @type {Set<string>}
 * @private
 */
const gmUrgentUsers = new Set();

/**
 * The authoritative current speaker, only meaningful on the active GM client.
 * Null means the spotlight is available.
 * @type {string|null}
 * @private
 */
let gmSpeakerUserId = null;

/**
 * Whether the GM-authoritative RP scene is currently open for participants.
 * Only meaningful on the active GM client.
 * @type {boolean}
 * @private
 */
let gmSceneActive = false;

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
 * Get the GM-authoritative scene participant list.
 * Only meaningful on the active GM client.
 * @returns {QueueState}
 */
export function getGmQueue() {
  return gmQueue;
}

/**
 * Get the GM-authoritative urgent users set.
 * Only meaningful on the active GM client.
 * @returns {Set<string>}
 */
export function getGmUrgentUsers() {
  return gmUrgentUsers;
}

/**
 * Get the GM-authoritative current speaker user ID.
 * @returns {string|null}
 */
export function getGmSpeakerUserId() {
  return gmSpeakerUserId;
}

/**
 * Set the GM-authoritative current speaker user ID.
 * @param {string|null} userId - The speaker user ID, or null if no one is speaking.
 * @returns {void}
 */
export function setGmSpeakerUserId(userId) {
  gmSpeakerUserId = userId;
}

/**
 * Check whether the GM-authoritative RP scene is active.
 * @returns {boolean}
 */
export function isGmSceneActive() {
  return gmSceneActive;
}

/**
 * Set whether the GM-authoritative RP scene is active.
 * @param {boolean} active - True if players can join the RP scene.
 * @returns {void}
 */
export function setGmSceneActive(active) {
  gmSceneActive = Boolean(active);
}

/**
 * Broadcast the current GM queue state to all connected clients.
 * Should only be called from the active GM client after mutating the queue.
 * @returns {void}
 */
export function broadcastQueueState() {
  if (!socket) return;
  socket.executeForEveryone(socketHandlers.syncQueueState, gmQueue.getAll(), [...gmUrgentUsers], gmSpeakerUserId, gmSceneActive);
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
  socket.register("appendCameraIndicator", socketHandlers.appendCameraIndicator);
  socket.register("removePlayerListIcon", socketHandlers.removePlayerListIcon);
  socket.register("clearPlayerListIcons", socketHandlers.clearPlayerListIcons);
  socket.register("createHandPopout", socketHandlers.createHandPopout);
  socket.register("closeHandPopout", socketHandlers.closeHandPopout);
  socket.register("createXCardPopout", socketHandlers.createXCardPopout);
  socket.register("lowerHandForUser", socketHandlers.lowerHandForUser);
  socket.register("trackHandRaised", socketHandlers.trackHandRaised);

  // Queue handlers
  socket.register("requestQueueJoin", socketHandlers.requestQueueJoin);
  socket.register("requestQueueRemove", socketHandlers.requestQueueRemove);
  socket.register("requestUrgent", socketHandlers.requestUrgent);
  socket.register("requestSpotlightToggle", socketHandlers.requestSpotlightToggle);
  socket.register("requestSceneStart", socketHandlers.requestSceneStart);
  socket.register("requestSceneEnd", socketHandlers.requestSceneEnd);
  socket.register("showSceneStartRequestIndication", socketHandlers.showSceneStartRequestIndication);
  socket.register("clearSceneStartRequestIndication", socketHandlers.clearSceneStartRequestIndication);
  socket.register("syncQueueState", socketHandlers.syncQueueState);
}
