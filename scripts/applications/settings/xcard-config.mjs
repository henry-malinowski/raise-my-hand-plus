import { MODULE_ID } from "../../raise-my-hand.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {FormDataExtended} = foundry.applications.ux;
import XCardSettingsData from "../../data/settings/XCardSettingsData.mjs";

export default class XCardConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
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

  /** @override */
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

  /** @inheritDoc */
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
   * The current setting value
   * @type {XCardSettingsData}
   */
  #setting;

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /** @override */
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

  /** @override */
  _onChangeForm(formConfig, event) {
    const formData = new FormDataExtended(this.form);
    this.#setting = XCardConfig.#cleanFormData(formData);
    this.render();
  }

  /**
   * Clean the form data using the schema.
   * @param {FormDataExtended} formData
   * @returns {XCardSettingsData}
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
