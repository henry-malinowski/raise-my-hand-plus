import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("snatch spotlight keybinding imports hand handlers before use", () => {
  const source = readFileSync("scripts/raise-my-hand.mjs", "utf8");

  assert.match(source, /import \* as handHandlers from "\.\/handlers\/hand\.mjs";/);
  assert.match(source, /handHandlers\.snatchSpotlight\(\);/);
});

test("space keybinding consumes handled spotlight scene actions", () => {
  const source = readFileSync("scripts/raise-my-hand.mjs", "utf8");

  assert.match(source, /if \(context\.event\?\.repeat\) return false;/);
  assert.match(source, /const handled = handHandlers\.snatchSpotlight\(\);/);
  assert.match(source, /return handled;/);
});

test("shift space keybinding delays the spotlight turn", () => {
  const source = readFileSync("scripts/raise-my-hand.mjs", "utf8");

  assert.match(source, /game\.keybindings\.register\(MODULE_ID, "delay-spotlight"/);
  assert.match(source, /editable:\s*\[\{\s*key:\s*"Space",\s*modifiers:\s*\["Shift"\]\s*\}\]/);
  assert.match(source, /const handled = handHandlers\.delaySpotlight\(\);/);
  assert.match(source, /return handled;/);
});

test("module id follows the loaded module URL", async () => {
  const {getModuleId} = await import("../scripts/module-id.mjs");

  assert.equal(
    getModuleId("http://localhost/modules/raise-my-hand-plus/scripts/raise-my-hand.mjs"),
    "raise-my-hand-plus"
  );
  assert.equal(
    getModuleId("http://localhost/modules/raise-my-hand/build/raise-my-hand.min.mjs"),
    "raise-my-hand"
  );
});

test("controls use the shared module id", () => {
  const source = readFileSync("scripts/controls.mjs", "utf8");

  assert.match(source, /import \{ MODULE_ID \} from "\.\/module-id\.mjs";/);
  assert.doesNotMatch(source, /const MODULE_ID = 'raise-my-hand';/);
});

test("socket initialization handles socketlib registration failure", () => {
  const source = readFileSync("scripts/socket/socket.mjs", "utf8");

  assert.match(source, /if \(!socket\) \{/);
  assert.match(source, /game\.modules\.get\(MODULE_ID\)/);
  assert.match(source, /return;/);
});
