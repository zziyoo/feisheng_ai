#!/usr/bin/env node
/*
 * 组装神话雷最终交付目录：ZIP + 原生补丁 + 校验清单 + 证据副本。
 * 用法：node tools/lei-assemble-delivery.mjs --zip <zip> --delivery <目录> [--evidence <证据目录>] [--native <补丁>]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const ZIP = option('zip') ? path.resolve(option('zip')) : null;
const DELIVERY = option('delivery') ? path.resolve(option('delivery')) : null;
const EVIDENCE = option('evidence') ? path.resolve(option('evidence')) : null;
const NATIVE = option('native') ? path.resolve(option('native')) : null;
if (!ZIP || !DELIVERY) {
	console.error('usage: node tools/lei-assemble-delivery.mjs --zip <zip> --delivery <dir> [--evidence <dir>] [--native <patch>]');
	process.exit(2);
}
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(DELIVERY, { recursive: true });

const delivered = [];
const copy = (source, targetName) => {
	const bytes = fs.readFileSync(source);
	fs.writeFileSync(path.join(DELIVERY, targetName), bytes);
	delivered.push({ file: targetName, size: bytes.length, sha256: sha(bytes) });
};

copy(ZIP, path.basename(ZIP));
if (NATIVE && fs.existsSync(NATIVE)) copy(NATIVE, 'feisheng-ai-shenhua-lei-native-ai.patch');

if (EVIDENCE && fs.existsSync(EVIDENCE)) {
	const target = path.join(DELIVERY, 'evidence');
	fs.mkdirSync(target, { recursive: true });
	for (const entry of fs.readdirSync(EVIDENCE, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const bytes = fs.readFileSync(path.join(EVIDENCE, entry.name));
		fs.writeFileSync(path.join(target, entry.name), bytes);
		delivered.push({ file: 'evidence/' + entry.name, size: bytes.length, sha256: sha(bytes) });
	}
}

/* SHA256SUMS.txt 只列顶层交付文件（证据目录内文件由 evidence 自身清单覆盖） */
const sums = delivered
	.filter(item => !item.file.includes('/'))
	.map(item => item.sha256 + '  ' + item.file)
	.join('\n') + '\n';
fs.writeFileSync(path.join(DELIVERY, 'SHA256SUMS.txt'), sums, 'utf8');

console.log(JSON.stringify({ delivery: DELIVERY, files: delivered, sha256sums: sums }, null, 2));
