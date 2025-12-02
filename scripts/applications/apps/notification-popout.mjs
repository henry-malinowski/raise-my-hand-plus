const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Simple ApplicationV2 subclass for display-only popouts
 */
export default class NotificationPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "raise-my-hand-notification-popout",
    window: {
      frame: true,
      positioned: true,
      minimizable: false,
      resizable: false
    }
  };

  static PARTS = {
    content: {template: "modules/raise-my-hand/templates/apps/notification-popout.hbs"}
  };

  /**
   * Override to return empty controls array, which will hide the toggleControls button
   * @returns {ApplicationHeaderControlsEntry[]}
   * @protected
   */
  _getHeaderControls() {
    return [];
  }

  /**
   * Override to provide template data. Without this, the template would only receive {partId} instead of
   * the imagePath and name from this.options.templateData.
   * @param {ApplicationRenderOptions} options Options which configure application rendering behavior
   * @returns {Promise<object>} Context data containing templateData
   * @protected
   */
  async _prepareContext(options) {
    return this.options.templateData;
  }
}
