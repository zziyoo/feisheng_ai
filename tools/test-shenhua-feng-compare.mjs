#!/usr/bin/env node
// 风包原生/扩展对照的负向回归：未登记差异、错误支付档位、无收益、不可达、自尽都必须被拒绝。
import assert from 'node:assert/strict';
import { compareNativeExtension, validateQimouDifference } from './shenhua-feng-review-semantics.mjs';

const scene = (name, options) => {
	const { used = false, paid = 0, targetHpBefore = 3, targetHpAfter = 3, reachableAfter = false, enemyHpLoss = 0, shaUses = 0, actorHpBefore = 4, actorHpAfter = 4, actorAlive = true } = options || {};
	return {
		name,
		before: { skills: { A: ['qimou'], B: [], C: [] }, hp: { A: actorHpBefore, B: 4, C: targetHpBefore } },
		after: { hp: { A: actorHpAfter, B: 4, C: targetHpAfter }, hand: { A: [], B: [], C: [] } },
		ops: [
			...(used ? [{ op: 'useSkill', args: ['qimou', [], []] }] : []),
			...(paid ? [{ op: 'loseHp', args: [paid] }] : []),
			...Array.from({ length: shaUses }, () => ({ op: 'useCard', args: ['sha', ['sha'], ['P:C'], null] })),
		],
		qimou: {
			paid,
			targetId: 'C',
			targetHpBefore,
			targetHpAfter,
			reachableAfter,
			enemyHpLoss,
			shaUses,
			actorHpBefore,
			actorHpAfter,
			actorAlive,
		},
	};
};

const report = scenes => ({ scenes });
const names = ['hp-qimou-distance4-hp3', 'hp-qimou-distance3-hp2', 'hp-qimou-distance4-hp4-negative'];
const nativeScenes = [
	scene('hp-qimou-distance4-hp3', { targetHpBefore: 3, targetHpAfter: 3 }),
	scene('hp-qimou-distance3-hp2', { targetHpBefore: 2, targetHpAfter: 2 }),
	scene('hp-qimou-distance4-hp4-negative', { targetHpBefore: 4, targetHpAfter: 4 }),
];
const validExtensionScenes = [
	scene('hp-qimou-distance4-hp3', { used: true, paid: 3, targetHpBefore: 3, targetHpAfter: 3, reachableAfter: true, enemyHpLoss: 4, shaUses: 4, actorHpAfter: 1 }),
	scene('hp-qimou-distance3-hp2', { used: true, paid: 2, targetHpBefore: 2, targetHpAfter: 1, reachableAfter: true, enemyHpLoss: 1, shaUses: 2, actorHpAfter: 1 }),
	scene('hp-qimou-distance4-hp4-negative', { targetHpBefore: 4, targetHpAfter: 4 }),
];
const run = extensionScenes => compareNativeExtension(report(nativeScenes), report(extensionScenes), names);
const reject = (label, extensionScenes, pattern) => {
	const result = run(extensionScenes);
	assert.equal(result.semantic_all, false, label + ' 应被拒绝');
	const failed = result.rows.filter(row => !row.semantic_match);
	assert.ok(failed.length, label + ' 没有失败行');
	assert.ok(failed.some(row => row.qimou_error && pattern.test(row.qimou_error)), label + ' 失败原因不符：' + JSON.stringify(failed.map(row => row.qimou_error)));
};

let passed = 0;
const check = (label, callback) => { callback(); passed++; console.log('PASS', label); };

check('合法登记差异通过并只登记两条', () => {
	const result = run(validExtensionScenes);
	assert.equal(result.semantic_all, true);
	assert.equal(result.strategy_differences.length, 2);
	assert.deepEqual(result.strategy_differences.map(item => item.scene).sort(), ['hp-qimou-distance3-hp2', 'hp-qimou-distance4-hp3']);
});
check('支付档位错误被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance4-hp3' ? scene(item.name, { used: true, paid: 4, targetHpBefore: 3, targetHpAfter: 3, reachableAfter: true, enemyHpLoss: 4, shaUses: 4, actorHpAfter: 0 }) : item);
	reject('支付档位错误', scenes, /支付档位不符/);
});
check('无实际敌方收益被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance3-hp2' ? scene(item.name, { used: true, paid: 2, targetHpBefore: 2, targetHpAfter: 2, reachableAfter: true, enemyHpLoss: 0, shaUses: 2, actorHpAfter: 1 }) : item);
	reject('无实际收益', scenes, /未造成预期敌方体力损失|指定目标未受到伤害/);
});
check('支付后目标仍不可达被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance4-hp3' ? scene(item.name, { used: true, paid: 3, targetHpBefore: 3, targetHpAfter: 3, reachableAfter: false, enemyHpLoss: 4, shaUses: 4, actorHpAfter: 1 }) : item);
	reject('目标不可达', scenes, /支付后目标仍不可达/);
});
check('支付导致自尽被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance4-hp3' ? scene(item.name, { used: true, paid: 4, targetHpBefore: 3, targetHpAfter: 3, reachableAfter: true, enemyHpLoss: 4, shaUses: 4, actorHpBefore: 4, actorHpAfter: 0, actorAlive: false }) : item);
	reject('支付自尽', scenes, /支付档位不符|耗尽体力|角色死亡/);
});
check('负向场景出现未登记差异被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance4-hp4-negative' ? scene(item.name, { used: true, paid: 1, targetHpBefore: 4, targetHpAfter: 4, reachableAfter: true, enemyHpLoss: 1, shaUses: 1, actorHpAfter: 3 }) : item);
	reject('负向场景发动', scenes, /未登记的奇谋场景/);
});
check('原生基线自己发动奇谋时不再算已登记修复', () => {
	const native = nativeScenes.map(item => item.name === 'hp-qimou-distance4-hp3' ? scene(item.name, { used: true, paid: 3, targetHpBefore: 3, targetHpAfter: 3, reachableAfter: true, enemyHpLoss: 4, shaUses: 4, actorHpAfter: 1 }) : item);
	const result = compareNativeExtension(report(native), report(validExtensionScenes), names);
	assert.equal(result.semantic_all, false);
	assert.ok(result.rows.some(row => row.qimou_error && /原生基线/.test(row.qimou_error)));
});
check('扩展未发动登记的正向场景被拒绝', () => {
	const scenes = validExtensionScenes.map(item => item.name === 'hp-qimou-distance4-hp3' ? scene(item.name, { targetHpBefore: 3, targetHpAfter: 3 }) : item);
	reject('正向未发动', scenes, /扩展未实际发动奇谋/);
});
check('直接校验器对未登记场景返回错误', () => {
	const native = { usedQimou: true, paid: 0 };
	const extension = { usedQimou: false, paid: 0 };
	assert.match(validateQimouDifference('qimou-unknown', native, extension), /未登记/);
});

console.log('ALL PASS (' + passed + ')');
