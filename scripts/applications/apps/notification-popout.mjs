const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Simple ApplicationV2 subclass for display-only popouts.
 * Used for both hand-raising and X-Card notifications.
 * @extends {foundry.applications.api.ApplicationV2}
 * @see {@link https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html ApplicationV2}
 * @see {@link https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html HandlebarsApplicationMixin}
 */
export default class NotificationPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Default application options.
   * @type {ApplicationOptions}
   */
  static DEFAULT_OPTIONS = {
    id: "raise-my-hand-notification-popout",
    window: {
      frame: true,
      positioned: true,
      minimizable: false,
      resizable: false
    }
  };

  /**
   * Application parts configuration.
   * @type {Object}
   */
  static PARTS = {
    content: {template: "modules/raise-my-hand/templates/apps/notification-popout.hbs"}
  };

  /**
   * Override to return empty controls array, which will hide the toggleControls button
   * @returns {foundry.applications.types.ApplicationHeaderControlsEntry[]}
   * @protected
   * @see {@link https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationHeaderControlsEntry.html ApplicationHeaderControlsEntry}
   */
  _getHeaderControls() {
    return [];
  }

  /**
   * Override to provide template data. Without this, the template would only receive {partId} instead of
   * the imagePath and name from this.options.templateData.
   * @param {foundry.applications.types.ApplicationRenderOptions} options - Options which configure application rendering behavior
   * @returns {Promise<object>} Context data containing templateData
   * @protected
   * @see {@link https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderOptions.html ApplicationRenderOptions}
   */
  async _prepareContext(options) {
    return this.options.templateData;
  }
}
