#!/usr/bin/env node
/*
 * 把本轮验收产生的真实宿主报告与补丁校验结果归档进仓库证据目录。
 * 用法：node tools/lei-stage-evidence.mjs --from <报告目录> --to <仓库内证据目录>
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const FROM = path.resolve(option('from') || '');
const TO = path.resolve(option('to') || path.join(HERE, '..', 'docs', 'skill-ai-quality-20261103', 'lei-acceptance', 'evidence'));
if (!FROM) {
	console.error('usage: node tools/lei-stage-evidence.mjs --from <dir> [--to <dir>]');
	process.exit(2);
}
const MAP = {
	'A-unpatched-baseline.json': 'zhengu-A-unpatched-baseline.json',
	'B-unpatched-policy.json': 'zhengu-B-unpatched-policy.json',
	'C-patched-native.json': 'zhengu-C-patched-native.json',
	'D-patched-policy.json': 'zhengu-D-patched-policy.json',
	'lei-native-patch-verify.json': 'lei-native-patch-verify.json',
	'N-lei-history.json': 'lei-history-N-host-only.json',
	'P-lei-history.json': 'lei-history-P-extension.json',
	'C-lei-history.json': 'lei-history-C-native.json',
	'D-lei-history.json': 'lei-history-D-native-policy.json',
};
fs.mkdirSync(TO, { recursive: true });
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const copied = [];
for (const [from, to] of Object.entries(MAP)) {
	const source = path.join(FROM, from);
	if (!fs.existsSync(source)) { console.warn('skip (missing): ' + from); continue; }
	const bytes = fs.readFileSync(source);
	fs.writeFileSync(path.join(TO, to), bytes);
	copied.push({ file: to, size: bytes.length, sha256: sha(bytes) });
}
const compareDir = path.join(FROM, 'compare');
if (fs.existsSync(compareDir)) {
	const COMPARE_FILES = {
		'summary.json': 'zhengu-compare-summary.json',
		'matrix.md': 'zhengu-matrix.md',
		'lei-history-summary.json': 'lei-history-compare-summary.json',
		'lei-history-matrix.md': 'lei-history-matrix.md',
	};
	for (const [name, target] of Object.entries(COMPARE_FILES)) {
		const source = path.join(compareDir, name);
		if (!fs.existsSync(source)) continue;
		const bytes = fs.readFileSync(source);
		fs.writeFileSync(path.join(TO, target), bytes);
		copied.push({ file: target, size: bytes.length, sha256: sha(bytes) });
	}
}
console.log(JSON.stringify({ from: FROM, to: TO, copied }, null, 2));

/* 可选：同时把证据目录复制到交付目录 */
const DELIVERY = option('delivery');
if (DELIVERY) {
	const target = path.join(path.resolve(DELIVERY), 'evidence');
	fs.mkdirSync(target, { recursive: true });
	const delivered = [];
	for (const entry of fs.readdirSync(TO, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const bytes = fs.readFileSync(path.join(TO, entry.name));
		fs.writeFileSync(path.join(target, entry.name), bytes);
		delivered.push({ file: entry.name, size: bytes.length, sha256: sha(bytes) });
	}
	console.log(JSON.stringify({ delivery: path.resolve(DELIVERY), delivered }, null, 2));
}
