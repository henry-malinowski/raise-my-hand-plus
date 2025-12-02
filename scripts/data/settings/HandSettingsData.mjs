const { BooleanField, NumberField, FilePathField, SchemaField, StringField, SetField } = foundry.data.fields;
const { DataModel } = foundry.abstract;
import ScopeField from "./ScopeField.mjs";

/**
 * DataModel for hand raising settings.
 * Provides schema validation, migration, and structured data access.
 *
 * @property {Object} general
 * @property {string} chat.overridePath
 * @property {number} chat.widthPercentage
 */
export default class HandSettingsData extends DataModel {
  static defineSchema() {
    return {
      general: new SchemaField({
        isToggle: new BooleanField({required: true, initial: true}),
        notificationModes: new SetField(new StringField({
          choices: {
            "playerList": "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.playerList",
            "aural": "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.aural",
            "popout": "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.popout",
            "ui": "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.ui",
            "chat": "raise-my-hand.settings.HAND.FIELDS.general.notificationModes.choices.chat"
          }
        }), {initial: ["playerList"]})
      }),
      playerList: new SchemaField({
        scope: new ScopeField(),
        holdTime: new NumberField({required: true, initial: 10, min: 0, max: 60, step: 1})
      }),
      aural: new SchemaField({
        scope: new ScopeField(),
        source: new StringField({
          required: true,
          blank: false,
          initial: "default",
          choices: {
            "default": "raise-my-hand.settings.HAND.FIELDS.aural.source.choices.default",
            "custom": "raise-my-hand.settings.HAND.FIELDS.aural.source.choices.custom"
          }
        }),
        overridePath: new FilePathField({
          required: true,
          blank: true,
          initial: "modules/raise-my-hand/assets/sounds/bell01.ogg",
          categories: ["AUDIO"]
        }),
        soundVolume: new NumberField({
          required: true,
          initial: 60,
          min: 1,
          max: 100,
          step: 1
        })
      }),
      popout: new SchemaField({
        scope: new ScopeField(),
        source: new StringField({
          required: true,
          blank: false,
          initial: "default",
          choices: {
            "default": "raise-my-hand.settings.HAND.FIELDS.popout.source.choices.default",
            "avatar": "raise-my-hand.settings.HAND.FIELDS.popout.source.choices.avatar",
            "custom": "raise-my-hand.settings.HAND.FIELDS.popout.source.choices.custom"
          }
        }),
        overridePath: new FilePathField({
          required: true,
          blank: true,
          initial: "",
          categories: ["IMAGE"]
        })
      }),
      ui: new SchemaField({
        scope: new ScopeField(),
        permanent: new BooleanField({required: true, initial: false})
      }),
      chat: new SchemaField({
        scope: new ScopeField(),
        source: new StringField({
          required: true,
          blank: false,
          initial: "none",
          choices: {
            "none": "raise-my-hand.settings.HAND.FIELDS.chat.source.choices.disabled",
            "default": "raise-my-hand.settings.HAND.FIELDS.chat.source.choices.default",
            "avatar": "raise-my-hand.settings.HAND.FIELDS.chat.source.choices.avatar",
            "custom": "raise-my-hand.settings.HAND.FIELDS.chat.source.choices.custom"
          }
        }),
        overridePath: new FilePathField({
          required: true,
          blank: true,
          initial: "",
          categories: ["IMAGE"]
        }),
        widthPercentage: new NumberField({
          required: true,
          initial: 85,
          min: 1,
          max: 100,
          step: 1
        })
      })
    };
  }

  static LOCALIZATION_PREFIXES = ["raise-my-hand.settings.HAND"];

  /**
   * Migrate data for this DataModel.
   * Handles future schema version migrations within the DataModel.
   * @param {object} source - The source data to migrate
   * @returns {object} - The migrated data
   */
  static migrateData(source) {
    // Currently no migrations needed - return source as-is
    // Future migrations will be added here
    return super.migrateData(source);
  }
}

