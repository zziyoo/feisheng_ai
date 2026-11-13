import assert from "node:assert/strict";
import { loadSkill, patchedSources } from "./native-p2-test-support.mjs";

const source = patchedSources("refresh_shan", ["character/refresh.js"])["character/refresh.js"];
const status = {};
const lib = { skill: {}, status: { videoId: 0 } };
const choiceRequested = new Error("normal dialog requested");
const ui = { create: { dialog() { throw choiceRequested; } } };
const skill = loadSkill(source, "rehuashen", { _status: status, lib, ui });
const player = { storage: { rehuashen: { character: [] } }, isOnline2: () => false };
let dealt = [];
let draws = 0;
lib.skill.rehuashen = {
  addHuashens(actor, count) {
    assert.equal(actor, player);
    assert.equal(count, 3);
    actor.storage.rehuashen.character.push(...dealt);
    draws++;
  }
};

const initial = { triggername: "phaseBefore" };
const trigger = { name: "phase" };
await skill.cost(initial, trigger, player);
assert.equal(initial.result.bool, true);
await skill.content({ cost_data: initial.result.cost_data }, trigger, player);
assert.equal(draws, 1);
assert.deepEqual(player.storage.rehuashen.character, []);
assert.equal(lib.status.videoId, 0);
assert.equal(Object.hasOwn(status, "noclearcountdown"), false);

dealt = ["test_candidate"];
await assert.rejects(skill.content({ cost_data: initial.result.cost_data }, trigger, player), choiceRequested);
assert.equal(draws, 2);
assert.deepEqual(player.storage.rehuashen.character, dealt);
assert.equal(lib.status.videoId, 1);
assert.equal(status.noclearcountdown, true);
console.log("rehuashen: empty initial draw returns before UI; nonempty initial draw reaches stock UI");
