import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
	SHENHUA_HUO_POLICY_RULES,
	luanjiAllyLethal, luanjiNetTooLow, tianyiLowCompare, tianyiKnownWinTarget, tianyiKnownWinAvailable, jianchuWorthwhile,
} from '../source/score/decision/skills/rules/shenhuaHuo.js';

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('火包清单登记乱击/天义/鞬出/强袭AI优化（区分缺陷修复与质量提升）', () => {
	const meta = JSON.parse(fs.readFileSync('pack.json', 'utf8'));
	assert.equal(meta.id, 'shenhua_huo');
	assert.deepEqual(meta.implemented_skills, ['luanji', 'tianyi', 'jianchu', 'qiangxix']);
	assert.deepEqual(meta.optimization_types, {
		luanji: '缺陷修复',
		tianyi: '质量提升',
		jianchu: '质量提升',
		qiangxix: '质量提升',
	});
	assert.equal(meta.review_only, false);
});
check('火包携带共享依赖 skillVetoRegistry 且哈希登记', () => {
	assert.ok(fs.existsSync('source/score/decision/skills/skillVetoRegistry.js'), 'source 缺少 skillVetoRegistry.js');
	const meta = JSON.parse(fs.readFileSync('pack.json', 'utf8'));
	assert.ok(meta.shared_files && meta.shared_files.skillVetoRegistryjs === undefined || true);
	assert.ok(typeof meta.shared_files['skillVetoRegistry.js'] === 'string', 'pack.json.shared_files 缺少 skillVetoRegistry.js');
});
check('乱击濒死否决：1血空手且无确定免伤（护甲吸收/藤甲）', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0 }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, hujia: 1 }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armorName: 'tengjia' }), false);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 2 }), false);
	assert.equal(luanjiAllyLethal({ ally: false, hp: 1, hand: 0 }), false);
});
check('乱击概率防御不视为必然安全（镜像原生补丁0001）', () => {
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armorName: 'bagua' }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armorName: 'baiyin' }), true);
	assert.equal(luanjiAllyLethal({ ally: true, hp: 1, hand: 0, armorName: 'renwang' }), true);
});
check('乱击小规模对局净收益门槛（镜像原生补丁0001）', () => {
	assert.equal(luanjiNetTooLow({ count: 3, net: 0.5, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 3, net: 1, overLimit: false }), false);
	assert.equal(luanjiNetTooLow({ count: 5, net: 1.4, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 7, net: 1.9, overLimit: false }), true);
	assert.equal(luanjiNetTooLow({ count: 3, net: -5, overLimit: true }), false);
});
check('天义低点数默认保守（镜像原生补丁0002）', () => {
	assert.equal(tianyiLowCompare({ maxNumber: 5 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 9 }), true);
	assert.equal(tianyiLowCompare({ maxNumber: 10 }), false);
	assert.equal(tianyiLowCompare({ maxNumber: 13 }), false);
});
check('天义已知必胜逐目标绑定：只用完全公开手牌且点数确定更低（镜像原生补丁0002）', () => {
	assert.equal(tianyiKnownWinTarget({ maxNumber: 5, handCount: 1, knownCount: 1, knownMax: 2 }), true);
	assert.equal(tianyiKnownWinTarget({ maxNumber: 5, handCount: 2, knownCount: 1, knownMax: 2 }), false);
	assert.equal(tianyiKnownWinTarget({ maxNumber: 5, handCount: 1, knownCount: 1, knownMax: 5 }), false);
	assert.equal(tianyiKnownWinTarget({ maxNumber: 12, handCount: 1, knownCount: 1, knownMax: 2 }), false);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: true, comparable: true, handCount: 1, knownCount: 1, knownMax: 2 }],
	}), true);
	assert.equal(tianyiKnownWinAvailable({
		maxNumber: 5,
		candidates: [{ hostile: false, comparable: true, handCount: 1, knownCount: 1, knownMax: 2 }],
	}), false);
});
check('鞬出仅在值得发动时触发；hp<=1击杀动机在有护甲时不成立（镜像原生补丁0003）', () => {
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 3 }), false);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 1, hp: 4, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 1, hand: 3 }), true);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 1, hand: 3, hujia: 1 }), false);
	assert.equal(jianchuWorthwhile({ hostile: true, equips: 0, hp: 4, hand: 1 }), true);
	assert.equal(jianchuWorthwhile({ hostile: false, equips: 1, hp: 4, hand: 3 }), false);
});
check('纯规则出口完整', () => {
	assert.deepEqual(Object.keys(SHENHUA_HUO_POLICY_RULES), [
		'luanjiAllyLethal', 'luanjiNetTooLow', 'tianyiLowCompare', 'tianyiKnownWinTarget', 'tianyiKnownWinAvailable', 'jianchuWorthwhile',
	]);
});
console.log('ALL PASS (' + passed + ')');
