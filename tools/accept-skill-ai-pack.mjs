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
import { compareNativeExtension } from './shenhua-feng-review-semantics.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(option('repo') || process.env.DJSC_REPO || path.join(HERE, '..'));
const WORK = path.resolve(option('workdir') || fs.mkdtempSync(path.join(os.tmpdir(), 'djsc-pack-accept-')));
const OUT = path.resolve(option('out') || path.join(WORK, 'acceptance.json'));
const HOST = option('host-root');
const CHROME = option('browser');
const PLAYWRIGHT = option('playwright');
const ZIP_SHA = option('expected-sha');
const BASE_REF = option('base-ref') || null;
const WIRE_INDEX = argsHas('wire-index-diff') || !!BASE_REF;
const BASELINE_DIR = option('baseline-dir') ? path.resolve(option('baseline-dir')) : null;
const BASELINE_PREFIX = option('baseline-prefix') || 'accept-';
const EXPLICIT_SCENES = option('scenes') ? option('scenes').split(',').map(item => item.trim()).filter(Boolean) : null;
const ALLOW_MISSING_TESTS = argsHas('allow-missing-tests');
const DEFAULT_SCENES = {
	refresh_standard: ['rezhiheng-3hp', 'new-retuxi-order'],
	shenhua_feng: [
		'hp-qimou-distance4-hp3', 'hp-qimou-distance4-hp4-negative', 'hp-qimou-distance3-hp2',
		'shenhua-releiji-target', 'shenhua-guidao-replace', 'shenhua-guidao-decline',
		'shenhua-huangtian-give', 'shenhua-huangtian-negative',
		'shenhua-guhuo-claim', 'shenhua-guhuo-real-questioned',
		'shenhua-guhuo-fake-questioned', 'shenhua-guhuo-phase',
		'shenhua-shensu-skip', 'shenhua-shensu-negative', 'quality-shensu1-lowhand-lebu',
		'quality-shensu1-reverse-lowvalue',
		'shenhua-tianxiang-redirect', 'shenhua-tianxiang-negative', 'shenhua-hongyan-suit',
		'shenhua-kuanggu-draw-fullhp', 'shenhua-kuanggu-recover',
		'quality-kuanggu-lowhp', 'quality-kuanggu-midhp-recover',
		'quality-jushou-turned', 'quality-jushou-normal',
		'quality-guhuo-bluff-lowhp', 'quality-guhuo-bluff-midhp',
		'quality-guhuo-full-lowhp-fake-lastshan', 'quality-guhuo-full-lowhp-true-sha-forced',
		'quality-guhuo-full-lowhp-fake-expendable', 'quality-guhuo-full-midhp-fake-expendable',
		'quality-huangtian-last-shan', 'quality-huangtian-midhp',
		'quality-huangtian-last-shan-with-shandian', 'quality-huangtian-forced-shan-with-shandian',
		'shenhua-jushou-4hp-empty', 'shenhua-jushou-lowhp',
		'shenhua-buqu-damage', 'shenhua-buqu-negative', 'shenhua-buqu-recover-choice',
		'shenhua-liegong-hit', 'shenhua-liegong-negative',
	],
	shenhua_huo: [
		'hp-qiangxix-2hp-target1', 'hp-qiangxix-2hp-weapon-target2',
		'shenhua-huo-quhu-compare', 'shenhua-huo-quhu-no-target', 'shenhua-huo-quhu-risky-decline',
		'shenhua-huo-jieming-damage', 'shenhua-huo-jieming-no-benefit',
		'shenhua-huo-lianhuan-tiesuo', 'shenhua-huo-lianhuan-ally-risk', 'shenhua-huo-lianhuan-recast',
		'shenhua-huo-lianhuan-unlink-ally-risk', 'shenhua-huo-lianhuan-keep-enemy-linked',
		'shenhua-huo-lianhuan-full-linked-recast', 'shenhua-huo-lianhuan-link-enemies',
		'shenhua-huo-lianhuan-unlinked-ally-only', 'shenhua-huo-lianhuan-self-linked',
		'shenhua-huo-lianhuan-recast-blocked',
		'shenhua-huo-oldniepan-dying', 'shenhua-huo-oldniepan-tao',
		'shenhua-huo-tianyi-compare', 'shenhua-huo-tianyi-win-sha', 'shenhua-huo-tianyi-lose-sha', 'shenhua-huo-tianyi-lose-content',
		'shenhua-huo-shuangxiong-judge', 'shenhua-huo-shuangxiong-duel', 'shenhua-huo-shuangxiong-no-judge',
		'shenhua-huo-luanji-wanjian', 'shenhua-huo-luanji-wanjian-use', 'shenhua-huo-luanji-no-pair',
		'quality-luanji-ally-lethal',
		'shenhua-huo-huoji-red', 'shenhua-huo-huoji-use', 'shenhua-huo-huoji-no-red',
		'shenhua-huo-kanpo-response', 'shenhua-huo-kanpo-no-black',
		'shenhua-huo-bazhen-bagua', 'shenhua-huo-bazhen-armor-negative',
		'shenhua-huo-jianchu-sha', 'shenhua-huo-jianchu-no-equip',
		'shenhua-huo-passive-rules',
	],
	refresh_feng: ['hp-reqimou-distance4-hp2', 'hp-reqimou-distance4-hp3'],
	shenhua_lei: ['olkongsheng-array-count', 'olkongsheng-repeat'],
	out_of_scope: ['redimeng-hidden-info', 'redimeng-permute-values', 'redimeng-target-legal', 'redimeng-target-zero-cost', 'redimeng-target-infeasible'],
};
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const exists = file => fs.existsSync(file);
const read = file => fs.readFileSync(file);
const jsonOf = file => JSON.parse(read(file).toString('utf8'));

function option(name) {
	const index = process.argv.indexOf('--' + name);
	return index < 0 ? null : process.argv[index + 1];
}
function argsHas(name) { return process.argv.includes('--' + name); }
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

function makeCleanTarget(name, baseRef = null, sharedFiles = null) {
	const root = path.join(WORK, 'targets', name);
	fs.rmSync(root, { recursive: true, force: true });
	fs.mkdirSync(root, { recursive: true });
	if (baseRef) {
		const archive = path.join(WORK, 'targets', name + '.zip');
		const packed = run('git', ['-C', REPO, 'archive', '--format=zip', '--output', archive, baseRef], { cwd: REPO });
		if (packed.status !== 0) throw new Error('无法归档基线提交 ' + baseRef + '：' + packed.stderr);
		const extracted = run('python', ['-m', 'zipfile', '-e', archive, root], { cwd: WORK });
		if (extracted.status !== 0) throw new Error('无法解压基线提交 ' + baseRef + '：' + extracted.stderr);
		return root;
	}
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
	/* 分包携带的全部共享核心文件也不得预置：干净目标必须由 apply-pack 从
	 * 包内供应。硬编码清单漏掉了 2026-11-05 起新增的 skillVetoRegistry.js
	 * （builder shared_files 三件套之一），在 CRLF 检出的验收工作树中会与
	 * LF 包字节冲突导致安装被拒（LF 工作树恰好字节相同才掩盖至今）。
	 * 按 pack.json shared_files 动态清除，消除对清单记忆的依赖。 */
	for (const file of Object.keys(sharedFiles || {})) fs.rmSync(path.join(skills, file), { force: true });
	return root;
}

function captureContract(root) {
	const files = ['score/model/features/features.js', 'score/model/features/dimensionAdapter.js'];
	const hashes = {};
	for (const file of files) {
		const target = path.join(root, file);
		if (!exists(target)) throw new Error('缺少模型契约文件：' + file);
		hashes[file] = sha(read(target));
	}
	const features = read(path.join(root, 'score/model/features/features.js')).toString('utf8');
	const adapter = read(path.join(root, 'score/model/features/dimensionAdapter.js')).toString('utf8');
	if (!/FEATURE_DIM\s*=\s*134/.test(features) || !/CURRENT_DIM\s*=\s*134/.test(adapter)) throw new Error('134 维模型契约常量缺失');
	return { files: hashes, dims: 134 };
}

function assertContractUnchanged(root, contract) {
	for (const [file, expected] of Object.entries(contract.files)) {
		const actual = sha(read(path.join(root, file)));
		if (actual !== expected) throw new Error('模型契约文件被改动：' + file);
	}
}

function wireIndexDiff(target, packRoots) {
	const patches = packRoots.map(pack => path.join(pack, 'patches/score-index.diff'));
	for (const patch of patches) if (!exists(patch)) throw new Error('包内缺少接线补丁：' + patch);
	const hashes = patches.map(patch => sha(read(patch)));
	if (new Set(hashes).size !== 1) throw new Error('多个分包的 score-index.diff 不一致，无法确认同一接线步骤');
	const index = path.join(target, 'score/index.js');
	if (!exists(index)) throw new Error('基线缺少 score/index.js');
	const before = read(index).toString('utf8');
	if (before.includes('installSkillAIPolicies')) return { applied: false, reason: '基线已接线', patch_sha256: hashes[0] };
	const applied = run('git', ['apply', patches[0]], { cwd: target });
	if (applied.status !== 0) throw new Error('应用包内 score/index.diff 失败：' + applied.stderr);
	const after = read(index).toString('utf8');
	if (!after.includes('installSkillAIPolicies') || !after.includes('uninstallSkillAIPolicies')) throw new Error('接线补丁未包含 install/uninstall 调用');
	return { applied: true, patch: path.relative(target, patches[0]), patch_sha256: hashes[0] };
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

function assertInstalled(root, pkg, packJson, contract) {
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
	if (contract) assertContractUnchanged(root, contract);
	return { checks, imports };
}

function assertRolledBack(root, packJson, expectedImports) {
	for (const file of Object.keys(packJson.pack_files || {})) {
		if (file === 'skillPlanHints.js') continue;
		if (exists(path.join(root, 'score/decision/skills', ...file.split('/')))) throw new Error('回滚后分包文件仍存在：' + file);
	}
	if (packJson.id === 'refresh_standard' && !exists(path.join(root, 'score/decision/skills/skillPlanHints.js'))) {
		throw new Error('回滚误删完整引擎共享软建议文件：skillPlanHints.js');
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

function normalizeNames(list) { return (list || []).slice().sort(); }
function normalizePools(gained) {
	return Object.values(gained || {}).map(list => normalizeNames(list)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function normalizeIndices(indices) {
	return Object.values(indices || {}).map(list => (list || []).map(Number).sort((a, b) => a - b))
		.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function findScene(report, name) {
	const scene = (report.scenes || []).find(item => item && item.name === name);
	if (!scene) throw new Error('宿主场景未执行：' + name);
	return scene;
}
function opUsesSkill(scene, skill) {
	return (scene.ops || []).some(item => item && item.op === 'useSkill' && Array.isArray(item.args) && item.args[0] === skill);
}
function opLoseHp(scene) {
	return (scene.ops || []).filter(item => item && item.op === 'loseHp').reduce((sum, item) => sum + (Number(item.args && item.args[0]) || 0), 0);
}

function analyzeShenhuaFengScenes(report, requestedScenes, stats) {
	const checks = [];
	const pass = (name, detail) => checks.push({ name, passed: true, detail });
	const fail = message => { throw new Error(message); };
	const wanted = new Set(requestedScenes);
	const want = name => wanted.has(name);
	const signature = {};
	const validation = {};
	const actorId = scene => Object.keys(scene.before && scene.before.skills || {})[0];
	const allyId = scene => Object.keys(scene.before && scene.before.skills || {})[1];
	const idOnly = value => String(value || '').split(':')[0];
	const handOf = (snapshot, id) => snapshot && snapshot.hand && snapshot.hand[id] || [];
	const dataOf = scene => scene.result || scene;
	const opUsed = (scene, op, predicate) => (dataOf(scene).ops || scene.ops || []).some(item => item && item.op === op && (!predicate || predicate(item)));
	const damageEvent = scene => (scene.damage || [])[0];
	const isEnemyTarget = (scene, id) => !!id && id !== actorId(scene) && id !== allyId(scene);

	const qimouChecks = {
		'hp-qimou-distance4-hp3': { paid: 3, minEnemyHpLoss: 1, targetMustBeHit: false },
		'hp-qimou-distance3-hp2': { paid: 2, minEnemyHpLoss: 1, targetMustBeHit: true },
	};
	for (const [name, expected] of Object.entries(qimouChecks)) {
		if (!want(name)) continue;
		const scene = findScene(report, name);
		const qimou = scene.qimou || {};
		if (!(Number(stats.qimouBypass) > 0)) fail('qimou 策略未执行');
		if (!opUsesSkill(scene, 'qimou')) fail(name + ' 场景未实际发动技能');
		const paid = opLoseHp(scene);
		if (paid !== expected.paid) fail(name + ' 支付档位不是 ' + expected.paid + '：' + paid);
		if (!(Number(qimou.actorHpBefore) > paid)) fail(name + ' 支付会耗尽体力');
		if (qimou.actorAlive === false) fail(name + ' 支付后角色死亡');
		if (!qimou.reachableAfter) fail(name + ' 支付后目标仍不可达');
		if (!(Number(qimou.enemyHpLoss) >= expected.minEnemyHpLoss)) fail(name + ' 未取得预期敌方体力损失');
		if (expected.targetMustBeHit && !(Number(qimou.targetHpAfter) < Number(qimou.targetHpBefore))) fail(name + ' 指定目标未受到伤害');
		pass('qimou-settlement', { scene: name, qimouBypass: stats.qimouBypass, paid, reachableAfter: qimou.reachableAfter, enemyHpLoss: qimou.enemyHpLoss });
		signature.qimou = {
			qimouBypass: stats.qimouBypass,
			usedQimou: true,
			paid,
			reachableAfter: true,
			enemyHpLoss: qimou.enemyHpLoss,
		};
		validation.qimou = { level: '确认缺陷并已修复', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('hp-qimou-distance4-hp4-negative')) {
		const scene = findScene(report, 'hp-qimou-distance4-hp4-negative');
		const qimou = scene.qimou || {};
		if (opUsesSkill(scene, 'qimou') || opLoseHp(scene) !== 0) fail('qimou 负向场景仍发动/支付');
		if (Number(qimou.enemyHpLoss)) fail('qimou 负向场景造成了敌方体力损失');
		pass('qimou-negative-settlement', { usedQimou: false, paid: 0, enemyHpLoss: 0 });
	}

	if (want('shenhua-releiji-target')) {
		const scene = findScene(report, 'shenhua-releiji-target');
		const actor = actorId(scene);
		const targets = (scene.selected || []).map(idOnly);
		if (targets.length !== 1) fail('雷击目标数不是 1');
		if (!isEnemyTarget(scene, targets[0])) fail('雷击选择了友方或自己');
		const damage = (scene.damage || []).find(item => item && item.player === targets[0]);
		if (!damage || damage.num !== 2 || damage.nature !== 'thunder' || damage.source !== actor) {
			fail('雷击未按黑桃判定造成 2 点雷电伤害：' + JSON.stringify(scene.damage));
		}
		const beforeHp = scene.before.hp[targets[0]];
		const afterHp = scene.after.hp[targets[0]];
		if (afterHp !== beforeHp - 2) fail('雷击目标体力变化不是 -2');
		pass('releiji-target-settlement', { targetEnemy: true, damage: { num: 2, nature: 'thunder' }, hpDelta: -2 });
		signature.releiji = { targetEnemy: true, thunderDamage: 2 };
		validation.releiji = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: false, note: '目标选择与黑桃判定后的 2 点雷电伤害均有真实结算断言；未额外构造无目标负向场景。' };
	}

	if (want('shenhua-guidao-replace')) {
		const scene = findScene(report, 'shenhua-guidao-replace');
		const picked = (scene.picked || []).flat();
		if (!scene.replaced) fail('鬼道未替换判定牌');
		if (!scene.judging || scene.judging.suit !== 'spade') fail('鬼道判定结果不是黑桃');
		if (!picked.some(card => card && card.name === 'sha' && card.suit === 'spade')) fail('鬼道未选择黑桃杀替换');
		if (!scene.gainedOriginal) fail('鬼道未获得原判定牌');
		const actor = actorId(scene);
		if (!handOf(scene.after, actor).includes('wuxie')) fail('原判定牌未进入张角手牌');
		pass('guidao-replace-settlement', { replaced: true, judgingSuit: 'spade', gainedOriginal: true, picked });
		validation.guidao = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-guidao-decline')) {
		const scene = findScene(report, 'shenhua-guidao-decline');
		const picked = (scene.picked || []).flat();
		if (scene.replaced || picked.length) fail('鬼道在无收益改判时仍替换判定牌');
		if (!scene.judging || scene.judging.suit !== 'spade') fail('鬼道负向场景判定结果不是黑桃');
		const actor = actorId(scene);
		if (!handOf(scene.after, actor).includes('sha')) fail('鬼道负向场景错误消耗了黑桃牌');
		if (handOf(scene.after, actor).includes('wuxie')) fail('鬼道负向场景错误获得了原判定牌');
		pass('guidao-decline-settlement', { replaced: false, handKept: true });
		signature.guidao = { replaced: true, gainedOriginal: true, declineWhenEqual: true };
	}

	if (want('shenhua-huangtian-give')) {
		const scene = findScene(report, 'shenhua-huangtian-give');
		const actor = actorId(scene);
		const ally = allyId(scene);
		if (!opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天未实际发动');
		if (!(scene.tempCalls || []).some(item => item.skill === 'huangtian3')) fail('黄天未给主公施加黄天3');
		if (handOf(scene.after, actor).includes('shan')) fail('黄天发动后闪仍在原角色手中');
		if (!handOf(scene.after, ally).includes('shan')) fail('黄天未把闪交给主公');
		pass('huangtian-give-settlement', { used: true, tempSkill: true, gaveToZhu: true });
		validation.huangtian = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huangtian-negative')) {
		const scene = findScene(report, 'shenhua-huangtian-negative');
		const ally = allyId(scene);
		if (opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天在没有闪时仍发动');
		if ((scene.tempCalls || []).length) fail('黄天负向场景仍施加了黄天3');
		if (handOf(scene.after, ally).length) fail('黄天负向场景错误交给了主公牌');
		pass('huangtian-negative-settlement', { used: false });
		signature.huangtian = { used: true, tempSkill: true, gaveToZhu: true, noShanDecline: true };
	}

	if (want('shenhua-guhuo-real-questioned')) {
		const scene = findScene(report, 'shenhua-guhuo-real-questioned');
		const actor = actorId(scene);
		const damage = damageEvent(scene);
		if (scene.declared !== 'sha' || scene.hidden !== 'sha') fail('蛊惑真声明场景未使用真实杀');
		if (!scene.enemyChanyuan) fail('蛊惑真声明被质疑后质疑者未获得缠怨');
		if (scene.cancelled) fail('蛊惑真声明被质疑后仍被取消');
		if (!damage || damage.num !== 1) fail('蛊惑真声明未造成 1 点伤害');
		if (damage.player === actor || damage.player === allyId(scene)) fail('蛊惑真声明伤害了友方或自己');
		if (handOf(scene.after, actor).length) fail('蛊惑真声明未消耗真实杀');
		pass('guhuo-real-questioned-settlement', { declaredSha: true, chanyuan: true, damage: 1, cancelled: false });
		signature.guhuoReal = { declaredSha: true, chanyuan: true, damage: 1, cancelled: false };
	}

	if (want('shenhua-guhuo-fake-questioned')) {
		const scene = findScene(report, 'shenhua-guhuo-fake-questioned');
		const actor = actorId(scene);
		const declared = (scene.buttonChoices || []).flat().includes('sha') || scene.declared === 'sha';
		if (!declared) fail('蛊惑假声明场景未记录杀声明');
		if ((scene.damage || []).length) fail('蛊惑假声明遭质疑后仍造成伤害');
		if (scene.enemyChanyuan) fail('蛊惑假声明遭质疑后质疑者错误获得缠怨');
		const beforeHand = handOf(scene.before, actor);
		const afterHand = handOf(scene.after, actor);
		const hiddenLost = afterHand.length === beforeHand.length - 1;
		const activated = hiddenLost || scene.guhuoPhase || (scene.useCalls || []).length > 0;
		if (!activated) {
			pass('guhuo-fake-questioned-declined', { declaredSha: true, declined: true, noDamage: true });
			signature.guhuoFake = { declaredSha: true, noDamage: true, noChanyuan: true, outcome: 'declined' };
		} else {
			if (!scene.cancelled) fail('蛊惑假声明遭质疑后未取消');
			pass('guhuo-fake-questioned-cancelled', { declaredSha: true, cancelled: true, hiddenLost });
			signature.guhuoFake = { declaredSha: true, noDamage: true, noChanyuan: true, outcome: 'cancelled' };
		}
	}

	if (want('shenhua-shensu-skip')) {
		const scene = findScene(report, 'shenhua-shensu-skip');
		const used = (scene.ops || []).find(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha');
		if (!used) fail('神速未实际使用虚拟杀');
		const target = String(used.args[1] || '').replace(/^P:/, '');
		if (!isEnemyTarget(scene, target)) fail('神速虚拟杀目标不是敌方');
		if (scene.after.hp[target] !== scene.before.hp[target] - 1) fail('神速虚拟杀未造成 1 点伤害');
		if (scene.shensuAfter.judge !== 1) fail('神速未跳过判定阶段（乐不思蜀仍在判定区）');
		pass('shensu-skip-settlement', { usedSha: true, targetEnemy: true, hpDelta: -1, judgeSkipped: true });
		validation.xinshensu = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-shensu-negative')) {
		const scene = findScene(report, 'shenhua-shensu-negative');
		if ((scene.ops || []).some(item => item && item.op === 'useCard' && item.args && item.args[0] === 'sha')) fail('神速在手牌不足时仍使用虚拟杀');
		if (scene.shensuAfter.judge !== 0) fail('神速负向场景未正常结算判定牌');
		if (handOf(scene.after, actorId(scene)).length !== 2) fail('神速负向场景错误消耗手牌');
		pass('shensu-negative-settlement', { usedSha: false, judgeResolved: true });
		signature.shensu = { usedSha: true, targetHpDelta: -1, judgeSkipped: true, lowHandDecline: true };
	}

	if (want('shenhua-tianxiang-redirect')) {
		const scene = findScene(report, 'shenhua-tianxiang-redirect');
		const actor = actorId(scene);
		const target = (scene.targets || []).flat().map(idOnly)[0];
		if (!isEnemyTarget(scene, target)) fail('天香转移目标不是敌方');
		if (!(scene.controls || []).includes(1)) fail('天香未选择失去体力并获得弃置牌');
		if (scene.after.hp[actor] !== scene.before.hp[actor]) fail('天香发动后小乔仍受到伤害');
		if (scene.after.hp[target] !== scene.before.hp[target] - 1) fail('天香目标未失去 1 点体力');
		if (!handOf(scene.after, target).includes('tao')) fail('天香目标未获得弃置的桃');
		pass('tianxiang-redirect-settlement', { targetEnemy: true, control: 1, actorHpDelta: 0, targetHpDelta: -1 });
		validation.retianxiang = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-tianxiang-negative')) {
		const scene = findScene(report, 'shenhua-tianxiang-negative');
		const actor = actorId(scene);
		if ((scene.targets || []).length) fail('天香在没有红桃牌时仍转移伤害');
		if (scene.after.hp[actor] !== scene.before.hp[actor] - 1) fail('天香负向场景未正常受到伤害');
		if (handOf(scene.after, actor).length !== handOf(scene.before, actor).length) fail('天香负向场景错误弃牌');
		pass('tianxiang-negative-settlement', { noTarget: true, damageProceeded: true });
		signature.tianxiang = { targetEnemy: true, control: 1, actorHpDelta: 0, targetHpDelta: -1, noHeartDamage: true };
	}

	if (want('shenhua-hongyan-suit')) {
		const scene = findScene(report, 'shenhua-hongyan-suit');
		if (scene.suits.spade !== 'heart' || scene.suits.heart !== 'heart') fail('红颜未把黑桃视为红桃');
		if (scene.colors.spade !== 'red' || scene.colors.heart !== 'red') fail('红颜未把黑桃视为红色');
		pass('hongyan-passive-rule', { spadeAsHeart: true, spadeAsRed: true });
		validation.hongyan = { level: '规则结算验证通过', rule_settlement: true, ai_decision: false, positive_negative: false, note: '纯被动规则，无独立 AI 决策入口；只验证花色/颜色规则。' };
		signature.hongyan = { spadeAsHeart: true, spadeAsRed: true };
	}

	/* 历史封版断言：3血连弩+1杀期望摸牌。正式双风原生补丁 B 与新扩展 D 在该状态选择回复
	 * （真实宿主回复收益 1.5:1），故旧断言只保留为显式对照，不再进入默认场景；
	 * 默认摸牌分支改由满血场景覆盖（回复收益为 0）。 */
	if (want('shenhua-kuanggu-draw')) {
		const scene = findScene(report, 'shenhua-kuanggu-draw');
		const damage = damageEvent(scene);
		if (!damage || !damage.checkKuanggu || damage.num !== 1) fail('狂骨摸牌场景未命中距离 1 伤害');
		if (!(scene.choices || []).includes('draw_card')) fail('狂骨未选择摸牌');
		if (!opUsed(scene, 'draw', item => Number(item.args && item.args[0]) === 1)) fail('狂骨摸牌未实际摸 1 张');
		if (scene.after.hp[damage.player] !== scene.before.hp[damage.player] - 1) fail('狂骨摸牌场景目标未受伤');
		pass('kuanggu-draw-settlement', { choice: 'draw_card', damage: 1, draw: 1 });
		validation.xinkuanggu = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: false, note: '摸牌/回复两个 AI 分支均有真实结算断言。' };
	}
	if (want('shenhua-kuanggu-recover')) {
		const scene = findScene(report, 'shenhua-kuanggu-recover');
		const actor = actorId(scene);
		const damage = damageEvent(scene);
		if (!damage || !damage.checkKuanggu || damage.num !== 1) fail('狂骨回复场景未命中距离 1 伤害');
		if (!(scene.choices || []).includes('recover_hp')) fail('狂骨未选择回复体力');
		if (!opUsed(scene, 'recover', item => Number(item.args && item.args[0]) === 1)) fail('狂骨未实际回复 1 点体力');
		if (scene.after.hp[actor] !== scene.before.hp[actor] + 1) fail('狂骨回复后体力未增加 1');
		if (opUsed(scene, 'draw', item => Number(item.args && item.args[0]) > 0)) fail('狂骨回复分支错误摸牌');
		pass('kuanggu-recover-settlement', { choice: 'recover_hp', hpDelta: 1, draw: 0 });
		signature.kuanggu = { drawChoice: 'draw_card', recoverChoice: 'recover_hp', draw: 1, recover: 1 };
	}
	if (want('shenhua-kuanggu-draw-fullhp')) {
		const scene = findScene(report, 'shenhua-kuanggu-draw-fullhp');
		const measure = (scene.probe && scene.probe.atChoose || [])[0];
		if (!measure) fail('狂骨满血摸牌场景未记录收益');
		if (!(scene.choices || []).includes('draw_card')) fail('狂骨满血未选择摸牌');
		if (!opUsed(scene, 'draw', item => Number(item.args && item.args[0]) === 1)) fail('狂骨满血摸牌未实际摸 1 张');
		if (opUsed(scene, 'recover', item => Number(item.args && item.args[0]) > 0)) fail('狂骨满血错误回复');
		if (Number(measure.recoverEffect) !== 0) fail('狂骨满血回复收益不是 0');
		if (!(Number(measure.drawEffect) > 0)) fail('狂骨满血摸牌收益不为正');
		pass('kuanggu-draw-fullhp-settlement', { choice: 'draw_card', recoverEffect: measure.recoverEffect, drawEffect: measure.drawEffect, draw: 1 });
		signature.kuanggu = Object.assign(signature.kuanggu || {}, { fullHpDraw: true });
		validation.xinkuanggu = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true, note: '满血无回复收益时摸牌；受伤且回复收益高于摸牌时回复；与正式双风原生补丁公式一致。' };
	}

	if (want('quality-kuanggu-lowhp')) {
		const scene = findScene(report, 'quality-kuanggu-lowhp');
		const data = dataOf(scene);
		const actor = actorId(scene);
		if (opUsed(scene, 'draw', item => Number(item.args && item.args[0]) > 0)) fail('狂骨1血仍选择摸牌');
		if (!opUsed(scene, 'recover', item => Number(item.args && item.args[0]) === 1)) fail('狂骨1血未实际回复1点体力');
		if (Number(data.hp) !== Number(scene.before.hp[actor]) + 1) fail('狂骨1血回复后体力未增加');
		pass('kuanggu-lowhp-recover', { hp: data.hp, recovered: true });
		signature.kuanggu = Object.assign(signature.kuanggu || {}, { lowHpRecover: true });
		validation.xinkuanggu = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '1血可回复时优先回复；反向场景保持原生摸牌。' };
	}
	/* 历史封版断言：3血无手牌、杀次数1、直伤来源，旧规则期望摸牌。
	 * 正式双风原生补丁 B 与新扩展 D 在该状态回复体力（真实宿主回复收益 1.5:1）；
	 * 旧断言只保留为显式对照，默认场景改由 quality-kuanggu-midhp-recover 覆盖同一局面的新决策。 */
	if (want('quality-kuanggu-midhp')) {
		const scene = findScene(report, 'quality-kuanggu-midhp');
		const data = dataOf(scene);
		const actor = actorId(scene);
		if (opUsed(scene, 'recover')) fail('狂骨3血反向场景错误回复');
		if (!opUsed(scene, 'draw', item => Number(item.args && item.args[0]) === 1)) fail('狂骨3血场景未摸1张');
		if (Number(data.hp) !== Number(scene.before.hp[actor])) fail('狂骨3血场景体力被错误改变');
		pass('kuanggu-midhp-draw', { hp: data.hp, draw: 1 });
		signature.kuanggu = Object.assign(signature.kuanggu || {}, { midHpDraw: true });
	}
	if (want('quality-kuanggu-midhp-recover')) {
		const scene = findScene(report, 'quality-kuanggu-midhp-recover');
		const actor = actorId(scene);
		const measure = (scene.probe && scene.probe.atChoose || [])[0];
		if (!measure) fail('狂骨3血场景未记录收益');
		if (!(scene.choices || []).includes('recover_hp')) fail('狂骨3血场景未选择回复');
		if (!opUsed(scene, 'recover', item => Number(item.args && item.args[0]) === 1)) fail('狂骨3血场景未实际回复 1 点体力');
		if (opUsed(scene, 'draw', item => Number(item.args && item.args[0]) > 0)) fail('狂骨3血回复分支错误摸牌');
		if (!(Number(measure.recoverEffect) > Number(measure.drawEffect))) fail('狂骨3血场景回复收益未高于摸牌收益');
		if (scene.after.hp[actor] !== scene.before.hp[actor] + 1) fail('狂骨3血回复后体力未增加 1');
		pass('kuanggu-midhp-recover-settlement', { hp: scene.after.hp[actor], recoverEffect: measure.recoverEffect, drawEffect: measure.drawEffect, recovered: true });
		signature.kuanggu = Object.assign(signature.kuanggu || {}, { midHpRecover: true });
	}

	if (want('shenhua-jushou-4hp-empty')) {
		const scene = findScene(report, 'shenhua-jushou-4hp-empty');
		if ((scene.ops || []).some(item => item && (item.op === 'draw' || item.op === 'recover'))) fail('据守在满血空手时仍发动');
		if (scene.jushouAfter.turnedOver) fail('据守负向场景仍翻面');
		if (handOf(scene.after, actorId(scene)).length) fail('据守负向场景错误摸牌');
		pass('jushou-empty-settlement', { triggered: false, turnedOver: false });
		validation.jushou = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-jushou-lowhp')) {
		const scene = findScene(report, 'shenhua-jushou-lowhp');
		if (!opUsed(scene, 'draw', item => Number(item.args && item.args[0]) === 3)) fail('据守未摸 3 张');
		if (handOf(scene.after, actorId(scene)).length !== 3) fail('据守后手牌不是 3 张');
		if (!scene.jushouAfter.turnedOver) fail('据守未翻面');
		pass('jushou-lowhp-settlement', { draw: 3, turnedOver: true });
		signature.jushou = { emptyTriggered: false, draw: 3, turnedOver: true };
	}

	if (want('shenhua-buqu-damage')) {
		const scene = findScene(report, 'shenhua-buqu-damage');
		if (!(scene.buquAfter.expansions || []).length) fail('不屈未翻出创');
		if (scene.buquAfter.hp > 0) fail('不屈场景未进入 0 体力');
		if (scene.buquAfter.dying) fail('不屈翻出创后仍进入濒死');
		if (!scene.buquAfter.alive) fail('不屈翻出创后角色死亡');
		pass('buqu-damage-settlement', { hp: scene.buquAfter.hp, expansions: scene.buquAfter.expansions.length, dying: false, alive: true });
		validation.gzbuqu = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true, note: '主触发为锁定技；额外验证回复后移创的 chooseCardButton AI 选择。' };
	}
	if (want('shenhua-buqu-negative')) {
		const scene = findScene(report, 'shenhua-buqu-negative');
		if (scene.buquAfter.hp !== 1) fail('不屈负向场景体力不是 1');
		if ((scene.buquAfter.expansions || []).length) fail('不屈在未进入 0 体力时错误翻创');
		pass('buqu-negative-settlement', { hp: 1, expansions: 0 });
	}
	if (want('shenhua-buqu-recover-choice')) {
		const scene = findScene(report, 'shenhua-buqu-recover-choice');
		const picks = (scene.recoverPicks || []).flat();
		if (picks.length !== 1) fail('不屈回复时未选择 1 张创');
		if ((scene.buquAfter.expansions || []).length !== 1) fail('不屈回复后创数量不是 1');
		if (scene.buquAfter.hp !== 2) fail('不屈回复后体力不是 2');
		if (!opUsed(scene, 'recover', item => Number(item.args && item.args[0]) === 1)) fail('不屈场景未实际回复 1 点体力');
		pass('buqu-recover-choice-settlement', { picks, expansions: 1, hp: 2 });
		signature.buqu = { damageExpansions: true, negativeExpansions: 0, recoverPick: 1, recoverHp: 2 };
	}

	if (want('shenhua-liegong-hit')) {
		const scene = findScene(report, 'shenhua-liegong-hit');
		const damage = damageEvent(scene);
		const target = damage && damage.player;
		if (!damage || damage.num !== 2) fail('烈弓命中场景伤害不是 2');
		if (!(scene.useCard && scene.useCard.directHit || []).some(value => idOnly(value) === target)) fail('烈弓未记录不可响应');
		if (scene.useCard.extraDamage !== 1) fail('烈弓未记录加伤 1');
		if (scene.after.hp[target] !== scene.before.hp[target] - 2) fail('烈弓命中后目标体力不是 -2');
		pass('liegong-hit-settlement', { damage: 2, directHit: true, extraDamage: 1 });
		validation.xinliegong = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-liegong-negative')) {
		const scene = findScene(report, 'shenhua-liegong-negative');
		const damage = damageEvent(scene);
		if (!damage || damage.num !== 1) fail('烈弓负向场景伤害不是 1');
		if ((scene.useCard && scene.useCard.directHit || []).length) fail('烈弓负向场景错误不可响应');
		if (scene.useCard.extraDamage) fail('烈弓负向场景错误加伤');
		if (scene.after.hp[damage.player] !== scene.before.hp[damage.player] - 1) fail('烈弓负向场景目标体力变化不是 -1');
		pass('liegong-negative-settlement', { damage: 1, directHit: false });
		signature.liegong = { hitDamage: 2, hitDirect: true, negativeDamage: 1, negativeDirect: false };
	}

	if (want('quality-jushou-turned')) {
		const scene = findScene(report, 'quality-jushou-turned');
		const data = dataOf(scene);
		if (Number(data.drew) !== 3) fail('据守已翻面时未摸3张');
		if (data.turned !== false) fail('据守已翻面时未翻回正面');
		if (handOf(scene.after, actorId(scene)).length !== 6) fail('据守已翻面后手牌数量不是6');
		pass('jushou-turned-free-draw', { drew: 3, turned: false });
		signature.jushou = Object.assign(signature.jushou || {}, { turnedFreeDraw: true });
		validation.jushou = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '已翻面时据守摸3张并翻回正面；正常4血3手牌反向不发动。' };
	}
	if (want('quality-jushou-normal')) {
		const scene = findScene(report, 'quality-jushou-normal');
		const data = dataOf(scene);
		if (Number(data.drew) !== 0) fail('据守正常场景错误摸牌');
		if (data.turned !== false) fail('据守正常场景错误翻面');
		if (handOf(scene.after, actorId(scene)).length !== 3) fail('据守正常场景手牌被改变');
		pass('jushou-normal-no-draw', { drew: 0, turned: false });
	}
	if (want('quality-shensu1-lowhand-lebu')) {
		const scene = findScene(report, 'quality-shensu1-lowhand-lebu');
		const data = dataOf(scene);
		if (!data.usedSha) fail('神速1低手牌+乐场景未使用虚拟杀');
		if (Number(data.judge) !== 1) fail('神速1未跳过不良判定');
		if (!isEnemyTarget(scene, data.target)) fail('神速1低手牌场景目标不是敌方');
		if (scene.after.hp[data.target] !== scene.before.hp[data.target] - 1) fail('神速1低手牌场景目标未受伤');
		pass('shensu1-lowhand-lebu', { usedSha: true, judgeSkipped: true, targetEnemy: true });
		signature.shensu = Object.assign(signature.shensu || {}, { lowHandJudgeSkip: true });
		validation.xinshensu = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '低手牌+不良判定时使用神速1；无判定低手牌反向仍放弃。' };
	}
	if (want('quality-shensu1-reverse-lowvalue')) {
		const scene = findScene(report, 'quality-shensu1-reverse-lowvalue');
		const data = dataOf(scene);
		if (Number(data.usedSha) !== 0) fail('神速1反向场景仍跳过摸牌使用虚拟杀');
		if (Number(data.judgeCalls) !== 1) fail('神速1反向场景未结算不良判定');
		if ((data.judgeAfter || []).length) fail('神速1反向场景乐未移除');
		if (Number(data.handCount) < 2) fail('神速1反向场景手牌被异常消耗');
		pass('shensu1-opportunity-cost', { usedSha: 0, judgeCalls: 1, handCount: data.handCount });
		validation.xinshensu = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '低手牌+不良判定且目标收益高于摸牌价值时使用神速1；目标收益低于摸牌价值时放弃并正常结算判定。' };
	}
	if (want('quality-guhuo-bluff-lowhp')) {
		const scene = findScene(report, 'quality-guhuo-bluff-lowhp');
		const data = dataOf(scene);
		const scores = data.checkScores || [];
		if (!scores.length) fail('蛊惑1血场景未进入原生选择函数');
		if (scores.some(item => Number(item.out) !== 0)) fail('蛊惑1血无真牌仍有正声明分');
		if (data.bool) fail('蛊惑1血无真牌仍选择发动');
		if (Number(data.hp) !== 1) fail('蛊惑1血场景错误改变体力');
		pass('guhuo-lowhp-guard', { checkScores: scores.map(item => item.out), used: false });
		signature.guhuo = Object.assign(signature.guhuo || {}, { lowHpBluffGuard: true });
		validation.xinfu_guhuo = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '1血无真牌不诈称；3血同局面仍保留原生诈称分。' };
	}
	if (want('quality-guhuo-bluff-midhp')) {
		const scene = findScene(report, 'quality-guhuo-bluff-midhp');
		const data = dataOf(scene);
		const scores = data.checkScores || [];
		if (!scores.some(item => Number(item.out) > 0)) fail('蛊惑3血场景被错误抑制');
		pass('guhuo-midhp-native-bluff', { checkScores: scores.map(item => item.out) });
	}
	if (want('quality-guhuo-full-lowhp-fake-lastshan')) {
		const scene = findScene(report, 'quality-guhuo-full-lowhp-fake-lastshan');
		const data = dataOf(scene);
		if (data.activated) fail('蛊惑1血无真牌最后闪仍发动诈称');
		if (!(data.handAfter || []).includes('shan')) fail('蛊惑1血场景未保留最后一张闪');
		if (Number(data.hpAfter) !== 1) fail('蛊惑1血场景错误改变体力');
		if (Number(data.enemyHpAfter) !== 2) fail('蛊惑1血场景错误造成伤害');
		pass('guhuo-full-lowhp-fake-declined', { activated: false, hand: data.handAfter, hp: data.hpAfter });
	}
	if (want('quality-guhuo-full-lowhp-true-sha-forced')) {
		const scene = findScene(report, 'quality-guhuo-full-lowhp-true-sha-forced');
		const data = dataOf(scene);
		if (!data.activated) fail('蛊惑1血有真牌时被错误抑制');
		if (!(data.useCalls || []).some(item => item && item.skill === 'xinfu_guhuo_backup')) fail('蛊惑1血有真牌未实际发动');
		if (Number(data.enemyHpAfter) !== 1) fail('蛊惑1血真牌未造成伤害');
		if (!data.enemyChanyuan) fail('蛊惑真牌被质疑后质疑者未获得缠怨');
		if (Number(data.hpAfter) !== 1) fail('蛊惑1血真牌错误改变体力');
		pass('guhuo-full-lowhp-true-used', { activated: true, hidden: data.hidden, enemyHp: data.enemyHpAfter, chanyuan: true });
	}
	if (want('quality-guhuo-full-lowhp-fake-expendable')) {
		const scene = findScene(report, 'quality-guhuo-full-lowhp-fake-expendable');
		const data = dataOf(scene);
		const lost = (data.handBefore || []).filter(name => !(data.handAfter || []).includes(name));
		if (!data.activated) fail('蛊惑1血有闪电可弃时被错误抑制');
		if (!(data.useCalls || []).some(item => item && item.skill === 'xinfu_guhuo_backup')) fail('蛊惑1血可弃闪电未实际发动');
		if (!lost.includes('shandian')) fail('蛊惑1血未扣置闪电');
		if (!(data.handAfter || []).includes('shan')) fail('蛊惑1血未保留唯一闪');
		if (Number(data.enemyHpAfter) !== 2) fail('蛊惑1血假牌被质疑后仍造成伤害');
		pass('guhuo-full-lowhp-expendable', { activated: true, lost, hand: data.handAfter, enemyHp: data.enemyHpAfter });
	}
	if (want('quality-guhuo-full-midhp-fake-expendable')) {
		const scene = findScene(report, 'quality-guhuo-full-midhp-fake-expendable');
		const data = dataOf(scene);
		if (!data.activated) fail('蛊惑3血可弃闪电时未发动');
		if (!(data.hidden || []).includes('shandian')) fail('蛊惑3血未扣置闪电');
		if (Number(data.enemyHpAfter) !== 1) fail('蛊惑3血假牌未造成伤害');
		if (!(data.handAfter || []).includes('shan')) fail('蛊惑3血未保留闪');
		pass('guhuo-full-midhp-expendable', { activated: true, hidden: data.hidden, enemyHp: data.enemyHpAfter });
	}
	if (want('quality-huangtian-last-shan')) {
		const scene = findScene(report, 'quality-huangtian-last-shan');
		if (opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天1血最后闪仍转交');
		if (!handOf(scene.after, actorId(scene)).includes('shan')) fail('黄天1血场景未保留最后一张闪');
		pass('huangtian-last-shan-kept', { used: false, hand: handOf(scene.after, actorId(scene)) });
		signature.huangtian = Object.assign(signature.huangtian || {}, { lastShanKept: true });
		validation.huangtian = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '1血最后一张闪不转交；3血双闪仍按原生转交。' };
	}
	if (want('quality-huangtian-midhp')) {
		const scene = findScene(report, 'quality-huangtian-midhp');
		if (!opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天3血场景被错误抑制');
		if (!handOf(scene.after, allyId(scene)).includes('shan')) fail('黄天3血场景主公未获得闪');
		pass('huangtian-midhp-give', { used: true, allyHand: handOf(scene.after, allyId(scene)) });
	}
	if (want('quality-huangtian-last-shan-with-shandian')) {
		const scene = findScene(report, 'quality-huangtian-last-shan-with-shandian');
		if (!opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天1血持闪+闪电时未转交闪电');
		if (!handOf(scene.after, actorId(scene)).includes('shan')) fail('黄天1血持闪+闪电时未保留唯一闪');
		if (!handOf(scene.after, allyId(scene)).includes('shandian')) fail('黄天1血持闪+闪电时主公未获得闪电');
		pass('huangtian-shandian-given-shan-kept', { used: true, allyHand: handOf(scene.after, allyId(scene)) });
	}
	if (want('quality-huangtian-forced-shan-with-shandian')) {
		const scene = findScene(report, 'quality-huangtian-forced-shan-with-shandian');
		if (opUsed(scene, 'useSkill', item => item.args && item.args[0] === 'huangtian2')) fail('黄天1血持闪+闪电时仍交出闪');
		if (!handOf(scene.after, actorId(scene)).includes('shan')) fail('黄天1血交闪场景未保留唯一闪');
		if (handOf(scene.after, allyId(scene)).includes('shan')) fail('黄天1血交闪场景错误把闪交给主公');
		const scores = (scene.scoreCalls || []).filter(item => (item.selected || []).includes('shan')).map(item => Number(item.score));
		if (!scores.length || scores.some(value => value !== 0)) fail('黄天1血交闪场景评分未归零');
		pass('huangtian-forced-shan-kept', { used: false, scores, hand: handOf(scene.after, actorId(scene)) });
		validation.huangtian = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '1血最后一张闪不转交；持闪+闪电时只转交闪电；3血双闪仍按原生转交。' };
	}

	return { checks, signature, validation };
}

function analyzeShenhuaHuoScenes(report, requestedScenes, stats) {
	const checks = [];
	const pass = (name, detail) => checks.push({ name, passed: true, detail });
	const fail = message => { throw new Error(message); };
	const want = name => requestedScenes.includes(name);
	const idOnly = value => String(value || '').split(':')[0];
	const dataOf = scene => scene.result || scene;
	const opsOf = scene => (dataOf(scene).ops || scene.ops || []);
	const damageOf = scene => (dataOf(scene).damage || scene.damage || []);
	const judgesOf = scene => (dataOf(scene).judges || scene.judges || []);
	const actorId = scene => Object.keys(scene.before && scene.before.skills || {})[0];
	const allyId = scene => Object.keys(scene.before && scene.before.skills || {})[1];
	const handOf = (snapshot, id) => (snapshot && snapshot.hand && snapshot.hand[id] || []);
	const isEnemy = (scene, id) => !!id && id !== actorId(scene) && id !== allyId(scene);
	const usedSkill = (scene, skill) => opsOf(scene).some(item => item && item.op === 'useSkill' && Array.isArray(item.args) && item.args[0] === skill);
	const usedCard = (scene, name) => opsOf(scene).some(item => item && item.op === 'useCard' && Array.isArray(item.args) && item.args[0] === name);
	const enemyHpLoss = scene => Object.keys(scene.before.hp || {}).filter(id => isEnemy(scene, id)).reduce((sum, id) => sum + Math.max(0, Number(scene.before.hp[id]) - Number(scene.after.hp[id] || 0)), 0);
	const signature = {};
	const validation = {};
	const passive = name => findScene(report, name);

	if (want('hp-qiangxix-2hp-target1')) {
		const scene = findScene(report, 'hp-qiangxix-2hp-target1');
		if (!usedSkill(scene, 'qiangxix')) fail('强袭回归场景未实际发动');
		if (!(scene.target && scene.target.hp <= 1)) fail('强袭回归场景目标未进入 1 血');
		if (!(scene.turn && scene.turn.hp === 1)) fail('强袭回归场景未按体力支付');
		pass('qiangxix-target1-regression', { targetHp: scene.target.hp, actorHp: scene.turn.hp });
		signature.qiangxix = { used: true, targetHp: scene.target.hp, actorHp: scene.turn.hp };
		validation.qiangxix = { level: '已验证无问题', rule_settlement: true, ai_decision: true, positive_negative: false, note: '沿用第二批完整回合证据，本轮回归仍通过。' };
	}
	if (want('hp-qiangxix-2hp-weapon-target2')) {
		const scene = findScene(report, 'hp-qiangxix-2hp-weapon-target2');
		if (!usedSkill(scene, 'qiangxix')) fail('强袭武器场景未实际发动');
		if (!opsOf(scene).some(item => item && item.op === 'discard' && (item.args[0] || []).includes('zhangba'))) fail('强袭武器场景未弃置武器');
		if (!(scene.turn && scene.turn.hp === 2)) fail('强袭武器场景错误失去体力');
		if (!(scene.target && scene.target.hp <= 1)) fail('强袭武器场景目标未进入 1 血');
		pass('qiangxix-weapon-regression', { weaponDiscarded: true, actorHp: scene.turn.hp, targetHp: scene.target.hp });
		signature.qiangxix = Object.assign(signature.qiangxix || {}, { weaponDiscarded: true });
	}

	if (want('shenhua-huo-quhu-compare')) {
		const scene = findScene(report, 'shenhua-huo-quhu-compare');
		const data = dataOf(scene);
		const targets = (data.targets || []).flat().filter(Boolean).map(idOnly);
		if (!usedSkill(scene, 'quhu')) fail('驱虎正向场景未实际发动');
		if (!targets.length || targets.some(id => !isEnemy(scene, id))) fail('驱虎目标不是敌方');
		if (!(enemyHpLoss(scene) >= 1)) fail('驱虎拼点后未造成伤害');
		pass('quhu-settlement', { targetEnemy: true, enemyHpLoss: enemyHpLoss(scene) });
		signature.quhu = { used: true, targetEnemy: true, damage: 1 };
		validation.quhu = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-quhu-no-target') || want('shenhua-huo-quhu-risky-decline')) {
		if (want('shenhua-huo-quhu-no-target')) {
			const scene = findScene(report, 'shenhua-huo-quhu-no-target');
			if (usedSkill(scene, 'quhu')) fail('驱虎在没有体力更高目标时仍发动');
			pass('quhu-no-target', { used: false });
			signature.quhu = Object.assign(signature.quhu || {}, { noTargetDecline: true });
		}
		if (want('shenhua-huo-quhu-risky-decline')) {
			const scene = findScene(report, 'shenhua-huo-quhu-risky-decline');
			if (usedSkill(scene, 'quhu')) fail('驱虎在低血低牌高失败风险时仍发动');
			pass('quhu-risky-decline', { used: false, actorHp: dataOf(scene).actorHp });
			signature.quhu = Object.assign(signature.quhu || {}, { riskyDecline: true });
		}
	}

	if (want('shenhua-huo-jieming-damage')) {
		const scene = findScene(report, 'shenhua-huo-jieming-damage');
		const data = dataOf(scene);
		const targets = (data.targets || []).flat().filter(Boolean).map(idOnly);
		if (targets.length !== 1 || targets[0] !== allyId(scene)) fail('节命未选择友方补牌');
		const draw = handOf(scene.after, allyId(scene)).length - handOf(scene.before, allyId(scene)).length;
		if (!(draw > 0)) fail('节命未给友方实际补牌');
		pass('jieming-damage-settlement', { targetAlly: true, draw });
		signature.jieming = { targetAlly: true, allyDraw: draw };
		validation.jieming = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-jieming-no-benefit')) {
		const scene = findScene(report, 'shenhua-huo-jieming-no-benefit');
		const data = dataOf(scene);
		const targets = (data.targets || []).flat().filter(Boolean).map(idOnly);
		const enemyGain = Object.keys(scene.before.hp || {}).filter(id => isEnemy(scene, id)).reduce((sum, id) => sum + handOf(scene.after, id).length - handOf(scene.before, id).length, 0);
		if (targets.some(id => isEnemy(scene, id))) fail('节命在无收益局面选择了敌方');
		if (enemyGain > 0) fail('节命在无收益局面让敌方摸牌');
		if (opsOf(scene).some(item => item && item.op === 'draw')) fail('节命在无收益局面仍摸牌');
		pass('jieming-no-benefit', { targetCount: targets.length, enemyGain });
		signature.jieming = Object.assign(signature.jieming || {}, { noBenefitDecline: true });
	}

	const targetIdsOf = data => (data.targetIds || []).map(String).filter(Boolean);
	const linksOf = data => data.links || {};

	if (want('shenhua-huo-lianhuan-tiesuo')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-tiesuo');
		const data = dataOf(scene);
		const targets = (data.tiesuoTargets || []).flat().filter(Boolean).map(idOnly);
		if (targets.length !== 2) fail('连环正向场景未实际转化两张目标：' + targets.length);
		if (targets.some(id => !isEnemy(scene, id))) fail('连环目标包含友方或自己');
		if (!usedCard(scene, 'tiesuo')) fail('连环未实际使用铁索');
		if (data.recast) fail('连环正向场景错误重铸');
		pass('lianhuan-tiesuo-settlement', { targetEnemy: true, targets: targets.length });
		signature.lianhuan = { usedOnEnemies: true, targetCount: 2 };
	}
	if (want('shenhua-huo-lianhuan-ally-risk')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-ally-risk');
		const data = dataOf(scene);
		const targets = (data.tiesuoTargets || []).flat().filter(Boolean).map(idOnly);
		if (!data.recast) fail('连环在只剩友方未横置时未重铸');
		if (targets.includes(allyId(scene))) fail('连环把友方作为目标');
		if (!(Number(data.draws) >= 1)) fail('连环重铸未实际摸牌');
		pass('lianhuan-ally-risk-recast', { recast: true, allyTargeted: false });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { allyRiskRecast: true });
	}
	if (want('shenhua-huo-lianhuan-recast')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-recast');
		const data = dataOf(scene);
		const ids = targetIdsOf(data);
		const ally = allyId(scene);
		if (data.recast) fail('连环在已横置友方可解除时错误改走重铸');
		if (!ids.includes(ally)) fail('连环未对已横置友方使用铁索解除横置');
		if (Number(data.draws)) fail('连环解除横置时错误摸牌');
		if (linksOf(data)[ally] !== false) fail('连环未实际解除友方横置');
		pass('lianhuan-unlink-settlement', { targetAlly: true, unlinked: true, recast: false });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { unlinkAlly: true });
	}
	if (want('shenhua-huo-lianhuan-unlink-ally-risk')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-unlink-ally-risk');
		const data = dataOf(scene);
		const ids = targetIdsOf(data);
		const ally = allyId(scene);
		if (!ids.includes(ally)) fail('连环未在低血友方+火计威胁下解除友方横置');
		if (data.recast || Number(data.draws)) fail('连环在有解除收益时错误重铸');
		if (data.allyLinked !== false || linksOf(data)[ally] !== false) fail('连环未实际解除低血友方横置');
		if (!scene.setup || scene.setup.enemyFireSkill !== true || scene.setup.allyHp !== 1) fail('低血友方属性伤害风险夹具不完整');
		pass('lianhuan-unlink-ally-risk', { targetAlly: true, allyHp: scene.setup.allyHp, enemyFireSkill: true });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { unlinkLowHpAlly: true });
	}
	if (want('shenhua-huo-lianhuan-keep-enemy-linked')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-keep-enemy-linked');
		const data = dataOf(scene);
		const enemy1 = Object.keys(scene.before.hp || {})[2];
		const enemy2 = Object.keys(scene.before.hp || {})[3];
		if (!data.recast) fail('连环在仅有已横置敌方时未重铸');
		if (targetIdsOf(data).length) fail('连环解除了不应解除的敌方横置');
		if (!linksOf(data)[enemy1] || !linksOf(data)[enemy2]) fail('连环重铸后敌方横置状态丢失');
		if (!data.chain) fail('连环敌方横置后续属性伤害未结算');
		if (!(Number(data.chain.after[enemy1]) < Number(data.chain.before[enemy1]))) fail('连环传导未伤害首个敌方');
		if (!(Number(data.chain.after[enemy2]) < Number(data.chain.before[enemy2]))) fail('连环传导未伤害另一个敌方');
		pass('lianhuan-keep-enemy-linked', { recast: true, chainTargets: 2 });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { keepEnemyLinked: true });
	}
	if (want('shenhua-huo-lianhuan-full-linked-recast')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-full-linked-recast');
		const data = dataOf(scene);
		if (!scene.setup || scene.setup.allImmune !== true) fail('全场已横置无解除收益夹具不完整');
		if (!data.recast) fail('连环在全场无解除收益时未重铸');
		if (targetIdsOf(data).length) fail('连环在无解除收益时仍指定目标');
		if (!(Number(data.draws) >= 1)) fail('连环无收益重铸未实际摸牌');
		pass('lianhuan-full-linked-recast', { recast: true, targets: 0, draws: 1 });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { fullLinkedRecast: true });
	}
	if (want('shenhua-huo-lianhuan-link-enemies')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-link-enemies');
		const data = dataOf(scene);
		const ids = targetIdsOf(data);
		const enemy1 = Object.keys(scene.before.hp || {})[2];
		const enemy2 = Object.keys(scene.before.hp || {})[3];
		if (ids.length !== 2) fail('连环未把两名未横置敌方建立连环：' + ids.length);
		if (ids.some(id => !isEnemy(scene, id))) fail('连环建立敌方连环时包含友方或自己');
		if (!ids.every(id => linksOf(data)[id] === true)) fail('连环未实际横置两名敌方');
		if (data.recast) fail('连环在可建立敌方连环时错误重铸');
		if (!data.chain) fail('连环建立后后续属性伤害未结算');
		if (!(Number(data.chain.after[enemy1]) < Number(data.chain.before[enemy1]))) fail('连环建立后首个敌方未受伤');
		if (!(Number(data.chain.after[enemy2]) < Number(data.chain.before[enemy2]))) fail('连环建立后另一个敌方未受伤');
		pass('lianhuan-link-enemies', { targets: ids.length, chainTargets: 2 });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { linkEnemies: true });
	}
	if (want('shenhua-huo-lianhuan-unlinked-ally-only')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-unlinked-ally-only');
		const data = dataOf(scene);
		if (!data.recast) fail('仅有未横置友方时未重铸');
		if (targetIdsOf(data).length) fail('仅有未横置友方时仍指定目标');
		if (!(Number(data.draws) >= 1)) fail('仅有未横置友方时重铸未实际摸牌');
		pass('lianhuan-unlinked-ally-only', { recast: true, targets: 0 });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { unlinkedAllyRecast: true });
	}
	if (want('shenhua-huo-lianhuan-self-linked')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-self-linked');
		const data = dataOf(scene);
		const actor = actorId(scene);
		if (!targetIdsOf(data).includes(actor)) fail('自己已横置时未解除自身连环');
		if (data.recast) fail('自己已横置时错误改走重铸');
		if (data.actorLinked !== false || linksOf(data)[actor] !== false) fail('自己已横置时未实际解除连环');
		pass('lianhuan-self-linked', { targetSelf: true, unlinked: true });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { unlinkSelf: true });
	}
	if (want('shenhua-huo-lianhuan-recast-blocked')) {
		const scene = findScene(report, 'shenhua-huo-lianhuan-recast-blocked');
		const data = dataOf(scene);
		const ids = targetIdsOf(data);
		const actor = actorId(scene);
		const ally = allyId(scene);
		if (!ids.length) fail('重铸被禁用时仍空过，未使用合法铁索');
		if (data.recast || Number(data.draws)) fail('重铸被禁用时仍记录重铸/摸牌');
		if (ids.some(id => id !== actor && id !== ally)) fail('重铸被禁用时铁索目标不是自己/友方');
		if (data.actorLinked !== false && data.allyLinked !== false) fail('重铸被禁用时未实际解除任何横置');
		pass('lianhuan-recast-blocked', { targets: ids.length, actorLinked: data.actorLinked, allyLinked: data.allyLinked });
		signature.lianhuan = Object.assign(signature.lianhuan || {}, { recastBlockedStillUses: true });
	}
	if (signature.lianhuan) {
		validation.lianhuan = { level: '验证无问题', rule_settlement: true, ai_decision: true, positive_negative: true, note: '原生 get.effect 已区分解除友方/自身横置的保护收益与解除敌方的损失；10 个固定局面（7 个新增边界 + 3 个首轮）由原生与扩展逐场景对照，未保留任何 ai2 覆盖。' };
	}

	if (want('shenhua-huo-oldniepan-dying')) {
		const scene = findScene(report, 'shenhua-huo-oldniepan-dying');
		const data = dataOf(scene);
		if (!usedSkill(scene, 'oldniepan')) fail('涅槃濒死场景未实际发动');
		if (data.hp !== 3 || data.alive !== true) fail('涅槃后体力/存活状态不符');
		if (!(handOf(scene.after, actorId(scene)).length === 3)) fail('涅槃后没有 3 张手牌');
		pass('oldniepan-dying-settlement', { used: true, hp: data.hp, hand: 3 });
		signature.oldniepan = { used: true, hp: data.hp };
		validation.oldniepan = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-oldniepan-tao')) {
		const scene = findScene(report, 'shenhua-huo-oldniepan-tao');
		const data = dataOf(scene);
		if (data.used) fail('涅槃在桃已足够自救时仍消耗限定技');
		if (!usedCard(scene, 'tao')) fail('涅槃负向场景未正常使用桃');
		if (data.hp !== 1 || data.alive !== true) fail('涅槃负向场景未以桃自救');
		pass('oldniepan-tao-preserved', { usedOldniepan: false, usedTao: true, hp: data.hp });
		signature.oldniepan = Object.assign(signature.oldniepan || {}, { taoPreserved: true });
	}

	if (want('shenhua-huo-tianyi-compare')) {
		const scene = findScene(report, 'shenhua-huo-tianyi-compare');
		const data = dataOf(scene);
		if (!data.tianyi2 || data.tianyi3) fail('天义拼点胜利后未获得天义2');
		pass('tianyi-compare-win', { tianyi2: true });
		signature.tianyi = { winBuff: true };
		validation.tianyi = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-tianyi-win-sha')) {
		const scene = findScene(report, 'shenhua-huo-tianyi-win-sha');
		const data = dataOf(scene);
		if (!usedSkill(scene, 'tianyi')) fail('天义正向场景未实际发动');
		if (!data.tianyi2 || data.tianyi3) fail('天义胜利后未获得天义2');
		if (!usedCard(scene, 'sha')) fail('天义胜利后未实际出杀');
		if (!(enemyHpLoss(scene) > 0)) fail('天义胜利后的杀未造成伤害');
		pass('tianyi-win-sha-settlement', { used: true, tianyi2: true, shaUsed: true, enemyHpLoss: enemyHpLoss(scene) });
		signature.tianyi = Object.assign(signature.tianyi || {}, { winSha: true });
	}
	if (want('shenhua-huo-tianyi-lose-sha')) {
		const scene = findScene(report, 'shenhua-huo-tianyi-lose-sha');
		if (usedSkill(scene, 'tianyi')) fail('天义在高失败风险局面仍发动');
		if (!usedCard(scene, 'sha')) fail('天义负向场景未正常出杀');
		pass('tianyi-lose-decline', { used: false, shaUsed: true });
		signature.tianyi = Object.assign(signature.tianyi || {}, { loseDecline: true });
	}
	if (want('shenhua-huo-tianyi-lose-content')) {
		const scene = findScene(report, 'shenhua-huo-tianyi-lose-content');
		const data = dataOf(scene);
		if (!data.tianyi3 || data.tianyi2) fail('天义拼点失败后未获得天义3');
		if (data.shaEnabled !== false) fail('天义拼点失败后仍可使用杀');
		pass('tianyi-lose-content', { tianyi3: true, shaEnabled: false });
		signature.tianyi = Object.assign(signature.tianyi || {}, { loseBlocksSha: true });
	}

	if (want('shenhua-huo-shuangxiong-judge')) {
		const scene = findScene(report, 'shenhua-huo-shuangxiong-judge');
		if (!dataOf(scene).viewas) fail('双雄判定后未获得转化技能');
		pass('shuangxiong-judge-viewas', { viewas: true });
		signature.shuangxiong = { viewas: true };
		validation.shuangxiong = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-shuangxiong-duel')) {
		const scene = findScene(report, 'shenhua-huo-shuangxiong-duel');
		const data = dataOf(scene);
		if (!judgesOf(scene).length) fail('双雄正向场景未进行判定');
		if (!data.viewas) fail('双雄正向场景未获得转化技能');
		const juedou = opsOf(scene).filter(item => item && item.op === 'useCard' && item.args && item.args[0] === 'juedou' && item.args[3] === 'shuangxiong_viewas');
		if (!juedou.length) fail('双雄未实际把异色牌当决斗使用');
		if (!(enemyHpLoss(scene) > 0)) fail('双雄决斗未造成伤害');
		pass('shuangxiong-duel-settlement', { judged: true, viewas: true, juedou: juedou.length, enemyHpLoss: enemyHpLoss(scene) });
		signature.shuangxiong = Object.assign(signature.shuangxiong || {}, { duelUsed: true });
	}
	if (want('shenhua-huo-shuangxiong-no-judge')) {
		const scene = findScene(report, 'shenhua-huo-shuangxiong-no-judge');
		const data = dataOf(scene);
		if (judgesOf(scene).length) fail('双雄在手牌不足时仍判定');
		if (data.viewas) fail('双雄负向场景仍获得转化技能');
		pass('shuangxiong-no-judge', { judged: false, viewas: false });
		signature.shuangxiong = Object.assign(signature.shuangxiong || {}, { noJudgeDecline: true });
	}

	if (want('shenhua-huo-luanji-wanjian-use')) {
		const scene = findScene(report, 'shenhua-huo-luanji-wanjian-use');
		const wanjian = (dataOf(scene).wanjian || []);
		if (!wanjian.length) fail('乱击正向场景未实际发动');
		if (wanjian[0].skill !== 'luanji') fail('万箭齐发不是乱击转化');
		if (!(wanjian[0].targets || []).length || wanjian[0].targets.length < 2) fail('乱击未形成多目标万箭');
		if (!(damageOf(scene).some(item => isEnemy(scene, item.player)))) fail('乱击未对敌方造成伤害');
		pass('luanji-wanjian-settlement', { targets: wanjian[0].targets.length, enemyDamage: damageOf(scene).length });
		signature.luanji = { used: true, multiTarget: true, enemyDamaged: true };
		validation.luanji = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-luanji-no-pair')) {
		const scene = findScene(report, 'shenhua-huo-luanji-no-pair');
		const data = dataOf(scene);
		if (data.wanjian && data.wanjian.length) fail('乱击在无同花色对子时仍发动');
		if (handOf(scene.after, actorId(scene)).length !== 2) fail('乱击负向场景错误消耗手牌');
		if (enemyHpLoss(scene) > 0) fail('乱击负向场景造成伤害');
		pass('luanji-no-pair', { used: false, handKept: true });
		signature.luanji = Object.assign(signature.luanji || {}, { noPairDecline: true });
	}
	if (want('shenhua-huo-luanji-wanjian')) {
		const scene = findScene(report, 'shenhua-huo-luanji-wanjian');
		if (usedCard(scene, 'wanjian')) fail('乱击保守局面不应发动却发动了');
		if (handOf(scene.after, actorId(scene)).length !== 2) fail('乱击保守局面错误消耗手牌');
		pass('luanji-conservative-decline', { used: false });
		signature.luanji = Object.assign(signature.luanji || {}, { conservativeDecline: true });
	}

	if (want('quality-luanji-ally-lethal')) {
		const scene = findScene(report, 'quality-luanji-ally-lethal');
		const data = dataOf(scene);
		const ally = allyId(scene);
		if (Number(data.check) !== 0) fail('乱击对1血空手无防具队友的评分未归零：' + data.check);
		if (usedCard(scene, 'wanjian') || (data.uses || []).length) fail('乱击仍对1血空手队友发动万箭');
		if (Number(scene.after.hp[ally]) !== Number(scene.before.hp[ally])) fail('乱击队友反向场景队友体力被改变');
		pass('luanji-ally-lethal-veto', { check: 0, used: false, allyHp: scene.after.hp[ally] });
		signature.luanji = Object.assign(signature.luanji || {}, { allyLethalVeto: true });
		validation.luanji = { level: '确认存在质量提升并已实现', rule_settlement: true, ai_decision: true, positive_negative: true, note: '1血空手无防具队友被万箭打入濒死时拒绝发动；全敌方反向场景仍发动。' };
	}
	if (want('shenhua-huo-huoji-use')) {
		const scene = findScene(report, 'shenhua-huo-huoji-use');
		const data = dataOf(scene);
		const huogong = data.huogong || [];
		if (!huogong.length) fail('火计正向场景未实际发动');
		if (huogong[0].skill !== 'huoji') fail('火攻不是火计转化');
		if (!(damageOf(scene).some(item => item.nature === 'fire' && isEnemy(scene, item.player)))) fail('火计未造成火焰伤害');
		pass('huoji-use-settlement', { huogong: true, fireDamage: true });
		signature.huoji = { used: true, fireDamage: true };
		validation.huoji = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-huoji-red')) {
		const scene = findScene(report, 'shenhua-huo-huoji-red');
		if (dataOf(scene).huogong && dataOf(scene).huogong.length) fail('火计保守局面不应发动却发动了');
		if (handOf(scene.after, actorId(scene)).length !== 1) fail('火计保守局面错误消耗手牌');
		pass('huoji-conservative-decline', { used: false });
		signature.huoji = Object.assign(signature.huoji || {}, { conservativeDecline: true });
	}
	if (want('shenhua-huo-huoji-no-red')) {
		const scene = findScene(report, 'shenhua-huo-huoji-no-red');
		if (dataOf(scene).huogong && dataOf(scene).huogong.length) fail('火计在无红牌时仍发动');
		pass('huoji-no-red', { used: false });
		signature.huoji = Object.assign(signature.huoji || {}, { noRedDecline: true });
	}

	if (want('shenhua-huo-kanpo-response')) {
		const scene = findScene(report, 'shenhua-huo-kanpo-response');
		const data = dataOf(scene);
		if (!(data.wuxie || []).some(item => item.skill === 'kanpo')) fail('看破未把黑牌当无懈实际响应');
		if (damageOf(scene).length) fail('看破响应后仍受到南蛮伤害');
		if (hpDeltaFrom(scene, actorId(scene)) !== 0) fail('看破响应后角色体力变化');
		pass('kanpo-response-settlement', { used: true, damage: 0 });
		signature.kanpo = { responded: true, damage: 0 };
		validation.kanpo = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true };
	}
	if (want('shenhua-huo-kanpo-no-black')) {
		const scene = findScene(report, 'shenhua-huo-kanpo-no-black');
		const data = dataOf(scene);
		if ((data.wuxie || []).length) fail('看破在没有黑牌时仍响应');
		if (!damageOf(scene).length) fail('看破负向场景未正常受到伤害');
		if (hpDeltaFrom(scene, actorId(scene)) !== -1) fail('看破负向场景体力变化不是 -1');
		pass('kanpo-no-black', { used: false, damage: 1 });
		signature.kanpo = Object.assign(signature.kanpo || {}, { noBlackDecline: true });
	}

	if (want('shenhua-huo-bazhen-bagua')) {
		const scene = findScene(report, 'shenhua-huo-bazhen-bagua');
		if (!(scene.setup && scene.setup.bazhenExtra)) fail('八阵正向前置缺失');
		if (scene.setup.emptyArmorSlot === false) fail('八阵正向场景护甲槽已被占用');
		if (!judgesOf(scene).length) fail('八阵未进行实际判定');
		if (damageOf(scene).length) fail('八阵红判定后仍受到伤害');
		if (hpDeltaFrom(scene, actorId(scene)) !== 0) fail('八阵红判定后体力变化');
		pass('bazhen-bagua-settlement', { judged: true, damage: 0 });
		signature.bazhen = { baguaJudged: true, damage: 0 };
		validation.bazhen = { level: '规则结算验证通过', rule_settlement: true, ai_decision: false, positive_negative: true, note: '八卦为自动响应规则，无独立目标 AI；正反向验证判定成功与护甲槽占用后的失效。' };
	}
	if (want('shenhua-huo-bazhen-armor-negative')) {
		const scene = findScene(report, 'shenhua-huo-bazhen-armor-negative');
		if (!(scene.setup && scene.setup.emptyArmorSlot === false)) fail('八阵负向场景护甲槽未被占用');
		if (judgesOf(scene).length) fail('护甲槽占用后仍进行八卦判定');
		if (!damageOf(scene).length) fail('护甲槽占用后未正常受到伤害');
		if (hpDeltaFrom(scene, actorId(scene)) !== -1) fail('八阵失效场景体力变化不是 -1');
		pass('bazhen-armor-negative', { bazhenExtra: false, damage: 1 });
		signature.bazhen = Object.assign(signature.bazhen || {}, { armorDisabled: true });
	}
	if (want('shenhua-huo-passive-rules')) {
		const scene = findScene(report, 'shenhua-huo-passive-rules');
		if (scene.setup.mashuDistance !== 1 || scene.setup.baseDistance !== 2) fail('马术被动距离规则不符');
		if (scene.setup.maxHandcard !== 10) fail('血裔手牌上限规则不符');
		if (!scene.setup.bazhenExtra) fail('八阵额外装备前置不符');
		if (!scene.setup.kanpoView) fail('看破黑牌前置不符');
		pass('passive-rules', { mashuDistance: scene.setup.mashuDistance, maxHandcard: scene.setup.maxHandcard });
		signature.passive = { mashuDistance: scene.setup.mashuDistance, maxHandcard: scene.setup.maxHandcard, bazhenExtra: true, kanpoView: true };
		validation.mashu = { level: '规则结算验证通过', rule_settlement: true, ai_decision: false, positive_negative: false, note: '纯被动距离规则。' };
		validation.xueyi = { level: '规则结算验证通过', rule_settlement: true, ai_decision: false, positive_negative: false, note: '纯被动手牌上限规则。' };
	}

	if (want('shenhua-huo-jianchu-sha')) {
		const scene = findScene(report, 'shenhua-huo-jianchu-sha');
		const data = dataOf(scene);
		if (!(data.directHit || []).length) fail('鞬出弃装备后未记录不可闪避');
		if ((data.equips || []).length) fail('鞬出后目标装备未清空');
		if (!opsOf(scene).some(item => item && item.op === 'discard' && (item.args[0] || []).includes('zhuge'))) fail('鞬出未弃置目标装备');
		if (!(enemyHpLoss(scene) >= 1)) fail('鞬出未造成伤害');
		pass('jianchu-sha-settlement', { directHit: true, equips: data.equips.length, enemyHpLoss: enemyHpLoss(scene) });
		signature.jianchu = { directHit: true, equipDiscarded: true, damage: 1 };
		validation.jianchu = { level: 'AI决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true, note: '无装备分支按技能文本交换目标一张手牌并令其获得此杀，未发现非法目标或隐藏信息读取，只记录真实结算。' };
	}
	if (want('shenhua-huo-jianchu-no-equip')) {
		const scene = findScene(report, 'shenhua-huo-jianchu-no-equip');
		const data = dataOf(scene);
		if ((data.directHit || []).length) fail('鞬出无装备时错误记录不可闪避');
		if (!(data.enemyHand || []).includes('sha')) fail('鞬出无装备时目标未获得此杀');
		if (!(enemyHpLoss(scene) >= 1)) fail('鞬出无装备时未造成伤害');
		pass('jianchu-no-equip', { directHit: false, enemyGainedSha: true, damage: 1 });
		signature.jianchu = Object.assign(signature.jianchu || {}, { noEquipTrade: true });
	}

	return { checks, signature, validation };
}

function hpDeltaFrom(scene, id) {
	return Number(scene.after.hp[id]) - Number(scene.before.hp[id]);
}

function analyzePackScenes(packId, report, requestedScenes) {
	const stats = report.policyStats && report.policyStats.packs && report.policyStats.packs[packId];
	if (!stats) throw new Error('策略统计缺少分包：' + packId);
	const checks = [];
	const pass = (name, detail) => checks.push({ name, passed: true, detail });
	if (packId === 'out_of_scope' && requestedScenes.some(name => name.startsWith('redimeng-'))) {
		const hidden = findScene(report, 'redimeng-hidden-info');
		const permute = findScene(report, 'redimeng-permute-values');
		const mixed = normalizeNames(hidden.mixed);
		const gained = Object.values(hidden.gained || {}).flat();
		if (!mixed.length || JSON.stringify(mixed) !== JSON.stringify(normalizeNames(gained))) throw new Error('redimeng 暗牌结算前后牌不一致');
		pass('hidden-settlement', { mixed, gained: normalizePools(hidden.gained) });
		const runs = permute.runs || [];
		if (runs.length < 2) throw new Error('redimeng 置换场景不足两轮');
		const groups = runs.map(run => normalizeIndices(run.indices));
		if (JSON.stringify(groups[0]) !== JSON.stringify(groups[1])) throw new Error('redimeng 选择索引随隐藏牌面价值改变：' + JSON.stringify(groups));
		for (const run of runs) {
			if (!run.fairMasked) throw new Error('redimeng 未命中公平钩子');
			const selected = Object.values(run.gained || {}).flat().length;
			const indexed = Object.values(run.indices || {}).flat().length;
			if (!selected || selected !== indexed) throw new Error('redimeng 置换结算索引与得牌数量不一致');
		}
		if (!(Number(stats.fairRedimeng) > 0)) throw new Error('fairRedimeng 未命中');
		if (Number(stats.redimengMaskFailed) !== 0) throw new Error('redimengMaskFailed=' + stats.redimengMaskFailed);
		pass('permute-invariance', { indices: groups, fairRedimeng: stats.fairRedimeng, redimengMaskFailed: stats.redimengMaskFailed });
		if (requestedScenes.includes('redimeng-target-legal')) {
			const legal = findScene(report, 'redimeng-target-legal');
			if (legal.usedSkill !== 'redimeng' || !legal.legalTargets) throw new Error('redimeng 合法目标未完成：' + JSON.stringify(legal));
			if (legal.targetTotalBefore !== legal.targetTotalAfter) throw new Error('redimeng 目标手牌结算不守恒');
			pass('target-legal', { targets: legal.usedTargets, cost: legal.costCards, total: legal.targetTotalAfter });
		}
		if (requestedScenes.includes('redimeng-target-zero-cost')) {
			const zero = findScene(report, 'redimeng-target-zero-cost');
			if (zero.usedSkill !== 'redimeng' || !zero.legalTargets || zero.costCards !== 0) throw new Error('redimeng 0 费合法目标未完成：' + JSON.stringify(zero));
			if (zero.targetTotalBefore !== zero.targetTotalAfter) throw new Error('redimeng 0 费目标手牌结算不守恒');
			pass('target-zero-cost', { targets: zero.usedTargets, cost: zero.costCards, total: zero.targetTotalAfter });
		}
		if (requestedScenes.includes('redimeng-target-infeasible')) {
			const infeasible = findScene(report, 'redimeng-target-infeasible');
			if (!infeasible.completed) throw new Error('redimeng 非法目标场景不应发动：' + JSON.stringify(infeasible));
			if (JSON.stringify(infeasible.beforeCounts) !== JSON.stringify(infeasible.afterCounts)) throw new Error('redimeng 不可行场景改变了手牌');
			pass('target-infeasible', { choice: infeasible.choice, usedTargets: infeasible.usedTargets });
		}
		const lifecycle = findScene(report, 'policy-lifecycle');
		if (!lifecycle.before.redimengFind || lifecycle.afterUninstall.redimengFind || !lifecycle.afterReinstall.redimengFind) {
			throw new Error('redimeng find 钩子生命周期未按安装/卸载/重装恢复：' + JSON.stringify(lifecycle));
		}
		pass('redimeng-lifecycle', { before: lifecycle.before, afterUninstall: lifecycle.afterUninstall, afterReinstall: lifecycle.afterReinstall });
		return {
			packId, checks,
			signature: {
				hiddenMixed: mixed,
				hiddenGainedPools: normalizePools(hidden.gained),
				permuteIndices: groups,
				fairRedimeng: stats.fairRedimeng,
				redimengMaskFailed: stats.redimengMaskFailed,
				redimengFindCalls: stats.redimengFindCalls,
				redimengFindFixed: stats.redimengFindFixed,
				redimengFindFallbacks: stats.redimengFindFallbacks,
			},
		};
	}
	if (packId === 'refresh_standard') {
		findScene(report, 'rezhiheng-3hp');
		const retuxi = findScene(report, 'new-retuxi-order');
		if (!(Number(stats.calls) > 0)) throw new Error('rezhiheng 策略未执行');
		if (!(Number(stats.retuxiTargetBonus) > 0)) throw new Error('new_retuxi 目标加成未执行');
		const lost = Object.values(retuxi.lost || {}).map(Number).sort((a, b) => a - b);
		if (!lost.some(value => value > 0)) throw new Error('new_retuxi 未取得目标手牌');
		pass('policy-counters', { calls: stats.calls, retuxiTargetBonus: stats.retuxiTargetBonus, lost });
		return {
			packId, checks,
			signature: {
				calls: stats.calls,
				retuxiTargetBonus: stats.retuxiTargetBonus,
				keptTao: stats.keptTao,
				keptShan: stats.keptShan,
				lost,
			},
		};
	}
	if (packId === 'shenhua_feng') {
		const detailed = analyzeShenhuaFengScenes(report, requestedScenes, stats);
		return { packId, checks, ...detailed };
	}
	if (packId === 'shenhua_huo') {
		const detailed = analyzeShenhuaHuoScenes(report, requestedScenes, stats);
		return { packId, checks, ...detailed };
	}
	if (packId === 'refresh_feng') {
		/* 旧断言使用 target hp3 / 手杀2：当前界风包将其定义为“无法保证击杀，保守放弃”
		 * （见 pack 内 FULL-SKILL-ACCEPTANCE-HANDOFF）。正向检查改用可兑现击杀的 hp2 局面；
		 * hp3 局面保留为负向检查，要求实际不发动、不支付体力。 */
		const scene = findScene(report, 'hp-reqimou-distance4-hp2');
		if (!(Number(stats.reqimouClampCalls) > 0)) throw new Error('reqimou 策略未在可行击杀局面执行');
		if (!opUsesSkill(scene, 'reqimou')) throw new Error('reqimou 可行局面未实际发动技能');
		const paid = opLoseHp(scene);
		if (!(paid > 0)) throw new Error('reqimou 可行局面未实际支付体力');
		const negative = findScene(report, 'hp-reqimou-distance4-hp3');
		if (opUsesSkill(negative, 'reqimou')) throw new Error('reqimou 在不可保证击杀局面仍发动');
		if (!(Number(stats.reqimouInfeasible) > 0)) throw new Error('reqimou 保守放弃未记录');
		pass('policy-counters', { reqimouClampCalls: stats.reqimouClampCalls, reqimouClamp: stats.reqimouClamp, paid, reqimouInfeasible: stats.reqimouInfeasible });
		return {
			packId, checks,
			signature: {
				reqimouClampCalls: stats.reqimouClampCalls,
				reqimouClamp: stats.reqimouClamp,
				reqimouGateSkip: stats.reqimouGateSkip,
				reqimouInfeasible: stats.reqimouInfeasible,
				usedReqimou: true,
				paid,
			},
		};
	}
	if (packId === 'shenhua_lei') {
		const arrayCount = findScene(report, 'olkongsheng-array-count');
		const repeat = findScene(report, 'olkongsheng-repeat');
		if (!(Number(stats.olkongshengCostCalls) > 0)) throw new Error('olkongsheng 成本策略未执行');
		if (stats.olkongshengCompatible !== true) throw new Error('olkongsheng 宿主形态不兼容');
		const selected = normalizeNames(arrayCount.selected);
		if (selected.length !== 1) throw new Error('olkongsheng 数组数量修正未生效');
		const runs = repeat.runs || [];
		if (runs.length < 2 || runs.some(value => value !== 1)) throw new Error('olkongsheng 重复发动次数异常');
		if (!repeat.scopeRestored) throw new Error('olkongsheng 作用域未恢复');
		pass('policy-counters', { olkongshengCostCalls: stats.olkongshengCostCalls, selected, runs });
		return {
			packId, checks,
			signature: {
				olkongshengCostCalls: stats.olkongshengCostCalls,
				olkongshengCompatible: stats.olkongshengCompatible,
				selected,
				runs,
				scopeRestored: repeat.scopeRestored,
			},
		};
	}
	throw new Error('未为该分包定义技能级宿主判据：' + packId);
}

function compareWithBaseline(packId, skillCheck) {
	if (!BASELINE_DIR) return null;
	const file = path.join(BASELINE_DIR, BASELINE_PREFIX + packId + '.json');
	if (!exists(file)) throw new Error('缺少单包基线验收：' + file);
	const baseline = jsonOf(file);
	const record = baseline.skillChecks && baseline.skillChecks[packId];
	if (!record || !record.signature) throw new Error('单包基线缺少技能判据：' + file);
	if (JSON.stringify(record.signature) !== JSON.stringify(skillCheck.signature)) {
		throw new Error('组合安装改变了 ' + packId + ' 的技能结果：\n  单包=' + JSON.stringify(record.signature) + '\n  组合=' + JSON.stringify(skillCheck.signature));
	}
	return { pack_id: packId, baseline: path.relative(WORK, file), signature_match: true };
}

function loadSkillScenes(root, label, scenes, expectedPacks, options = {}) {
	if (!HOST || !CHROME || !PLAYWRIGHT) return { status: 'skipped', reason: '未提供 --host-root/--browser/--playwright', scenes };
	if (!scenes || !scenes.length) throw new Error('未指定技能级宿主场景');
	const output = path.join(WORK, 'host-' + label + '.json');
	const args = ['--mode', 'identity', '--skill-ai'];
	if (!options.native) args.push('--skill-ai-extension');
	args.push(
		'--scenes', scenes.join(','), '--seed', '20261030',
		'--host-root', HOST, '--extension-root', root,
		'--browser', CHROME, '--playwright', PLAYWRIGHT, '--output', output,
	);
	const result = runNode(path.join(REPO, 'tools/trick-real-host-smoke.mjs'), args, { cwd: REPO, timeout: 420000 });
	let report = null;
	try { report = jsonOf(output); } catch (error) {}
	if (result.status !== 0 || !report || report.status !== 'passed') throw new Error('宿主技能场景失败 [' + label + ']：' + String(result.stderr || result.stdout || '').slice(-1200));
	if (report.errors && report.errors.length) throw new Error('宿主技能场景出现错误 [' + label + ']：' + report.errors.join('; '));
	for (const name of scenes) findScene(report, name);
	const packIds = Object.keys((report.policyStats && report.policyStats.packs) || {}).sort();
	if (expectedPacks && expectedPacks.length) {
		const wanted = expectedPacks.slice().sort();
		if (JSON.stringify(packIds) !== JSON.stringify(wanted)) throw new Error('策略分包集合不符 [' + label + ']：' + JSON.stringify(packIds) + '，期望 ' + JSON.stringify(wanted));
	}
	const skillChecks = {};
	if (expectedPacks && expectedPacks.length) for (const packId of expectedPacks) skillChecks[packId] = analyzePackScenes(packId, report, scenes);
	const base = {
		status: 'passed', scenes,
		policyStats: report.policyStats,
		skillChecks,
		output: path.relative(WORK, output),
	};
	if (options.includeReport) base.report = report;
	return base;
}

function mergeHostReports(reports) {
	const merged = {
		...reports[0],
		status: reports.every(report => report.status === 'passed') ? 'passed' : 'failed',
		scenes: [],
		errors: reports.flatMap(report => report.errors || []),
	};
	const seen = new Set();
	for (const report of reports) {
		for (const scene of report.scenes || []) {
			if (!scene || !scene.name) continue;
			if (['engine-disabled-gate', 'policy-lifecycle', 'full-engine-lifecycle'].includes(scene.name)) {
				if (seen.has(scene.name)) continue;
				seen.add(scene.name);
			}
			merged.scenes.push(scene);
		}
	}
	if (reports[0].policyStats) {
		merged.policyStats = JSON.parse(JSON.stringify(reports[0].policyStats));
		for (const report of reports.slice(1)) {
			const stats = report.policyStats;
			if (!stats) continue;
			if (stats.installed) merged.policyStats.installed = true;
			for (const [key, value] of Object.entries(stats)) {
				if (key === 'packs') continue;
				if (typeof value === 'number') merged.policyStats[key] = (Number(merged.policyStats[key]) || 0) + value;
				else if (merged.policyStats[key] == null) merged.policyStats[key] = value;
			}
			merged.policyStats.packs = merged.policyStats.packs || {};
			for (const [packId, packStats] of Object.entries(stats.packs || {})) {
				merged.policyStats.packs[packId] = merged.policyStats.packs[packId] || {};
				for (const [key, value] of Object.entries(packStats || {})) {
					if (typeof value === 'number') merged.policyStats.packs[packId][key] = (Number(merged.policyStats.packs[packId][key]) || 0) + value;
					else if (merged.policyStats.packs[packId][key] == null) merged.policyStats.packs[packId][key] = value;
				}
			}
		}
	}
	merged.extensionInstalled = reports.some(report => report.extensionInstalled);
	return merged;
}

function loadSkillScenesGrouped(root, label, scenes, expectedPacks, options = {}) {
	if (!HOST || !CHROME || !PLAYWRIGHT) {
		return { status: 'skipped', reason: '未提供 --host-root/--browser/--playwright', scenes, skillChecks: {}, policyStats: null, output: [] };
	}
	const groupOf = name => {
		if (name.startsWith('hp-qimou') || name.startsWith('qimou-')) return 'shenhua_feng-qimou';
		if (name === 'shenhua-huo-luanji-wanjian-use') return 'shenhua_huo-luanji-positive';
		if (name === 'shenhua-huo-huoji-use') return 'shenhua_huo-huoji-positive';
		if (name.startsWith('quality-luanji')) return 'shenhua_huo-review';
		if (name.startsWith('quality-kuanggu') || name.startsWith('quality-jushou') || name.startsWith('quality-shensu1') || name.startsWith('quality-guhuo') || name.startsWith('quality-huangtian')) return 'shenhua_feng-review';
		if (name.startsWith('hp-qiangxix') || name.startsWith('shenhua-huo-')) return 'shenhua_huo-review';
		if (name.startsWith('shenhua-')) return 'shenhua_feng-review';
		if (name.startsWith('rezhiheng') || name.startsWith('new-retuxi')) return 'refresh_standard';
		if (name.startsWith('hp-reqimou') || name.startsWith('reqimou-')) return 'refresh_feng';
		if (name.startsWith('olkongsheng') || name.startsWith('kongsheng')) return 'shenhua_lei';
		if (name.startsWith('redimeng')) return 'out_of_scope';
		return 'other';
	};
	const groups = new Map();
	for (const name of scenes) {
		const id = groupOf(name);
		if (!groups.has(id)) groups.set(id, []);
		groups.get(id).push(name);
	}
	// 每个分包场景组使用独立宿主进程；所有已安装分包在每个进程中仍同时加载。
	// 这样既验证共存，又避免前一分包场景改变后续 AI 决策上下文。
	if (groups.size <= 1) return loadSkillScenes(root, label, scenes, expectedPacks, options);
	const loads = [];
	for (const [id, groupScenes] of groups) {
		const load = loadSkillScenes(root, label + '-' + id, groupScenes, [], Object.assign({}, options, { includeReport: true }));
		loads.push(load);
	}
	const report = mergeHostReports(loads.map(load => load.report));
	const skillChecks = {};
	if (expectedPacks && expectedPacks.length) {
		const packIds = Object.keys((report.policyStats && report.policyStats.packs) || {}).sort();
		const wanted = expectedPacks.slice().sort();
		if (JSON.stringify(packIds) !== JSON.stringify(wanted)) throw new Error('策略分包集合不符 [' + label + ']：' + JSON.stringify(packIds) + '，期望 ' + JSON.stringify(wanted));
		for (const packId of expectedPacks) skillChecks[packId] = analyzePackScenes(packId, report, scenes);
	}
	const base = {
		status: 'passed', scenes,
		policyStats: report.policyStats,
		skillChecks,
		output: loads.map(load => load.output),
	};
	if (options.includeReport) base.report = report;
	return base;
}

function skippedRun(command, reason) {
	return { command, status: 0, signal: null, stdout: '', stderr: '', error: null, skipped: true, reason };
}

function packSummary(zip, root) {
	const packJson = jsonOf(path.join(root, 'pack.json'));
	const packageTestsPath = path.join(root, 'tests/run-pack-tests.mjs');
	const crossPlatformPath = path.join(root, 'tests/test-verify-zip.py');
	const packageTestsPresent = exists(packageTestsPath);
	const crossPlatformPresent = exists(crossPlatformPath);
	return {
		id: packJson.id,
		name: packJson.name,
		zip: path.resolve(zip),
		zip_size: fs.statSync(zip).size,
		zip_sha256: sha(read(zip)),
		delivery_stage: packJson.delivery_stage,
		implemented_skills: packJson.implemented_skills || [],
		target_skills_count: (packJson.target_skills || []).length,
		tests_present: packageTestsPresent,
		package_tests: packageTestsPresent
			? runNode(packageTestsPath, [], { cwd: root })
			: (ALLOW_MISSING_TESTS ? skippedRun('node ' + packageTestsPath, 'ZIP 不含 tests/run-pack-tests.mjs') : runNode(packageTestsPath, [], { cwd: root })),
		verify_zip: run('python', [path.join(root, 'verify.py'), '--zip', path.resolve(zip)], { cwd: root }),
		verify_dir: run('python', [path.join(root, 'verify.py')], { cwd: root }),
		verify_cross_platform: crossPlatformPresent
			? run('python', [crossPlatformPath], { cwd: root })
			: (ALLOW_MISSING_TESTS ? skippedRun('python ' + crossPlatformPath, 'ZIP 不含 tests/test-verify-zip.py') : run('python', [crossPlatformPath], { cwd: root })),
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
	base_ref: BASE_REF,
	wired_index: null,
	scenes: EXPLICIT_SCENES,
	contract: { single: null, combined: null },
	skillChecks: {},
	baseline_comparison: [],
	native_comparison: null,
	packs: [],
	steps: [],
	skipped_checks: [],
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
			tests_present: summary.tests_present,
			package_tests_status: summary.package_tests.status,
			verify_zip_status: summary.verify_zip.status,
			verify_dir_status: summary.verify_dir.status,
			verify_cross_platform_status: summary.verify_cross_platform.status,
		});
		if (summary.package_tests.skipped) result.skipped_checks.push({ pack: summary.id, check: 'package-tests', reason: summary.package_tests.reason });
		if (summary.verify_cross_platform.skipped) result.skipped_checks.push({ pack: summary.id, check: 'verify-cross-platform', reason: summary.verify_cross_platform.reason });
		result.steps.push({ step: 'extract+verify', pack: summary.id, status: summary.package_tests.status === 0 && summary.verify_zip.status === 0 && summary.verify_dir.status === 0 && summary.verify_cross_platform.status === 0 ? 'passed' : 'failed', package_tests: summary.package_tests, verify_zip: summary.verify_zip, verify_dir: summary.verify_dir, verify_cross_platform: summary.verify_cross_platform });
		if (summary.package_tests.status !== 0 || summary.verify_zip.status !== 0 || summary.verify_dir.status !== 0 || summary.verify_cross_platform.status !== 0) throw new Error('包内测试/校验失败：' + summary.id);
		return summary;
	});
	if (ZIP_SHA) {
		for (const summary of prepared) if (summary.zip_sha256 !== ZIP_SHA) throw new Error('ZIP SHA256 与期望不一致：' + summary.id);
	}

	if (prepared.length === 1) {
		const pack = prepared[0];
		result.scenes = EXPLICIT_SCENES || DEFAULT_SCENES[pack.id] || null;
		/* 1.11.7 原生 redimeng.find(2) 已知抛错；卸载/回滚后的原生基线只跑不经过目标评估的场景。 */
		const nativeScenes = pack.id === 'out_of_scope' ? result.scenes.filter(name => !name.startsWith('redimeng-target')) : result.scenes;
		const target = makeCleanTarget('single-' + pack.id, BASE_REF, pack.packJson.shared_files);
		const contract = captureContract(target);
		let nativeLoad = null;
		if (['shenhua_feng', 'shenhua_huo'].includes(pack.id) && HOST && CHROME && PLAYWRIGHT) {
			nativeLoad = loadSkillScenesGrouped(target, 'single-' + pack.id + '-native', result.scenes, [], { native: true, includeReport: true });
			result.steps.push({ step: 'native-baseline', pack: pack.id, status: nativeLoad.status, output: nativeLoad.output });
		}
		if (WIRE_INDEX) {
			const beforeWiring = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
			if (beforeWiring.status === 0) throw new Error('基线未接线时 apply 不应成功');
			if (!/接线|score-index/.test(beforeWiring.stderr)) throw new Error('未接线基线的失败原因不符：' + beforeWiring.stderr);
			result.steps.push({ step: 'wiring-required', pack: pack.id, status: 'passed', stderr: beforeWiring.stderr.trim() });
			result.wired_index = wireIndexDiff(target, [pack.root]);
			result.steps.push({ step: 'index-wiring', pack: pack.id, status: 'passed', ...result.wired_index });
		}
		const applied = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (applied.status !== 0 || applied.json.status !== 'applied') throw new Error('安装失败：' + applied.stderr);
		result.steps.push({ step: 'apply', pack: pack.id, status: 'passed', output: applied.json });
		const installed = assertInstalled(target, pack, pack.packJson, contract);
		result.steps.push({ step: 'install-check', pack: pack.id, status: 'passed', ...installed });
		result.contract.single = true;
		const load = loadSkillScenesGrouped(target, 'single-' + pack.id + '-installed', result.scenes, [pack.id], { includeReport: true });
		const loadStep = Object.assign({}, load);
		delete loadStep.report;
		result.steps.push({ step: 'host-load-installed', pack: pack.id, ...loadStep });
		if (load.status === 'passed') result.skillChecks[pack.id] = load.skillChecks[pack.id];
		if (nativeLoad && nativeLoad.report && load.status === 'passed' && load.report) {
			const comparison = compareNativeExtension(nativeLoad.report, load.report, result.scenes);
			result.native_comparison = comparison;
			result.steps.push({ step: 'native-comparison', pack: pack.id, status: comparison.semantic_all ? 'passed' : 'failed', exact_all: comparison.exact_all, semantic_all: comparison.semantic_all, allowed_random_differences: comparison.allowed_random_differences, strategy_differences: comparison.strategy_differences });
			if (!comparison.semantic_all) throw new Error('原生/扩展语义对照失败：' + JSON.stringify(comparison.rows.filter(row => !row.semantic_match)));
		}
		const rolled = runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (rolled.status !== 0 || rolled.json.status !== 'rolled-back') throw new Error('回滚失败：' + rolled.stderr);
		result.steps.push({ step: 'rollback', pack: pack.id, status: 'passed', output: rolled.json });
		const after = assertRolledBack(target, pack, []);
		result.steps.push({ step: 'rollback-check', pack: pack.id, status: 'passed', imports: after });
		const loadAfter = loadSkillScenesGrouped(target, 'single-' + pack.id + '-rolledback', nativeScenes, []);
		result.native_scenes = nativeScenes;
		result.steps.push({ step: 'host-load-rolledback', pack: pack.id, ...loadAfter });
		const reinstall = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (reinstall.status !== 0 || !['applied', 'already-installed'].includes(reinstall.json.status)) throw new Error('重装失败：' + reinstall.stderr);
		result.steps.push({ step: 'reinstall', pack: pack.id, status: 'passed', output: reinstall.json });
		assertInstalled(target, pack, pack.packJson, contract);
		const finalRollback = runJson(path.join(pack.root, 'integration/rollback-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
		if (finalRollback.status !== 0) throw new Error('重装后回滚失败：' + finalRollback.stderr);
		assertRolledBack(target, pack, []);
		result.target = target;
	} else {
		const requiredScenes = [];
		for (const pack of prepared) for (const scene of DEFAULT_SCENES[pack.id] || []) if (!requiredScenes.includes(scene)) requiredScenes.push(scene);
		result.scenes = EXPLICIT_SCENES ? Array.from(new Set([...requiredScenes, ...EXPLICIT_SCENES])) : requiredScenes;
		if (!result.scenes.length) throw new Error('组合验收缺少技能级宿主场景');
		const nativeScenes = result.scenes.filter(name => !name.startsWith('redimeng-target'));
		const combinedShared = {};
		for (const pack of prepared) Object.assign(combinedShared, pack.packJson.shared_files || {});
		const target = makeCleanTarget('combined', BASE_REF, combinedShared);
		const contract = captureContract(target);
		if (WIRE_INDEX) {
			const first = prepared[0];
			const beforeWiring = runJson(path.join(first.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: first.root });
			if (beforeWiring.status === 0) throw new Error('基线未接线时 apply 不应成功');
			if (!/接线|score-index/.test(beforeWiring.stderr)) throw new Error('未接线基线的失败原因不符：' + beforeWiring.stderr);
			result.steps.push({ step: 'wiring-required', pack: first.id, status: 'passed', stderr: beforeWiring.stderr.trim() });
			result.wired_index = wireIndexDiff(target, prepared.map(pack => pack.root));
			result.steps.push({ step: 'index-wiring', pack: 'combined', status: 'passed', ...result.wired_index });
		}
		const developerPath = path.join(target, 'score/decision/skills/packs/developer.js');
		fs.mkdirSync(path.dirname(developerPath), { recursive: true });
		fs.writeFileSync(developerPath, 'export const pack = { id: "developer" };\n');
		fs.writeFileSync(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js'), '// @djsc-pack-imports-begin\nimport { pack as developer } from \'./packs/developer.js?v=41a\';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\tdeveloper,\n\t// @djsc-pack-registry-end\n];\n');
		const applied = [];
		for (const pack of prepared) {
			const outcome = runJson(path.join(pack.root, 'integration/apply-pack.mjs'), ['--extension-root', target], { cwd: pack.root });
			if (outcome.status !== 0 || !['applied', 'already-installed'].includes(outcome.json.status)) throw new Error('共存安装失败：' + pack.id + ' ' + outcome.stderr);
			assertInstalled(target, pack, pack.packJson, contract);
			applied.push(pack);
			result.steps.push({ step: 'apply-coexist', pack: pack.id, status: 'passed', output: outcome.json });
		}
		result.contract.combined = true;
		const registryText = read(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
		if (!registryText.includes('developer,')) throw new Error('共存安装覆盖了开发者注册行');
		if (verifyImports(target).length !== prepared.length + 1) throw new Error('共存注册表导入数不符');
		const load = loadSkillScenesGrouped(target, 'combined-installed', result.scenes, prepared.map(item => item.id));
		result.steps.push({ step: 'host-load-installed', pack: prepared.map(item => item.id).join(','), ...load });
		if (load.status === 'passed') {
			result.skillChecks = load.skillChecks;
			for (const pack of prepared) {
				const comparison = compareWithBaseline(pack.id, load.skillChecks[pack.id]);
				if (comparison) result.baseline_comparison.push(comparison);
			}
		}
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
			for (const file of Object.keys(pack.packJson.pack_files || {})) {
				/* skillPlanHints.js 是完整引擎共享软建议；标准包回滚按设计保留，不能当残留。 */
				if (file === 'skillPlanHints.js') continue;
				if (exists(path.join(target, 'score/decision/skills', ...file.split('/')))) throw new Error('回滚后文件仍存在：' + pack.id + '/' + file);
			}
			if (pack.id === 'refresh_standard' && !exists(path.join(target, 'score/decision/skills/skillPlanHints.js'))) throw new Error('回滚误删完整引擎共享软建议文件：skillPlanHints.js');
			assertRolledBack(target, pack, []);
			result.steps.push({ step: 'rollback-coexist', pack: pack.id, status: 'passed', remaining: [...remaining] });
		}
		const afterText = read(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
		if (!afterText.includes('developer,')) throw new Error('回滚误删开发者注册行');
		const loadAfter = loadSkillScenesGrouped(target, 'combined-rolledback', nativeScenes, []);
		result.native_scenes = nativeScenes;
		result.steps.push({ step: 'host-load-rolledback', pack: 'combined', ...loadAfter });
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
