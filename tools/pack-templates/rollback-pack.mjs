#!/usr/bin/env node
// 回滚本分包：只删除安装记录内的文件/注册表行；其他分包新增的内容保持不变。
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
	console.error('ROLLBACK FAIL: no install record for ' + pack.id);
	process.exit(1);
}
const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const rel = file => path.join(targetRoot, ...file.split('/'));
const failures = [];

for (const action of [...(record.actions || [])].reverse()) {
	const target = rel(action.target);
	if (!fs.existsSync(target)) continue;
	const current = sha(fs.readFileSync(target));
	if (action.type === 'create') {
		/* 共享核心可能被其他已安装分包复用；回滚只删除本分包文件，保留共享核心。 */
		if (action.kind === '共享核心') continue;
		if (current === action.hash || force) {
			fs.rmSync(target, { force: true });
		} else {
			failures.push(`保留已修改文件 ${action.target}（当前哈希与安装记录不同；--force 才会删除）`);
		}
	}
}
if (record.registry && record.registry.mode !== 'already') {
	const registryRel = 'score/decision/skills/skillAIPolicyPacks.js';
	const registryPath = rel(registryRel);
	if (fs.existsSync(registryPath)) {
		let text = fs.readFileSync(registryPath, 'utf8');
		const before = text;
		if (record.registry.mode === 'created' && sha(Buffer.from(text)) === record.registry.installedHash) {
			fs.rmSync(registryPath, { force: true });
		} else {
			text = text.split('\n').filter(line => line.trim() !== record.registry.importLine.trim() && line.trim() !== record.registry.entryLine.trim()).join('\n');
			if (text !== before) fs.writeFileSync(registryPath, text);
		}
	}
}
if (failures.length) {
	console.error('ROLLBACK PARTIAL:\n' + failures.join('\n'));
	process.exit(1);
}
try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch (e) {}
console.log(JSON.stringify({ status: 'rolled-back', pack: pack.id, files: (record.actions || []).length, registry: record.registry && record.registry.mode }, null, 2));
