const { BooleanField, NumberField, StringField, FilePathField } = foundry.data.fields;
const { DataModel } = foundry.abstract;
import ScopeField from "./ScopeField.mjs";

/**
 * DataModel for X-Card settings.
 * Provides schema validation, migration, and structured data access.
 *
 * @property {boolean} isEnabled
 * @property {"gm-only"|"all-players"} scope
 * @property {boolean} anonymousWarning
 * @property {"none"|"default"|"custom"} source
 * @property {string} overridePath
 * @property {number} soundVolume
 */
export default class XCardSettingsData extends DataModel {
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
        initial: 60,
        min: 1,
        max: 100,
        step: 1
      })
    };
  }

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
