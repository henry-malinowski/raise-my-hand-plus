import { MODULE_ID } from "./module-id.mjs";
export { MODULE_ID };

import { default as HandConfig } from "./applications/settings/hand-config.mjs";
import { default as XCardConfig } from "./applications/settings/xcard-config.mjs";
import HandSettingsData from "./data/settings/HandSettingsData.mjs";
import XCardSettingsData from "./data/settings/XCardSettingsData.mjs";
import * as handHandlers from "./handlers/hand.mjs";
import { initSocket, getSocket, getGmQueue, getGmUrgentUsers, getGmSpeakerUserId, setGmSpeakerUserId, setGmSceneActive, broadcastQueueState } from "./socket/socket.mjs";
import { clearPlayerListIcons, reapplyQueueIndicators, updateCameraQueueBadges, removePlayerListIcon } from "./socket/handlers.mjs";
import { registerTokenControls, getLowerHandContextOptions } from "./controls.mjs";
import { registerHandlebarsHelpers } from "./applications/handlebars.mjs";
import { api } from "./api.mjs";

/**
 * The current settings era version for migration tracking.
 * Incremented when breaking changes require settings migration.
 * @type {string}
 * @private
 */
const CURRENT_ERA = "2";

// Init hooks
Hooks.once("init", init); // register handlebars helpers, settings, and keybindings
Hooks.once("socketlib.ready", initSocket); // initialize the socket object and register handlers
Hooks.once("ready", ready); // perform migration of settings if needed

// Runtime UI hooks
Hooks.on("getUserContextOptions", getLowerHandContextOptions); // get the context options for the lower hand keybinding
Hooks.on("getSceneControlButtons", registerTokenControls); // register the token controls
Hooks.on("clientSettingChanged", clientSettingChanged); // update the controls toolclip when keybindings are changed

// Queue lifecycle hooks
Hooks.on("userConnected", onUserConnected);
Hooks.on("userDisconnected", onUserDisconnected);
Hooks.on("renderPlayerList", reapplyQueueIndicators);
Hooks.on("renderCameraViews", updateCameraQueueBadges);

/**
 * Initialize the module.
 * Called during the 'init' hook to register handlebars helpers, settings, and keybindings.
 * @returns {void}
 */
function init() {
  registerHandlebarsHelpers();
  registerSettings(); // registers the modules settings as well as 'settings-era' with a default of "1"
  registerKeybindings();

  // Expose public API for other modules
  game.modules.get(MODULE_ID).api = api;
}

/**
 * Register all module settings with FoundryVTT.
 * Registers both visible settings (notificationTimeout) and hidden settings objects
 * (handSettings, xCardSettings) that are configured via dedicated menu dialogs.
 * Also registers the internal 'settings-era' setting for migration tracking.
 * @see {@link https://foundryvtt.com/api/classes/foundry.helpers.ClientSettings.html#register ClientSettings.register}
 * @see {@link https://foundryvtt.com/api/interfaces/foundry.types.SettingConfig.html SettingConfig}
 * @returns {void}
 */
function registerSettings() {
  // settings-era (internal, tracks migration state)
  // If, when the ready hook is called, the settings-era is still set to "1", the migration will be performed if other settings exist.
  // The current era is considered "2" as the first era was implicitly "1" (as there was no era system at the time of the first release)
  game.settings.register(MODULE_ID, "settings-era", {
    scope: 'world',
    config: false,
    type: String,
    default: "1",
    restricted: true
  });

  // Main settings (visible in main settings)
  game.settings.register(MODULE_ID, 'enableQueue', {
    name: "raise-my-hand.settings.enableQueue.name",
    hint: "raise-my-hand.settings.enableQueue.hint",
    scope: 'world',
    config: true,
    default: false,
    type: Boolean,
    restricted: true,
    onChange: (value) => {
      // Re-render controls so the X-card/urgent button updates
      ui.controls.render({reset: true});
      updateCameraQueueBadges();

      // Clear queue if queue was disabled
      if (!value) {
        if (game.users.activeGM?.id === game.userId) {
          const gmQueue = getGmQueue();
          gmQueue.clear();
          getGmUrgentUsers().clear();
          setGmSpeakerUserId(null);
          setGmSceneActive(false);
          broadcastQueueState();
        }
      }
    }
  });

  game.settings.register(MODULE_ID, 'notificationTimeout', {
    name: "raise-my-hand.settings.notificationTimeout.name",
    hint: "raise-my-hand.settings.notificationTimeout.hint",
    scope: 'world',
    config: true,
    default: 10,
    range: {
      min: 0,
      max: 60,
      step: 1
    },
    type: Number,
    restricted: true
  });

  game.settings.register(MODULE_ID, 'speakerIndication', {
    name: "raise-my-hand.settings.speakerIndication.name",
    hint: "raise-my-hand.settings.speakerIndication.hint",
    scope: 'world',
    config: true,
    default: true,
    type: Boolean,
    restricted: true,
    onChange: () => updateCameraQueueBadges()
  });

  game.settings.register(MODULE_ID, 'speakerIndicationPosition', {
    scope: 'client',
    config: false,
    default: null,
    type: Object,
    onChange: () => updateCameraQueueBadges()
  });

  // Hand Settings object (hidden from main config, shown in dedicated menu)
  game.settings.register(MODULE_ID, "handSettings", {
    scope: 'world',
    config: false,
    type: HandSettingsData,
    default: new HandSettingsData(),
    restricted: true,
    onChange: (value, options, userId) => {
      // Retrigger the 'getSceneControlButtons' hook to update controls
      ui.controls.render({reset: true});
      updateCameraQueueBadges();

      // if the new mode is not a toggle, clear the player list icons
      if (!value.general.isToggle) {
        const socket = getSocket();
        socket?.executeForEveryone(clearPlayerListIcons);
      }

      // Clear queue if toggle mode turned off
      if (!value.general.isToggle) {
        if (game.users.activeGM?.id === game.userId) {
          const gmQueue = getGmQueue();
          gmQueue.clear();
          getGmUrgentUsers().clear();
          setGmSpeakerUserId(null);
          setGmSceneActive(false);
          broadcastQueueState();
        }
      }
    },
  });

  // X-Card Settings object (hidden from main config, shown in dedicated menu)
  game.settings.register(MODULE_ID, "xCardSettings", {
    scope: 'world',
    config: false,
    type: XCardSettingsData,
    default: new XCardSettingsData(),
    restricted: true,
    onChange: (value, options, userId) => {
      // Retrigger the 'getSceneControlButtons' hook to update controls
      ui.controls.render({reset: true});
    },
  });

  // Register menu buttons
  game.settings.registerMenu(MODULE_ID, "handSettings", {
    name: "raise-my-hand.settings.handSettings.name",
    label: "raise-my-hand.settings.handSettings.label",
    hint: "raise-my-hand.settings.handSettings.hint",
    icon: "fa-solid fa-hand-paper",
    type: HandConfig,
    restricted: true,
  });

  game.settings.registerMenu(MODULE_ID, "xCardSettings", {
    name: "raise-my-hand.settings.xcard.name",
    label: "raise-my-hand.settings.xcard.label",
    hint: "raise-my-hand.settings.xcard.hint",
    icon: "fa-solid fa-times",
    type: XCardConfig,
    restricted: true,
  });
}

/**
 * Register keybindings for the module.
 * Registers "raise-hand" (default: H) and "show-xcard" (default: X) keybindings.
 * @returns {void}
 */
function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "raise-hand", {
    name: 'raise-my-hand.controls.raise-hand.name',  
    hint: 'raise-my-hand.controls.raise-hand.hint',
    editable: [{ key: "KeyH", modifiers: []}],
    onDown: (context) => {
      const tool = ui.controls.controls["tokens"].tools["raise-hand"];
      return handHandlers.handleRaiseHandKeybinding(tool, context.event);
    },
    reservedModifiers: []
  });

  game.keybindings.register(MODULE_ID, "show-xcard", {
    name: 'raise-my-hand.controls.show-xcard.name',
    hint: 'raise-my-hand.controls.show-xcard.hint',
    editable: [{ key: "KeyX", modifiers: []}],
    onDown: (context) => {
      const tool = ui.controls.controls["tokens"].tools["show-xcard"];
      if (!tool) return; // this can happen if the control is not registered yet or all modes are disabled

      tool.onChange(context.event, true);
    },
    reservedModifiers: []
  });  

  game.keybindings.register(MODULE_ID, "snatch-spotlight", {
    name: 'raise-my-hand.controls.snatch-spotlight.name',
    hint: 'raise-my-hand.controls.snatch-spotlight.hint',
    editable: [{ key: "Space", modifiers: []}],
    onDown: (context) => {
      if (context.event?.repeat) return false;
      const handled = handHandlers.snatchSpotlight();
      return handled;
    },
    reservedModifiers: []
  });

  game.keybindings.register(MODULE_ID, "delay-spotlight", {
    name: 'raise-my-hand.controls.delay-spotlight.name',
    hint: 'raise-my-hand.controls.delay-spotlight.hint',
    editable: [{ key: "Space", modifiers: ["Shift"]}],
    onDown: (context) => {
      if (context.event?.repeat) return false;
      const handled = handHandlers.delaySpotlight();
      return handled;
    },
    reservedModifiers: []
  });
}

/**
 * Perform migration of settings if needed.
 * Called during the 'ready' hook. Checks the settings-era and migrates if necessary.
 * @returns {Promise<void>}
 */
async function ready() {
  // Check if migration is needed and perform it if so
  const era = game.settings.get(MODULE_ID, "settings-era");

  // This is the only place module era is used.
  // Future migration will be handled by the DataModel migration process.
  if (foundry.utils.isNewerVersion(CURRENT_ERA, era)) {
    await migrateSettings();
  }

  // Migrate enableQueue from handSettings.general to top-level setting
  await migrateEnableQueue();
}

/**
 * Migrate old settings values to new format.
 * Converts legacy flat settings structure to the new DataModel-based structure.
 * Maps old boolean and string settings to the new HandSettingsData and XCardSettingsData schemas.
 * Runs in ready hook as a single serial process.
 * @returns {Promise<void>}
 */
async function migrateSettings() {
  console.log(`${MODULE_ID} | Migrating settings to era ${CURRENT_ERA}`);

  const modulePrefix = `${MODULE_ID}.`;
  const oldSettings = {};

  // Get all old settings directly from storage
  // This is more efficient than iterating registered settings and works for unregistered settings during migration
  const worldSettings = game.settings.storage.get("world");
  for (const [fullKey, value] of worldSettings.entries()) {
    if (fullKey.startsWith(modulePrefix)) {
      const key = fullKey.substring(modulePrefix.length);
      oldSettings[key] = value;
    }
  }

  // Early return if no settings to migrate
  if (Object.keys(oldSettings).length === 0) {
    await game.settings.set(MODULE_ID, "settings-era", CURRENT_ERA);
    console.log(`${MODULE_ID} | No settings to migrate`);
    return;
  }

  console.log(`${MODULE_ID} | Migrating ${Object.keys(oldSettings).length} settings`);
  
  // Map old settings to new schema structure for Hand Settings
  const handData = {
    general: {
      isToggle: oldSettings.handToogleBehavior ?? true,
      notificationModes: new Set([
        (oldSettings.showEmojiIndicator ?? true) && "playerList",
        oldSettings.showDialogMessage && "popout",
        (oldSettings.playSound ?? true) && "aural",
        oldSettings.showUiNotification && "ui",
        oldSettings.showUiChatMessage && "chat"
      ].filter(m => m))
    },
    playerList: {
      scope: "all-players", // new setting, options didn't previously exist
      holdTime: 10 // new setting, didn't previously exist
    },
    aural: {
      scope: oldSettings.playSoundGMOnly ? "gm-only" : "all-players",
      // if path was not the default, set source to custom
      source: (oldSettings.warningsoundpath && oldSettings.warningsoundpath !== "modules/raise-my-hand/assets/bell01.ogg") ? "custom" : "default", // new setting
      overridePath: (oldSettings.warningsoundpath && oldSettings.warningsoundpath !== "modules/raise-my-hand/assets/bell01.ogg") ? oldSettings.warningsoundpath : "", // new setting, default is empty string, else the custom path
      soundVolume: Math.max(1, Math.round((oldSettings.warningsoundvolume ?? 0.65) * 100))  // Convert to percentage, min 1%, default 65%
    },
    popout: {
      scope: "all-players",
      source: (!oldSettings.showImageChatMessage) ? "default" : (oldSettings.chatMessageImageUserArt ? "avatar" : "custom"),
      overridePath: oldSettings.chatimagepath ?? ""
    },
    ui: {
      scope: oldSettings.showUiNotificationOnlyToGM ? "gm-only" : "all-players",
      permanent: oldSettings.makeUiNotificationPermanent ?? false
    },
    chat: {
      scope: oldSettings.showUiChatMessageOnlyForGM ? "gm-only" : "all-players",
      source: (!oldSettings.showImageChatMessage) ? 
        "none" : (oldSettings.chatMessageImageUserArt ? "avatar" : "custom"),
      overridePath: (oldSettings.chatimagepath && oldSettings.chatimagepath !== "modules/raise-my-hand/assets/hand.svg") ? oldSettings.chatimagepath : "",
      widthPercentage: oldSettings.chatimagewidth ?? 85
    }
  };

  // Map old settings to new schema structure for X-Card Settings
  const xCardData = {
    isEnabled: oldSettings.xcard ?? false,
    scope: oldSettings.xcardgmonly ? "gm-only" : "all-players",
    anonymousWarning: oldSettings.xcardAnonymousMode ?? false,
    source: oldSettings.xcardsound ? "default" : "none",
    soundVolume: Math.max(1, Math.round((oldSettings.xcardsoundvolume ?? 0.55) * 100))  // Convert to percentage, min 1%, default 55%
  };

  // Instantiate models with specific candidate data (invalid data should be ignored by the cleaning process in the DataModel)
  const handSettings = new HandSettingsData(handData);
  const xCardSettings = new XCardSettingsData(xCardData);

  // Save settings
  await Promise.all([
    game.settings.set(MODULE_ID, "handSettings", handSettings.toObject()),
    game.settings.set(MODULE_ID, "xCardSettings", xCardSettings.toObject()),
    game.settings.set(MODULE_ID, "settings-era", CURRENT_ERA)
  ]);
  
  ui.notifications.info(`✋ ${MODULE_ID} | Settings migration complete.`);
}

/**
 * Migrate enableQueue from handSettings.general to a top-level module setting.
 * Reads the raw stored value and copies it if present, then re-saves handSettings
 * so the DataModel's migrateData strips the old field.
 * Only runs once — after migration, the raw value no longer contains enableQueue.
 * @returns {Promise<void>}
 */
async function migrateEnableQueue() {
  if (!game.user.isGM) return;

  // Read the raw stored object (before DataModel cleaning)
  const worldSettings = game.settings.storage.get("world");
  const raw = worldSettings.get(`${MODULE_ID}.handSettings`);
  if (!raw?.general || !("enableQueue" in raw.general)) return;

  console.log(`${MODULE_ID} | Migrating enableQueue to top-level setting`);

  // Copy the old value to the new top-level setting
  if (raw.general.enableQueue) {
    await game.settings.set(MODULE_ID, "enableQueue", true);
  }

  // Re-save handSettings so DataModel.migrateData strips the old field
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  await game.settings.set(MODULE_ID, "handSettings", handSettings.toObject());
}

/**
 * When a user connects, if we are the active GM, broadcast the current queue state
 * so the new client receives the queue.
 * @param {User} user - The user who connected
 * @param {object} context - Connection context
 * @returns {void}
 */
function onUserConnected(user, context) {
  if (game.users.activeGM?.id !== game.userId) return;

  // Always broadcast queue state so the new client receives it
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle) {
    broadcastQueueState();
  }
}

/**
 * When a user disconnects, if we are the active GM, clean up their raised hand
 * indicators and remove them from the queue (if queue mode is active).
 * @param {User} user - The user who disconnected
 * @param {object} context - Connection context
 * @returns {void}
 */
function onUserDisconnected(user, context) {
  if (game.users.activeGM?.id !== game.userId) return;

  // Always clean up raised hand indicators for the disconnected user
  const socket = getSocket();
  socket?.executeForEveryone(removePlayerListIcon, user.id);

  // Clean up queue state if queue mode is active
  const handSettings = game.settings.get(MODULE_ID, "handSettings");
  if (game.settings.get(MODULE_ID, "enableQueue") && handSettings.general.isToggle) {
    const gmQueue = getGmQueue();
    if (gmQueue.remove(user.id)) {
      getGmUrgentUsers().delete(user.id);
      if (getGmSpeakerUserId() === user.id) setGmSpeakerUserId(null);
      broadcastQueueState();
    }
  }
}

/**
 * Update controls toolclip when keybindings are changed.
 * Called when client settings change. Re-renders controls if keybindings for this module were modified.
 * @param {string} setting - The setting that changed
 * @param {*} value - The desired setting value
 * @param {object} options - Additional options passed as part of the setting change request
 * @returns {void}
 */
function clientSettingChanged(setting, value, options) {
  if ( setting === "core.keybindings" && Object.keys(value).some(k => k.startsWith(MODULE_ID)) ) {
    ui.controls.render({reset: true});
  }
}
