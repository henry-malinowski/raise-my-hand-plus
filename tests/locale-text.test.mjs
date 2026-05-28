import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

test("rp scene start request text does not reveal requester name", () => {
  const english = JSON.parse(readFileSync("lang/en.json", "utf8"));
  const text = english["raise-my-hand"].RP_SCENE_START_REQUEST;

  assert.equal(text, "Someone wants to start RP scene");
  assert.doesNotMatch(text, /\{name\}/);
});

test("rp scene start request has self text", () => {
  const english = JSON.parse(readFileSync("lang/en.json", "utf8"));

  assert.equal(english["raise-my-hand"].RP_SCENE_START_REQUEST_SELF, "You want to start RP scene");
});
