import assert from 'node:assert/strict';
import { lianhuanLinkedTargetSkip } from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('已横置目标跳过铁索转化', () => {
	assert.equal(lianhuanLinkedTargetSkip({ isLinked: () => true }), true);
	assert.equal(lianhuanLinkedTargetSkip({ isLinked: () => false }), false);
});
check('自己/空目标跳过，未横置目标保留原生评分', () => {
	const player = { isLinked: () => false };
	assert.equal(lianhuanLinkedTargetSkip(player, player), true);
	assert.equal(lianhuanLinkedTargetSkip(null, player), true);
	assert.equal(lianhuanLinkedTargetSkip({ isLinked: () => false }, player), false);
});
check('缺少 isLinked 时不误判为已横置', () => {
	assert.equal(lianhuanLinkedTargetSkip({}), false);
});
console.log('ALL PASS (' + passed + ')');
