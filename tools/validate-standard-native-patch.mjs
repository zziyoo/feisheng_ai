#!/usr/bin/env node
/*
 * 校验 refresh_standard 原生累计补丁的 Git blob 结构与 1.11.7 目标文件适用性。
 * 只读取 Git blob（LF），不读取可能被 Windows autocrlf 转成 CRLF 的工作树文件。
 * 用法：node tools/validate-standard-native-patch.mjs [--host-root <app>] [--output <json>]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = name => { const index = process.argv.indexOf('--' + name); return index < 0 ? null : process.argv[index + 1]; };
const PATCH_REL = 'docs/skill-ai-quality-20261103/refresh-standard/refresh-standard-native-candidate.patch';
const HOST = option('host-root') ? path.resolve(option('host-root')) : null;
const OUT = option('output') ? path.resolve(option('output')) : null;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const errors = [];
const fail = message => { errors.push(message); };

const blob = execFileSync('git', ['show', `HEAD:${PATCH_REL}`], { cwd: REPO, maxBuffer: 1024 * 1024 * 16 });
const text = blob.toString('utf8');
if (blob.includes(13)) fail('Git blob 含 CR；补丁应为 LF');
if (!text.startsWith('--- a/character/refresh.js\n')) fail('补丁首段不是 refresh.js 统一 Diff');

const lines = text.split('\n');
const sections = [];
let current = null;
let hunk = null;
const finishHunk = () => {
	if (!hunk) return;
	const oldCount = hunk.oldBody.filter(line => line === '' || line[0] === ' ' || line[0] === '-').length;
	const newCount = hunk.newBody.filter(line => line === '' || line[0] === ' ' || line[0] === '+').length;
	if (oldCount !== hunk.oldExpected) fail(`${current.file}:${hunk.header} 旧行数 ${oldCount} != ${hunk.oldExpected}`);
	if (newCount !== hunk.newExpected) fail(`${current.file}:${hunk.header} 新行数 ${newCount} != ${hunk.newExpected}`);
	hunk.oldBody = oldCount;
	hunk.newBody = newCount;
	current.hunks.push(hunk);
	hunk = null;
};
for (let index = 0; index < lines.length; index++) {
	const line = lines[index];
	if (line.startsWith('--- a/')) {
		finishHunk();
		const plus = lines[index + 1] || '';
		if (!plus.startsWith('+++ b/')) { fail('缺少 +++ 段：' + line); break; }
		current = { file: line.slice(6), hunks: [] };
		sections.push(current);
		index++;
		continue;
	}
	const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
	if (match) {
		finishHunk();
		hunk = {
			header: line,
			oldExpected: match[2] === undefined ? 1 : Number(match[2]),
			newExpected: match[4] === undefined ? 1 : Number(match[4]),
			oldBody: [],
			newBody: [],
		};
		continue;
	}
	if (hunk && line === '') {
		finishHunk();
		continue;
	}
	if (hunk && !line.startsWith('\\')) {
		if (!/^[ +\-]/.test(line)) { fail('hunk 内含非法行：' + line.slice(0, 80)); continue; }
		hunk.oldBody.push(line);
		hunk.newBody.push(line);
	}
}
finishHunk();

if (sections.length !== 2) fail('应有 2 个文件段，实际 ' + sections.length);
const refresh = sections.find(section => section.file === 'character/refresh.js');
const standard = sections.find(section => section.file === 'character/standard.js');
if (!refresh || refresh.hunks.length !== 21) fail('refresh.js hunk 数应为 21');
if (!standard || standard.hunks.length !== 3) fail('standard.js hunk 数应为 3');
if (!text.includes('+            return cards2.indexOf(card);')) fail('缺少倾国/急救索引返回修复');
if (!text.includes('+            return get.effect(ui.selected.targets[0], { name: "juedou" }, target, player);')) fail('缺少离间方向修复');

const result = {
	checkedAt: new Date().toISOString(),
	patch: PATCH_REL,
	bytes: blob.length,
	sha256: sha(blob),
	containsCR: blob.includes(13),
	sections: sections.map(section => ({ file: section.file, hunks: section.hunks.length })),
	totalHunks: sections.reduce((sum, section) => sum + section.hunks.length, 0),
	errors,
};

if (HOST) {
	const hostFiles = {
		'character/refresh.js': ['character/refresh.js', null],
		'character/standard.js': ['character/standard.js', null],
	};
	for (const [key, value] of Object.entries(hostFiles)) {
		const file = path.join(HOST, value[0]);
		const bytes = fs.readFileSync(file);
		value[1] = { bytes: bytes.length, cr: [...bytes].filter(byte => byte === 13).length, sha256: sha(bytes) };
	}
	result.hostFiles = Object.fromEntries(Object.entries(hostFiles).map(([key, value]) => [key, value[1]]));
	const temp = fs.mkdtempSync(path.join(REPO, '..', '.djsc-patch-check-'));
	try {
		for (const name of ['character/refresh.js', 'character/standard.js']) {
			fs.mkdirSync(path.join(temp, 'character'), { recursive: true });
			fs.copyFileSync(path.join(HOST, name), path.join(temp, name));
		}
		execFileSync('git', ['init', '-q'], { cwd: temp });
		execFileSync('git', ['-c', 'core.autocrlf=false', 'apply', '--check', '-'], { cwd: temp, input: blob, stdio: 'pipe' });
		result.applyCheck = 'passed';
	} catch (error) {
		result.applyCheck = 'failed';
		fail('git apply --check 失败：' + String((error.stderr || error.message) || error).slice(0, 500));
	} finally {
		fs.rmSync(temp, { recursive: true, force: true });
	}
}

if (OUT) fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exit(1);
