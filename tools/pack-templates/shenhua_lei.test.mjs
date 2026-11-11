import assert from 'node:assert/strict';
import { olkongshengCostNeedsFix, olkongshengExpansionView, zhenguCostNeedsFix, zhenguImmediateDelta } from '../source/score/decision/skills/rules/shenhuaLei.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('成本指纹只在原表达式存在时命中', () => {
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng") + ui.selected.cards.length;'), true);
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng").length + ui.selected.cards.length;'), false);
	assert.equal(olkongshengCostNeedsFix('const n = other();'), false);
});
check('数组视图保留索引/长度/迭代/JSON 语义', () => {
	const original = [{ name: 'tao' }, { name: 'sha' }];
	const view = olkongshengExpansionView(original);
	assert.equal(Array.isArray(view), true);
	assert.equal(view.length, 2);
	assert.equal(view[0], original[0]);
	assert.deepEqual(view.map(card => card.name), ['tao', 'sha']);
	assert.equal(JSON.stringify(view), '[{"name":"tao"},{"name":"sha"}]');
	assert.equal(view + 1, 3);
	assert.equal(String(view), '2');
	assert.equal(view.valueOf(), 2);
	assert.equal(original.length, 2);
});
check('非数组输入原样返回', () => {
	const value = { length: 2 };
	assert.equal(olkongshengExpansionView(value), value);
});

/* ---- 镇骨 P1：即时手牌差额与旧式评分指纹 ---- */
const OLD_COST = 'const num = Math.min(5, player2.countCards("h")) - target.countCards("h");';
const NATIVE_COST = 'const ownHand = player2.countCards("h"), targetHand = target.countCards("h");\n        const num = ownHand < targetHand ? ownHand - targetHand : Math.min(5, ownHand) - Math.min(5, targetHand);';
check('镇骨旧式评分指纹只在宿主未修复时命中', () => {
	assert.equal(zhenguCostNeedsFix(OLD_COST), true);
	assert.equal(zhenguCostNeedsFix(NATIVE_COST), false);
	assert.equal(zhenguCostNeedsFix('const num = 0;'), false);
});
check('镇骨即时差额与宿主 sync 的实际变化一致', () => {
	/* 7/6：自己不少于目标 → 目标摸至 5，实际 0 */
	assert.equal(zhenguImmediateDelta(7, 6), 0);
	/* 6/8：自己少于目标 → 目标弃 2 张 */
	assert.equal(zhenguImmediateDelta(6, 8), -2);
	/* 3/1：自己不少于目标 → 目标摸至 3，实际 +2 */
	assert.equal(zhenguImmediateDelta(3, 1), 2);
	/* 3/5：自己少于目标 → 目标弃 2 张 */
	assert.equal(zhenguImmediateDelta(3, 5), -2);
});
check('镇骨即时差额的边界与非法输入', () => {
	assert.equal(zhenguImmediateDelta(10, 7), 0);
	assert.equal(zhenguImmediateDelta(5, 0), 5);
	assert.equal(zhenguImmediateDelta(4, 3), 1);
	assert.equal(zhenguImmediateDelta(2, 5), -3);
	assert.equal(zhenguImmediateDelta(0, 0), 0);
	assert.equal(zhenguImmediateDelta('x', 3), 0);
	assert.equal(zhenguImmediateDelta(3, undefined), 0);
});
check('旧式评分在 7/6 与 6/8 两档与即时差额不一致', () => {
	const oldEstimate = (own, target) => Math.min(5, own) - target;
	assert.notEqual(oldEstimate(7, 6), zhenguImmediateDelta(7, 6));
	assert.notEqual(oldEstimate(6, 8), zhenguImmediateDelta(6, 8));
	/* 修正后两档与旧式一致（回归保护） */
	assert.equal(oldEstimate(3, 1), zhenguImmediateDelta(3, 1));
	assert.equal(oldEstimate(3, 5), zhenguImmediateDelta(3, 5));
});
console.log('ALL PASS (' + passed + ')');
