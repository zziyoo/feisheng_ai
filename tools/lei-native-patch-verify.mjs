#!/usr/bin/env node
/*
 * 原生候选补丁可应用性校验（真实宿主 1.11.7）。
 *
 * 目的：
 *  1. 证明 docs/skill-ai-quality-20261103/lei-native/lei-native-candidate.patch 能真正应用到
 *     真实宿主的 character/shenhua.js（而不是只在仓库内自洽）。
 *  2. 记录补丁字节的来源（git blob）与行尾，避免 Windows 检出把 LF 补丁转成 CRLF
 *     而导致 git apply 失败。
 *  3. 产出打完补丁的宿主文件副本，供真实宿主原生配置（配置 C/D）使用。
 *
 * 用法：
 *   node tools/lei-native-patch-verify.mjs --host-root <无名杀resources/app> --repo <仓库根> \
 *        [--patch <仓库内路径>] [--out <报告json>] [--emit-patched <输出文件>]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };

const REPO = path.resolve(option('repo') || path.join(HERE, '..'));
const HOST = path.resolve(option('host-root') || '');
const PATCH_PATH = option('patch') || 'docs/skill-ai-quality-20261103/lei-native/lei-native-candidate.patch';
const OUT = option('out') ? path.resolve(option('out')) : null;
const EMIT = option('emit-patched') ? path.resolve(option('emit-patched')) : null;
const GIT = option('git') || process.env.DJSC_GIT || 'git';

if (!HOST) {
	console.error('usage: node tools/lei-native-patch-verify.mjs --host-root <resources/app> [--repo <dir>] [--out <json>] [--emit-patched <file>]');
	process.exit(2);
}

const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const countEol = buffer => {
	let crlf = 0, lf = 0, cr = 0;
	for (let i = 0; i < buffer.length; i++) {
		if (buffer[i] === 13) {
			if (buffer[i + 1] === 10) { crlf++; i++; } else cr++;
		} else if (buffer[i] === 10) lf++;
	}
	return { crlf, lf_only: lf, cr_only: cr, eol: crlf && !lf ? 'CRLF' : lf && !crlf ? 'LF' : 'MIXED' };
};

const git = (params, opts = {}) => spawnSync(GIT, params, { cwd: opts.cwd || REPO, encoding: opts.encoding === undefined ? 'utf8' : opts.encoding, maxBuffer: 1024 * 1024 * 256 });

/* 补丁字节必须来自 git blob：Windows 检出可能把 LF 补丁转成 CRLF，导致 git apply 失配。 */
const blob = git(['cat-file', 'blob', `HEAD:${PATCH_PATH}`], { encoding: 'buffer' });
if (blob.status !== 0) throw new Error('无法读取补丁 blob：' + PATCH_PATH + '\n' + blob.stderr);
const patchBytes = Buffer.from(blob.stdout);
const patchEol = countEol(patchBytes);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'lei-native-verify-'));
fs.mkdirSync(path.join(work, 'character'), { recursive: true });
const target = path.join(work, 'character', 'shenhua.js');
const hostFile = path.join(HOST, 'character', 'shenhua.js');
const hostBytes = fs.readFileSync(hostFile);
fs.writeFileSync(target, hostBytes);
const patchFile = path.join(work, 'candidate.patch');
fs.writeFileSync(patchFile, patchBytes);

/* 工作树副本（Windows 检出后的字节）用于说明检出态行尾差异。 */
const worktreePatch = path.join(REPO, PATCH_PATH);
const worktreeBytes = fs.existsSync(worktreePatch) ? fs.readFileSync(worktreePatch) : null;

const check = git(['apply', '--check', '--verbose', patchFile], { cwd: work });
const applied = check.status === 0 ? git(['apply', '--verbose', patchFile], { cwd: work }) : null;
const patchedBytes = check.status === 0 ? fs.readFileSync(target) : null;

/* 逐 hunk 判定必须在未打补丁的副本上做，否则上下文已被改写而全部误报失败。 */
const pristineDir = path.join(work, 'pristine');
fs.mkdirSync(path.join(pristineDir, 'character'), { recursive: true });
fs.writeFileSync(path.join(pristineDir, 'character', 'shenhua.js'), hostBytes);

/* 逐 hunk 判定：把补丁拆成单 hunk 后分别检查，定位是哪一段失配。 */
const text = patchBytes.toString('utf8');
const header = text.split('\n').filter(line => line.startsWith('diff --git') || line.startsWith('@@')).join('\n');
const hunkMatches = [...text.matchAll(/^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@(.*)$/gm)].map(m => m[0]);
const hunkLines = [];
{
	const lines = text.split('\n');
	let current = null;
	for (const line of lines) {
		if (line.startsWith('@@')) {
			current = { header: line, lines: [] };
			hunkLines.push(current);
		} else if (current && (line.startsWith(' ') || line.startsWith('-') || line.startsWith('+'))) {
			current.lines.push(line);
		}
	}
}
const perHunk = hunkLines.map((hunk, index) => {
	const single = ['--- a/character/shenhua.js', '+++ b/character/shenhua.js', hunk.header, ...hunk.lines, ''].join('\n');
	const singleFile = path.join(work, `hunk-${index + 1}.patch`);
	fs.writeFileSync(singleFile, single);
	const result = git(['apply', '--check', '--verbose', singleFile], { cwd: pristineDir });
	return {
		index: index + 1,
		header: hunk.header,
		status: result.status === 0 ? 'applies' : 'fails',
		detail: String(result.stderr || result.stdout || '').trim().split('\n').slice(-6).join('\n'),
	};
});

/* 工作树检出字节（CRLF）的可应用性，用于复现 Windows 检出问题。 */
let worktreeApply = null;
if (worktreeBytes && !worktreeBytes.equals(patchBytes)) {
	const wtFile = path.join(work, 'worktree.patch');
	fs.writeFileSync(wtFile, worktreeBytes);
	const wtCheck = git(['apply', '--check', '--verbose', wtFile], { cwd: pristineDir });
	worktreeApply = {
		eol: countEol(worktreeBytes).eol,
		sha256: sha(worktreeBytes),
		applies: wtCheck.status === 0,
		detail: String(wtCheck.stderr || wtCheck.stdout || '').trim().split('\n').slice(-4).join('\n'),
	};
}

const report = {
	checkedAt: new Date().toISOString(),
	hostRoot: HOST,
	hostFile: 'character/shenhua.js',
	hostVersion: (() => {
		try {
			const update = fs.readFileSync(path.join(HOST, 'game', 'update.js'), 'utf8');
			const match = update.match(/version\s*:\s*"([^"]+)"/);
			return match ? match[1] : null;
		} catch (e) { return null; }
	})(),
	hostSha256Before: sha(hostBytes),
	patch: {
		repoPath: PATCH_PATH,
		source: 'git blob (HEAD)',
		sha256: sha(patchBytes),
		bytes: patchBytes.length,
		eol: patchEol.eol,
		eolDetail: patchEol,
	},
	worktreePatchBytes: worktreeBytes ? { sha256: sha(worktreeBytes), eol: countEol(worktreeBytes).eol, bytes: worktreeBytes.length } : null,
	worktreeApply,
	applies: check.status === 0,
	applyDetail: String((check.stderr || check.stdout || '')).trim().split('\n').slice(-8).join('\n'),
	hostSha256After: patchedBytes ? sha(patchedBytes) : null,
	hunks: perHunk,
	hunkCount: perHunk.length,
	appliedHunks: perHunk.filter(item => item.status === 'applies').length,
};
if (applied) report.applyOutput = String(applied.stdout || '').trim();

if (OUT) {
	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n', 'utf8');
}
if (EMIT && patchedBytes) {
	fs.mkdirSync(path.dirname(EMIT), { recursive: true });
	fs.writeFileSync(EMIT, patchedBytes);
	report.emittedPatchedFile = EMIT;
}
console.log(JSON.stringify(report, null, 2));
if (!report.applies) process.exit(1);
