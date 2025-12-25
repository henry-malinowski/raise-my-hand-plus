const { BooleanField, NumberField, FilePathField, SchemaField, StringField, SetField } = foundry.data.fields;
const { DataModel } = foundry.abstract;
import ScopeField from "./ScopeField.mjs";

/**
 * DataModel for hand raising settings.
 * Provides schema validation, migration, and structured data access.
 *
 * @extends {foundry.abstract.DataModel}
 * @see {@link https://foundryvtt.com/api/classes/foundry.abstract.DataModel.html DataModel}
 *
 * @property {Object} general - General hand raising settings
 * @property {boolean} general.isToggle - Whether hand raising is a toggle (true) or button (false)
 * @property {Set<string>} general.notificationModes - Set of enabled notification modes: "playerList", "aural", "popout", "ui", "chat"
 * @property {Object} playerList - Player list icon settings
 * @property {"gm-only"|"all-players"} playerList.scope - Who sees the player list icon
 * @property {number} playerList.holdTime - How long to hold the icon in non-toggle mode (0-60 seconds)
 * @property {Object} aural - Sound notification settings
 * @property {"gm-only"|"all-players"} aural.scope - Who hears the sound
 * @property {"default"|"custom"} aural.source - Sound source type
 * @property {string} aural.overridePath - Custom sound file path (if source is "custom")
 * @property {number} aural.soundVolume - Sound volume percentage (1-100)
 * @property {Object} popout - Popout notification settings
 * @property {"gm-only"|"all-players"} popout.scope - Who sees the popout
 * @property {"default"|"avatar"|"custom"} popout.source - Image source type
 * @property {string} popout.overridePath - Custom image file path (if source is "custom")
 * @property {Object} ui - UI notification settings
 * @property {"gm-only"|"all-players"} ui.scope - Who sees the UI notification
 * @property {boolean} ui.permanent - Whether the notification is permanent
 * @property {Object} chat - Chat message settings
 * @property {"gm-only"|"all-players"} chat.scope - Who sees the chat message
 * @property {"none"|"default"|"avatar"|"custom"} chat.source - Image source type
 * @property {string} chat.overridePath - Custom image file path (if source is "custom")
 * @property {number} chat.widthPercentage - Image width percentage in chat (1-100)
 */
export default class HandSettingsData extends DataModel {
  /**
   * Define the schema for hand settings.
   * @returns {Object} The schema definition
   * @protected
   */
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
        }), {initial: ["playerList", "aural"]})
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
          initial: "",
          categories: ["AUDIO"]
        }),
        soundVolume: new NumberField({
          required: true,
          initial: 65,
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

  /**
   * Localization prefixes for this DataModel.
   * @type {string[]}
   */
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

