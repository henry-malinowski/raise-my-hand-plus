const { BooleanField, NumberField, StringField, FilePathField } = foundry.data.fields;
const { DataModel } = foundry.abstract;
import ScopeField from "./ScopeField.mjs";

/**
 * DataModel for X-Card settings.
 * Provides schema validation, migration, and structured data access.
 *
 * @extends {foundry.abstract.DataModel}
 * @see {@link https://foundryvtt.com/api/classes/foundry.abstract.DataModel.html DataModel}
 *
 * @property {boolean} isEnabled - Whether X-Card functionality is enabled
 * @property {"gm-only"|"all-players"} scope - Who receives X-Card notifications
 * @property {boolean} anonymousWarning - Whether to hide the player's name in X-Card notifications
 * @property {"none"|"default"|"custom"} source - Sound source type ("none" disables sound)
 * @property {string} overridePath - Custom sound file path (if source is "custom")
 * @property {number} soundVolume - Sound volume percentage (1-100)
 */
export default class XCardSettingsData extends DataModel {
  /**
   * Define the schema for X-Card settings.
   * @returns {Object} The schema definition
   * @protected
   */
  static defineSchema() {
    return {
      isEnabled: new BooleanField({required: true, initial: false}),
      scope: new ScopeField(),
      anonymousWarning: new BooleanField({required: true, initial: false}),
      source: new StringField({
        required: true,
        blank: false,
        initial: "default",
        choices: {
          "none": "raise-my-hand.settings.XCARD.FIELDS.source.choices.none",
          "default": "raise-my-hand.settings.XCARD.FIELDS.source.choices.default",
          "custom": "raise-my-hand.settings.XCARD.FIELDS.source.choices.custom"
        }
      }),
      overridePath: new FilePathField({
        required: true,
        blank: true,
        initial: "",
        categories: ["AUDIO"]
      }),
      soundVolume: new NumberField({
        required: true,
        initial: 55,
        min: 1,
        max: 100,
        step: 1
      })
    };
  }

  /**
   * Localization prefixes for this DataModel.
   * @type {string[]}
   */
  static LOCALIZATION_PREFIXES = ["raise-my-hand.settings.XCARD"];

  /**
   * Migrate data for this DataModel.
   * Handles future schema version migrations within the DataModel.
   * @param {object} source - The source data to migrate
   * @returns {object} - The migrated data
   */
  static migrateData(source) {
    // Currently no migrations needed - return source as-is
    // Future migrations will go here
    return super.migrateData(source);
  }
}
