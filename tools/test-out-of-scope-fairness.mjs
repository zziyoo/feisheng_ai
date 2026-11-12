import assert from 'node:assert/strict';
import { fairButtonScore, redimengFindNeedsFix, shouldMaskHiddenButtonChoice } from '../score/decision/skills/rules/outOfScope.js';

assert.equal(fairButtonScore('p1', 0), fairButtonScore('p1', 0));
assert.notEqual(fairButtonScore('p1', 0), fairButtonScore('p1', 1));
assert.notEqual(fairButtonScore('p1', 0), fairButtonScore('p2', 0));
assert.equal(shouldMaskHiddenButtonChoice(false, false, ['redimeng']), true);
assert.equal(shouldMaskHiddenButtonChoice(true, false, ['redimeng']), false);
assert.equal(shouldMaskHiddenButtonChoice(true, true, ['redimeng']), true);
assert.equal(shouldMaskHiddenButtonChoice(false, false, ['dimeng']), false);
assert.equal(shouldMaskHiddenButtonChoice(false, false, null), false);
const broken = 'find(type){ for (let i2 = 0; i2 < list.length; i2++) { count = i2; } return list[i]; }';
const brokenSource = 'find(type){ for (let i = 0; i < list.length; i++) { count = i; } return list[i]; }';
const fixed = 'find(type){ for (let i2 = 0; i2 < list.length; i2++) { count = i2; } return list[i2]; }';
assert.equal(redimengFindNeedsFix(broken), true);
assert.equal(redimengFindNeedsFix(brokenSource), true);
assert.equal(redimengFindNeedsFix(fixed), false);
assert.equal(redimengFindNeedsFix(''), false);
console.log('out_of_scope fairness tests PASS');
