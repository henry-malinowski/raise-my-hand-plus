import * as HandRaiser from "./HandRaiser.mjs";

export const MODULE_ID = 'raise-my-hand';
export let socket;


Hooks.once("init", () => {
  registerSettings();
  registerKeybindings();
});

Hooks.on("getSceneControlButtons", registerTokenControls);
Hooks.on("socketlib.ready", registerSocketCallbacks);

/**
 * Register the keybindings for the module.
 * @returns {void}
 */
function registerKeybindings() {
  game.keybindings.register(MODULE_ID, "raiseHand", {
    name: 'Raise Hand',
    hint: 'Toggle Raise Hand',
    editable: [{ key: "KeyH", modifiers: []}],
    onDown: (context) => HandRaiser.raiseHand(),
    reservedModifiers: []
  });

  game.keybindings.register(MODULE_ID, "xCard", {
    name: 'X-Card',
    hint: 'This will display the X-Card.',
    editable: [{ key: "KeyX", modifiers: []}],
    onDown: (context) => {
      if (game.settings.get(MODULE_ID, "xcard")) {
        HandRaiser.showXCardDialog();
      }
    },
    reservedModifiers: []
  });  
}

/**
 * Register the settings for the module.
 * @returns {void}
 */
function registerSettings() {
  game.settings.register(MODULE_ID, "handToogleBehavior", {
    name: "raise-my-hand.settings.handtooglebehavior.name", // "Should a raised hand be displayed in the Players list?"
    hint: "raise-my-hand.settings.handtooglebehavior.hint", // "Should a raised hand be displayed in the Players list?"
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
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
    type: Number
  });

  game.settings.register(MODULE_ID, "showEmojiIndicator", {
    name: "raise-my-hand.settings.displayhand.name", // "Should a raised hand be displayed in the Players list?"
    hint: "raise-my-hand.settings.displayhand.hint", // "Should a raised hand be displayed in the Players list?"
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "showUiNotification", {
    name: "raise-my-hand.settings.showuinotification.name", // "Should a raised hand display a UI notification when raised?",
    hint: "raise-my-hand.settings.showuinotification.hint", // "Should a raised hand display a UI notification when raised?",    
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "makeUiNotificationPermanent", {
    name: "raise-my-hand.settings.makeuinotificationpermanent.name", 
    hint: "raise-my-hand.settings.makeuinotificationpermanent.hint", 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register(MODULE_ID, "showUiNotificationOnlyToGM", {
    name: "raise-my-hand.settings.showuinotificationonlytogm.name", 
    hint: "raise-my-hand.settings.showuinotificationonlytogm.hint", 
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });  

  game.settings.register(MODULE_ID, "showUiChatMessage", {
    name: "raise-my-hand.settings.showuichatmessage.name",
    hint: "raise-my-hand.settings.showuichatmessage.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "showUiChatMessageOnlyForGM", {
    name: "raise-my-hand.settings.showuichatmessageonlyforgm.name",
    hint: "raise-my-hand.settings.showuichatmessageonlyforgm.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "showImageChatMessage", {
    name: "raise-my-hand.settings.showimagechatmessage.name",
    hint: "raise-my-hand.settings.showimagechatmessage.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });
  
  game.settings.register(MODULE_ID, 'chatimagepath', {
    name: "raise-my-hand.settings.chatimagepath.name",
    hint: "raise-my-hand.settings.chatimagepath.hint",
    scope: 'world',
    config: true,
    default: 'modules/raise-my-hand/assets/hand.svg',
    type: String,
    filePicker: 'imagevideo'
  }); 
  
  game.settings.register(MODULE_ID, 'chatimagewidth', {
    name: "raise-my-hand.settings.chatimagewidth.name",
    hint: "raise-my-hand.settings.chatimagewidth.hint",
    scope: 'world',
    config: true,
    default: 100,
    range: {
      min: 20,
      max: 100,
      step: 5
    },    
    type: Number
  }); 

  game.settings.register(MODULE_ID, "chatMessageImageUserArt", {
    name: "raise-my-hand.settings.chatmessageimageuserart.name",
    hint: "raise-my-hand.settings.chatmessageimageuserart.name",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register(MODULE_ID, "showDialogMessage", {
    name: "raise-my-hand.settings.showdialogmessage.name",
    hint: "raise-my-hand.settings.showdialogmessage.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register(MODULE_ID, "playSound", {
    name: "raise-my-hand.settings.playsound.name",
    hint: "raise-my-hand.settings.playsound.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "playSoundGMOnly", {
    name: "raise-my-hand.settings.playsoundgmonly.name",
    hint: "raise-my-hand.settings.playsoundgmonly.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });
  
  game.settings.register(MODULE_ID, 'warningsoundpath', {
    name: "raise-my-hand.settings.warningsoundpath.name",
    hint: "raise-my-hand.settings.warningsoundpath.hint",
    scope: 'world',
    config: true,
    default: 'modules/raise-my-hand/assets/bell01.ogg',
    type: String,
    filePicker: 'audio'
  });  
  
  game.settings.register(MODULE_ID, 'warningsoundvolume', {
    name: "raise-my-hand.settings.warningsoundvolume.name",
    hint: "raise-my-hand.settings.warningsoundvolume.hint",
    scope: 'world',
    config: true,
    default: 0.6,
    range: {
      min: 0.2,
      max: 1,
      step: 0.1
    },     
    type: Number
  });

  game.settings.register(MODULE_ID, "xcard", {
    name: "raise-my-hand.settings.xcard.name",
    hint: "raise-my-hand.settings.xcard.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  game.settings.register(MODULE_ID, "xcardAnonymousMode", {
    name: "raise-my-hand.settings.xcardAnonymousMode.name",
    hint: "raise-my-hand.settings.xcardAnonymousMode.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "xcardgmonly", {
    name: "raise-my-hand.settings.xcardgmonly.name",
    hint: "raise-my-hand.settings.xcardgmonly.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "xcardsound", {
    name: "raise-my-hand.settings.xcardsound.name",
    hint: "raise-my-hand.settings.xcardsound.hint",
    scope: 'world',
    config: true,
    type: Boolean,
    default: true
  });  

  game.settings.register(MODULE_ID, 'xcardsoundvolume', {
    name: "raise-my-hand.settings.xcardsoundvolume.name",
    hint: "raise-my-hand.settings.xcardsoundvolume.hint",
    scope: 'world',
    config: true,
    default: 0.6,
    range: {
      min: 0.1,
      max: 1,
      step: 0.1
    },
    type: Number
  });
}

/**
 * Register the token controls for the module.
 * The hand raise/lower toggle is controlled by the "handToogleBehavior" setting.
 * @param {Record<string, SceneControl>} controls - The SceneControl configurations.
 * @returns {void}
 */
function registerTokenControls(controls) {
  const tokenControlsTools = controls['tokens'].tools;
  const toggles = game.settings.get(MODULE_ID, "handToogleBehavior");

  tokenControlsTools['raise-hand'] = {
    name: 'raise-hand',
    title: '✋Raise My Hand',
    icon: 'fas fa-hand-paper',
    order: Object.keys(tokenControlsTools).length,
    button: !toggles,
    toggle: toggles,
    visible: true,
    onChange: (event, active) => toggles ? HandRaiser.toggle(active) : HandRaiser.raiseHand(),
  };

  tokenControlsTools['x-card'] = {
    name: 'x-card',
    title: 'X-Card',
    icon: 'fas fa-times',
    order: Object.keys(tokenControlsTools).length,
    button: true,
    visible: game.settings.get(MODULE_ID, "xcard"),
    onChange: () => HandRaiser.showXCardDialog(),
  };
}

/**
 * Register the socket callbacks for the module.
 * @returns {void}
 */
function registerSocketCallbacks() {
  socket = socketlib.registerModule(MODULE_ID);
  socket.register("createUiNotificationSocket", HandRaiser.createUiNotificationSocket);
  socket.register("appendEmojiHandSocket", HandRaiser.appendEmojiHandSocket);
  socket.register("removeEmojiHandSocket", HandRaiser.removeEmojiHandSocket);
  socket.register("createHandPopupSocket", HandRaiser.createHandPopupSocket);
  socket.register("closeHandPopupSocket", HandRaiser.closeHandPopupSocket);
  socket.register("createXCardPopupSocket", HandRaiser.createXCardPopupSocket);
}
