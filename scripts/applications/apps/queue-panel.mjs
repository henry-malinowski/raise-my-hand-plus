import { MODULE_ID } from "../../raise-my-hand.mjs";
import { getLocalQueue, requestQueueRemove } from "../../socket/handlers.mjs";
import { getSocket } from "../../socket/socket.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * ApplicationV2 panel showing the speaking queue as an ordered list.
 * GM can remove any entry; any player can remove themselves.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class QueuePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "raise-my-hand-queue-panel",
    window: {
      icon: "fas fa-list-ol",
      title: "raise-my-hand.queue.title",
      frame: true,
      positioned: true,
      minimizable: true,
      resizable: true
    },
    position: {
      width: 280,
      height: "auto"
    },
    actions: {
      removeFromQueue: QueuePanel.#onRemoveFromQueue
    }
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/apps/queue-panel.hbs` }
  };

  /**
   * Prepare context data for the template.
   * @param {object} options - Render options
   * @returns {Promise<object>}
   * @protected
   */
  async _prepareContext(options) {
    const queue = getLocalQueue().getAll();
    return {
      entries: queue.map((userId, i) => ({
        userId,
        name: game.users.get(userId)?.name ?? "Unknown",
        position: i + 1,
        canRemove: game.user.isGM || userId === game.userId
      }))
    };
  }

  /**
   * Handle clicking the remove button on a queue entry.
   * @param {PointerEvent} event
   * @param {HTMLElement} target
   */
  static #onRemoveFromQueue(event, target) {
    const userId = target.dataset.userId;
    if (!userId) return;
    const socket = getSocket();
    socket?.executeForAllGMs(requestQueueRemove, userId);
  }

  /**
   * Toggle the queue panel open/close. Uses singleton via application instances registry.
   */
  static toggle() {
    const existing = foundry.applications.instances.get("raise-my-hand-queue-panel");
    if (existing?.rendered) {
      existing.close();
    } else if (existing) {
      existing.render({ force: true });
    } else {
      new QueuePanel().render({ force: true });
    }
  }
}
