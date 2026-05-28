import { MODULE_ID } from "./raise-my-hand.mjs";
import { getLocalQueue, getRaisedHands, getUrgentUsers, getSpeakerUserId as _getSpeakerUserId, isHandRaised as _isHandRaised } from "./socket/handlers.mjs";
import * as handHandlers from "./handlers/hand.mjs";

/**
 * Public API for the raise-my-hand module.
 * Exposed on game.modules.get('raise-my-hand').api
 * Allows other modules to read hand/queue state and trigger actions.
 *
 * State change hooks fired by the module:
 * - 'raise-my-hand.stateChanged' — fired on all clients when any hand/queue state changes
 */
export const api = {

  // --- State Getters ---

  /**
   * Get the set of user IDs with raised hands.
   * @returns {Set<string>}
   */
  getRaisedHands() {
    return getRaisedHands();
  },

  /**
   * Get the set of user IDs marked as urgent speakers.
   * @returns {Set<string>}
   */
  getUrgentUsers() {
    return getUrgentUsers();
  },

  /**
   * Get the current speaker user ID.
   * @returns {string|null}
   */
  getSpeakerUserId() {
    return _getSpeakerUserId();
  },

  /**
   * Get the ordered queue of user IDs.
   * @returns {string[]}
   */
  getQueue() {
    return getLocalQueue().getAll();
  },

  /**
   * Get a user's position in the queue (1-based). 0 = not in queue.
   * @param {string} userId
   * @returns {number}
   */
  getQueuePosition(userId) {
    return getLocalQueue().getPosition(userId);
  },

  /**
   * Check if a user has their hand raised.
   * @param {string} userId
   * @returns {boolean}
   */
  isHandRaised(userId) {
    const handSettings = game.settings.get(MODULE_ID, "handSettings");
    return _isHandRaised(userId, handSettings);
  },

  /**
   * Check if queue mode is currently enabled.
   * @returns {boolean}
   */
  isQueueEnabled() {
    const handSettings = game.settings.get(MODULE_ID, "handSettings");
    return handSettings.general.isToggle && game.settings.get(MODULE_ID, "enableQueue");
  },

  /**
   * Check if toggle mode is enabled.
   * @returns {boolean}
   */
  isToggleMode() {
    return game.settings.get(MODULE_ID, "handSettings").general.isToggle;
  },

  /**
   * Check if the module has any notification modes enabled.
   * @returns {boolean}
   */
  hasNotifications() {
    return game.settings.get(MODULE_ID, "handSettings").general.notificationModes.size > 0;
  },

  // --- Actions ---

  /**
   * Raise the current user's hand.
   * @returns {Promise<void>}
   */
  raise() {
    return handHandlers.raise();
  },

  /**
   * Lower the current user's hand.
   * @returns {void}
   */
  lower() {
    return handHandlers.lower();
  },

  /**
   * Toggle the current user's hand raise/lower state.
   * @param {boolean} active - True to raise, false to lower
   * @returns {void}
   */
  toggle(active) {
    return handHandlers.toggle(active);
  },

  /**
   * Trigger urgent speak for the current user.
   * Raises hand if not already raised.
   * @returns {void}
   */
  urgentSpeak() {
    return handHandlers.urgentSpeak();
  },

  /**
   * Toggle the current user's spotlight.
   * @returns {void}
   */
  snatchSpotlight() {
    return handHandlers.snatchSpotlight();
  },

  /**
   * Delay the current user's spotlight turn.
   * @returns {void}
   */
  delaySpotlight() {
    return handHandlers.delaySpotlight();
  }
};
