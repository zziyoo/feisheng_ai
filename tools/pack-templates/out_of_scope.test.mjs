import assert from 'node:assert/strict';
import { fairButtonScore, redimengFindNeedsFix, shouldMaskHiddenButtonChoice } from '../source/score/decision/skills/rules/outOfScope.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('公平选择只依赖玩家与位置', () => {
	const a = fairButtonScore('p1', 0);
	assert.equal(a, fairButtonScore('p1', 0));
	assert.notEqual(a, fairButtonScore('p1', 1));
	assert.notEqual(a, fairButtonScore('p2', 0));
	assert(a >= 0 && a < 1);
});
check('不同位置分数稳定且互不读取牌面', () => {
	const values = [0, 1, 2, 3].map(index => fairButtonScore('p1', index));
	assert.equal(new Set(values).size, 4);
});
check('遮蔽只对 AI 且只在 redimeng 上下文', () => {
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(true, false, ['redimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(true, true, ['redimeng']), true);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, ['dimeng']), false);
	assert.equal(shouldMaskHiddenButtonChoice(false, false, null), false);
});
check('只识别宿主 find(2) 的已知块级变量越界', () => {
	const broken = 'find(type){ for (let i2 = 0; i2 < list.length; i2++) { count = i2; } return list[i]; }';
	const brokenSource = 'find(type){ for (let i = 0; i < list.length; i++) { count = i; } return list[i]; }';
	const fixed = 'find(type){ for (let i2 = 0; i2 < list.length; i2++) { count = i2; } return list[i2]; }';
	assert.equal(redimengFindNeedsFix(broken), true);
	assert.equal(redimengFindNeedsFix(brokenSource), true);
	assert.equal(redimengFindNeedsFix(fixed), false);
	assert.equal(redimengFindNeedsFix(''), false);
});
console.log('ALL PASS (' + passed + ')');
