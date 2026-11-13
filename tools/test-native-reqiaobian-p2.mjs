import assert from "node:assert/strict";
import { loadSkill, patchedSources } from "./native-p2-test-support.mjs";

const source = patchedSources("refresh_shan", ["character/refresh.js"])["character/refresh.js"];
const player = {
  mark: false,
  card: {},
  hasMark(name) {
    assert.equal(name, "reqiaobian");
    return this.mark;
  },
  hasCard(filter, zone) {
    assert.equal(zone, "he");
    return filter(this.card);
  },
  chooseControl(options) {
    this.choices = [...options];
    return {
      set() { return this; },
      async forResult() { return { control: "cancel2" }; }
    };
  }
};
let allowedContext;
const skill = loadSkill(source, "reqiaobian", {
  lib: { filter: { cardDiscardable: (card, actor, context) => {
    assert.equal(actor, player);
    assert.equal(card, player.card);
    return context === allowedContext;
  } } }
});
let scenarios = 0;
for (const stage of ["judge", "draw", "use", "discard"]) {
  const event = { name: "reqiaobian_" + stage };
  const trigger = { name: "phase" + stage[0].toUpperCase() + stage.slice(1), cancel() {
    assert.fail("Cancelling choice must preserve the phase");
  } };
  for (const mark of [false, true]) {
    player.mark = mark;
    for (const context of [event.name, "unrelated_skill", "reqiaobian_judge"]) {
      allowedContext = context;
      const canDiscard = context === event.name;
      assert.equal(skill.subSkill[stage].filter(trigger, player), mark || canDiscard,
        stage + " filter with " + context + " and mark " + mark);
      await skill.subSkill[stage].content(event, trigger, player);
      assert.deepEqual(player.choices, [
        ...(mark ? ["弃置标记"] : []),
        ...(canDiscard ? ["弃置牌"] : []),
        "cancel2"
      ]);
      scenarios++;
    }
  }
}
console.log("reqiaobian: " + scenarios + " stage-specific filter and choice scenarios passed");
