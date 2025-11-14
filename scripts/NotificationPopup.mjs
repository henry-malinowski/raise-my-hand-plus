const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/**
 * Simple ApplicationV2 subclass for display-only popups
 */
export default class NotificationPopup extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "raise-my-hand-notification-popup",
    window: {
      frame: true,
      positioned: true,
      minimizable: false,
      resizable: false
    }
  };

  static PARTS = {
    content: {template: "modules/raise-my-hand/templates/NotificationPopup.hbs"}
  };

  /**
   * Override to return empty controls array, which will hide the toggleControls button
   * @returns {ApplicationHeaderControlsEntry[]}
   * @protected
   */
  _getHeaderControls() {
    return [];
  }

  async _prepareContext(options) {
    return this.options.templateData;
  }
}
