![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dflat-square%26url%3Dhttps%3A%2F%2Fraw.githubusercontent.com%2Fhenry-malinowski%2Fraise-my-hand-plus%2Frefs%2Fheads%2Fmain%2Fmodule.json)
![GitHub License](https://img.shields.io/github/license/henry-malinowski/raise-my-hand-plus?style=flat-square&color=blue&link=https%3A%2F%2Fgithub.com%2Fhenry-malinowski%2Fraise-my-hand-plus%3Ftab%3DGPL-3.0-1-ov-file)

# ✋ Raise My Hand
This module impliments a simple and configurable way for a player to create a notification to the GM or all players at the table.
This is implimented as a "raise hand" action or an X-Card popout if enabled.

## Features
- Rich suit of configurable options
  - Place an icon in the Player List
  - Play a customizable sound
  - Display a configurable popout in the middle of the others canvases
  - A small UI notification along the top
  - Send a chat message
  - All have individual control of if the notification is sent to GMs or all players
- [X-Card by John Stavropoulos](https://docs.google.com/document/d/1SB0jsx34bWHZWbnNIVVuMjhDkrdFGo1_hSC2BWPlI3A/edit) with similar customization options to the Hand.
- Switch between notification that toggle or act as one-shots.
- Configurable Timeout for spam prevension.
- Configurable FoundryVTT keybinding.

## Raise my Hand Buttons
<table align="center" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td width="50%" style="border: none; padding: 0;">
      <video width="100%" muted controls src="https://github.com/user-attachments/assets/dd98d019-9398-43ee-8584-5d5b01e6fae7"></video>
    </td>
    <td width="50%" style="border: none; padding: 0;">
      <video width="100%" muted controls src="https://github.com/user-attachments/assets/eeed545b-e31c-4693-b8b8-0fe77d598fc0"></video>
    </td>
  </tr>
</table>

## Main Settings
<div align="center">
  <img width="80%" src="github-assets/doc_settings.webp">
</div>

## Keybindings
<div align="center">
  <img width="80%" src="github-assets/doc_keys.webp">
</div>

## Localization
If you want to translate this module [DOWNLOAD THIS FILE](https://raw.githubusercontent.com/henry-malinowski/raise-my-hand-plus/main/lang/en.json) and translate it. 
After that open an issue sharing your translation. 

You also need to share with me the default name convention for your language. 
This is very easy to get. 
- Find a system or module which is translated to your language. 
- Open the **module.json** file.
- You should find something like the code above. It's under **languages**. Share with me **lang, name and path** for your language.
```json
{
  "lang": "en",
  "name": "English",
  "path": "lang/en.json"
},
{
  "lang": "fr",
  "name": "Français",
  "path": "lang/fr.json"
}  
```

## Community
- Do you found a bug? [Report it!](https://github.com/henry-malinowski/raise-my-hand-plus/issues)
- Do you want to send a translation? [Send it!](https://github.com/henry-malinowski/raise-my-hand-plus/issues)

# Acknowledgements
- [Mestre Digital](https://github.com/brunocalado) for maintaining this module over the years.
- [Cody Swendrowski](https://github.com/cswendrowski) for creating the [first version](https://github.com/cswendrowski/FoundryVTT-Raise-My-Hand) of this module.

# License
- Code: [LICENSE](https://github.com/henry-malinowski/raise-my-hand-plus/blob/main/LICENSE)
- Chime & X-Card warning sound: https://creativecommons.org/licenses/by/4.0/
