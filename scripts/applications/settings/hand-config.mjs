import { MODULE_ID } from "../../raise-my-hand.mjs";

const {ApplicationV2, HandlebarsApplicationMixin} = foundry.applications.api;
const {FormDataExtended} = foundry.applications.ux;
import HandSettingsData from "../../data/settings/HandSettingsData.mjs";

export default class HandConfig extends HandlebarsApplicationMixin(ApplicationV2) {

  /** @inheritDoc */
  static DEFAULT_OPTIONS = {
    id: "hand-settings-config",
    tag: "form",
    window: {
      title: "raise-my-hand.settings.handSettings.name",
      contentClasses: ["standard-form"]
    },
    form: {
      closeOnSubmit: true,
      handler: HandConfig.#onSubmit
    },
    position: {width: 540},
    actions: {
      reset: HandConfig.#onReset
    }
  };

  /** @override */
  static PARTS = {
    form: {
      template: "modules/raise-my-hand/templates/settings/menus/hand-config.hbs",
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
    if ( !HandConfig.#localized ) {
      foundry.helpers.Localization.localizeDataModel({schema: HandSettingsData.schema}, {
        prefixes: ["raise-my-hand.settings.HAND"]
      });
      
      HandConfig.#localized = true;
    }
  }

  /**
   * The data schema for hand settings.
   * @type {SchemaField}
   */
  static get schema() {
    return HandSettingsData.schema;
  }

  /**
   * The current setting value
   * @type {HandSettingsData}
   */
  #setting;

  /* -------------------------------------------- */

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    if ( options.isFirstRender ) {
      this.#setting = game.settings.get(MODULE_ID, "handSettings");
    }
    
    return {
      setting: this.#setting,
      fields: HandSettingsData.schema.fields,
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
    this.#setting = HandConfig.#cleanFormData(formData);
    this.render();
  }

  /**
   * Clean the form data using the schema.
   * @param {FormDataExtended} formData
   * @returns {HandSettingsData}
   */
  static #cleanFormData(formData) {
    const expanded = foundry.utils.expandObject(formData.object);
    // Form data may have the setting key prefix or just the schema structure
    const data = expanded.handSettings ?? expanded;
    return new HandSettingsData(data);
  }

  /* -------------------------------------------- */

  /**
   * Submit the configuration form.
   * @this {HandConfig}
   * @param {SubmitEvent} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   * @returns {Promise<void>}
   */
  static async #onSubmit(event, form, formData) {
    this.#setting = HandConfig.#cleanFormData(formData);
    await game.settings.set(MODULE_ID, "handSettings", this.#setting);
  }

  /* -------------------------------------------- */

  /**
   * Reset the form back to default values (UI only, doesn't save).
   * @this {HandConfig}
   * @param {InputEvent} event
   * @returns {Promise<void>}
   */
  static async #onReset(event) {
    this.#setting = new HandSettingsData();
    await this.render({force: false});
  }
}
