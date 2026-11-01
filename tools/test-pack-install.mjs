#!/usr/bin/env node
// 分包安装/回滚事务性回归：干净临时扩展、失败注入、重复安装、乱序回滚、共存、冲突。
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const option = name => { const index = process.argv.indexOf('--' + name); return index < 0 ? null : process.argv[index + 1]; };
const TEMPLATES = option('templates') || [path.join(HERE, 'pack-templates'), path.join(HERE, '..', 'pack-tools', 'templates')].find(candidate => fs.existsSync(candidate));
const CORE_DIR = option('core') || [path.join(REPO, 'score/decision/skills'), path.join(HERE, '..', 'source/score/decision/skills')].find(candidate => fs.existsSync(candidate));
if (!TEMPLATES || !CORE_DIR) throw new Error('找不到 pack-templates 或 shared core；请用 --templates/--core 指定');
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'djsc-pack-install-'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
let passed = 0;
const check = (name, fn) => { fn(); passed++; console.log('PASS ' + name); };

const core = {
	policyCore: fs.readFileSync(path.join(CORE_DIR, 'policyCore.js')),
	facade: fs.readFileSync(path.join(CORE_DIR, 'skillAIPolicies.js')),
};

function write(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, data);
}

function makePackage(id) {
	const moduleName = 'fixture' + id;
	const base = path.join(ROOT, 'packs', id);
	write(path.join(base, 'integration/apply-pack.mjs'), fs.readFileSync(path.join(TEMPLATES, 'apply-pack.mjs')));
	write(path.join(base, 'integration/rollback-pack.mjs'), fs.readFileSync(path.join(TEMPLATES, 'rollback-pack.mjs')));
	write(path.join(base, 'integration/pack-only/skillAIPolicyPacks.js'), `// @djsc-pack-imports-begin\nimport { pack as ${moduleName} } from './packs/${moduleName}.js?v=41a';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\t${moduleName},\n\t// @djsc-pack-registry-end\n];\n`);
	write(path.join(base, 'source/score/decision/skills/policyCore.js'), core.policyCore);
	write(path.join(base, 'source/score/decision/skills/skillAIPolicies.js'), core.facade);
	const packFile = Buffer.from(`export const pack = { id: '${id}' };\n`);
	const rulesFile = Buffer.from(`export const rules = '${id}';\n`);
	write(path.join(base, 'source/score/decision/skills/packs', moduleName + '.js'), packFile);
	write(path.join(base, 'source/score/decision/skills/rules', moduleName + '.js'), rulesFile);
	write(path.join(base, 'pack.json'), JSON.stringify({
		schema_version: '1.0',
		id,
		name: 'fixture ' + id,
		delivery_stage: '阶段性',
		module: moduleName,
		rules: moduleName,
		shared_files: { 'policyCore.js': sha(core.policyCore), 'skillAIPolicies.js': sha(core.facade) },
		pack_files: { ['packs/' + moduleName + '.js']: sha(packFile), ['rules/' + moduleName + '.js']: sha(rulesFile) },
	}, null, 2) + '\n');
	return { base, moduleName, packFile, rulesFile };
}

function makeTarget() {
	const root = path.join(ROOT, 'target-' + Math.random().toString(36).slice(2, 8));
	write(path.join(root, 'score/index.js'), `export function installScoreEngine() {}\nexport function uninstallScoreEngine() {}\nexport { installSkillAIPolicies, uninstallSkillAIPolicies } from './decision/skills/skillAIPolicies.js';\n`);
	write(path.join(root, 'score/foundation/adapt/host.js'), '// host\n');
	write(path.join(root, 'score/decision/safety/aiOverride.js'), '// override\n');
	fs.mkdirSync(path.join(root, 'score/decision/skills'), { recursive: true });
	return root;
}

function run(pkg, script, root, extraEnv = {}, extraArgs = []) {
	const result = spawnSync(process.execPath, [path.join(pkg.base, 'integration', script), '--extension-root', root, ...extraArgs], {
		encoding: 'utf8',
		env: { ...process.env, ...extraEnv },
	});
	let json = null;
	try { json = JSON.parse(result.stdout); } catch (error) {}
	return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

const apply = (pkg, root, env, args) => run(pkg, 'apply-pack.mjs', root, env, args);
const rollback = (pkg, root, args) => run(pkg, 'rollback-pack.mjs', root, {}, args);
const targetFile = (root, moduleName) => path.join(root, 'score/decision/skills/packs', moduleName + '.js');
const targetRules = (root, moduleName) => path.join(root, 'score/decision/skills/rules', moduleName + '.js');
const registryPath = root => path.join(root, 'score/decision/skills/skillAIPolicyPacks.js');
const readRegistry = root => fs.readFileSync(registryPath(root), 'utf8');
const countLine = (text, line) => text.split('\n').filter(item => item.trim() === line).length;
const assertEmptyRegistry = root => {
	assert(fs.existsSync(registryPath(root)), '回滚唯一分包后必须保留空注册表，避免 facade 加载失败');
	const registry = readRegistry(root);
	assert(registry.includes('// @djsc-pack-imports-begin'));
	assert(registry.includes('// @djsc-pack-registry-begin'));
	assert.equal(registry.split('\n').filter(line => /^\s*[A-Za-z0-9_$]+,\s*$/.test(line)).length, 0);
};

const pkgA = makePackage('A');
const pkgB = makePackage('B');
const A = pkgA.moduleName, B = pkgB.moduleName;

check('dry-run 不写任何文件', () => {
	const root = makeTarget();
	const result = apply(pkgA, root, {}, ['--dry-run']);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.json.status, 'planned');
	assert.equal(fs.existsSync(targetFile(root, A)), false);
	assert.equal(fs.existsSync(registryPath(root)), false);
});

check('安装 A：创建文件与带 marker 的注册表', () => {
	const root = makeTarget();
	const result = apply(pkgA, root);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.json.status, 'applied');
	assert(fs.existsSync(targetFile(root, A)));
	assert(fs.existsSync(targetRules(root, A)));
	const registry = readRegistry(root);
	assert(registry.includes(`import { pack as ${A} }`));
	assert.equal(countLine(registry, A + ','), 1);
	assert(fs.existsSync(path.join(root, '.djsc-pack-backups', 'A', 'record.json')));
});

check('重复安装 A：幂等，不重复追加注册行', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	const result = apply(pkgA, root);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(result.json.status, 'already-installed');
	assert.equal(countLine(readRegistry(root), A + ','), 1);
});

check('A+B 共存：注册表保留两行并各自有记录', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	assert.equal(apply(pkgB, root).status, 0);
	const registry = readRegistry(root);
	assert.equal(countLine(registry, A + ','), 1);
	assert.equal(countLine(registry, B + ','), 1);
	assert(fs.existsSync(path.join(root, '.djsc-pack-backups', 'A', 'record.json')));
	assert(fs.existsSync(path.join(root, '.djsc-pack-backups', 'B', 'record.json')));
});

check('乱序回滚 A→B：不复活 A，共享核心保留', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	assert.equal(apply(pkgB, root).status, 0);
	assert.equal(rollback(pkgA, root).status, 0);
	assert.equal(fs.existsSync(targetFile(root, A)), false);
	assert(fs.existsSync(targetFile(root, B)), true);
	let registry = readRegistry(root);
	assert.equal(countLine(registry, A + ','), 0);
	assert.equal(countLine(registry, B + ','), 1);
	assert.equal(rollback(pkgB, root).status, 0);
	assert.equal(fs.existsSync(targetFile(root, B)), false);
	registry = readRegistry(root);
	assert.equal(countLine(registry, A + ','), 0);
	assert.equal(countLine(registry, B + ','), 0);
	assertEmptyRegistry(root);
	assert(fs.existsSync(path.join(root, 'score/decision/skills/policyCore.js')));
	assert(fs.existsSync(path.join(root, 'score/decision/skills/skillAIPolicies.js')));
	assert.equal(apply(pkgA, root).status, 0, '回滚后应可重新安装');
});

check('先回滚 B→A：恢复 A 行，A 回滚后保留空注册表', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	assert.equal(apply(pkgB, root).status, 0);
	assert.equal(rollback(pkgB, root).status, 0);
	assert.equal(countLine(readRegistry(root), A + ','), 1);
	assert.equal(countLine(readRegistry(root), B + ','), 0);
	assert.equal(rollback(pkgA, root).status, 0);
	assertEmptyRegistry(root);
});

check('共享核心冲突：拒绝安装且不改注册表', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	const beforeRegistry = readRegistry(root);
	fs.appendFileSync(path.join(root, 'score/decision/skills/policyCore.js'), '\n// developer change\n');
	const result = apply(pkgB, root);
	assert.equal(result.status, 1);
	assert(result.stderr.includes('共享核心'));
	assert.equal(fs.existsSync(targetFile(root, B)), false);
	assert.equal(readRegistry(root), beforeRegistry);
});

check('注册表引用缺失模块：预检失败且不写文件', () => {
	const root = makeTarget();
	write(registryPath(root), `// @djsc-pack-imports-begin\nimport { pack as ghost } from './packs/ghost.js?v=41a';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\tghost,\n\t// @djsc-pack-registry-end\n];\n`);
	const result = apply(pkgA, root);
	assert.equal(result.status, 1);
	assert(result.stderr.includes('不存在的分包模块'));
	assert.equal(fs.existsSync(targetFile(root, A)), false);
});

check('失败注入：恢复安装前状态，下次可自动清理并重装', () => {
	const root = makeTarget();
	const failed = apply(pkgA, root, { DJSC_PACK_TEST_FAIL_AFTER: '1' });
	assert.equal(failed.status, 1);
	assert(failed.stderr.includes('injected failure'));
	assert.equal(fs.existsSync(targetFile(root, A)), false);
	assert.equal(fs.existsSync(targetRules(root, A)), false);
	assert.equal(fs.existsSync(registryPath(root)), false);
	const retry = apply(pkgA, root);
	assert.equal(retry.status, 0, retry.stderr);
	assert(fs.existsSync(targetFile(root, A)));
});

check('他人修改分包文件：默认拒绝回滚，--force 才删除', () => {
	const root = makeTarget();
	assert.equal(apply(pkgA, root).status, 0);
	fs.appendFileSync(targetFile(root, A), '\n// developer change\n');
	const blocked = rollback(pkgA, root);
	assert.equal(blocked.status, 1);
	assert(blocked.stderr.includes('保留已修改文件'));
	assert.equal(countLine(readRegistry(root), A + ','), 1);
	const forced = rollback(pkgA, root, ['--force']);
	assert.equal(forced.status, 0, forced.stderr);
	assert.equal(fs.existsSync(targetFile(root, A)), false);
	assertEmptyRegistry(root);
});

check('注册表含他人模块：安装/回滚只增删本包行', () => {
	const root = makeTarget();
	const developer = 'developer';
	write(path.join(root, 'score/decision/skills/packs', developer + '.js'), 'export const pack = { id: "developer" };\n');
	write(registryPath(root), `// @djsc-pack-imports-begin\nimport { pack as ${developer} } from './packs/${developer}.js?v=41a';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\t${developer},\n\t// @djsc-pack-registry-end\n];\n`);
	assert.equal(apply(pkgA, root).status, 0);
	let registry = readRegistry(root);
	assert.equal(countLine(registry, developer + ','), 1);
	assert.equal(countLine(registry, A + ','), 1);
	assert.equal(rollback(pkgA, root).status, 0);
	registry = readRegistry(root);
	assert.equal(countLine(registry, developer + ','), 1);
	assert.equal(countLine(registry, A + ','), 0);
});

console.log(`ALL PACK INSTALL TESTS PASS (${passed})`);
fs.rmSync(ROOT, { recursive: true, force: true });
