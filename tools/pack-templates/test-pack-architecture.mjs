import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(BASE, rel), 'utf8');
const pack = JSON.parse(read('pack.json'));
const modulePath = `source/score/decision/skills/packs/${pack.module}.js`;
const rulesPath = `source/score/decision/skills/rules/${pack.rules}.js`;

let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS', name); };

check('包元数据与目标技能一致', () => {
	assert(['阶段性', '可交付', '已交付'].includes(pack.delivery_stage));
	assert.equal(pack.complete_delivery, pack.delivery_stage !== '阶段性');
	assert(Array.isArray(pack.implemented_skills));
	if (pack.implemented_skills.length) assert(pack.target_skills.includes(pack.implemented_skills[0]));
	else assert(pack.review_only === true, '无实现技能时必须标记 review_only');
});
check('分包模块只 import 共享核心、自己的规则与安全适配', () => {
	const source = read(modulePath);
	assert(source.includes(`id: '${pack.id}'`));
	if (!pack.implemented_skills.length) {
		assert(!/host\.wrap|\.ai2|\.ai\d|lib\.skill/.test(source), '复核包不得覆盖宿主 AI');
		return;
	}
	for (const skill of pack.implemented_skills) assert(source.includes(`'${skill}'`));
	assert(source.includes(`../rules/${pack.rules}.js`));
	assert(!source.includes('skillAIPolicyRules.js'));
	assert(!/from ['"]\.\/packs\//.test(source));
});
check('共享核心与具体技能解耦', () => {
	const core = read('source/score/decision/skills/policyCore.js');
	for (const skill of pack.all_registered_skills || []) assert(!core.includes(skill));
	assert(core.includes('backups.splice(0).reverse()'));
});
check('包内只携带本分包策略模块', () => {
	const dir = path.join(BASE, 'source/score/decision/skills/packs');
	const files = fs.readdirSync(dir).filter(name => name.endsWith('.js'));
	assert.deepEqual(files, [pack.module + '.js']);
});
check('注册表与 pack-only 注册表可安全合并', () => {
	const shared = read('source/score/decision/skills/skillAIPolicyPacks.js');
	assert(shared.includes('@djsc-pack-imports-begin'));
	assert(shared.includes('@djsc-pack-registry-begin'));
	assert(shared.includes(`pack as ${pack.module}`));
	const only = read('integration/pack-only/skillAIPolicyPacks.js');
	assert(only.includes(`./packs/${pack.module}.js`));
	assert(only.includes(`pack as ${pack.module}`));
	assert(!only.includes('refreshStandard') || pack.module === 'refreshStandard');
});
check('134 维模型契约与版本未被本分包修改', () => {
	assert.match(read('contract/score/model/features/features.js'), /FEATURE_DIM\s*=\s*134/);
	assert.match(read('contract/score/model/features/dimensionAdapter.js'), /CURRENT_DIM\s*=\s*134/);
	assert.equal(JSON.parse(read('contract/info.json')).version, '4.4.4');
});
check('分包声明的静态约束成立', () => {
	const source = read(modulePath) + '\n' + read(rulesPath);
	const code = source.split('\n').filter(line => !/^\s*(\*|\/\/|\/\*)/.test(line)).join('\n');
	for (const needle of pack.required || []) assert(source.includes(needle), 'missing required: ' + needle);
	for (const needle of pack.forbidden || []) assert(!code.includes(needle), 'found forbidden: ' + needle);
});
check('分包规则不读取宿主实现', () => {
	const rules = read(rulesPath);
	assert(!rules.includes('lib.skill'));
	assert(!rules.includes('player.getCards'));
});
console.log('ALL PASS (' + passed + ')');
