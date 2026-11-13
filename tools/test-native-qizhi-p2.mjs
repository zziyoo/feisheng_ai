import assert from "node:assert/strict";
import { loadSkill, patchedSources } from "./native-p2-test-support.mjs";

const source = patchedSources("shenhua_yin", ["character/shenhua.js", "character/sp.js"])["character/sp.js"];
const createPlayer = (attitude, cards) => ({
  attitude,
  hasCard(filter, zone) {
    assert.equal(zone, "he");
    return cards.some(filter);
  },
  countCards(zone) {
    assert.equal(zone, "he");
    return cards.length;
  }
});
const actor = createPlayer(1, [{ allowed: true }]);
const enemy = createPlayer(-1, [{ allowed: false }, { allowed: true }]);
const ally = createPlayer(1, [{ allowed: true }]);
const protectedEnemy = createPlayer(-1, [{ allowed: false }]);
const cardTarget = createPlayer(-1, [{ allowed: true }]);
const status = { event: { player: actor, targets: [cardTarget] } };
let score;
let targetFilter;
actor.chooseTarget = (prompt, description, filter) => {
  targetFilter = filter;
  return {
    set(name, value) {
      if (name === "ai") score = value;
      return this;
    },
    async forResult() {
      return { bool: false };
    }
  };
};
const skill = loadSkill(source, "qizhi", {
  _status: status,
  get: { prompt: name => name, attitude: (player, target) => target.attitude },
  lib: {
    filter: {
      canBeDiscarded(card, player, target, context) {
        assert.equal(player, actor);
        assert.ok(target.hasCard(candidate => candidate === card, "he"));
        assert.equal(context, "qizhi");
        return card.allowed;
      }
    }
  }
});
await skill.cost({ skill: "qizhi" }, { targets: [cardTarget] }, actor);
assert.equal(score(protectedEnemy), 0);
assert.equal(score(actor), 2);
assert.equal(score(enemy), 1);
assert.equal(score(ally), 0.5);
assert.equal(score(createPlayer(-1, [])), 0);
assert.equal(targetFilter(null, actor, cardTarget), false);
assert.equal(targetFilter(null, actor, protectedEnemy), true);
console.log("qizhi: 7 protected, eligible, and unchanged target-filter assertions passed");
