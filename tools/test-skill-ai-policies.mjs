import assert from 'node:assert/strict';
import { DEFENSE_RULES, retentionAdjustment, shouldSkipExchange, fairButtonScore, olkongshengCostNeedsFix, olkongshengExpansionView, shouldMaskHiddenButtonChoice, retuxiHandBonus, qimouTargetX, shouldBypassQimouCountBlock, reqimouNeedsPayment, reqimouOptimalX } from '../score/decision/skills/skillAIPolicyRules.js';

let passed = 0;
const check = (name, fn) => {
	fn();
	passed++;
	console.log('PASS', name);
};

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
check('公平选择只依赖玩家与位置', () => {
	const a = fairButtonScore('p1', 0);
	const b = fairButtonScore('p1', 0);
	const c = fairButtonScore('p1', 1);
	const d = fairButtonScore('p2', 0);
	assert.equal(a, b);
	assert.notEqual(a, c);
	assert.notEqual(a, d);
	assert(a >= 0 && a < 1);
});

check('箜声成本指纹只在原表达式存在时命中', () => {
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng") + ui.selected.cards.length;'), true);
	assert.equal(olkongshengCostNeedsFix('const n = player.getExpansions("olkongsheng").length + ui.selected.cards.length;'), false);
	assert.equal(olkongshengCostNeedsFix('const n = other();'), false);
});
check('箜声数组视图保留数组语义', () => {
	const original = [{ name: 'tao' }, { name: 'sha' }];
	const view = olkongshengExpansionView(original);
	assert.equal(Array.isArray(view), true);
	assert.equal(view.length, 2);
	assert.equal(view[0], original[0]);
	assert.equal([...view].length, 2);
	assert.deepEqual(view.map(c => c.name), ['tao', 'sha']);
	assert.equal(JSON.stringify(view), '[{"name":"tao"},{"name":"sha"}]');
	assert.equal(view + 1, 3);
	assert.equal(String(view), '2');
	assert.equal(view.valueOf(), 2);
	assert.equal(original.length, 2);
	assert.equal(original.valueOf(), original);
});
check('缔盟遮蔽只对 AI 且只在 redimeng 上下文', () => {
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(true, false, ['redimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(true, true, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['dimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, null), false);
});
check('突袭手牌奖励有界且避开特殊失牌收益', () => {
	assert.equal(retuxiHandBonus(4, true, false), 1);
	assert.equal(retuxiHandBonus(100, true, false), 2);
	assert.equal(retuxiHandBonus(4, false, false), 0);
	assert.equal(retuxiHandBonus(4, true, true), 0);
	assert.equal(retuxiHandBonus(0, true, false), 0);
});

check('奇谋支付档位复刻宿主 content', () => {
	assert.equal(qimouTargetX(4, 3), 3);
	assert.equal(qimouTargetX(4, 2), 2);
	assert.equal(qimouTargetX(3, 2), 2);
	assert.equal(qimouTargetX(3, 1), 1);
	assert.equal(qimouTargetX(2, 3), 1);
	assert.equal(qimouTargetX(1, 3), 1);
});

const qimouTarget = over => ({
	currentlyInRange: false,
	canUseIgnoringDistance: true,
	effect: 1,
	attackDistance: 4,
	hp: over,
});

check('奇谋：远处可击杀目标放宽 cardUsable 阻塞（复现正向）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), true);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(2), attackDistance: 3 }],
	}), true);
});
check('奇谋：目标过厚不放宽（复现反向）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(4)],
	}), false);
});
check('奇谋：目标已在射程内不放宽（杀可直接使用）', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(3), currentlyInRange: true }],
	}), false);
});
check('奇谋：杀次数耗尽走原生路径，不重复放宽', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: false,
		targets: [qimouTarget(3)],
	}), false);
});
check('奇谋：1血不放宽；2血付1换击杀允许', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 1, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(1)],
	}), false);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 2, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(1), attackDistance: 2 }],
	}), true, 'hp2 支付1后剩1血，与 4→1 的档位风险一致');
});
check('奇谋：目标距离超出档位射程不放宽', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [{ ...qimouTarget(3), attackDistance: 6 }],
	}), false);
});
check('奇谋：原生已放行或无杀时不干预', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 1, hp: 4, shaCount: 3, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), false);
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 4, shaCount: 0, cardEnabled: true, cardUsable: true,
		targets: [qimouTarget(3)],
	}), false);
});

check('奇谋OL：贴脸且一发杀可收割时 gate 拦截（复现正向）', () => {
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 1, baseUses: 1,
	}]), false);
});
check('奇谋OL：需要额外出杀或减距离时 gate 放行', () => {
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: true, hp: 2, baseUses: 1,
	}]), true);
	assert.equal(reqimouNeedsPayment([{
		effect: 1, canUseIgnoringDistance: true, currentlyInRange: false, hp: 1, baseUses: 1,
	}]), true);
	assert.equal(reqimouNeedsPayment([]), false);
});
check('奇谋OL：支付档位按距离与击杀收紧', () => {
	const mk = (distance, hp) => ({ effect: 1, canUseIgnoringDistance: true, distance, attackRange: 1, hp });
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(1, 2)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(2, 2)] }), 1);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 3, baseUses: 1, targets: [mk(4, 3)] }), 3);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [mk(4, 3)] }), null, '手杀不足时回退原生档位');
});
check('奇谋OL：手杀不足以击杀时保留原生行为', () => {
	assert.equal(reqimouOptimalX({
		hp: 4, shaCount: 2, baseUses: 1,
		targets: [{ effect: 1, canUseIgnoringDistance: true, distance: 4, attackRange: 1, hp: 4 }],
	}), null);
	assert.equal(reqimouOptimalX({ hp: 4, shaCount: 2, baseUses: 1, targets: [] }), null);
});
check('奇谋OL：支付不超过 hp-1', () => {
	assert.equal(reqimouOptimalX({
		hp: 3, shaCount: 5, baseUses: 1,
		targets: [{ effect: 1, canUseIgnoringDistance: true, distance: 5, attackRange: 1, hp: 3 }],
	}), 2);
});

console.log('ALL PASS (' + passed + ')');
