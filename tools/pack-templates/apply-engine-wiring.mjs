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
				position: 'before',
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
				insertAfterLine: {
					core: `if (!decision?.rule) { _stat('pass'); return restore; }`,
					block: [
						`/* ${MARK}：注册表否决的技能不 stage，交回宿主自身流程。`,
						` * 最终决策对象 _finalResult 里技能 ID 位于 rule 字段（rule: best.id），`,
						` * 不存在 decision.id —— 用错字段会使本守卫成为死代码。 */`,
						`if (decision.type === 'skill' && decision.rule) {`,
						`    try {`,
						`        const dynV = dynamicSkillVeto(decision.rule, null, { me: { ref: player } });`,
						`        if (dynV && dynV.veto) {`,
						`            _stat('skillVeto');`,
						`            trace.skillVeto = dynV.reason || 'pack-veto';`,
						`            return restore;`,
						`        }`,
						`    } catch (_) {}`,
						`}`,
					],
				},
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
		const manifestPath = path.join(backupDir, 'wiring-manifest.json');
		if (!exists(manifestPath)) {
			console.log(JSON.stringify({ status: 'nothing-to-rollback', root: targetRoot }));
			process.exit(0);
		}
		const manifest = JSON.parse(read(manifestPath).toString('utf8'));
		const results = [];
		let conflicts = 0;
		for (const entry of manifest.files) {
			const target = rel(entry.file);
			if (!exists(target)) { results.push({ file: entry.file, action: 'missing-skipped' }); continue; }
			const currentSha = sha(read(target));
			if (currentSha === entry.beforeSha) { results.push({ file: entry.file, action: 'already-clean' }); continue; }
			/* 优先方案：仅移除本次接线插入的代码块（逆向逐条精确删除），
			 * 保留接线完成后其他开发者或其他分包对同一文件的修改。 */
			let next = read(target).toString('utf8');
			let removalOk = true;
			for (const inserted of [...entry.insertions].reverse()) {
				if (!next.includes(inserted)) { removalOk = false; break; }
				next = next.replace(inserted, '');
			}
			if (removalOk) {
				const remainingSha = sha(Buffer.from(next));
				if (remainingSha === entry.beforeSha) {
					atomicWrite(target, Buffer.from(next));
					results.push({ file: entry.file, action: 'block-removed-exact', externalChanges: false });
					continue;
				}
				try {
					const checkFile = target + '.rollback-check-' + process.pid + '.mjs';
					fs.writeFileSync(checkFile, next);
					try { execFileSync(process.execPath, ['--check', checkFile], { stdio: 'pipe' }); }
					finally { try { fs.rmSync(checkFile, { force: true }); } catch (_) {} }
					atomicWrite(target, Buffer.from(next));
					results.push({ file: entry.file, action: 'block-removed-preserving-external-edits', externalChanges: true });
					continue;
				} catch (syntaxError) {
					conflicts++;
					results.push({ file: entry.file, action: 'refused-block-removal-syntax', reason: String(syntaxError.message || syntaxError).slice(0, 160) });
					continue;
				}
			}
			/* 插入文本无法定位（接线块被外部改动）：仅当文件仍是安装后原样时才允许整文件还原。 */
			if (currentSha === entry.afterSha) {
				const backupPath = path.join(backupDir, ...entry.file.split('/'));
				if (exists(backupPath)) atomicWrite(target, read(backupPath));
				results.push({ file: entry.file, action: 'full-restored-no-external-changes' });
				continue;
			}
			conflicts++;
			results.push({
				file: entry.file,
				action: 'refused-overwrite-external-changes',
				reason: '目标文件在接线后被外部修改，且无法定位本次接线块；备份保留于 ' + path.join(path.relative(targetRoot, backupDir), ...entry.file.split('/')),
			});
		}
		if (conflicts) {
			console.error('WIRING ROLLBACK FAIL: ' + conflicts + ' 个文件存在冲突，未覆盖；备份与清单已保留');
			console.error(JSON.stringify({ status: 'rollback-conflicts', root: targetRoot, results }, null, 2));
			process.exit(1);
		}
		fs.rmSync(backupDir, { recursive: true, force: true });
		console.log(JSON.stringify({ status: 'rolled-back', root: targetRoot, results }, null, 2));
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
	const insertions = [];
	for (const step of item.patch) {
		if (step.insertAfterLine) {
			/* 缩进中立：按行定位核心语句，沿用宿主该行缩进插入整块。 */
			const eol = next.includes('\r\n') ? '\r\n' : '\n';
			const core = step.insertAfterLine.core;
			const at = next.indexOf(core);
			if (at < 0) {
				console.error('WIRING FAIL: ' + item.file + ' 找不到核心语句（宿主版本可能不同）：' + JSON.stringify(core.slice(0, 60)));
				process.exit(2);
			}
			const lineStart = next.lastIndexOf(eol, at) + 1;
			const lineEnd = next.indexOf(eol, at) + eol.length;
			const indent = (next.slice(lineStart, at).match(/[ \t]*$/) || [''])[0];
			const block = step.insertAfterLine.block.map(line => line === '' ? '' : indent + line).join(eol);
			const inserted = block + eol;
			next = next.slice(0, lineEnd) + inserted + next.slice(lineEnd);
			insertions.push(inserted);
			continue;
		}
		const anchor = adapt(next, step.anchor);
		const insert = adapt(next, step.insert);
		if (!next.includes(anchor)) {
			console.error('WIRING FAIL: ' + item.file + ' 找不到锚点（宿主版本可能不同）：' + JSON.stringify(step.anchor.slice(0, 60)));
			process.exit(2);
		}
		const combined = step.position === 'before' ? insert + anchor : anchor + insert;
		next = next.replace(anchor, combined);
		insertions.push(insert);
	}
	writeTempForCheck(next);
	already = false;
	plan.push({ file: item.file, original, next, insertions, beforeSha: sha(Buffer.from(original)), afterSha: sha(Buffer.from(next)) });
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
	/* 接线清单：记录前后哈希与逐条插入文本，供安全回滚使用。 */
	const manifest = {
		marker: MARK,
		applied_at: new Date().toISOString(),
		files: plan.map(item => ({
			file: item.file,
			beforeSha: item.beforeSha,
			afterSha: item.afterSha,
			insertions: item.insertions,
		})),
	};
	atomicWrite(path.join(backupDir, 'wiring-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
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
