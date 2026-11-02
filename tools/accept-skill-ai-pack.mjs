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
const DEFAULT_SCENES = {
	refresh_standard: ['rezhiheng-3hp', 'new-retuxi-order'],
	shenhua_feng: [
		'hp-qimou-distance4-hp3', 'hp-qimou-distance4-hp4-negative', 'hp-qimou-distance3-hp2',
		'shenhua-releiji-target', 'shenhua-guidao-replace', 'shenhua-guidao-decline',
		'shenhua-huangtian-give', 'shenhua-huangtian-negative',
		'shenhua-guhuo-claim', 'shenhua-guhuo-ai-use', 'shenhua-guhuo-real-questioned',
		'shenhua-guhuo-fake-questioned', 'shenhua-guhuo-phase',
		'shenhua-shensu-skip', 'shenhua-shensu-negative',
		'shenhua-tianxiang-redirect', 'shenhua-tianxiang-negative', 'shenhua-hongyan-suit',
		'shenhua-kuanggu-draw', 'shenhua-kuanggu-recover',
		'shenhua-jushou-4hp-empty', 'shenhua-jushou-lowhp',
		'shenhua-buqu-damage', 'shenhua-buqu-negative', 'shenhua-buqu-recover-choice',
		'shenhua-liegong-hit', 'shenhua-liegong-negative',
	],
	refresh_feng: ['hp-reqimou-distance4-hp3'],
	shenhua_lei: ['olkongsheng-array-count', 'olkongsheng-repeat'],
	out_of_scope: ['redimeng-hidden-info', 'redimeng-permute-values'],
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

function makeCleanTarget(name, baseRef = null) {
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
	const opUsed = (scene, op, predicate) => (scene.ops || []).some(item => item && item.op === op && (!predicate || predicate(item)));
	const damageEvent = scene => (scene.damage || [])[0];
	const isEnemyTarget = (scene, id) => !!id && id !== actorId(scene) && id !== allyId(scene);

	if (want('hp-qimou-distance4-hp3')) {
		const scene = findScene(report, 'hp-qimou-distance4-hp3');
		if (!(Number(stats.qimouBypass) > 0)) fail('qimou 策略未执行');
		if (!opUsesSkill(scene, 'qimou')) fail('qimou 场景未实际发动技能');
		const paid = opLoseHp(scene);
		if (!(paid > 0)) fail('qimou 场景未实际支付体力');
		pass('qimou-settlement', { qimouBypass: stats.qimouBypass, paid });
		signature.qimou = { qimouBypass: stats.qimouBypass, usedQimou: true, paid };
		validation.qimou = { level: '确认缺陷并已修复', rule_settlement: true, ai_decision: true, positive_negative: true };
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

	if (want('shenhua-guhuo-ai-use')) {
		const scene = findScene(report, 'shenhua-guhuo-ai-use');
		const actor = actorId(scene);
		const targets = (scene.choice && scene.choice.targets || []).map(idOnly);
		const beforeHand = handOf(scene.before, actor);
		const afterHand = handOf(scene.after, actor);
		const hidden = scene.choice && scene.choice.cards || [];
		if (!scene.used) fail('蛊惑 AI 未实际使用');
		if (scene.declared !== 'sha') fail('蛊惑 AI 未声明杀');
		if (!(scene.buttonChoices || []).flat().includes('sha')) fail('蛊惑按钮未记录杀的声明');
		if (targets.length !== 1) fail('蛊惑目标数不是 1');
		if (!isEnemyTarget(scene, targets[0])) fail('蛊惑选择了友方或自己');
		if ((scene.targetAttitudes || []).some(value => value >= 0)) fail('蛊惑目标态度不是敌对');
		if (scene.targetsSelf) fail('蛊惑目标包含自己');
		const damage = damageEvent(scene);
		if (!damage || damage.num !== 1 || damage.player !== targets[0]) fail('蛊惑声明杀后未对目标造成 1 点伤害');
		if (!scene.guhuoPhase) fail('蛊惑未进入 guhuo_phase');
		if (beforeHand.length - afterHand.length !== 1) fail('蛊惑未消耗一张隐藏手牌');
		if (!hidden.length || hidden.includes('sha')) fail('蛊惑 AI 实际使用了真杀而非隐藏牌');
		pass('guhuo-ai-use-settlement', { used: true, declared: 'sha', targetEnemy: true, damage: 1, hidden });
		validation.xinfu_guhuo = { level: '正反向决策验证通过', rule_settlement: true, ai_decision: true, positive_negative: true, note: 'AI 实际发动假声明；另用真实牌验证质疑成功、用假牌验证质疑取消；扩展在假牌+确定质疑场景选择放弃，单独记录为策略差异。' };
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

	return { checks, signature, validation };
}

function analyzePackScenes(packId, report, requestedScenes) {
	const stats = report.policyStats && report.policyStats.packs && report.policyStats.packs[packId];
	if (!stats) throw new Error('策略统计缺少分包：' + packId);
	const checks = [];
	const pass = (name, detail) => checks.push({ name, passed: true, detail });
	if (packId === 'out_of_scope' && (requestedScenes.includes('redimeng-hidden-info') || requestedScenes.includes('redimeng-permute-values'))) {
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
		return {
			packId, checks,
			signature: {
				hiddenMixed: mixed,
				hiddenGainedPools: normalizePools(hidden.gained),
				permuteIndices: groups,
				fairRedimeng: stats.fairRedimeng,
				redimengMaskFailed: stats.redimengMaskFailed,
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
	if (packId === 'refresh_feng') {
		const scene = findScene(report, 'hp-reqimou-distance4-hp3');
		if (!(Number(stats.reqimouClampCalls) > 0)) throw new Error('reqimou 策略未执行');
		if (!opUsesSkill(scene, 'reqimou')) throw new Error('reqimou 场景未实际发动技能');
		const paid = opLoseHp(scene);
		if (!(paid > 0)) throw new Error('reqimou 场景未实际支付体力');
		pass('policy-counters', { reqimouClampCalls: stats.reqimouClampCalls, reqimouClamp: stats.reqimouClamp, paid });
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
	const groupOf = name => {
		if (name.startsWith('hp-qimou') || name.startsWith('qimou-')) return 'shenhua_feng-qimou';
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
	base_ref: BASE_REF,
	wired_index: null,
	scenes: EXPLICIT_SCENES,
	contract: { single: null, combined: null },
	skillChecks: {},
	baseline_comparison: [],
	native_comparison: null,
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
		result.scenes = EXPLICIT_SCENES || DEFAULT_SCENES[pack.id] || null;
		const target = makeCleanTarget('single-' + pack.id, BASE_REF);
		const contract = captureContract(target);
		let nativeLoad = null;
		if (pack.id === 'shenhua_feng' && HOST && CHROME && PLAYWRIGHT) {
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
		const loadAfter = loadSkillScenesGrouped(target, 'single-' + pack.id + '-rolledback', result.scenes, []);
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
		const target = makeCleanTarget('combined', BASE_REF);
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
			for (const file of Object.keys(pack.packJson.pack_files || {})) if (exists(path.join(target, 'score/decision/skills', ...file.split('/')))) throw new Error('回滚后文件仍存在：' + pack.id + '/' + file);
			assertRolledBack(target, pack, []);
			result.steps.push({ step: 'rollback-coexist', pack: pack.id, status: 'passed', remaining: [...remaining] });
		}
		const afterText = read(path.join(target, 'score/decision/skills/skillAIPolicyPacks.js')).toString('utf8');
		if (!afterText.includes('developer,')) throw new Error('回滚误删开发者注册行');
		const loadAfter = loadSkillScenesGrouped(target, 'combined-rolledback', result.scenes, []);
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
