import assert from 'node:assert/strict';
import { olkongshengCostNeedsFix, olkongshengExpansionView } from '../source/score/decision/skills/rules/shenhuaLei.js';

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
console.log('ALL PASS (' + passed + ')');
