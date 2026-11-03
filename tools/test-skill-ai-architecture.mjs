import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFENSE_RULES } from '../score/decision/skills/skillAIPolicyRules.js';

const read = path => fs.readFileSync(path, 'utf8');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };
const PACK_FILES = ['refreshStandard', 'shenhuaFeng', 'refreshFeng', 'shenhuaLei', 'outOfScope', 'shenhuaHuo'];
const PACK_META = {
	refreshStandard: { id: 'refresh_standard', skills: ['rezhiheng', 'new_retuxi'], rules: 'refreshStandard' },
	shenhuaFeng: { id: 'shenhua_feng', skills: ['qimou', 'xinkuanggu', 'jushou', 'xinshensu', 'xinfu_guhuo', 'huangtian'], rules: 'shenhuaFeng' },
	refreshFeng: { id: 'refresh_feng', skills: ['reqimou'], rules: 'refreshFeng' },
	shenhuaLei: { id: 'shenhua_lei', skills: ['olkongsheng'], rules: 'shenhuaLei' },
	outOfScope: { id: 'out_of_scope', skills: ['redimeng'], rules: 'outOfScope' },
	shenhuaHuo: { id: 'shenhua_huo', skills: ['luanji'], rules: 'shenhuaHuo' },
};
const packSource = name => read('score/decision/skills/packs/' + name + '.js');
const packId = source => (source.match(/id:\s*'([^']+)'/) || [])[1];
const packSkills = source => [...((source.match(/skills:\s*\[([^\]]*)\]/) || [])[1] || '').matchAll(/'([^']+)'/g)].map(m => m[1]);
const codeLines = source => source.split('\n').filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line));

check('模型特征维度仍为 134', () => {
	assert.match(read('score/model/features/features.js'), /FEATURE_DIM\s*=\s*134/);
	assert.match(read('score/model/features/dimensionAdapter.js'), /CURRENT_DIM\s*=\s*134/);
});
check('扩展版本仍为 4.4.4', () => {
	assert.equal(JSON.parse(read('info.json')).version, '4.4.4');
});
check('score/index.js 仍接线策略层，facade 只依赖共享核心与注册表', () => {
	const index = read('score/index.js');
	assert.match(index, /import\s*\{\s*installSkillAIPolicies/);
	assert.match(index, /installSkillAIPolicies\(\)/);
	assert.match(index, /uninstallSkillAIPolicies\(\)/);
	const facade = read('score/decision/skills/skillAIPolicies.js');
	assert.match(facade, /from '\.\/policyCore\.js/);
	assert.match(facade, /from '\.\/skillAIPolicyPacks\.js/);
	assert(!/rules\/|\.\/packs\//.test(facade), 'facade 不得直接依赖具体分包');
});
check('标准制衡不注册策略，只保留界制衡', () => {
	assert.deepEqual(Object.keys(DEFENSE_RULES), ['rezhiheng']);
});
check('分包注册表完整、技能归属唯一、分包字段齐全', () => {
	const registry = read('score/decision/skills/skillAIPolicyPacks.js');
	assert(registry.includes('@djsc-pack-imports-begin'));
	assert(registry.includes('@djsc-pack-imports-end'));
	assert(registry.includes('@djsc-pack-registry-begin'));
	assert(registry.includes('@djsc-pack-registry-end'));
	const ids = [];
	const skills = [];
	for (const file of PACK_FILES) {
		const source = packSource(file);
		assert.equal(packId(source), PACK_META[file].id, file + ' id');
		assert.deepEqual(packSkills(source), PACK_META[file].skills, file + ' skills');
		assert(/group:\s*'[^']+'/.test(source), file + ' group');
		assert(/statsDefaults:\s*\{/.test(source), file + ' statsDefaults');
		assert(/install,/.test(source), file + ' install');
		assert(registry.includes('pack as ' + file), file + ' registered');
		ids.push(PACK_META[file].id);
		skills.push(...PACK_META[file].skills);
	}
	assert.equal(new Set(ids).size, ids.length, 'pack id 不得重复');
	assert.equal(new Set(skills).size, skills.length, '同一技能只能由一个分包注册');
	assert.deepEqual(new Set(skills), new Set(['rezhiheng', 'new_retuxi', 'qimou', 'reqimou', 'olkongsheng', 'redimeng', 'xinkuanggu', 'luanji', 'jushou', 'xinshensu', 'xinfu_guhuo', 'huangtian']));
});
check('分包之间不互相 import，且只 import 自己的规则文件', () => {
	for (const file of PACK_FILES) {
		const source = packSource(file);
		assert(!/from ['"]\.\/packs\//.test(source), file + ' 不得 import 其他分包');
		assert(!source.includes('skillAIPolicyRules.js'), file + ' 不得 import 规则聚合出口');
		if (!PACK_META[file].reviewOnly) assert(source.includes('../rules/' + PACK_META[file].rules + '.js'), file + ' 必须 import 自己的规则文件');
	}
});
check('共享核心不包含任何具体技能名，生命周期可逆', () => {
	const core = read('score/decision/skills/policyCore.js');
	assert(!/rezhiheng|new_retuxi|retuxi|olkongsheng|qimou|reqimou|redimeng/.test(core), 'core 必须与技能无关');
	assert(/backups\.splice\(0\)\.reverse\(\)/.test(core));
	assert(/backup\.owner\[backup\.key\] === backup\.wrapped/.test(core));
	assert(/__djscSkillPolicy/.test(core));
	assert(/installed = false/.test(core));
});
check('共享核心安装幂等，注册表导入与条目一一对应且无重复', () => {
	const core = read('score/decision/skills/policyCore.js');
	assert(/if \(installed\) return;/.test(core), '重复安装必须直接返回');
	const registry = read('score/decision/skills/skillAIPolicyPacks.js');
	const imports = [...registry.matchAll(/import\s*\{\s*pack as\s+([A-Za-z0-9_$]+)\s*\}/g)].map(match => match[1]);
	const entries = [...registry.matchAll(/^\s*([A-Za-z0-9_$]+),\s*$/gm)].map(match => match[1]);
	assert.equal(new Set(imports).size, imports.length, 'import 别名不得重复');
	assert.equal(new Set(entries).size, entries.length, '注册条目不得重复');
	assert.deepEqual(new Set(imports), new Set(entries), 'import 与条目必须一一对应');
});
check('风分包只放宽已复现的阻塞且不复制技能规则', () => {
	const source = packSource('shenhuaFeng');
	assert(source.includes('shouldBypassQimouCountBlock'));
	assert(source.includes('lib.filter.cardEnabled'));
	assert(source.includes('lib.filter.cardUsable'));
	assert(source.includes('jushouShouldActivate'));
	assert(source.includes('shensu1ShouldUse'));
	assert(source.includes('drawEffect'));
	assert(source.includes('shensuCostBlock'));
	assert(source.includes('guhuoShouldBluff'));
	assert(source.includes('huangtianShouldGive'));
	assert(source.includes('ui.selected.cards'));
	assert(source.includes('selectedShandian'));
	assert(!source.includes('reqimou'));
	const rules = read('score/decision/skills/rules/shenhuaFeng.js');
	assert(rules.includes('qimouTargetX'));
	assert(rules.includes('jushouShouldActivate'));
	assert(rules.includes('shensu1ShouldUse'));
	assert(rules.includes('guhuoShouldBluff'));
	assert(rules.includes('huangtianShouldGive'));
	assert(!rules.includes('lib.skill'));
});
check('火分包只覆盖乱击且不覆盖连环/强袭/双雄原生评分', () => {
	const source = packSource('shenhuaHuo');
	assert.deepEqual(packSkills(source), ['luanji']);
	assert(!/lianhuan|qiangxix|shuangxiong/.test(source));
	assert(!codeLines(source).some(line => line.includes('get.value(button')));
	assert(source.includes('luanjiAllyLethal'));
	const rules = read('score/decision/skills/rules/shenhuaHuo.js');
	assert(rules.includes('luanjiAllyLethal'));
	assert(!rules.includes('lib.skill'));
});
check('OL界魏延分包使用真实攻击范围与一次性 chooseNumbers', () => {
	const source = packSource('refreshFeng');
	assert(source.includes('reqimouNeedsPayment'));
	assert(source.includes('reqimouOptimalX'));
	assert(source.includes('reqimouKillableByHand'));
	assert(/player\.getAttackRange\(\)/.test(source));
	assert(!/player\.attackRange\b/.test(source));
	assert(/player\.chooseNumbers = originalChooseNumbers;\s*\n\s*const next/.test(source));
	assert(/const isHuman = player === game\.me && !_status\.auto;/.test(source));
	assert(/Number\(native\) > 0 && targets\.length/.test(source));
	assert(/!reqimouNeedsPayment\(targets\)/.test(source));
	assert(/player\.canSaveCard\(card, player\)/.test(source));
	const rules = read('score/decision/skills/rules/refreshFeng.js');
	assert(/selfRescue > 0 \? life : Math\.max\(1, life - 1\)/.test(rules));
	assert(rules.includes('reqimouKillBenefit'));
	assert(/for \(let x = 1; x <= maxPayment; x\+\+\)/.test(rules));
	assert(/Math\.min\(sha, uses\)/.test(rules));
	assert(/baselineBenefit = reqimouKillBenefit\(shaCount, baseUses, 0, targets\)/.test(rules));
	assert(/maxBenefit <= baselineBenefit\) return null/.test(rules));
	assert(rules.includes('interpretBaseUses'));
	assert(!/getCardUsable\('sha'\) \|\| 1/.test(rules));
	assert(!rules.includes('lib.skill'));
	const calls = source.match(/reqimouOptimalX\(\{[^}]*\}\)/g) || [];
	assert(calls.length >= 2, 'gate 与 clamp 都调用 reqimouOptimalX');
	for (const call of calls) assert(call.includes('saveCount'), 'reqimouOptimalX 调用必须传 saveCount: ' + call);
});
check('缔盟分包不调用宿主看牌评分', () => {
	const source = packSource('outOfScope');
	assert(!codeLines(source).some(line => line.includes('get.value(button')));
	assert(source.includes('shouldMaskHiddenButtonChoice'));
	assert(source.includes('fairButtonScore'));
});
check('箜声分包保留宿主成本指纹与数组视图', () => {
	const source = packSource('shenhuaLei');
	assert(source.includes('olkongshengCostNeedsFix'));
	assert(source.includes('olkongshengExpansionView'));
	const rules = read('score/decision/skills/rules/shenhuaLei.js');
	assert(rules.includes('olkongshengCostNeedsFix'));
	assert(!rules.includes('lib.skill'));
});
check('突袭目标策略只注册 new_retuxi', () => {
	const source = packSource('refreshStandard');
	const match = source.match(/TARGET_POLICIES\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
	assert(match);
	assert.deepEqual([...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]), ['new_retuxi']);
	const rules = read('score/decision/skills/rules/refreshStandard.js');
	assert(rules.includes('retuxiHandBonus'));
	assert(!rules.includes('lib.skill'));
});
check('规则层保持纯函数，不含宿主实现', () => {
	for (const file of fs.readdirSync('score/decision/skills/rules')) {
		if (!file.endsWith('.js')) continue;
		const rules = read('score/decision/skills/rules/' + file);
		assert(!rules.includes('lib.skill'), file + ' 不应包含 lib.skill');
		assert(!rules.includes('player.getCards'), file + ' 不应读取宿主手牌');
	}
});
check('v2 模型未接线，运行时只有 v3', () => {
	const extension = read('extension.js');
	assert(!/policyModelV2/.test(extension));
	assert(new RegExp('import\\s+[^;]*policyModelV3').test(extension));
	assert.match(read('score/model/net/policyModelV2.js'), /import\(['"]\.\/client_policy_model_v2\.js/);
});
check('baseline 用 tag 解引用后的提交', () => {
	const baseline = JSON.parse(read('docs/skill-ai-20261030/baseline.json'));
	assert.equal(baseline.tag_object, '22cf3798445321385ed01582aaf35afdd5b7f63d');
	assert.equal(baseline.v4_4_4_tag_commit, '1fe5292eb3022dd8d1db494617b21a12be912e61');
	assert.equal(baseline.upstream_master_commit, '1fe5292eb3022dd8d1db494617b21a12be912e61');
});

console.log('ALL PASS (' + passed + ')');
