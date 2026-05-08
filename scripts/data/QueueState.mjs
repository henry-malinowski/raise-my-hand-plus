/**
 * Simple ordered list for tracking scene participants.
 * This is transient session state (not persisted to settings).
 * The GM client holds the authoritative instance; player clients hold read-only mirrors.
 */
export default class QueueState {
  /** @type {string[]} */
  #queue = [];

  /**
   * Add a user to the end of the queue if not already present.
   * @param {string} userId - The user ID to add
   * @returns {number} 1-based position if added, or -1 if already in queue
   */
  add(userId) {
    if (this.#queue.includes(userId)) return -1;
    this.#queue.push(userId);
    return this.#queue.length;
  }

  /**
   * Remove a user from the queue.
   * @param {string} userId - The user ID to remove
   * @returns {boolean} True if the user was found and removed
   */
  remove(userId) {
    const index = this.#queue.indexOf(userId);
    if (index === -1) return false;
    this.#queue.splice(index, 1);
    return true;
  }

  /**
   * Get the 1-based position of a user in the queue.
   * @param {string} userId - The user ID to look up
   * @returns {number} 1-based position, or 0 if not in queue
   */
  getPosition(userId) {
    const index = this.#queue.indexOf(userId);
    return index === -1 ? 0 : index + 1;
  }

  /**
   * Get a shallow copy of the queue array.
   * @returns {string[]} Array of user IDs in queue order
   */
  getAll() {
    return [...this.#queue];
  }

  /**
   * Clear the queue.
   */
  clear() {
    this.#queue = [];
  }

  /**
   * Replace the entire queue (used by clients receiving sync from GM).
   * @param {string[]} userIds - The new queue order
   */
  replace(userIds) {
    this.#queue = [...userIds];
  }

  /**
   * Get the number of users in the queue.
   * @returns {number}
   */
  get length() {
    return this.#queue.length;
  }
}
