import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFENSE_RULES } from '../score/decision/skills/skillAIPolicyRules.js';

const read = path => fs.readFileSync(path, 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('模型特征维度仍为 134', () => {
	assert.match(read('score/model/features/features.js'), /FEATURE_DIM\s*=\s*134/);
	assert.match(read('score/model/features/dimensionAdapter.js'), /CURRENT_DIM\s*=\s*134/);
});
check('扩展版本仍为 4.4.4', () => {
	const info = JSON.parse(read('info.json'));
	assert.equal(info.version, '4.4.4');
});
check('score/index.js 安装与卸载都接线策略层', () => {
	const source = read('score/index.js');
	assert.match(source, /import\s*\{\s*installSkillAIPolicies/);
	assert.match(source, /installSkillAIPolicies\(\)/);
	assert.match(source, /uninstallSkillAIPolicies\(\)/);
});
check('标准制衡不注册策略，只保留界制衡', () => {
	assert.deepEqual(Object.keys(DEFENSE_RULES), ['rezhiheng']);
});
check('突袭目标策略只注册 new_retuxi', () => {
	const source = read('score/decision/skills/skillAIPolicies.js');
	const match = source.match(/TARGET_POLICIES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
	assert(match);
	const ids = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
	assert.deepEqual(ids, ['new_retuxi']);
});
check('缔盟策略不调用宿主看牌评分', () => {
	const source = read('score/decision/skills/skillAIPolicies.js');
	const codeLines = source.split('\n').filter(line => !/^\s*(\*|\/\/)/.test(line));
	assert(!codeLines.some(line => line.includes('get.value(button')));
	assert(source.includes('shouldMaskHiddenButtonChoice'));
});
check('箜声策略有宿主成本指纹', () => {
	const source = read('score/decision/skills/skillAIPolicies.js');
	assert(source.includes('olkongshengCostNeedsFix'));
	assert(source.includes('olkongshengExpansionView'));
});
check('第二批奇谋策略只放宽阻塞且不改技能规则', () => {
	const source = read('score/decision/skills/skillAIPolicies.js');
	const rules = read('score/decision/skills/skillAIPolicyRules.js');
	assert(source.includes('shouldBypassQimouCountBlock'));
	assert(source.includes('reqimouNeedsPayment'));
	assert(source.includes('reqimouOptimalX'));
	/* 规则层只做数值判断，不直接改写 lib.skill */
	assert(!rules.includes('lib.skill'));
	/* 生命周期可还原：qimou/reqimou 的 result.player 与 reqimou.content 都有备份 */
	assert(source.includes('_qimouBackup'));
	assert(source.includes('_reqimouGateBackup'));
	assert(source.includes('_reqimouContentBackup'));
});
check('v2 模型未接线，运行时只有 v3', () => {
	const extension = read('extension.js');
	assert(!/policyModelV2/.test(extension));
	assert(matchImport(extension, 'policyModelV3'));
	const adapter = read('score/model/net/policyModelV2.js');
	assert.match(adapter, /import\(['"]\.\/client_policy_model_v2\.js/);
});
function matchImport(source, name) {
	return new RegExp('import\\s+[^;]*' + name).test(source);
}
check('baseline 用 tag 解引用后的提交', () => {
	const baseline = JSON.parse(read('docs/skill-ai-20261030/baseline.json'));
	assert.equal(baseline.tag_object, '22cf3798445321385ed01582aaf35afdd5b7f63d');
	assert.equal(baseline.v4_4_4_tag_commit, '1fe5292eb3022dd8d1db494617b21a12be912e61');
	assert.equal(baseline.upstream_master_commit, '1fe5292eb3022dd8d1db494617b21a12be912e61');
});

console.log('ALL PASS (' + passed + ')');
