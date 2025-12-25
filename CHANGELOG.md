## 3.0.0
### General Changes
- Migrated to esbuild bundling for improved load times. In spite of all the new features and upgrades, data sent to clients in a single-file, cutting down on successive HTTP requests.
    - Source maps provided for debugging
- Keybinding now route or pseudo-route through UI control handlers for consistant behavior (fixes [issue #26](https://github.com/henry-malinowski/raise-my-hand-plus/issues/26))

### Overhauled Settings system
- *Technical:* Settings are now stored in [`DataModels`](https://foundryvtt.com/api/classes/foundry.abstract.DataModel.html); reducing API calls to `game.setting.get` and enabling migration support if/when it's needed in the future
- Rich popout menus for settings that are progressively discovered; only show currently relevant settings. 
- Generally more customization is possible without additional cognitive load.
- Changing Hand or X-Card settings no longer requires reloading Foundry. Hooray! 🥳
- Settings now have a "Reset \[to defaults\]" button

### Notification Changes
- Notifications with scope set to "GM only", now always show for the triggering user as feedback that the notification was sent

### Player List Changes
- Right clicking a name to get the user context options offers another way to lower hands
    - A player can right-click their own name to lower their hand
    - A GM can use right-click any user's name to lower that user's hand
- The Player List hand now has animations and improvements to visibility and two modes
    - When toggle mode is enabled, it works like the original style
    - When not in toggle mode, the hand appears, and goes away after an adjustable duration

### Scene Control Changes
- Hand Raiser button is removed when no Hand notification modes are enabled
- Raise Hand and X-Card buttons now have toolclips; featuring a demonstration of the action and an abbreviation of the current notification settings

### Styling Improvements
- Improved Light Mode support
- Styling moved to use Foundry's implementation of CSS Cascade Layers; paving the way for the future development of modules and systems that restyle raise-my-hand that may be further developed in a future release

## 2.1.0
- Added a setting to deploy the X-Card anonymous for tables that wish to use it. (feature requested in [issue #25](https://github.com/henry-malinowski/raise-my-hand-plus/issues/25))

## 2.0.0
- Added a configurable timeout feature ([issue #21](https://github.com/henry-malinowski/raise-my-hand-plus/issues/21)). Default is 10 seconds.
- Fixed sizing and duplication of popups relating to hand raising or X-Cards
- Suppressed erronious pop-out of this module's ApplicationV2 classs in Foundry V14
- Replaced `xcard.webp` with a new SVG to improve initial load time
- XCard now shows name of the user raising the card
- Suppressed multiple sounds playing from module when multiple prompted, only the most recent notification plays
- The raise-my-hand button configures as a proper toggle when set as such 
- The toggle is also suppress by the timeout feature
- General code cleanup, refactoring, and assorted bug fixing as found
- Readme improvements (properly center images, updated examples for V13, etc.)

## 1.5.0
- v13 https://github.com/henry-malinowski/raise-my-hand-plus/issues/20

## 1.4.9
- fix for sound

## 1.4.8
- sound can play only for gm user https://github.com/henry-malinowski/raise-my-hand-plus/issues/17

## 1.4.7
- v12
- fix AudioHelper

## 1.4.6
- translation pt-br  fix

## 1.4.5
- v11 only

## 1.4.4
- small fix

## 1.4.3
- v11

## 1.4.2
- dialog is easier to close

## 1.4.1
- Disable X-Card Key
-  Add volume slider for x-card sound

## 1.4.0
- removed shake screen (kandashi fluid is broken)
- added dialog option
- dialog detect img size
- x card button on side bar
- x card key
- x card sound
- localization en/pt-br 
- v10 fixes - no error/no warns
- filepicker! really cool

## 1.3.5
Update lang files in en, de and fr ([issue #11](https://github.com/henry-malinowski/raise-my-hand-plus/issues/11))

## 1.3.4
toogle mod option