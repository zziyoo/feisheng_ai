import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
	SHENHUA_HUO_POLICY_RULES,
	luanjiAllyLethal, luanjiNetTooLow, tianyiLowCompare, tianyiKnownWinAvailable, jianchuWorthwhile,
} from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('火包清单登记乱击/天义/鞬出三项AI优化（区分缺陷修复与质量提升）', () => {
	const meta = JSON.parse(fs.readFileSync('pack.json', 'utf8'));
	assert.equal(meta.id, 'shenhua_huo');
	assert.deepEqual(meta.implemented_skills, ['luanji', 'tianyi', 'jianchu']);
	assert.deepEqual(meta.optimization_types, {
		luanji: '缺陷修复',
		tianyi: '质量提升',
		jianchu: '质量提升',
	});
	assert.equal(meta.review_only, false);
});
check('乱击濒死否决：1血空手无防具且无护甲/无自动闪响应能力', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: true }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 1, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: false, hp: 1, hand: 0, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false, hujia: 1 }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false, freeShan: true }), false);
});
check('乱击小规模对局净收益门槛（镜像原生补丁0001）', () => {
	assert.equal(luanjiNetTooLow({ count: 3, net: 0.5, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 3, net: 1, overLimit: false }), false);
	assert.equal(luanjiNetTooLow({ count: 5, net: 1.4, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 5, net: 1.5, overLimit: false }), false);
	assert.equal(luanjiNetTooLow({ count: 7, net: 1.9, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 7, net: 2, overLimit: false }), false);
	assert.equal(luanjiNetTooLow({ count: 3, net: -5, overLimit: true }), false);
});
check('天义低点数默认保守（镜像原生补丁0002）', () => {
	assert.equal(tianyiLowCompare({ maxNumber: 5 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 9 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 10 }), false);
	assert.equal(tianyiLowCompare({ maxNumber: 13 }), false);
});
check('天义已知必胜拼点例外：只用完全公开的对手手牌，且点数确定更低', () => {
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: true, comparable: true, handCount: 1, knownCount: 1, knownMax: 2 }],
	}), true);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: true, comparable: true, handCount: 2, knownCount: 1, knownMax: 2 }],
	}), false);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: true, comparable: true, handCount: 1, knownCount: 1, knownMax: 5 }],
	}), false);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 12,
		candidates: [{ hostile: true, comparable: true, handCount: 1, knownCount: 1, knownMax: 2 }],
	}), false);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: false, comparable: true, handCount: 1, knownCount: 1, knownMax: 2 }],
	}), false);
});
check('鞬出仅在值得发动时触发；hp<=1击杀动机在有护甲时不成立（镜像原生补丁0003）', () => {
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 3 }), false);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 1, hp: 4, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 1, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 1, hand: 3, hujia: 1 }), false);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 1 }), true);
	assert.equal(jianchuWorthwhile({ hostile: false, equips: 1, hp: 4, hand: 3 }), false);
});
check('纯规则出口完整', () => {
	assert.deepEqual(Object.keys(SHENHUA_HUO_POLICY_RULES), [
		'luanjiAllyLethal', 'luanjiNetTooLow', 'tianyiLowCompare', 'tianyiKnownWinAvailable', 'jianchuWorthwhile',
	]);
});
console.log('ALL PASS (' + passed + ')');
