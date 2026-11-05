import assert from 'node:assert/strict';
import {
	qimouTargetX, shouldBypassQimouCountBlock, kuangguChoice, jushouShouldActivate,
	shensu1ShouldUse, guhuoMaterialScore, huangtianTargetScore,
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
check('狂骨：1血回复；杀充足回复（原生保留）；其余摸牌', () => {
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 2 }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, shaReady: 2, shaUsable: 2, taoCount: 0 }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 2, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 2, isDamaged: true, recoverEffect: 1, shaReady: 0, shaUsable: 1, taoCount: 1 }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 0, shaReady: 0, shaUsable: 1, taoCount: 0 }), 'draw_card');
});
check('据守：已翻面发动；未翻面保留原生阈值', () => {
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: true }), true);
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: false }), false);
	assert.equal(jushouShouldActivate({ hp: 2, hand: 1, turned: false }), true);
	assert.equal(jushouShouldActivate({ hp: 1, hand: 1, turned: false, threat: true }), true);
	assert.equal(jushouShouldActivate({ hp: 1, hand: 1, turned: false, threat: false }), true);
});
check('神速1：低手牌但可跳过不良判定且收益高于摸牌时放行', () => {
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: true, effect: 8, drawEffect: 5 }), true);
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: true, effect: 2, drawEffect: 5 }), false);
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: false, effect: 8, drawEffect: 5 }), false);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: false, effect: 2, drawEffect: 5 }), true);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: true, effect: -1, drawEffect: 5 }), false);
});
check('蛊惑材料：真牌恒优先；诈称只支付低价值牌且濒死不支付', () => {
	assert.equal(guhuoMaterialScore({ isTrueCard: true, materialValue: 5, isDying: false }), 5);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 2, isDying: false }), 3);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 7, isDying: false }), 0);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 1, isDying: true }), 0);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: 1, hp: 1, cardName: 'shan' }), 0);
	assert.equal(guhuoMaterialScore({ isTrueCard: false, materialValue: -5, hp: 3, cardName: 'sha' }), 4.5);
});
check('黄天：低体力选中最后的闪保留，闪电放行', () => {
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 1 }), 0);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: true, hasSelection: true, targetHp: 4 }), null);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 1, handShan: 1, selectedShan: false, selectedShandian: false, hasSelection: false, targetHp: 4 }), null);
	assert.equal(huangtianTargetScore({ hp: 2, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), 0);
	assert.equal(huangtianTargetScore({ hp: 3, handShan: 1, selectedShan: true, selectedShandian: false, hasSelection: true, targetHp: 4 }), null);
});
console.log('ALL PASS (' + passed + ')');
