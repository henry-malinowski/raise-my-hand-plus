const MODULE_ID = 'raise-my-hand';
import * as handHandlers from "./handlers/hand.mjs";
import * as xcardHandlers from "./handlers/xcard.mjs";
import { isHandRaised } from "./socket/handlers.mjs";
import HandSettingsData from "./data/settings/HandSettingsData.mjs";
import XCardSettingsData from "./data/settings/XCardSettingsData.mjs";
import ScopeField from "./data/settings/ScopeField.mjs";

const {SceneControls} = foundry.applications.ui;
const {KeyboardManager} = foundry.helpers.interaction;

/**
 * Register the token controls for the module.
 * The hand raise/lower toggle is controlled by the "handSettings.general.isToggle" setting.
 * @param {Record<string, SceneControl>} controls - The SceneControl configurations.
 * @returns {void}
 */
export function registerTokenControls(controls) {
  const tokenControlsTools = controls['tokens'].tools;
  const handSettings = game.settings.get(MODULE_ID, "handSettings");

  /**
   * The raise hand control.
   * @description The raise hand control is a toggle if the hand settings 
   * general.isToggle is true, otherwise it is a button. It is only visible if
   * the hand settings general.notificationModes has at least one mode enabled.
   * This is to prevent the nonsense case of a ui control that has no effect.
   * @type {SceneControl}
   */
  const raiseHandControl = {
    name: 'raise-hand',
    title: 'raise-my-hand.controls.raise-hand.name',
    icon: 'fas fa-hand-paper',
    order: Object.keys(tokenControlsTools).length,
    button: !handSettings.general.isToggle,
    toggle: handSettings.general.isToggle,
    active: false, // initially deasserted, unused for button mode
    visible: handSettings.general.notificationModes.size > 0,
    ...(handSettings.general.isToggle
      ? { onChange: (event, active) => handHandlers.toggle(active) }
      : { onChange: (event, active) => handHandlers.raise() }
    ),
    toolclip: {
      src: `modules/${MODULE_ID}/assets/toolclips/tools/token-raise-hand.webm`,
      heading: "raise-my-hand.controls.raise-hand.name",
      items: SceneControls.buildToolclipItems(buildRaiseHandToolclipItems(handSettings))
    }
  };

  tokenControlsTools['raise-hand'] = raiseHandControl;

  /**
   * The x-card control. Only enabled if the x-card setting has been enabled.
   * @description The x-card control is a button that triggers the configured
   * x-card actions.
   * @type {SceneControl}
   */
  const xCardSettings = game.settings.get(MODULE_ID, "xCardSettings");
  tokenControlsTools['show-xcard'] = {
    name: 'show-xcard',
    title: 'raise-my-hand.controls.show-xcard.name',
    icon: 'fas fa-times',
    order: Object.keys(tokenControlsTools).length,
    button: true,
    visible: xCardSettings.isEnabled,
    onChange: (event, active) => xcardHandlers.showXCardDialog(),
    toolclip: {
      src: `modules/${MODULE_ID}/assets/toolclips/tools/token-xcard.webm`,
      heading: "raise-my-hand.controls.show-xcard.name",
      items: SceneControls.buildToolclipItems(buildXCardToolclipItems(xCardSettings))
    }
  };
}

/**
 * Get context menu options for lowering a player's hand from the players list.
 * @description Call back function of the 'getUserContextOptions' hook.
 * @param {Players} app - The Players application instance
 * @param {ContextMenuEntry[]} menuItems - The existing context menu options array to modify
 * @returns {void}
 */
export function getLowerHandContextOptions(app, menuItems) {
  // Add a menu item with condition and callback that checks the element
  menuItems.push({
    name: game.i18n.localize("raise-my-hand.context.lowerHand"),
    icon: '<i class="fa-solid fa-hand-paper fa-fw"></i>',
    condition: li => {
      // only show in toggle mode
      const handSettings = game.settings.get(MODULE_ID, "handSettings");
      if (!handSettings.general.isToggle) return false;

      // get the target user's ID from the list item's dataset
      const targetUserId = li.dataset.userId;
      
      // defensive check against race-condition where the user is deleted before the callback is called
      const targetUser = game.users.get(targetUserId);
      if (!targetUser) return false; 

      // only show if the user is a GM and the target user is the same as the current user
      if (!game.user.isGM && (game.user.id !== targetUserId)) return false;
      
      // Check if the hand is presently raised for the target user
      return isHandRaised(targetUserId, handSettings);
    },
    // Callback is documented as ContextMenuJQueryCallback
    // this may change in the future as FoundryVTT moves away from jQuery
    callback: li => {
      const targetUserId = li.dataset.userId;
      handHandlers.lowerForUser(targetUserId);
    }
  });
}

/**
 * Format a keybinding as HTML with Foundry styling.
 * Reuses logic from ControlsConfig.humanizeBinding but wraps parts in <span class="reference">.
 * Formats up to 2 bindings, joined with localized "or".
 * @param {string} namespace - The module namespace
 * @param {string} action - The action identifier
 * @returns {string} The formatted HTML string, or empty string if no bindings
 */
function formatKeybindingHTML(namespace, action) {
  const bindings = game.keybindings.get(namespace, action);
  if (!bindings || bindings.length === 0) return "";

  // Format a single binding
  const formatBinding = (binding) => {
    const key = binding.logicalKey ?? binding.key;
    const stringParts = binding.modifiers?.reduce((parts, part) => {
      if ( KeyboardManager.MODIFIER_CODES[part]?.includes(key) ) return parts;
      const display = KeyboardManager.getKeycodeDisplayString(part);
      parts.unshift(display);
      return parts;
    }, [KeyboardManager.getKeycodeDisplayString(key)]);
  
    return stringParts.map(part => `<span class="reference">${part}</span>`).join(" + ");
  };

  // Format up to 2 bindings
  const formattedBindings = bindings.slice(0, 2).map(formatBinding);
  
  // Join with localized "or" if there are 2 bindings
  if (formattedBindings.length === 2) {
    const orText = game.i18n.localize("raise-my-hand.controls.keybinding.or");
    return `${formattedBindings[0]} ${orText} ${formattedBindings[1]}`;
  }
  
  return formattedBindings[0];
}

/**
 * Build toolclip items for the Raise Hand tool.
 * @param {HandSettingsData} settings - The hand settings object
 * @returns {ToolclipConfigurationItem[]} The array of toolclip items
 */
function buildRaiseHandToolclipItems(settings) {
  const items = [];

  // Short Description with keybinding (if available)
  const formattedHTML = formatKeybindingHTML(MODULE_ID, "raise-hand");
  if (formattedHTML) {
    items.push({
      heading: "raise-my-hand.controls.raise-hand.toolclip.heading",
      content: formattedHTML
    });
  }

  /*
   We'd push a notification mode heading here but:
    - handlebars doesn't like an empty content item.
    - HTML heading tags are not respected by the heading template property.
    - They are respected in the content item, but the heading always appends a ':', and would look strange.
   */
  
  // Notification Mode Items
  for (const mode of settings.general.notificationModes) {
    // Get mode label from schema
    const modeLabelKey = HandSettingsData.schema.fields.general.fields.notificationModes.element.choices[mode];
    const modeLabel = game.i18n.localize(modeLabelKey);

    // Get scope - all notification settings have a scope field
    const scopeField = HandSettingsData.schema.fields[mode].fields.scope;
    const scopeLabel = game.i18n.localize(scopeField.label);

    const scopeValue = settings[mode].scope;
    const scopeChoiceKey = ScopeField._defaults.choices[scopeValue];
    const scopeChoice = game.i18n.localize(scopeChoiceKey);

    items.push({
      heading: modeLabelKey, 
      content: `${scopeLabel} ${scopeChoice}`
    });
  }
  
  return items;
}

/**
 * Build toolclip items for the X-Card tool.
 * @param {XCardSettingsData} settings - The X-Card settings object
 * @returns {ToolclipConfigurationItem[]} The array of toolclip items
 */
function buildXCardToolclipItems(settings) {
  const items = [];

  // Short Description with keybinding (if available)
  const formattedHTML = formatKeybindingHTML(MODULE_ID, "show-xcard");
  if (formattedHTML) {
    items.push({
      heading: "raise-my-hand.controls.show-xcard.toolclip.heading",
      content: formattedHTML
    });
  }
  
  // Settings Items
  // Scope
  const scopeChoiceKey = ScopeField._defaults.choices[settings.scope];
  items.push({
    heading: "raise-my-hand.settings.XCARD.FIELDS.scope.label",
    content: scopeChoiceKey
  });
  
  // Anonymous Warning
  items.push({
    heading: "raise-my-hand.settings.XCARD.FIELDS.anonymousWarning.label", 
    content: settings.anonymousWarning ? game.i18n.localize("Yes") : game.i18n.localize("No")
  });

  return items;
}
