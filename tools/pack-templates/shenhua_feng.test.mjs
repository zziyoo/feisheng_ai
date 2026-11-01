import assert from 'node:assert/strict';
import { qimouTargetX, shouldBypassQimouCountBlock } from '../source/score/decision/skills/rules/shenhuaFeng.js';

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
console.log('ALL PASS (' + passed + ')');
