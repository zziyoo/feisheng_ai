#!/usr/bin/env node
// 对实际分包 ZIP 做独立验收：解压、校验、干净目标安装、宿主加载、回滚、共存、134维契约。
// 用法：node tools/accept-skill-ai-pack.mjs --zip a.zip [--zip b.zip ...] --out result.json
//   [--repo <worktree>] [--workdir <dir>] [--host-root <dir>] [--browser <chrome>] [--playwright <dir>]
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(option('repo') || process.env.DJSC_REPO || path.join(HERE, '..'));
const WORK = path.resolve(option('workdir') || fs.mkdtempSync(path.join(os.tmpdir(), 'djsc-pack-accept-')));
const OUT = path.resolve(option('out') || path.join(WORK, 'acceptance.json'));
const HOST = option('host-root');
const CHROME = option('browser');
const PLAYWRIGHT = option('playwright');
const SCENE = option('scene') || 'reqimou-near1-2sha-hp2';
const ZIP_SHA = option('expected-sha');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const exists = file => fs.existsSync(file);
const read = file => fs.readFileSync(file);
const jsonOf = file => JSON.parse(read(file).toString('utf8'));

function option(name) {
	const index = process.argv.indexOf('--' + name);
	return index < 0 ? null : process.argv[index + 1];
}
function optionAll(name) {
	const result = [];
	process.argv.forEach((item, index) => { if (item === '--' + name && process.argv[index + 1]) result.push(process.argv[index + 1]); });
	return result;
}
const zips = optionAll('zip');
if (!zips.length) {
	console.error('usage: node tools/accept-skill-ai-pack.mjs --zip <pack.zip> [--zip <pack.zip> ...] --out <result.json>');
	process.exit(2);
}

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
function runNode(script, args, options = {}) { return run(process.execPath, [script, ...args], options); }
function runJson(script, args, options = {}) {
	const result = runNode(script, args, options);
	let json = null;
	try { json = JSON.parse(result.stdout); } catch (error) {}
	return { ...result, json };
}

function copyTree(source, target) {
	fs.mkdirSync(target, { recursive: true });
	for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
		const sourcePath = path.join(source, entry.name);
		const targetPath = path.join(target, entry.name);
		if (entry.isDirectory()) copyTree(sourcePath, targetPath);
		else fs.copyFileSync(sourcePath, targetPath);
	}
}

function makeCleanTarget(name) {
	const root = path.join(WORK, 'targets', name);
	fs.rmSync(root, { recursive: true, force: true });
	fs.mkdirSync(root, { recursive: true });
	for (const entry of fs.readdirSync(REPO, { withFileTypes: true })) {
		if (['.git', '.djsc-pack-backups', 'score'].includes(entry.name)) continue;
		const source = path.join(REPO, entry.name);
		const target = path.join(root, entry.name);
		if (entry.isDirectory()) fs.symlinkSync(source, target, 'junction');
		else fs.copyFileSync(source, target);
	}
	copyTree(path.join(REPO, 'score'), path.join(root, 'score'));
	const skills = path.join(root, 'score', 'decision', 'skills');
	for (const file of ['policyCore.js', 'skillAIPolicies.js', 'skillAIPolicyPacks.js', 'skillAIPolicyRules.js']) fs.rmSync(path.join(skills, file), { force: true });
	fs.rmSync(path.join(skills, 'packs'), { recursive: true, force: true });
	fs.rmSync(path.join(skills, 'rules'), { recursive: true, force: true });
	return root;
}

function extractZip(zip, index) {
	const destination = path.join(WORK, 'extract', String(index));
	fs.rmSync(destination, { recursive: true, force: true });
	fs.mkdirSync(destination, { recursive: true });
	const result = run('python', ['-m', 'zipfile', '-e', path.resolve(zip), destination], { cwd: WORK });
	if (result.status !== 0) throw new Error('解压失败：' + zip + '\n' + result.stderr);
	let root = destination;
	if (!exists(path.join(root, 'manifest.json'))) {
		const dirs = fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory());
		if (dirs.length === 1 && exists(path.join(root, dirs[0].name, 'manifest.json'))) root = path.join(root, dirs[0].name);
	}
	if (!exists(path.join(root, 'manifest.json'))) throw new Error('解压后找不到 manifest.json：' + zip);
	return root;
}

function verifyImports(root) {
	const registry = path.join(root, 'score/decision/skills/skillAIPolicyPacks.js');
	if (!exists(registry)) return [];
	const text = read(registry).toString('utf8');
	const imports = [];
	const pattern = /import\s*\{\s*pack\s+as\s+([A-Za-z0-9_$]+)\s*\}\s*from\s*['"]\.\/packs\/([^'"?]+)\.js(?:\?[^'"]*)?['"]/g;
	let match;
	while ((match = pattern.exec(text))) {
		const file = path.join(root, 'score/decision/skills/packs', match[2] + '.js');
		if (!exists(file)) throw new Error('注册表导入的文件不存在：' + match[2]);
		imports.push({ alias: match[1], module: match[2], file: 'score/decision/skills/packs/' + match[2] + '.js' });
	}
	return imports;
}

function assertInstalled(root, pkg, packJson) {
	const checks = [];
	if (packJson.registry_template_sha256) {
		const template = path.join(pkg.root, 'integration/pack-only/skillAIPolicyPacks.js');
		if (!exists(template) || sha(read(template)) !== packJson.registry_template_sha256) throw new Error('pack-only 注册表模板哈希不一致');
	}
	for (const [file, hash] of Object.entries(packJson.pack_files || {})) {
		const target = path.join(root, 'score/decision/skills', ...file.split('/'));
		if (!exists(target)) throw new Error('缺少分包文件：' + file);
		const actual = sha(read(target));
		if (actual !== hash) throw new Error('分包文件哈希不一致：' + file);
		checks.push({ file, sha256: actual });
	}
	for (const [file, hash] of Object.entries(packJson.shared_files || {})) {
		const target = path.join(root, 'score/decision/skills', file);
		if (!exists(target)) throw new Error('缺少共享核心：' + file);
		const actual = sha(read(target));
		if (actual !== hash) throw new Error('共享核心哈希不一致：' + file);
		checks.push({ file: 'shared/' + file, sha256: actual });
	}
	const imports = verifyImports(root);
	if (!imports.some(item => item.module === packJson.module)) throw new Error('注册表缺少本包导入：' + packJson.module);
	const registry = read(path.join(root, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
	if (registry.split('\n').filter(line => line.trim() === packJson.module + ',').length !== 1) throw new Error('注册表本包条目数量不是 1：' + packJson.module);
	for (const file of ['score/model/features/features.js', 'score/model/features/dimensionAdapter.js']) {
		const target = path.join(root, file);
		if (!exists(target)) throw new Error('缺少模型契约文件：' + file);
		const actual = sha(read(target));
		const expected = sha(read(path.join(REPO, file)));
		if (actual !== expected) throw new Error('模型契约文件被改动：' + file);
	}
	const features = read(path.join(root, 'score/model/features/features.js')).toString('utf8');
	const adapter = read(path.join(root, 'score/model/features/dimensionAdapter.js')).toString('utf8');
	if (!/FEATURE_DIM\s*=\s*134/.test(features) || !/CURRENT_DIM\s*=\s*134/.test(adapter)) throw new Error('134 维模型契约常量缺失');
	return { checks, imports };
}

function assertRolledBack(root, packJson, expectedImports) {
	for (const file of Object.keys(packJson.pack_files || {})) {
		if (exists(path.join(root, 'score/decision/skills', ...file.split('/')))) throw new Error('回滚后分包文件仍存在：' + file);
	}
	const imports = verifyImports(root);
	const still = imports.find(item => item.module === packJson.module);
	if (still) throw new Error('回滚后注册表仍导入本包：' + packJson.module);
	for (const item of expectedImports || []) {
		if (!imports.some(current => current.module === item.module)) throw new Error('回滚误删其他包：' + item.module);
	}
	const core = path.join(root, 'score/decision/skills/policyCore.js');
	const facade = path.join(root, 'score/decision/skills/skillAIPolicies.js');
	if (!exists(core) || !exists(facade)) throw new Error('回滚误删共享核心/facade');
	return imports;
}

function loadTarget(root, label) {
	if (!HOST || !CHROME || !PLAYWRIGHT) return { status: 'skipped', reason: '未提供 --host-root/--browser/--playwright' };
	const output = path.join(WORK, 'load-' + label + '.json');
	const result = runNode(path.join(REPO, 'tools/skill-ai-hp-real-host.mjs'), [
		'--mode', 'identity', '--variant', 'extension', '--scenario', SCENE,
		'--seed', '20261030', '--watchdog-ms', '120000',
		'--host-root', HOST, '--extension-root', root,
		'--browser', CHROME, '--playwright', PLAYWRIGHT, '--output', output,
	], { cwd: REPO, timeout: 240000 });
	let report = null;
	try { report = jsonOf(output); } catch (error) {}
	const scenario = report && report.results && report.results[0];
	const pageErrors = (scenario && scenario.pageErrors) || [];
	if (result.status !== 0 || !report || report.status !== 'passed') throw new Error('宿主加载失败 [' + label + ']：' + (scenario && scenario.error || result.stderr || result.stdout).slice(0, 800));
	if (pageErrors.length) throw new Error('宿主加载出现 pageerror [' + label + ']：' + pageErrors.join('; '));
	const stats = scenario.after && scenario.after.policyStats;
	return { status: 'passed', scene: SCENE, policyStats: stats, output: path.relative(WORK, output) };
}

function packSummary(zip, root) {
	const packJson = jsonOf(path.join(root, 'pack.json'));
	return {
		id: packJson.id,
		name: packJson.name,
		zip: path.resolve(zip),
		zip_size: fs.statSync(zip).size,
		zip_sha256: sha(read(zip)),
		delivery_stage: packJson.delivery_stage,
		implemented_skills: packJson.implemented_skills || [],
		target_skills_count: (packJson.target_skills || []).length,
		package_tests: runNode(path.join(root, 'tests/run-pack-tests.mjs'), [], { cwd: root }),
		verify_zip: run('python', [path.join(root, 'verify.py'), '--zip', path.resolve(zip)], { cwd: root }),
		verify_dir: run('python', [path.join(root, 'verify.py')], { cwd: root }),
		verify_cross_platform: run('python', [path.join(root, 'tests/test-verify-zip.py')], { cwd: root }),
		root,
		packJson,
	};
}

const result = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	mode: zips.length === 1 ? 'single' : 'combined',
	repo: REPO,
	repo_head: run('git', ['-C', REPO, 'rev-parse', 'HEAD']).stdout.trim(),
	scene: SCENE,
	packs: [],
	steps: [],
	pass: false,
	workdir: WORK,
};
try {
	const prepared = zips.map((zip, index) => {
		const root = extractZip(zip, index);
		const summary = packSummary(zip, root);
		result.packs.push({
			id: summary.id, name: summary.name, zip: summary.zip, zip_size: summary.zip_size, zip_sha256: summary.zip_sha256,
			delivery_stage: summary.delivery_stage, implemented_skills: summary.implemented_skills, target_skills_count: summary.target_skills_count,
			package_tests_status: summary.package_tests.status,
			verify_zip_status: summary.verify_zip.status,
			verify_dir_status: summary.verify_dir.status,
			verify_cross_platform_status: summary.verify_cross_platform.status,
		});
		result.steps.push({ step: 'extract+verify', pack: summary.id, status: summary.package_tests.status === 0 && summary.verify_zip.status === 0 && summary.verify_dir.status === 0 && summary.verify_cross_platform.status === 0 ? 'passed' : 'failed', package_tests: summary.package_tests, verify_zip: summary.verify_zip, verify_dir: summary.verify_dir, verify_cross_platform: summary.verify_cross_platform });
		if (summary.package_tests.status !== 0 || summary.verify_zip.status !== 0 || summary.verify_dir.status !== 0 || summary.verify_cross_platform.status !== 0) throw new Error('包内测试/校验失败：' + summary.id);
		return summary;
	});
	if (ZIP_SHA) {
		for (const summary of prepared) if (summary.zip_sha256 !== ZIP_SHA) throw new Error('ZIP SHA256 与期望不一致：' + summary.id);
	}

	if (prepared.length === 1) {
		const pack = prepared[0];
		const target = makeCleanTarget('single-' + pack.id);
		const applied = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (applied.status !== 0 || applied.json.status !== 'applied') throw new Error('安装失败：' + applied.stderr);
		result.steps.push({ step: 'apply', pack: pack.id, status: 'passed', output: applied.json });
		const installed = assertInstalled(target, pack, pack.packJson);
		result.steps.push({ step: 'install-check', pack: pack.id, status: 'passed', ...installed });
		const load = loadTarget(target, 'single-' + pack.id + '-installed');
		result.steps.push({ step: 'host-load-installed', pack: pack.id, ...load });
		const stats = load.policyStats || {};
		if (load.status === 'passed' && (!stats.packs || !stats.packs[pack.id])) throw new Error('安装后策略统计缺少分包：' + pack.id);
		const rolled = runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (rolled.status !== 0 || rolled.json.status !== 'rolled-back') throw new Error('回滚失败：' + rolled.stderr);
		result.steps.push({ step: 'rollback', pack: pack.id, status: 'passed', output: rolled.json });
		const after = assertRolledBack(target, pack, []);
		result.steps.push({ step: 'rollback-check', pack: pack.id, status: 'passed', imports: after });
		const loadAfter = loadTarget(target, 'single-' + pack.id + '-rolledback');
		result.steps.push({ step: 'host-load-rolledback', pack: pack.id, ...loadAfter });
		const statsAfter = loadAfter.policyStats || {};
		if (loadAfter.status === 'passed' && statsAfter.packs && Object.keys(statsAfter.packs).length) throw new Error('回滚后策略仍注册分包：' + Object.keys(statsAfter.packs).join(','));
		const reinstall = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (reinstall.status !== 0 || !['applied', 'already-installed'].includes(reinstall.json.status)) throw new Error('重装失败：' + reinstall.stderr);
		result.steps.push({ step: 'reinstall', pack: pack.id, status: 'passed', output: reinstall.json });
		assertInstalled(target, pack, pack.packJson);
		const finalRollback = runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (finalRollback.status !== 0) throw new Error('重装后回滚失败：' + finalRollback.stderr);
		result.target = target;
	} else {
		const target = makeCleanTarget('combined');
		const developerPath = path.join(target, 'score/decision/skills/packs/developer.js');
		fs.mkdirSync(path.dirname(developerPath), { recursive: true });
		fs.writeFileSync(developerPath, 'export const pack = { id: "developer" };\n');
		fs.writeFileSync(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js'), '// @djsc-pack-imports-begin\nimport { pack as developer } from \'./packs/developer.js?v=41a\';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\tdeveloper,\n\t// @djsc-pack-registry-end\n];\n');
		const applied = [];
		for (const pack of prepared) {
			const outcome = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
			if (outcome.status !== 0 || !['applied', 'already-installed'].includes(outcome.json.status)) throw new Error('共存安装失败：' + pack.id + ' ' + outcome.stderr);
			assertInstalled(target, pack, pack.packJson);
			applied.push(pack);
			result.steps.push({ step: 'apply-coexist', pack: pack.id, status: 'passed', output: outcome.json });
		}
		const registryText = read(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
		if (!registryText.includes('developer,')) throw new Error('共存安装覆盖了开发者注册行');
		if (verifyImports(target).length !== prepared.length + 1) throw new Error('共存注册表导入数不符');
		const load = loadTarget(target, 'combined-installed');
		result.steps.push({ step: 'host-load-installed', pack: prepared.map(item => item.id).join(','), ...load });
		const stats = load.policyStats || {};
		for (const pack of prepared) if (load.status === 'passed' && (!stats.packs || !stats.packs[pack.id])) throw new Error('共存加载缺少分包统计：' + pack.id);
		const remaining = new Set(prepared.map(pack => pack.id));
		const rollbackOrder = [...prepared].reverse();
		for (const pack of rollbackOrder) {
			const rolled = runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
			if (rolled.status !== 0) throw new Error('共存乱序回滚失败：' + pack.id + ' ' + rolled.stderr);
			remaining.delete(pack.id);
			const imports = verifyImports(target);
			for (const id of remaining) {
				const packJson = prepared.find(item => item.id === id).packJson;
				if (!imports.some(item => item.module === packJson.module)) throw new Error('回滚误删其他分包：' + id);
			}
			for (const file of Object.keys(pack.packJson.pack_files || {})) if (exists(path.join(target, 'score/decision/skills', ...file.split('/')))) throw new Error('回滚后文件仍存在：' + pack.id + '/' + file);
			assertRolledBack(target, pack, []);
			result.steps.push({ step: 'rollback-coexist', pack: pack.id, status: 'passed', remaining: [...remaining] });
		}
		const afterText = read(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
		if (!afterText.includes('developer,')) throw new Error('回滚误删开发者注册行');
		const loadAfter = loadTarget(target, 'combined-rolledback');
		result.steps.push({ step: 'host-load-rolledback', pack: 'combined', ...loadAfter });
		const statsAfter = loadAfter.policyStats || {};
		if (loadAfter.status === 'passed' && statsAfter.packs && Object.keys(statsAfter.packs).length) throw new Error('共存回滚后仍有策略分包注册');
		result.target = target;
	}
	result.pass = true;
	console.log(JSON.stringify(result, null, 2));
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
	console.log('ACCEPTANCE PASS (' + prepared.length + ' pack(s)); result=' + OUT);
} catch (error) {
	result.error = String(error && error.stack || error);
	console.error('ACCEPTANCE FAIL: ' + (error && error.message || error));
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
	process.exit(1);
}
