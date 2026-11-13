import assert from "node:assert/strict";
import { loadSkill, patchedSources } from "./native-p2-test-support.mjs";

const source = patchedSources("shenhua_yin", ["character/shenhua.js", "character/sp.js"])["character/shenhua.js"];
const card = (zone, value = 1, discardable = true, type = zone === "e" ? "equip" : "basic") => ({
  zone, value, discardable, type
});
function makePlayer(attitude, cards) {
  return {
    attitude,
    cards,
    hasCard(filter, zones) {
      return this.cards.some(item => zones.includes(item.zone) && filter(item));
    },
    countCards(zone) {
      return this.cards.filter(item => item.zone === zone).length;
    },
    getStorage() { return []; }
  };
}

let actor;
let otherPlayers;
const lib = { skill: {}, filter: {
  cardDiscardable(item, player, context) {
    assert.equal(context, "nzry_feijun");
    assert.ok(player.cards.includes(item));
    return item.discardable;
  }
} };
const skill = loadSkill(source, "nzry_feijun", {
  lib,
  get: {
    player: () => actor,
    attitude: (player, target) => target.attitude,
    position: item => item.zone,
    type: item => item.type,
    value: item => {
      assert.ok(actor.cards.includes(item), "Must only value own cards");
      return item.value;
    }
  },
  game: { hasPlayer: filter => [actor, ...otherPlayers].some(filter) }
});
lib.skill.nzry_feijun = skill;

const cheapHand = card("h");
const cheapEquip = card("e");
const costlyHand = card("h", 7);
const enemyHand = makePlayer(-1, [card("h")]);
const enemyEquip = makePlayer(-1, [card("e")]);
const protectedEquip = makePlayer(-1, [card("e", 1, false)]);
const ally = makePlayer(1, [card("h"), card("e")]);
const emptyEnemy = makePlayer(-1, []);
const scenarios = [
  ["equal hand", [cheapHand], [enemyHand], [4], 1],
  ["equal equipment", [cheapEquip], [enemyEquip], [4], 1],
  ["only hand payment creates a target", [cheapHand, cheapEquip], [enemyHand], [4, 0], 1],
  ["only equipment payment creates a target", [cheapHand, cheapEquip], [enemyEquip], [0, 4], 1],
  ["high-value hand payment", [costlyHand], [enemyHand], [-2], 0],
  ["cheap equipment does not open hand target", [costlyHand, cheapEquip], [enemyHand], [-2, 0], 0],
  ["no enemy benefits", [cheapHand, cheapEquip], [ally], [0, 0], 0],
  ["no target after payment", [cheapHand], [emptyEnemy], [0], 0],
  ["cannot discard opposing equipment", [cheapEquip], [protectedEquip], [0], 0],
  ["equipped non-equipment card", [cheapEquip], [makePlayer(-1, [card("e", 1, true, "basic")])], [0], 0],
  ["protected own cost", [card("h", 1, false)], [enemyHand], [0], 0],
  ["non-finite cost score", [card("h", Number.NaN)], [enemyHand], [0], 0],
  ["valid enemy already before payment", [cheapEquip], [enemyHand], [4], 1],
  ["no candidate payment", [], [enemyHand], [], 0]
];
for (const [name, cards, opponents, cardScores, playerScore] of scenarios) {
  actor = makePlayer(1, cards);
  otherPlayers = opponents;
  assert.equal(skill.ai.result.player(actor), playerScore, name + " player score");
  assert.deepEqual(cards.map(item => skill.check(item)), cardScores, name + " card scores");
}

actor = makePlayer(1, []);
otherPlayers = [enemyEquip, protectedEquip];
actor.chooseTarget = filter => ({
  async forResult() {
    assert.equal(filter(null, actor, protectedEquip), true, "Manual target remains legal");
    assert.equal(this.ai(enemyEquip), 1);
    assert.equal(this.ai(protectedEquip), 0);
    return { bool: false };
  }
});
await skill.content({}, {}, actor);
otherPlayers = [emptyEnemy];
actor.chooseTarget = () => assert.fail("No post-payment target may open a prompt");
await skill.content({}, {}, actor);
console.log("nzry_feijun: " + (scenarios.length + 2) + " paid-zone, target and cancellation scenarios passed");
