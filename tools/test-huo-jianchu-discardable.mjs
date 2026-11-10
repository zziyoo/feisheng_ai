import assert from 'node:assert/strict';
import { jianchuDiscardableEquips, jianchuWorthwhile } from '../score/decision/skills/rules/shenhuaHuo.js';
const actor = {};
const target = { countCards: () => 1, countDiscardableCards: (player, zone) => { assert.equal(player, actor); assert.equal(zone, 'e'); return 0; } };
assert.equal(jianchuDiscardableEquips(target, actor), 0);
assert.equal(jianchuWorthwhile({hostile:true,equips:jianchuDiscardableEquips(target,actor),hp:4,hand:3}), false);
target.countDiscardableCards = () => 1;
assert.equal(jianchuWorthwhile({hostile:true,equips:jianchuDiscardableEquips(target,actor),hp:4,hand:3}), true);
console.log('PASS 鞬出：不可弃装备不触发；可弃装备仍触发');
