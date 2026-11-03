import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
	SHENHUA_HUO_POLICY_RULES,
	luanjiAllyLethal, luanjiNetTooLow, tianyiLowCompare, jianchuWorthwhile,
} from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('火包清单登记乱击/天义/鞬出三项运行时校正', () => {
	const meta = JSON.parse(fs.readFileSync('pack.json', 'utf8'));
	assert.equal(meta.id, 'shenhua_huo');
	assert.deepEqual(meta.implemented_skills, ['luanji', 'tianyi', 'jianchu']);
	assert.equal(meta.review_only, false);
});
check('乱击不会为AOE牺牲1血空手无防具队友', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: true }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 1, armor: false }), false);
	assert.equal(luanjiAllyLethal({ ally: false, hp: 1, hand: 0, armor: false }), false);
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
check('天义手里最大点数不足10时拒绝无把握拼点（镜像原生补丁0002）', () => {
	assert.equal(tianyiLowCompare({ maxNumber: 5 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 9 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 10 }), false);
	assert.equal(tianyiLowCompare({ maxNumber: 13 }), false);
});
check('鞬出仅在值得发动时触发（镜像原生补丁0003）', () => {
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 3 }), false);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 1, hp: 4, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 1, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 1 }), true);
	assert.equal(jianchuWorthwhile({ hostile: false, equips: 1, hp: 4, hand: 3 }), false);
});
check('纯规则出口完整', () => {
	assert.deepEqual(Object.keys(SHENHUA_HUO_POLICY_RULES), [
		'luanjiAllyLethal', 'luanjiNetTooLow', 'tianyiLowCompare', 'jianchuWorthwhile',
	]);
});
console.log('ALL PASS (' + passed + ')');
