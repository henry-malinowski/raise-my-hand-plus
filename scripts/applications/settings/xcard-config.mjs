import { MODULE_ID } from "../../raise-my-hand.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {FormDataExtended} = foundry.applications.ux;
import XCardSettingsData from "../../data/settings/XCardSettingsData.mjs";

/**
 * Settings configuration application for X-Card settings.
 * Provides a form-based UI for configuring X-Card notifications and options.
 * @extends {foundry.applications.api.ApplicationV2}
 * @see {@link https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html ApplicationV2}
 * @see {@link https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html HandlebarsApplicationMixin}
 */
export default class XCardConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  /**
   * Default application options.
   * @type {ApplicationOptions}
   * @inheritDoc
   */
  static DEFAULT_OPTIONS = {
    id: "xcard-settings-config",
    tag: "form",
    window: {
      title: "raise-my-hand.settings.xcard.name",
      contentClasses: ["standard-form"]
    },
    form: {
      closeOnSubmit: true,
      handler: XCardConfig.#onSubmit
    },
    position: {width: 540},
    actions: {
      reset: XCardConfig.#onReset
    }
  };

  /**
   * Application parts configuration.
   * @type {Object}
   * @override
   */
  static PARTS = {
    form: {
      template: "modules/raise-my-hand/templates/settings/menus/xcard-config.hbs",
      scrollable: [""]
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  /**
   * Track whether this class has been localized.
   * @type {boolean}
   */
  static #localized = false;

  /**
   * Prepare the first render by localizing the schema.
   * @param {foundry.applications.types.ApplicationRenderContext} context - The render context
   * @param {foundry.applications.types.ApplicationRenderOptions} options - Render options
   * @returns {Promise<void>}
   * @protected
   * @inheritDoc
   * @see {@link https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderContext.html ApplicationRenderContext}
   * @see {@link https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderOptions.html ApplicationRenderOptions}
   */
  async _preFirstRender(context, options) {
    await super._preFirstRender(context, options);
    if ( !XCardConfig.#localized ) {
      foundry.helpers.Localization.localizeDataModel({schema: XCardSettingsData.schema}, {
        prefixes: ["raise-my-hand.settings.XCARD"]
      });
      XCardConfig.#localized = true;
    }
  }

  /**
   * The data schema for X-Card settings.
   * @type {SchemaField}
   */
  static get schema() {
    return XCardSettingsData.schema;
  }

  /**
   * The current setting value being edited.
   * @type {XCardSettingsData}
   * @private
   */
  #setting;

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /**
   * Prepare the context data for rendering.
   * @param {foundry.applications.types.ApplicationRenderOptions} options - Render options
   * @returns {Promise<Object>} The context data with setting, fields, and buttons
   * @protected
   * @override
   * @see {@link https://foundryvtt.com/api/interfaces/foundry.applications.types.ApplicationRenderOptions.html ApplicationRenderOptions}
   */
  async _prepareContext(options) {
    if ( options.isFirstRender ) {
      this.#setting = game.settings.get(MODULE_ID, "xCardSettings");
    }
    
    return {
      setting: this.#setting,
      fields: XCardSettingsData.schema.fields,
      buttons: [
        {type: "reset", label: "Reset", icon: "fa-solid fa-arrow-rotate-left", action: "reset"},
        {type: "submit", label: "Save Changes", icon: "fa-solid fa-floppy-disk"}
      ]
    };
  }

  /* -------------------------------------------- */

  /**
   * Handle form change events.
   * Updates the setting from form data and re-renders the form.
   * @param {Object} formConfig - The form configuration
   * @param {Event} event - The change event
   * @protected
   * @override
   */
  _onChangeForm(formConfig, event) {
    const formData = new FormDataExtended(this.form);
    this.#setting = XCardConfig.#cleanFormData(formData);
    this.render();
  }

  /**
   * Clean the form data using the schema.
   * Expands the form data object and creates a new XCardSettingsData instance.
   * @param {foundry.applications.ux.FormDataExtended} formData - The form data to clean
   * @returns {XCardSettingsData} A new XCardSettingsData instance with cleaned data
   * @private
   * @see {@link https://foundryvtt.com/api/classes/foundry.applications.ux.FormDataExtended.html FormDataExtended}
   */
  static #cleanFormData(formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    // Form data may have the setting key prefix or just the schema structure
    const data = expanded.xCardSettings ?? expanded;
    return new XCardSettingsData(data);
  }

  /* -------------------------------------------- */

  /**
   * Submit the configuration form.
   * @this {XCardConfig}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    this.#setting = XCardConfig.#cleanFormData(formData);
    await game.settings.set(MODULE_ID, "xCardSettings", this.#setting);
  }

  /* -------------------------------------------- */

  /**
   * Reset the form back to default values (UI only, doesn't save).
   * @this {XCardConfig}
   * @param {InputEvent} event
   * @returns {Promise<void>}
   */
  static async #onReset(event) {
    this.#setting = new XCardSettingsData();
    await this.render({force: false});
  }
}
