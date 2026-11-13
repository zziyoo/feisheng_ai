#!/usr/bin/env node
// 六包实际 ZIP 的安装事务回归：顺序依赖、六包共存、单包回滚、全量回滚/重装、故障注入、共享核心冲突。
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const WORK = path.resolve(option('workdir') || fs.mkdtempSync(path.join(os.tmpdir(), 'djsc-sixpack-install-')));
const OUT = path.resolve(option('out') || path.join(WORK, 'install-battery.json'));
const BASE_REF = option('base-ref') || '1fe5292eb3022dd8d1db494617b21a12be912e61';
const FULL_ENGINE_REF = option('full-engine-ref') || 'a863553cdfae1b997a2fb4e2899ea84323903bcd';
const ZIPS = optionAll('zip');
if (!ZIPS.length) {
	console.error('usage: node tools/six-pack-installer-battery.mjs --zip <pack.zip> [--zip ...] --out <result.json>');
	process.exit(2);
}

function option(name) {
	const index = process.argv.indexOf('--' + name);
	return index < 0 ? null : process.argv[index + 1];
}
function optionAll(name) {
	const result = [];
	process.argv.forEach((item, index) => {
		if (item === '--' + name && process.argv[index + 1]) result.push(process.argv[index + 1]);
	});
	return result;
}
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const exists = file => fs.existsSync(file);
const read = file => fs.readFileSync(file);
const jsonOf = file => JSON.parse(read(file).toString('utf8'));

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: options.cwd || REPO,
		encoding: 'utf8',
		timeout: options.timeout || 240000,
		env: { ...process.env, ...(options.env || {}) },
	});
	return {
		command: [command, ...args].join(' '),
		status: result.status,
		signal: result.signal,
		stdout: String(result.stdout || ''),
		stderr: String(result.stderr || ''),
		error: result.error ? String(result.error.message || result.error) : null,
	};
}
const runNode = (script, args, options) => run(process.execPath, [script, ...args], options);
function runJson(script, args, options) {
	const result = runNode(script, args, options);
	let json = null;
	try { json = JSON.parse(result.stdout); } catch (error) {}
	return { ...result, json };
}

function extractZip(zip, name) {
	const root = path.join(WORK, 'extract', name);
	fs.rmSync(root, { recursive: true, force: true });
	fs.mkdirSync(root, { recursive: true });
	const result = run('python', ['-m', 'zipfile', '-e', path.resolve(zip), root], { cwd: WORK });
	assert.equal(result.status, 0, result.stderr);
	return root;
}

function archive(ref, name) {
	const zip = path.join(WORK, 'targets', name + '.zip');
	fs.mkdirSync(path.dirname(zip), { recursive: true });
	fs.rmSync(zip, { force: true });
	const result = run('git', ['-C', REPO, 'archive', '--format=zip', '--output=' + zip, ref], { cwd: REPO });
	assert.equal(result.status, 0, result.stderr);
	const root = path.join(WORK, 'targets', name);
	fs.rmSync(root, { recursive: true, force: true });
	fs.mkdirSync(root, { recursive: true });
	const extracted = run('python', ['-m', 'zipfile', '-e', zip, root], { cwd: WORK });
	assert.equal(extracted.status, 0, extracted.stderr);
	return root;
}

function write(file, data) {
	fs.mkdirSync(path.dirname(file), { recursive: true });
	fs.writeFileSync(file, data);
}

function registryTemplate() {
	return '// @djsc-pack-imports-begin\nimport { pack as developer } from \'./packs/developer.js?v=41a\';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\tdeveloper,\n\t// @djsc-pack-registry-end\n];\n';
}

function makeTarget(name, ref, options = {}) {
	const root = archive(ref, name);
	if (options.wireIndex) {
		const diff = path.join(byId.refresh_standard.root, 'patches/score-index.diff');
		const wired = run('git', ['apply', diff], { cwd: root });
		assert.equal(wired.status, 0, wired.stderr);
		assert(fs.readFileSync(path.join(root, 'score/index.js'), 'utf8').includes('installSkillAIPolicies'), 'score-index.diff 未实际写入 score/index.js');
	}
	if (options.scrubPacks) {
		const skills = path.join(root, 'score/decision/skills');
		for (const file of ['policyCore.js', 'skillAIPolicies.js', 'skillAIPolicyPacks.js', 'skillPlanHints.js', 'skillVetoRegistry.js']) fs.rmSync(path.join(skills, file), { force: true });
		fs.rmSync(path.join(skills, 'packs'), { recursive: true, force: true });
		fs.rmSync(path.join(skills, 'rules'), { recursive: true, force: true });
	}
	write(path.join(root, 'score/decision/skills/packs/developer.js'), 'export const pack = { id: "developer" };\n');
	write(path.join(root, 'score/decision/skills/skillAIPolicyPacks.js'), registryTemplate());
	return root;
}

function targetPath(root, rel) {
	return path.join(root, 'score/decision/skills', ...rel.split('/'));
}
function registryPath(root) {
	return path.join(root, 'score/decision/skills/skillAIPolicyPacks.js');
}
function registryText(root) {
	return read(registryPath(root)).toString('utf8');
}
function entryCount(root) {
	return registryText(root).split(/\r?\n/).filter(line => /^\s*[A-Za-z0-9_$]+,\s*$/.test(line)).length;
}
function importCount(root) {
	return registryText(root).split(/\r?\n/).filter(line => /^\s*import\b.*\.\/packs\//.test(line)).length;
}
function installed(root, pack) {
	assert(registryText(root).includes(`import { pack as ${pack.json.module} }`), pack.id + ' 导入缺失');
	assert.equal(registryText(root).split(/\r?\n/).filter(line => line.trim() === pack.json.module + ',').length, 1, pack.id + ' 注册行重复');
	for (const [name, hash] of Object.entries(pack.json.shared_files || {})) {
		assert.equal(sha(read(path.join(root, 'score/decision/skills', name))), hash, pack.id + ' 共享核心不一致 ' + name);
	}
	for (const [rel, hash] of Object.entries(pack.json.pack_files || {})) {
		assert.equal(sha(read(targetPath(root, rel))), hash, pack.id + ' 分包文件不一致 ' + rel);
	}
}
function absent(root, pack) {
	for (const rel of Object.keys(pack.json.pack_files || {})) {
		if (rel === 'skillPlanHints.js') continue;
		assert(!exists(targetPath(root, rel)), pack.id + ' 回滚后文件仍存在 ' + rel);
	}
	assert(!registryText(root).includes(`import { pack as ${pack.json.module} }`), pack.id + ' 回滚后导入仍存在');
	if (pack.id === 'refresh_standard') assert(exists(path.join(root, 'score/decision/skills/skillPlanHints.js')), '回滚误删完整引擎共享软建议文件');
}
function apply(pack, root, env = {}) {
	return runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', root], { cwd: pack.root, env });
}
function rollback(pack, root) {
	return runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', root], { cwd: pack.root });
}
function snapshot(root) {
	const map = {};
	const walk = (dir, rel) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const next = rel ? rel + '/' + entry.name : entry.name;
			if (next === '.djsc-pack-backups' || next === '.git') continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full, next);
			else map[next] = sha(read(full));
		}
	};
	walk(root, '');
	return map;
}
function sameSnapshot(before, after) {
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	for (const key of keys) if (before[key] !== after[key]) return key;
	return null;
}
function record(step, data) {
	results.steps.push({ step, status: 'passed', ...data });
	console.log('PASS ' + step);
}

const packs = ZIPS.map((zip, index) => {
	const root = extractZip(zip, String(index));
	const json = jsonOf(path.join(root, 'pack.json'));
	return { id: json.id, json, root, zip: path.resolve(zip), sha256: sha(read(zip)) };
});
const byId = Object.fromEntries(packs.map(pack => [pack.id, pack]));
/* 本版新神话风只声明旧界风对包哈希；双风必须界风先装。顺序与交付 README/UPGRADE 一致。 */
const ORDER = ['refresh_standard', 'refresh_feng', 'shenhua_feng', 'shenhua_huo', 'shenhua_lei', 'out_of_scope'];
assert.deepEqual(packs.map(pack => pack.id), ORDER, 'ZIP 顺序必须与安装顺序一致');

const results = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	repo: REPO,
	repo_head: run('git', ['-C', REPO, 'rev-parse', 'HEAD']).stdout.trim(),
	base_ref: BASE_REF,
	full_engine_ref: FULL_ENGINE_REF,
	install_order: ORDER,
	packs: packs.map(pack => ({ id: pack.id, zip: path.basename(pack.zip), zip_sha256: pack.sha256, module: pack.json.module })),
	steps: [],
	pass: false,
};

try {
	{
		const root = makeTarget('order-old-engine', FULL_ENGINE_REF, { scrubPacks: true });
		const first = apply(byId.shenhua_feng, root);
		assert.notEqual(first.status, 0, '旧完整引擎缺少 skillPlanHints 时风包不应安装成功');
		assert.match(first.stderr, /skillPlanHints\.js/, '拒绝原因必须指向 skillPlanHints.js');
		assert(!exists(targetPath(root, 'packs/shenhuaFeng.js')), '拒绝时必须零写入');
		assert.equal(entryCount(root), 1, '拒绝时注册表必须保持 developer 单行');
		const standard = apply(byId.refresh_standard, root);
		assert.equal(standard.status, 0, standard.stderr);
		installed(root, byId.refresh_standard);
		const second = apply(byId.shenhua_feng, root);
		assert.equal(second.status, 0, second.stderr);
		installed(root, byId.shenhua_feng);
		record('order-skillPlanHints', { first: first.stderr.trim().split(/\r?\n/).slice(0, 3), standard: standard.json.status, second: second.json.status });
	}

	{
		const root = makeTarget('install-six', BASE_REF, { wireIndex: true });
		for (const id of ORDER) {
			const result = apply(byId[id], root);
			assert.equal(result.status, 0, id + ' ' + result.stderr);
			assert(['applied', 'already-installed'].includes(result.json.status), id + ' 安装状态异常');
			installed(root, byId[id]);
		}
		assert.equal(entryCount(root), ORDER.length + 1, '注册行数量必须为六包 + developer');
		assert.equal(importCount(root), ORDER.length + 1, '导入行数量必须为六包 + developer');
		assert.equal(new Set(packs.map(pack => pack.json.module)).size, packs.length, '模块别名必须唯一');
		const shared = Object.fromEntries(Object.keys(byId.refresh_standard.json.shared_files).map(name => [name, sha(read(path.join(root, 'score/decision/skills', name)))]));
		record('install-six', { entries: entryCount(root), imports: importCount(root), shared });

		const repeat = apply(byId.refresh_standard, root);
		assert.equal(repeat.status, 0, repeat.stderr);
		assert.equal(repeat.json.status, 'already-installed', '重复安装必须幂等');
		assert.equal(entryCount(root), ORDER.length + 1, '重复安装不得增加注册行');
		record('idempotent-reinstall', { status: repeat.json.status, entries: entryCount(root) });

		const rolled = rollback(byId.out_of_scope, root);
		assert.equal(rolled.status, 0, rolled.stderr);
		assert.equal(rolled.json.status, 'rolled-back', '单包回滚状态异常');
		absent(root, byId.out_of_scope);
		for (const id of ORDER.filter(id => id !== 'out_of_scope')) installed(root, byId[id]);
		record('rollback-one', { rolled: 'out_of_scope', remaining: ORDER.filter(id => id !== 'out_of_scope') });

		const reinstall = apply(byId.out_of_scope, root);
		assert.equal(reinstall.status, 0, reinstall.stderr);
		installed(root, byId.out_of_scope);
		assert.equal(entryCount(root), ORDER.length + 1, '重装后注册行数量不符');
		record('reinstall-one', { status: reinstall.json.status, entries: entryCount(root) });

		const remaining = new Set(ORDER);
		for (const id of [...ORDER].reverse()) {
			const result = rollback(byId[id], root);
			assert.equal(result.status, 0, id + ' ' + result.stderr);
			absent(root, byId[id]);
			remaining.delete(id);
			for (const other of remaining) installed(root, byId[other]);
		}
		assert.equal(entryCount(root), 1, '全量回滚后只应保留 developer');
		assert.equal(importCount(root), 1, '全量回滚后只应保留 developer 导入');
		for (const name of Object.keys(byId.refresh_standard.json.shared_files)) assert(exists(path.join(root, 'score/decision/skills', name)), '全量回滚后共享核心应保留');
		record('full-rollback', { entries: entryCount(root), imports: importCount(root) });

		for (const id of ORDER) {
			const result = apply(byId[id], root);
			assert.equal(result.status, 0, id + ' ' + result.stderr);
			installed(root, byId[id]);
		}
		assert.equal(entryCount(root), ORDER.length + 1, '全量重装后注册行数量不符');
		record('full-reinstall', { entries: entryCount(root), imports: importCount(root) });
	}

	{
		const root = makeTarget('fault', BASE_REF, { wireIndex: true });
		const before = snapshot(root);
		const failed = apply(byId.refresh_standard, root, { DJSC_PACK_TEST_FAIL_AFTER: '2' });
		assert.notEqual(failed.status, 0, '故障注入必须失败');
		const after = snapshot(root);
		const changed = sameSnapshot(before, after);
		assert.equal(changed, null, '故障注入后残留半安装文件：' + changed);
		assert(!exists(path.join(root, 'score/decision/skills/policyCore.js')), '故障后不应留下共享核心');
		assert.equal(entryCount(root), 1, '故障后注册表必须只保留 developer');
		const journal = path.join(root, '.djsc-pack-backups/refresh_standard/transaction.json');
		const journalData = exists(journal) ? jsonOf(journal) : null;
		record('fault-injection', { exit: failed.status, changed, journal_status: journalData && journalData.status });
	}

	{
		const root = makeTarget('mismatch', BASE_REF, { wireIndex: true });
		const core = path.join(root, 'score/decision/skills/policyCore.js');
		write(core, '// foreign shared core\n');
		const before = snapshot(root);
		const failed = apply(byId.refresh_standard, root);
		assert.notEqual(failed.status, 0, '共享核心不匹配必须拒绝');
		assert.match(failed.stderr, /共享核心/, '拒绝原因必须指向共享核心');
		const after = snapshot(root);
		const changed = sameSnapshot(before, after);
		assert.equal(changed, null, '共享核心冲突时不得写任何文件：' + changed);
		assert(!exists(path.join(root, 'score/decision/skills/skillPlanHints.js')), '共享核心冲突时不得安装标准包文件');
		record('shared-core-mismatch', { exit: failed.status, changed, stderr: failed.stderr.trim().split(/\r?\n/).slice(0, 4) });
	}

	results.pass = true;
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
	console.log('INSTALL BATTERY PASS; result=' + OUT);
} catch (error) {
	results.error = String(error && error.stack || error);
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
	console.error('INSTALL BATTERY FAIL: ' + (error && error.message || error));
	process.exit(1);
}
