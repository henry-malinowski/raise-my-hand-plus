const { StringField } = foundry.data.fields;

/**
 * A custom StringField that pre-configures the common scope choices used throughout the module.
 * Scope options are: "all-players", "gm-only"
 */
export default class ScopeField extends StringField {
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

  static LOCALIZATION_PREFIXES = ["raise-my-hand.settings.FIELDS.choices"];
}
