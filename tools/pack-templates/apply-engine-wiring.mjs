#!/usr/bin/env node
// 完整引擎接线补丁（可选）：让引擎候选层/staging 层尊重分包的 skillVetoRegistry 动态否决。
// 策略层（policyOnly/分包集成）不需要本补丁——分包 wrap 直接生效。
//
// 用法：
//   node integration/apply-engine-wiring.mjs --extension-root <无名AI根目录> [--dry-run]
//   node integration/apply-engine-wiring.mjs --extension-root <无名AI根目录> --rollback
//
// 特性：幂等（重复执行报 already-wired）、逐文件备份到 .djsc-pack-backups/engine-wiring/、
//       应用后 node --check 语法校验、失败自动恢复、--rollback 按备份还原。
// 前置：目标扩展已包含 score/decision/skills/skillVetoRegistry.js（由分包 apply-pack 安装）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const root = option('extension-root');
const dryRun = args.includes('--dry-run');
const doRollback = args.includes('--rollback');
if (!root) {
	console.error('usage: node integration/apply-engine-wiring.mjs --extension-root <dir> [--dry-run|--rollback]');
	process.exit(2);
}
const targetRoot = path.resolve(root);
const rel = file => path.join(targetRoot, ...file.split('/'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const backupDir = path.join(targetRoot, '.djsc-pack-backups', 'engine-wiring');
const MARK = '@djsc-skill-veto-wiring';

/* 三个最小接线点：只新增 import 与查询调用，不改任何既有判断/评分。 */
const WIRING = [
	{
		file: 'score/decision/skills/skillPlayBrain.js',
		patch: [
			{
				anchor: `import { skillPriorityBias, skillTimingAdjust, allyTargetBias, enemyTargetBias } from '../strategy/identityPolicy.js?v=41a';`,
				insert: `
/* ${MARK}：分包动态技能否决（skillVetoRegistry），vetoSkill 规则⑤查询。 */
import { dynamicSkillVeto } from './skillVetoRegistry.js?v=41a';`,
			},
			{
				anchor: `	if (!enemies.length) return { veto: true, reason: '控制技无可控真敌' };\n	}`,
				insert: `
	/* ${MARK}：⑤ 分包动态否决（fail-open）。 */
	const dyn = dynamicSkillVeto(sid, profile, ctx);
	if (dyn) return dyn;`,
			},
		],
	},
	{
		file: 'score/decision/skills/activeSkillEligibility.js',
		patch: [
			{
				anchor: `/* 主动候选只来自当前玩家真实的出牌选择窗口；触发技能仍由宿主触发。`,
				insert: `/* ${MARK}：分包动态技能否决（skillVetoRegistry），activePlaySkills 枚举源头过滤。 */
import { dynamicSkillVeto } from './skillVetoRegistry.js?v=41a';

`,
			},
			{
				anchor: `  } catch (_) { _diagBump('filterEnableRej'); return false; }`,
				insert: `
  try {
   const dynVeto = dynamicSkillVeto(id, null, { me: { ref: player } });
   if (dynVeto && dynVeto.veto) { _diagBump('packVeto', id); return false; }
  } catch (_) { /* ${MARK} fail-open */ }`,
			},
		],
	},
	{
		file: 'score/decision/override/use.js',
		patch: [
			{
				anchor: `import { trip, isTripped } from './circuit.js?v=41a';`,
				insert: `
/* ${MARK}：分包动态技能否决（skillVetoRegistry），staging 守卫。 */
import { dynamicSkillVeto } from '../skills/skillVetoRegistry.js?v=41a';`,
			},
			{
				anchor: `				if (!decision?.rule) { _stat('pass'); return restore; }`,
				insert: `
				/* ${MARK}：注册表否决的技能不 stage，交回宿主自身流程。 */
				if (decision.type === 'skill' && decision.id) {
					try {
						const dynV = dynamicSkillVeto(decision.id, null, { me: { ref: player } });
						if (dynV && dynV.veto) {
							_stat('skillVeto');
							trace.skillVeto = dynV.reason || 'pack-veto';
							return restore;
						}
					} catch (_) {}
				}`,
			},
		],
	},
];

const read = file => fs.readFileSync(file);
const exists = file => fs.existsSync(file);
const atomicWrite = (target, content) => {
	const temporary = target + '.tmp-' + process.pid;
	try {
		fs.writeFileSync(temporary, content);
		fs.renameSync(temporary, target);
	} finally {
		try { if (exists(temporary)) fs.rmSync(temporary, { force: true }); } catch (_) {}
	}
};
const syntaxCheck = file => {
	try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); return true; }
	catch (error) { throw new Error('接线后语法校验失败：' + file + '\n' + (error.stderr || error.message)); }
};

if (doRollback) {
	if (!exists(backupDir)) {
		console.log(JSON.stringify({ status: 'nothing-to-rollback', root: targetRoot }));
		process.exit(0);
	}
	for (const item of WIRING) {
		const backupPath = path.join(backupDir, ...item.file.split('/'));
		if (!exists(backupPath)) continue;
		atomicWrite(rel(item.file), read(backupPath));
		console.log('restored ' + item.file);
	}
	fs.rmSync(backupDir, { recursive: true, force: true });
	console.log(JSON.stringify({ status: 'rolled-back', root: targetRoot }));
	process.exit(0);
}

if (!exists(rel('score/index.js'))) {
	console.error('WIRING FAIL: 目标不是无名AI扩展根目录（缺少 score/index.js）');
	process.exit(2);
}
const registryRel = rel('score/decision/skills/skillVetoRegistry.js');
if (!exists(registryRel)) {
	console.error('WIRING FAIL: 缺少共享模块 score/decision/skills/skillVetoRegistry.js；请先运行 integration/apply-pack.mjs 安装分包（会一并写入该模块）');
	process.exit(2);
}

const plan = [];
let already = true;
/* 行尾自适应：宿主文件可能是 CRLF（git autocrlf）或 LF；锚点与插入文本统一按目标行尾适配。 */
const adapt = (fileText, text) => fileText.includes('\r\n') && !text.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text;
for (const item of WIRING) {
	const target = rel(item.file);
	if (!exists(target)) { console.error('WIRING FAIL: 缺少 ' + item.file); process.exit(2); }
	const original = read(target).toString('utf8');
	/* 幂等：marker 注释或 dynamicSkillVeto 引用任一存在即视为已接线。 */
	if (original.includes(MARK) || original.includes('dynamicSkillVeto')) continue;
	let next = original;
	for (const step of item.patch) {
		const anchor = adapt(next, step.anchor);
		const insert = adapt(next, step.insert);
		if (!next.includes(anchor)) {
			console.error('WIRING FAIL: ' + item.file + ' 找不到锚点（宿主版本可能不同）：' + JSON.stringify(step.anchor.slice(0, 60)));
			process.exit(2);
		}
		next = next.replace(anchor, anchor + insert);
	}
	writeTempForCheck(next);
	already = false;
	plan.push({ file: item.file, original, next });
}
function writeTempForCheck(text) {
	const temporary = path.join(targetRoot, '.djsc-wiring-check-' + process.pid + '.mjs');
	fs.writeFileSync(temporary, text);
	try { execFileSync(process.execPath, ['--check', temporary], { stdio: 'pipe' }); }
	finally { try { fs.rmSync(temporary, { force: true }); } catch (_) {} }
}

if (already) {
	console.log(JSON.stringify({ status: 'already-wired', root: targetRoot }));
	process.exit(0);
}
if (dryRun) {
	console.log(JSON.stringify({ status: 'planned', root: targetRoot, files: plan.map(item => item.file) }, null, 2));
	process.exit(0);
}

fs.mkdirSync(backupDir, { recursive: true });
const applied = [];
try {
	for (const item of plan) {
		const target = rel(item.file);
		fs.mkdirSync(path.join(backupDir, path.dirname(item.file)), { recursive: true });
		fs.writeFileSync(path.join(backupDir, ...item.file.split('/')), Buffer.from(item.original));
		atomicWrite(target, Buffer.from(item.next));
		syntaxCheck(target);
		applied.push(item.file);
	}
	console.log(JSON.stringify({ status: 'wired', root: targetRoot, files: applied, backup: path.relative(targetRoot, backupDir) }, null, 2));
} catch (error) {
	for (const item of plan) {
		const target = rel(item.file);
		if (applied.includes(item.file) || exists(target)) {
			const backupPath = path.join(backupDir, ...item.file.split('/'));
			if (exists(backupPath)) atomicWrite(target, read(backupPath));
		}
	}
	console.error('WIRING FAIL: ' + (error && error.message || error) + '（已恢复备份）');
	process.exit(1);
}
