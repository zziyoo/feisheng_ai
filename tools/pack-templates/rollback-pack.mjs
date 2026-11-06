#!/usr/bin/env node
// 回滚本分包：只撤销安装记录内的内容；其他分包/开发者后续修改保持不变。
// 用法：node integration/rollback-pack.mjs --extension-root <无名AI根目录> [--force]
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const root = option('extension-root');
const force = args.includes('--force');
if (!root) {
	console.error('usage: node integration/rollback-pack.mjs --extension-root <dir> [--force]');
	process.exit(2);
}
const targetRoot = path.resolve(root);
const pack = JSON.parse(fs.readFileSync(path.join(BASE, 'pack.json'), 'utf8'));
const backupDir = path.join(targetRoot, '.djsc-pack-backups', pack.id);
const recordPath = path.join(backupDir, 'record.json');
if (!fs.existsSync(recordPath)) {
	if (!fs.existsSync(backupDir)) {
		console.log(JSON.stringify({ status: 'nothing-to-rollback', pack: pack.id }));
		process.exit(0);
	}
	console.error('ROLLBACK FAIL: incomplete transaction exists; rerun installation to recover: ' + pack.id);
	process.exit(1);
}
const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file);
const exists = file => fs.existsSync(file);
const rel = file => path.join(targetRoot, ...file.split('/'));
const atomicWrite = (target, content) => {
	const temporary = target + '.tmp-' + process.pid;
	try {
		fs.writeFileSync(temporary, content);
		fs.renameSync(temporary, target);
	} finally {
		try { if (exists(temporary)) fs.rmSync(temporary, { force: true }); } catch (error) {}
	}
};
const created = record.created || (record.actions || []).filter(action => action.type === 'create');
const registry = record.registry || null;
const conflicts = [];
const deletes = [];
let registryAction = null;
/* 回滚唯一分包时保留空注册表：facade 仍 import 该文件，删除会造成卸载后模块加载错误。 */
const EMPTY_REGISTRY = `// @djsc-pack-imports-begin\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\t// @djsc-pack-registry-end\n];\n`;

for (const action of [...created].reverse()) {
	if (action.kind === '共享核心') continue;
	const target = rel(action.target);
	if (!exists(target)) continue;
	const current = sha(read(target));
	if (current === action.hash || force) deletes.push({ target, targetRel: action.target, current });
	else conflicts.push(`保留已修改文件 ${action.target}（当前哈希与安装记录不同；--force 才会删除）`);
}

/* 旧版安装记录可能把分包文件补进“已预存本包行”的注册表；此时删除文件会留下悬空导入。
   这类记录无法在保持注册表原样的前提下安全回滚，必须人工先处理注册行，--force 也不放行。 */
let unsafeRegistryDelete = false;
if (registry && registry.mode === 'already') {
	const registryPath = rel('score/decision/skills/skillAIPolicyPacks.js');
	if (exists(registryPath) && created.some(action => action.kind !== '共享核心')) {
		const text = read(registryPath).toString('utf8');
		const hasOwnLines = text.split('\n').some(line => line.trim() === (registry.importLine || '').trim() || line.trim() === (registry.entryLine || '').trim());
		if (hasOwnLines) {
			conflicts.push('注册表仍保留本包导入/注册行，删除分包文件会造成悬空导入；请先人工移除这些行，或保留文件。');
			unsafeRegistryDelete = true;
		}
	}
}

if (registry && registry.mode !== 'already') {
	const registryRel = 'score/decision/skills/skillAIPolicyPacks.js';
	const registryPath = rel(registryRel);
	if (exists(registryPath)) {
		const currentBytes = read(registryPath);
		const currentHash = sha(currentBytes);
		const text = currentBytes.toString('utf8');
		const hasOwnLines = text.split('\n').some(line => line.trim() === registry.importLine.trim() || line.trim() === registry.entryLine.trim());
		if (registry.mode === 'created') {
			if (currentHash === registry.installedHash) registryAction = { type: 'empty-registry', target: registryPath, registryRel, content: Buffer.from(EMPTY_REGISTRY) };
			else if (hasOwnLines) registryAction = { type: 'strip-own-lines', target: registryPath, registryRel, text, importLine: registry.importLine, entryLine: registry.entryLine };
			else registryAction = { type: 'none', reason: '注册表已被其他安装重写，且不含本包行', registryRel };
		} else if (registry.mode === 'updated') {
			if (currentHash === registry.installedHash && typeof registry.before === 'string') {
				registryAction = { type: 'restore-before', target: registryPath, registryRel, content: Buffer.from(registry.before) };
			} else if (hasOwnLines) {
				registryAction = { type: 'strip-own-lines', target: registryPath, registryRel, text, importLine: registry.importLine, entryLine: registry.entryLine };
			} else {
				registryAction = { type: 'none', reason: '注册表已被其他安装重写，且不含本包行', registryRel };
			}
		}
	}
}

if (conflicts.length && (!force || unsafeRegistryDelete)) {
	console.error('ROLLBACK BLOCKED:\n' + conflicts.join('\n') + '\n未做任何修改；' + (unsafeRegistryDelete ? '此状态不能通过 --force 绕过。' : '确认后可加 --force。'));
	process.exit(1);
}

const performed = [];
try {
	if (registryAction) {
		if (registryAction.type === 'empty-registry') {
			atomicWrite(registryAction.target, registryAction.content);
			performed.push({ type: registryAction.type, target: registryAction.registryRel });
		} else if (registryAction.type === 'restore-before') {
			atomicWrite(registryAction.target, registryAction.content);
			performed.push({ type: registryAction.type, target: registryAction.registryRel });
		} else if (registryAction.type === 'strip-own-lines') {
			const next = registryAction.text.split('\n').filter(line => line.trim() !== registryAction.importLine.trim() && line.trim() !== registryAction.entryLine.trim()).join('\n');
			if (next !== registryAction.text) atomicWrite(registryAction.target, next);
			performed.push({ type: registryAction.type, target: registryAction.registryRel });
		} else {
			performed.push(registryAction);
		}
	}
	for (const item of deletes) {
		try {
			fs.rmSync(item.target, { force: true });
			performed.push({ type: 'delete', target: item.targetRel });
		} catch (error) {
			conflicts.push(`删除失败 ${item.targetRel}：${error.message}`);
		}
	}
	if (conflicts.length) {
		console.error('ROLLBACK PARTIAL:\n' + conflicts.join('\n') + '\n安装记录已保留：' + path.relative(targetRoot, backupDir));
		process.exit(1);
	}
	fs.rmSync(backupDir, { recursive: true, force: true });
	console.log(JSON.stringify({ status: 'rolled-back', pack: pack.id, files: deletes.map(item => item.targetRel), registry: registryAction && registryAction.type, performed }, null, 2));
} catch (error) {
	console.error('ROLLBACK ERROR: ' + (error && error.message || error) + '\n安装记录已保留：' + path.relative(targetRoot, backupDir));
	process.exit(1);
}
