import assert from 'node:assert/strict';
import {
	qimouTargetX, shouldBypassQimouCountBlock, qimouMinimalPayment, kuangguChoice, jushouShouldActivate,
	shensu1ShouldUse, shensu4ShouldUse, guhuoMaterialScore, retianxiangOptionIndex, huangtianTargetScore, buquDamageFactor,
} from '../source/score/decision/skills/rules/shenhuaFeng.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('奇谋档位按体力/杀数复刻宿主', () => {
	assert.equal(qimouTargetX(4, 3), 3);
	assert.equal(qimouTargetX(3, 2), 2);
	assert.equal(qimouTargetX(2, 5), 1);
	assert.equal(qimouTargetX(NaN, 3), 0);
});
check('少杀时只放宽“杀次数可用”这一条阻塞', () => {
	const target = { currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 3, hp: 2 };
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 0, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true, targets: [target],
	}), true);
});
check('原生已给正分时不覆盖', () => {
	assert.equal(shouldBypassQimouCountBlock({
		nativeResult: 1, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true,
		targets: [{ currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 3, hp: 2 }],
	}), false);
});
check('卡不可用/目标已在射程内/距离过远/目标血过厚均不放宽', () => {
	const base = { nativeResult: 0, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true };
	assert.equal(shouldBypassQimouCountBlock({ ...base, cardUsable: false, targets: [] }), false);
	assert.equal(shouldBypassQimouCountBlock({ ...base, targets: [{ currentlyInRange: true, canUseIgnoringDistance: true, effect: 1, attackDistance: 1, hp: 2 }] }), false);
	assert.equal(shouldBypassQimouCountBlock({ ...base, targets: [{ currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 5, hp: 2 }] }), false);
	assert.equal(shouldBypassQimouCountBlock({ ...base, targets: [{ currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 3, hp: 4 }] }), false);
});
check('低血/无杀/负收益目标不放宽', () => {
	assert.equal(shouldBypassQimouCountBlock({ nativeResult: 0, hp: 1, shaCount: 2, cardEnabled: true, cardUsable: true, targets: [] }), false);
	assert.equal(shouldBypassQimouCountBlock({ nativeResult: 0, hp: 3, shaCount: 0, cardEnabled: true, cardUsable: true, targets: [] }), false);
	assert.equal(shouldBypassQimouCountBlock({ nativeResult: 0, hp: 3, shaCount: 2, cardEnabled: true, cardUsable: true, targets: [{ currentlyInRange: false, canUseIgnoringDistance: true, effect: -1, attackDistance: 3, hp: 2 }] }), false);
});
check('奇谋支付最小化：近距低血目标降到更低支付档，够不着则维持原档', () => {
	const target = { currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 2, hp: 1 };
	assert.equal(qimouMinimalPayment({ tier: 3, baseUsable: 1, shaCount: 3, hp: 4, targets: [target] }), 1);
	const far = { currentlyInRange: false, canUseIgnoringDistance: true, effect: 1, attackDistance: 4, hp: 1 };
	assert.equal(qimouMinimalPayment({ tier: 3, baseUsable: 1, shaCount: 3, hp: 4, targets: [far] }), 3);
});
check('狂骨：1血回复；杀充足回复（原生保留）；2血无桃储备回复；其余摸牌', () => {
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 2 }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, shaReady: 2, shaUsable: 2, taoCount: 0 }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 2, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 2, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 1 }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 0, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'draw_card');
});
check('据守：已翻面免费；1血且近身有持牌敌人时放弃', () => {
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: true }), true);
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: false }), false);
	assert.equal(jushouShouldActivate({ hp: 2, hand: 1, turned: false }), true);
	assert.equal(jushouShouldActivate({ hp: 1, hand: 1, turned: false, threat: true }), false);
	assert.equal(jushouShouldActivate({ hp: 1, hand: 1, turned: false, threat: false }), true);
});
check('神速1：低手牌但可跳过不良判定且收益高于摸牌时放行', () => {
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: true, effect: 8, drawEffect: 5 }), true);
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: true, effect: 2, drawEffect: 5 }), false);
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: false, effect: 8, drawEffect: 5 }), false);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: false, effect: 2, drawEffect: 5 }), true);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: true, effect: -1, drawEffect: 5 }), false);
});
check('神速4：弃牌分支只在低体力/被乐/可收割濒死敌人时放行', () => {
	assert.equal(shensu4ShouldUse({ turned: true, needDiscard: 0, hp: 4, hasLebu: false, killTarget: false }), true);
	assert.equal(shensu4ShouldUse({ turned: false, needDiscard: 2, hp: 4, hasLebu: false, killTarget: false }), false);
	assert.equal(shensu4ShouldUse({ turned: false, needDiscard: 2, hp: 2, hasLebu: false, killTarget: false }), true);
	assert.equal(shensu4ShouldUse({ turned: false, needDiscard: 2, hp: 4, hasLebu: true, killTarget: false }), true);
	assert.equal(shensu4ShouldUse({ turned: false, needDiscard: 2, hp: 4, hasLebu: false, killTarget: true }), true);
	assert.equal(shensu4ShouldUse({ turned: false, needDiscard: 0, hp: 4, hasLebu: false, killTarget: true }), false);
});
check('蛊惑材料：真牌恒优先；诈称只支付低价值牌且濒死不支付', () => {
	assert.equal(guhuoMaterialScore({ isTrueCard: true, materialValue: 5, isDying: false }), 5);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 2, isDying: false }), 3);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 7, isDying: false }), 0);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 1, isDying: true }), 0);
});
check('天香两方案比较：取较优者，无法比较时回退原生', () => {
	assert.equal(retianxiangOptionIndex(3, 2), 0);
	assert.equal(retianxiangOptionIndex(1, 4), 1);
	assert.equal(retianxiangOptionIndex(NaN, 2), -1);
});
check('黄天：低体力选中闪按主公状态定档，闪电放行，高体力回退原生', () => {
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 1 }), 2);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: true, hasSelection: true, targetHp: 4 }), null);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: false, hasSelection: false, targetHp: 4 }), null);
	assert.equal(huangtianTargetScore({ hp: 2, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 3, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), null);
});
check('不屈：无创时按血量，有创时按公开信息重复概率上限1', () => {
	assert.equal(buquDamageFactor({ creations: [], outCount: {}, hp: 4 }), 1);
	assert.equal(buquDamageFactor({ creations: [], outCount: {}, hp: 1 }), 0.2);
	// 4点创，公开区已见每点数3张：每点剩余5/108，共20/108+0.1≈0.285
	const factor = buquDamageFactor({ creations: [3, 5, 7, 9], outCount: { 3: 3, 5: 3, 7: 3, 9: 3 }, hp: 0 });
	assert.ok(Math.abs(factor - (20 / 108 + 0.1)) < 1e-9);
	assert.equal(buquDamageFactor({ creations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], outCount: {}, hp: 0 }), 1);
});
console.log('ALL PASS (' + passed + ')');
