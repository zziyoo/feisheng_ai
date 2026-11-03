import assert from 'node:assert/strict';
import { qimouTargetX, shouldBypassQimouCountBlock, kuangguChoice, jushouShouldActivate, shensu1ShouldUse, guhuoShouldBluff, huangtianShouldGive } from '../source/score/decision/skills/rules/shenhuaFeng.js';

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
check('狂骨：1血可回复时优先回复，其余返回原生选择', () => {
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 1, nativeRecover: false }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, nativeRecover: false }), 'draw_card');
	assert.equal(kuangguChoice({ hp: 3, isDamaged: true, recoverEffect: 1, nativeRecover: true }), 'recover_hp');
	assert.equal(kuangguChoice({ hp: 1, isDamaged: true, recoverEffect: 0, nativeRecover: false }), 'draw_card');
});
check('据守：已翻面时摸三张没有额外回合成本', () => {
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: true }), true);
	assert.equal(jushouShouldActivate({ hp: 4, hand: 3, turned: false }), false);
	assert.equal(jushouShouldActivate({ hp: 2, hand: 1, turned: false }), true);
});
check('神速1：低手牌但可跳过不良判定时放行', () => {
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: true, effect: 2 }), true);
	assert.equal(shensu1ShouldUse({ check: false, harmfulJudge: false, effect: 2 }), false);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: false, effect: 2 }), true);
	assert.equal(shensu1ShouldUse({ check: true, harmfulJudge: true, effect: -1 }), false);
});
check('蛊惑：1血无真牌不诈称，有真牌或非1血保持原生', () => {
	assert.equal(guhuoShouldBluff({ enemyNum: 2, hasTrue: false, hp: 1, dying: false }), false);
	assert.equal(guhuoShouldBluff({ enemyNum: 2, hasTrue: true, hp: 1, dying: false }), true);
	assert.equal(guhuoShouldBluff({ enemyNum: 2, hasTrue: false, hp: 3, dying: false }), true);
});
check('黄天：1血最后一张闪不转交，多闪或非1血保持原生', () => {
	assert.equal(huangtianShouldGive({ hp: 1, handShan: 1, hasShandian: false, selectedShan: true }), false);
	assert.equal(huangtianShouldGive({ hp: 1, handShan: 1, hasShandian: false, selectedShan: false }), false);
	assert.equal(huangtianShouldGive({ hp: 1, handShan: 1, hasShandian: true, selectedShan: true }), true);
	assert.equal(huangtianShouldGive({ hp: 1, handShan: 2, hasShandian: false, selectedShan: true }), true);
	assert.equal(huangtianShouldGive({ hp: 3, handShan: 1, hasShandian: false, selectedShan: true }), true);
});
console.log('ALL PASS (' + passed + ')');
