import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const css = readFileSync("css/speaker-indication.css", "utf8");
const variables = readFileSync("css/variables.css", "utf8");

test("speaker indication has no screen border animation", () => {
  assert.doesNotMatch(css, /\.raise-my-hand-speaker-frame\s*\{/);
  assert.doesNotMatch(css, /@keyframes\s+raise-my-hand-speaker-frame/);
});

test("urgent indication root supports side-by-side positioning", () => {
  assert.match(css, /#raise-my-hand-speaker-indication,\s*#raise-my-hand-urgent-indication\s*\{/);
  assert.match(css, /\.raise-my-hand-urgent-indication\s+\.raise-my-hand-speaker-banner\s*\{[^}]*top:\s*28px;/);
  assert.doesNotMatch(css, /\.raise-my-hand-urgent-indication\s+\.raise-my-hand-speaker-banner\s*\{[^}]*top:\s*104px;/);
  assert.match(css, /\.raise-my-hand-urgent-indication\s+\.raise-my-hand-speaker-banner\s*\{[^}]*cursor:\s*move;/);
  assert.match(css, /\.raise-my-hand-urgent-indication\s+\.raise-my-hand-speaker-banner\s*\{[^}]*pointer-events:\s*auto;/);
});

test("speaker and urgent banners use the same reserved height", () => {
  const bannerRule = css.match(/\.raise-my-hand-speaker-banner\s*\{(?<body>[^}]+)\}/)?.groups.body ?? "";

  assert.match(bannerRule, /box-sizing:\s*border-box;/);
  assert.match(bannerRule, /min-height:\s*68px;/);
});

test("speaker indication palette includes scene started color", () => {
  assert.match(variables, /--raise-my-hand-blue:\s*#[0-9a-fA-F]{6};/);
});
