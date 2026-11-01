import assert from 'node:assert/strict';
import { interpretBaseUses, reqimouNeedsPayment, reqimouKillBenefit, reqimouOptimalX, reqimouKillableByHand } from '../source/score/decision/skills/rules/refreshFeng.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const target = (over = {}) => ({
	effect: 1, canUseIgnoringDistance: true, currentlyInRange: true,
	hp: 2, distance: 1, attackRange: 1, baseUses: 1, ...over,
});

check('出杀次数四态：Infinity/0/负数/未知', () => {
	assert.equal(interpretBaseUses(Infinity), Infinity);
	assert.equal(interpretBaseUses(0), 0);
	assert.equal(interpretBaseUses(-2), 0);
	assert.equal(interpretBaseUses(3.9), 3);
	assert.equal(interpretBaseUses(undefined), 1);
});
check('needsPayment 只对“距离或次数不足”返回真', () => {
	assert.equal(reqimouNeedsPayment([target({ currentlyInRange: false })]), true);
	assert.equal(reqimouNeedsPayment([target({ hp: 1 })]), false);
	assert.equal(reqimouNeedsPayment([target({ hp: 2 })]), true);
	assert.equal(reqimouNeedsPayment([target({ hp: 2, baseUses: Infinity })]), false);
	assert.equal(reqimouNeedsPayment([target({ hp: 2, baseUses: 0 })]), true);
	assert.equal(reqimouNeedsPayment([target({ effect: 0 })]), false);
});
check('击杀收益按预算与距离贪心统计', () => {
	assert.equal(reqimouKillBenefit(2, 1, 1, [target({ hp: 2, distance: 1 })]), 1);
	assert.equal(reqimouKillBenefit(2, 1, 0, [target({ hp: 2, distance: 1 })]), 0);
	assert.equal(reqimouKillBenefit(2, Infinity, 0, [target({ hp: 2, distance: 1 })]), 1);
	assert.equal(reqimouKillBenefit(3, 1, 2, [
		target({ hp: 1, distance: 1 }), target({ hp: 2, distance: 2 }), target({ hp: 3, distance: 3 }),
	]), 2);
	assert.equal(reqimouKillBenefit(2, 1, 1, [target({ hp: 2, distance: 4 })]), 0);
});
check('optimalX：贴脸2血付1，不付hp-1', () => {
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 2, baseUses: 1, targets: [target({ hp: 2, distance: 1 })] }), 1);
});
check('optimalX：不可承受的候选绝不截断', () => {
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 2, baseUses: 1, targets: [target({ hp: 2, distance: 4 })] }), null);
});
check('optimalX：自救牌只放宽上限，不无条件付满', () => {
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 2, baseUses: 1, saveCount: 1, targets: [target({ hp: 2, distance: 3 })] }), 2);
});
check('optimalX：无限次数不构成支付理由', () => {
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 2, baseUses: Infinity, targets: [target({ hp: 2, distance: 1 })] }), null);
});
check('optimalX：低血/无杀返回 null 回退原生', () => {
	assert.equal(reqimouOptimalX({ hp: 1, shaCount: 2, baseUses: 1, targets: [target()] }), null);
	assert.equal(reqimouOptimalX({ hp: 3, shaCount: 0, baseUses: 1, targets: [target()] }), null);
});
check('KillableByHand 只做静态手杀判断', () => {
	assert.equal(reqimouKillableByHand(2, [target({ hp: 2 })]), true);
	assert.equal(reqimouKillableByHand(2, [target({ hp: 3 })]), false);
	assert.equal(reqimouKillableByHand(0, [target({ hp: 1 })]), false);
	assert.equal(reqimouKillableByHand(2, [target({ hp: 1, effect: 0 })]), false);
});
console.log('ALL PASS (' + passed + ')');
