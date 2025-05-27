export default class HandRaiser {

  constructor() {
    this.isRaised = false;
    this.userId = game.userId;
    this.moduleName = "raise-my-hand";
    
    // socketlib
    this.socket = socketlib.registerModule(this.moduleName);       	
  	this.socket.register("sendNotification", this.sendNotification);
    //this.socket.register("shakeTheScreen", this.shakeTheScreen);    
    this.socket.register("showHandDialogForEveryone", this.showHandDialogForEveryone);    // Hand Dialog
    this.socket.register("showXCardDialogForEveryone", this.showXCardDialogForEveryone);  // X-Card  
    this.socket.register("showHandForEveryone", this.showHandForEveryone);                // SHOW HAND FOR EVERYONE
    this.socket.register("removeHandForEveryone", this.removeHandForEveryone);            // REMOVE HAND FOR EVERYONE
  }

  toggle() {
    if (game.settings.get(this.moduleName, "handToogleBehavior")) {
      if (this.isRaised) this.lower();
      else this.raise();
    } else {
      this.raise();      
    }      
  }

  async raise() {
    const id = this.userId;
    const player = game.users.get(id);
          
    if (game.settings.get(this.moduleName, "handToogleBehavior")) {
      if (this.isRaised) return;    
      this.isRaised = true;
      
      if (game.settings.get(this.moduleName, "showEmojiIndicator")) { // SHOW HAND NEXT TO PLAYER NAME
        this.socket.executeForEveryone(this.showHandForEveryone, id);              
      }
    } 
    
    // SHOW NOTIFICATION
    if (game.settings.get(this.moduleName, "showUiNotification")) {
      //let player = game.users.get(id);
      if (game.settings.get(this.moduleName, "showUiNotificationOnlyToGM")) {
        //https://github.com/manuelVo/foundryvtt-socketlib#socketexecuteforallgms
        const permanentFlag = game.settings.get(this.moduleName, "makeUiNotificationPermanent");
        this.socket.executeForAllGMs(this.sendNotification, player, permanentFlag);                    
      } else {
        //https://github.com/manuelVo/foundryvtt-socketlib#socketexecuteforeveryone
        const permanentFlag = game.settings.get(this.moduleName, "makeUiNotificationPermanent");
        this.socket.executeForEveryone(this.sendNotification, player, permanentFlag);              
      }
    }  
/*
    // SHAKE SCREEN
    if (game.settings.get(this.moduleName, "shakescreen")) {
      //https://github.com/manuelVo/foundryvtt-socketlib#socketexecuteforeveryone            
      this.socket.executeForEveryone(this.shakeTheScreen); 
    }
*/
    // ======================================
    // CHAT
    if (game.settings.get(this.moduleName, "showUiChatMessage")) {
      let imagePath;
      let chatImageWidth = game.settings.get(this.moduleName, "chatimagewidth");
      let chatData;
      const showImageChatMessage = game.settings.get(this.moduleName, "showImageChatMessage");
      let message='';
      if (showImageChatMessage) {
        if (game.settings.get(this.moduleName, "chatMessageImageUserArt")) {
          imagePath = player.avatar;
        } else {
          imagePath = game.settings.get("raise-my-hand", "chatimagepath");
        }
        message += `<label class="titulo" style="font-size:35px; color: #b02b2e;">${player.name}</label></br><label style="font-size: 15px">${game.i18n.localize("raise-my-hand.CHATMESSAGE")}</label><p><img style="vertical-align:middle" src="${imagePath}" width="${chatImageWidth}%"></p>`; 
      } else {
        message += `<label class="titulo" style="font-size:35px; color: #b02b2e;">${player.name}</label></br><label style="font-size: 15px">${game.i18n.localize("raise-my-hand.CHATMESSAGE")}</label>`; 
      }
      
      if (game.settings.get(this.moduleName, "showUiChatMessageOnlyForGM")) {
        chatData = {
          speaker: null,
          content: message,
          whisper : ChatMessage.getWhisperRecipients("GM")          
        }; // has their hand raised!
      } else {
        chatData = {
          speaker: null,
          content: message
        }; // has their hand raised!        
      }
      ChatMessage.create(chatData, {});
    } // END CHAT
  
    // SOUND
    if (game.settings.get(this.moduleName, "playSound")) {
      let userType = true;
      if (game.settings.get(this.moduleName, "playSoundGMOnly")) {
        userType = this.returnGMs(); // return the GMs IDs
      } 
      const soundVolume = game.settings.get("raise-my-hand", "warningsoundvolume");
      const mySound = game.settings.get("raise-my-hand", "warningsoundpath"); //const mySound = 'modules/raise-my-hand/assets/bell01.ogg';
      /* ... second params
      * @param {object|boolean} socketOptions  Options which only apply when emitting playback over websocket.
      *                         As a boolean, emits (true) or does not emit (false) playback to all other clients
      *                         As an object, can configure which recipients should receive the event.
      * @param {string[]} [socketOptions.recipients] An array of user IDs to push audio playback to. All users by default.
      * create an array with gms ids
      */      
      foundry.audio.AudioHelper.play({
        src: mySound,
        volume: soundVolume,
        autoplay: true,
        loop: false
      }, userType);
    } // END SOUND

    // Show dialog image
    if ( game.settings.get("raise-my-hand", "showDialogMessage") ) {      
      let imagePath;
      if (game.settings.get(this.moduleName, "chatMessageImageUserArt")) {
        imagePath = player.avatar;
      } else {
        imagePath = game.settings.get("raise-my-hand", "chatimagepath");
      }  

      //https://github.com/manuelVo/foundryvtt-socketlib#socketexecuteforeveryone            
      const dimensions = await this.getDimensions(imagePath);    
      this.socket.executeForEveryone(this.showHandDialogForEveryone, id, imagePath, dimensions);       
    }

  } // raise end ----------------------------------
  
  //-----------------------------------------------
  // Lower hand
  lower() {
    const id = this.userId;
    if (!this.isRaised) return;
    this.isRaised = false;
    if (game.settings.get(this.moduleName, "showEmojiIndicator")) {
      this.socket.executeForEveryone(this.removeHandForEveryone, id);              
    }
  }

  sendNotification(player, permanentFlag) {    
    ui.notifications.notify( '✋ ' + player.name + game.i18n.localize("raise-my-hand.UINOTIFICATION"), 'info', {permanent: permanentFlag} ); 
  }   

  showHandForEveryone(id) {       //THIS WILL ADD THE HAND
    $("[data-user-id='" + id + "'] > .player-name").append("<span class='raised-hand'>✋</span>");
  }   

  removeHandForEveryone(id) {     //THIS WILL REMOVE THE HAND
    $("[data-user-id='" + id + "'] > .player-name > .raised-hand").remove();
  }   

  //-----------------------------------------------
  // Show  dialog with hand to everyone
  async showHandDialogForEveryone(id, imagePath, dimensions) {
    const myDialogOptions = {};
    myDialogOptions['id'] = 'raise-my-hand-dialog';
    myDialogOptions['resizable'] = false;
    
    if(dimensions.width>500 || dimensions.height>500) {
      myDialogOptions['width'] = 500;
      myDialogOptions['height'] = 500;      
    } else {
      myDialogOptions['width'] = '100%';
      myDialogOptions['height'] = '100%';
    }

    const player = game.users.get(id);
    const templateData = { image_path: imagePath, player_name: player.name, player_color: player.color };
    const myContent = await renderTemplate("modules/raise-my-hand/templates/hand.html", templateData);
    
    new Dialog({
        title: player.name,
        content: myContent,
        buttons: {}
      }, myDialogOptions
    ).render(true);    
  }

  //-----------------------------------------------
  // X-Card
  async showXCardDialogForEveryone() {
    const myDialogOptions = {};
    //myDialogOptions['id'] = 'raise-my-hand-dialog';
    //myDialogOptions['resizable'] = false;
    //myDialogOptions['width'] = 370;
    //myDialogOptions['height'] = 440;
    
    const imagePath = "modules/raise-my-hand/assets/xcard.webp";
    //const templateData = { image_path: imagePath };
    //const myContent = await renderTemplate("modules/raise-my-hand/templates/xcard.html", templateData);
    
    new foundry.applications.apps.ImagePopout({
      window: {
        icon: 'fas fa-times',
        title: "Stop!",
        resizable: false,
      },
      src: imagePath,
      id: 'raise-my-hand-dialog',
    }).render({force: true});
    
/*    
    new Dialog({
        title: 'Stop!',
        content: myContent,
        buttons: {}
      }, myDialogOptions
    ).render(true);  
*/    
    // Sound X-Card
    if (game.settings.get("raise-my-hand", "xcardsound")) {      
      const soundVolume = game.settings.get("raise-my-hand", "xcardsoundvolume");
      const mySound = 'modules/raise-my-hand/assets/alarm.ogg';
      foundry.audio.AudioHelper.play({
        src: mySound,
        volume: soundVolume,
        autoplay: true,
        loop: false
      }, true);    
    } // END IF
  }
  
  //-----------------------------------------------
  // X-Card 
  async showXCardDialogForEveryoneSocket() {
    if (game.settings.get("raise-my-hand", "xcardgmonly")) {
      this.socket.executeForAllGMs(this.showXCardDialogForEveryone);
    } else {
      this.socket.executeForEveryone(this.showXCardDialogForEveryone);
    }
    
  }
  
  // 
  async getDimensions(path) {
    const fileExtension = path.split('.').pop();     
    let img = new Image();
    return await new Promise(resolve => { 
      img.onload = function() {
        resolve({width: this.width, height: this.height});
      };
      img.src = path;
    });
  }  

  //-----------------------------------------------
  // 
  async returnGMs() {
    // Obtém todos os usuários que estão atualmente conectados
    const connectedUsers = game.users.filter(user => user.active);
    
    // Filtra apenas os GMs conectados
    const connectedGMs = connectedUsers.filter(user => user.isGM);
    
    // Retorna uma lista de nomes de usuário dos GMs conectados
    return connectedGMs.map(user => user.id);
  }

/*  
  shakeTheScreen() {
    const intensity = 1;
    const duration = 500;
    const iteration = 3;
    
    if (game.modules.get('kandashis-fluid-canvas')?.active) { 
      FluidCanvas.earthquake(intensity, duration, iteration);
    } else {
      ui.notifications.error( '✋ ' + game.i18n.localize("raise-my-hand.kandashisfluidcanvas") ); //
    }       
  } 
*/

}