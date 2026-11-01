import assert from 'node:assert/strict';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, retuxiHandBonus } from '../source/score/decision/skills/rules/refreshStandard.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const rule = DEFENSE_RULES.rezhiheng;

check('低血保留桃', () => {
	assert.equal(retentionAdjustment('tao', 3, 'h', 1, rule), -1);
	assert.equal(retentionAdjustment('tao', 1, 'h', 0.5, rule), -1);
});
check('低血保留闪', () => {
	assert.equal(retentionAdjustment('shan', 2, 'h', 1, rule), -1);
});
check('四血不改变原生评分', () => {
	assert.equal(retentionAdjustment('tao', 4, 'h', 1, rule), 1);
	assert.equal(retentionAdjustment('shan', 4, 'h', 1, rule), 1);
});
check('装备区不干预', () => {
	assert.equal(retentionAdjustment('tao', 1, 'e', 1, rule), 1);
});
check('已经为负的成本分保持更负', () => {
	assert.equal(retentionAdjustment('tao', 1, 'h', -3, rule), -3);
});
check('非法输入原样返回', () => {
	assert.equal(retentionAdjustment('tao', null, 'h', 1, rule), 1);
	assert.equal(retentionAdjustment('tao', 1, 'h', NaN, rule), NaN);
});
check('只剩防御牌时停止换牌', () => {
	assert.equal(shouldSkipExchange(1, ['tao', 'shan'], rule), true);
	assert.equal(shouldSkipExchange(3, ['shan'], rule), true);
});
check('仍有非防御牌时照常换牌', () => {
	assert.equal(shouldSkipExchange(1, ['tao', 'sha'], rule), false);
	assert.equal(shouldSkipExchange(2, ['tao', 'shan', 'sha'], rule), false);
});
check('高血或空手不触发停止', () => {
	assert.equal(shouldSkipExchange(4, ['tao'], rule), false);
	assert.equal(shouldSkipExchange(3, [], rule), false);
});
check('突袭手牌奖励有界且避开特殊失牌收益', () => {
	assert.equal(retuxiHandBonus(4, true, false), 1);
	assert.equal(retuxiHandBonus(100, true, false), 2);
	assert.equal(retuxiHandBonus(4, false, false), 0);
	assert.equal(retuxiHandBonus(4, true, true), 0);
	assert.equal(retuxiHandBonus(0, true, false), 0);
});
console.log('ALL PASS (' + passed + ')');
