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
