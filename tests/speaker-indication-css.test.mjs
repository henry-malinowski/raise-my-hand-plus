import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const css = readFileSync("css/speaker-indication.css", "utf8");
const variables = readFileSync("css/variables.css", "utf8");

test("speaker indication has no screen border animation", () => {
  assert.doesNotMatch(css, /\.raise-my-hand-speaker-frame\s*\{/);
  assert.doesNotMatch(css, /@keyframes\s+raise-my-hand-speaker-frame/);
});

test("urgent speakers are shown in the inline talking queue", () => {
  assert.doesNotMatch(css, /#raise-my-hand-urgent-indication/);
  assert.doesNotMatch(css, /\.raise-my-hand-urgent-indication/);
  assert.match(css, /\.raise-my-hand-talking-queue\s*\{/);
  assert.match(css, /\.raise-my-hand-talking-queue-item\.urgent\s*\{/);
});

test("speaker banner keeps a stable reserved height", () => {
  const bannerRule = css.match(/\.raise-my-hand-speaker-banner\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";

  assert.match(bannerRule, /box-sizing:\s*border-box;/);
  assert.match(bannerRule, /min-height:\s*68px;/);
});

test("speaker avatar crops from the top of portrait art", () => {
  const avatarRule = css.match(/\.raise-my-hand-speaker-avatar\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";

  assert.match(avatarRule, /top center \/ cover no-repeat;/);
});

test("talking queue chips center the number and name on one line", () => {
  const itemRule = css.match(/\.raise-my-hand-talking-queue-item\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";
  const positionRule = css.match(/\.raise-my-hand-talking-queue-position\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";
  const nameRule = css.match(/\.raise-my-hand-talking-queue-name\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";

  assert.match(itemRule, /height:\s*calc\(36px \* var\(--raise-my-hand-speaker-scale\)\);/);
  assert.match(itemRule, /margin:\s*0;/);
  assert.match(itemRule, /display:\s*inline-grid;/);
  assert.match(itemRule, /grid-template-columns:\s*calc\(18px \* var\(--raise-my-hand-speaker-scale\)\) minmax\(0,\s*auto\);/);
  assert.match(itemRule, /align-items:\s*center;/);
  assert.match(itemRule, /justify-items:\s*center;/);
  assert.match(positionRule, /line-height:\s*1;/);
  assert.match(nameRule, /display:\s*flex;/);
  assert.match(nameRule, /align-items:\s*center;/);
  assert.match(nameRule, /line-height:\s*1;/);
  assert.doesNotMatch(nameRule, /transform:/);
});

test("speaker banner text scales with resized banner", () => {
  const bannerRule = css.match(/\.raise-my-hand-speaker-banner\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";
  const textRule = css.match(/\.raise-my-hand-speaker-text\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";
  const itemRule = css.match(/\.raise-my-hand-talking-queue-item\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";
  const positionRule = css.match(/\.raise-my-hand-talking-queue-position\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";

  assert.match(bannerRule, /--raise-my-hand-speaker-scale:\s*1;/);
  assert.match(textRule, /font-size:\s*calc\(20px \* var\(--raise-my-hand-speaker-scale\)\);/);
  assert.match(itemRule, /font-size:\s*calc\(13px \* var\(--raise-my-hand-speaker-scale\)\);/);
  assert.match(positionRule, /font-size:\s*calc\(11px \* var\(--raise-my-hand-speaker-scale\)\);/);
});

test("speaker indication palette includes scene started color", () => {
  assert.match(variables, /--raise-my-hand-blue:\s*#[0-9a-fA-F]{6};/);
});
