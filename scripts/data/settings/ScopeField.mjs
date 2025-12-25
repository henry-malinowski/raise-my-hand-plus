const { StringField } = foundry.data.fields;

/**
 * A custom StringField that pre-configures the common scope choices used throughout the module.
 * Scope options are: "all-players" (all players see/hear the notification) or "gm-only" (only GMs see/hear it).
 * @extends {foundry.data.fields.StringField}
 * @see {@link https://foundryvtt.com/api/classes/foundry.data.fields.StringField.html StringField}
 */
export default class ScopeField extends StringField {
  /**
   * Get the default field configuration with scope choices.
   * @returns {Object} The default field configuration
   * @protected
   */
  static get _defaults() {
    return Object.assign(super._defaults, {
      required: true,
      blank: false,
      initial: "all-players",
      choices: {
        "all-players": "raise-my-hand.settings.FIELDS.choices.all",
        "gm-only": "raise-my-hand.settings.FIELDS.choices.gm",
      }
    });
  }

  /**
   * Localization prefixes for this field.
   * @type {string[]}
   */
  static LOCALIZATION_PREFIXES = ["raise-my-hand.settings.FIELDS.choices"];
}
