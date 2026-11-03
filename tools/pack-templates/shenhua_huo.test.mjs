import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SHENHUA_HUO_POLICY_RULES, luanjiAllyLethal } from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('火包清单只登记乱击一项运行时校正', () => {
	const meta = JSON.parse(fs.readFileSync('pack.json', 'utf8'));
	assert.equal(meta.id, 'shenhua_huo');
	assert.deepEqual(meta.implemented_skills, ['luanji']);
	assert.equal(meta.review_only, false);
});
check('乱击不会为AOE牺牲1血空手无防具队友', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: false }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armor: true }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 1, armor: false }), false);
});
check('纯规则出口完整', () => {
	assert.deepEqual(Object.keys(SHENHUA_HUO_POLICY_RULES), ['luanjiAllyLethal']);
});
console.log('ALL PASS (' + passed + ')');
