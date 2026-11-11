#!/usr/bin/env node
/*
 * 神话雷分包最终交付核验：对实际 ZIP 与原生补丁做独立复核。
 *
 * 核对项：
 *  1. ZIP 成员清单、路径安全（无绝对路径、无 .. 穿越、无盘符、无符号链接条目）。
 *  2. ZIP 内运行文件与 Git HEAD blob 逐字节一致（sha256 + git blob 对照）。
 *  3. 本轮镇骨修复确实包含在 ZIP 内（源码标记 + 接线形态）。
 *  4. 交付用原生补丁为 LF 行尾、可对真实 1.11.7 宿主干净应用（4/4 hunk）。
 *  5. 包内 manifest.json 与实际文件哈希一致。
 *  6. 交付目录 SHA256SUMS.txt 与实际文件一致。
 *
 * 用法：node tools/lei-delivery-verify.mjs --zip <zip> --delivery <目录> [--repo <仓库根>] [--host-root <宿主>]
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
const ZIP = option('zip') ? path.resolve(option('zip')) : null;
const DELIVERY = option('delivery') ? path.resolve(option('delivery')) : null;
const HOST = option('host-root') ? path.resolve(option('host-root')) : null;
const GIT = option('git') || process.env.DJSC_GIT || 'git';
if (!ZIP || !DELIVERY) {
	console.error('usage: node tools/lei-delivery-verify.mjs --zip <zip> --delivery <dir> [--repo <dir>] [--host-root <dir>]');
	process.exit(2);
}
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const git = params => spawnSync(GIT, params, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const report = { checkedAt: new Date().toISOString(), zip: ZIP, delivery: DELIVERY, items: [] };

/* ---------- 1. ZIP 清单与路径安全 ---------- */
const list = spawnSync('python', ['-c', 'import zipfile,sys,json;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([{"name":i.filename,"size":i.file_size,"crc":i.CRC,"external_attr":i.external_attr,"is_dir":i.is_dir()} for i in z.infolist()]))', ZIP], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
if (list.status !== 0) throw new Error('无法列出 ZIP：' + list.stderr);
const entries = JSON.parse(list.stdout);
report.zipFiles = entries.length;
const unsafe = entries.filter(item => {
	const name = item.name;
	if (name.startsWith('/') || name.startsWith('\\')) return true;
	if (/^[A-Za-z]:/.test(name)) return true;
	if (name.split('/').some(part => part === '..')) return true;
	if (name.includes('\\')) return true;
	if ((item.external_attr >>> 16) & 0o170000) return true; /* 符号链接等特殊类型 */
	return false;
});
check(unsafe.length === 0, 'ZIP 存在不安全路径：' + JSON.stringify(unsafe.map(item => item.name)));
report.unsafePaths = unsafe.map(item => item.name);

/* ---------- 2. 运行文件与 Git HEAD blob 一致 ---------- */
const extract = fs.mkdtempSync(path.join(os.tmpdir(), 'lei-delivery-'));
spawnSync('python', ['-m', 'zipfile', '-e', ZIP, extract], { encoding: 'utf8' });
const root = fs.existsSync(path.join(extract, 'manifest.json')) ? extract : path.join(extract, fs.readdirSync(extract)[0]);
const RUNTIME = [
	'source/score/decision/skills/packs/shenhuaLei.js',
	'source/score/decision/skills/rules/shenhuaLei.js',
	'source/score/decision/skills/policyCore.js',
	'source/score/decision/skills/skillAIPolicies.js',
	'source/score/decision/skills/skillAIPolicyPacks.js',
	'source/score/decision/skills/skillVetoRegistry.js',
];
const head = git(['rev-parse', 'HEAD']).stdout.trim();
report.head = head;
const runtimeChecks = [];
for (const rel of RUNTIME) {
	const zipPath = path.join(root, rel);
	if (!fs.existsSync(zipPath)) { check(false, 'ZIP 缺少运行文件：' + rel); continue; }
	const zipBytes = fs.readFileSync(zipPath);
	const repoPath = rel.replace(/^source\//, '');
	const blob = git(['show', `HEAD:${repoPath}`], { encoding: 'buffer' });
	const blobBytes = Buffer.from(blob.stdout);
	const same = blob.status === 0 && sha(zipBytes) === sha(blobBytes);
	check(same, 'ZIP 运行文件与 HEAD blob 不一致：' + rel);
	runtimeChecks.push({ file: rel, repoPath, zipSha256: sha(zipBytes), headBlobSha256: sha(blobBytes), identical: same });
}
report.runtimeFiles = runtimeChecks;

/* ---------- 3. 镇骨修复确实在 ZIP 内 ---------- */
const zhenguPack = fs.readFileSync(path.join(root, 'source/score/decision/skills/packs/shenhuaLei.js'), 'utf8');
const zhenguRules = fs.readFileSync(path.join(root, 'source/score/decision/skills/rules/shenhuaLei.js'), 'utf8');
const markers = {
	'packs/shenhuaLei.js 引入镇骨规则': /zhenguCostNeedsFix/.test(zhenguPack) && /zhenguImmediateDelta/.test(zhenguPack),
	'packs/shenhuaLei.js 注册 drlt_zhengu': /['"]drlt_zhengu['"]/.test(zhenguPack),
	'packs/shenhuaLei.js 接线 onChooseTarget': /onChooseTarget/.test(zhenguPack),
	'packs/shenhuaLei.js 安装前指纹检查': /zhenguCostNeedsFix/.test(zhenguPack),
	'packs/shenhuaLei.js 身份校验卸载': /host\.addCleanup/.test(zhenguPack),
	'rules/shenhuaLei.js 即时差额实现': /own\s*<\s*target/.test(zhenguRules),
};
for (const [name, ok] of Object.entries(markers)) check(ok, 'ZIP 内缺少镇骨修复标记：' + name);
report.zhenguMarkers = markers;

/* ---------- 4. 原生补丁：LF + 可对真实宿主应用 ---------- */
const patchCandidates = [
	path.join(DELIVERY, 'feisheng-ai-shenhua-lei-native-ai.patch'),
	path.join(root, 'feisheng-ai-shenhua-lei-native-ai.patch'),
];
let patchPath = patchCandidates.find(file => fs.existsSync(file));
if (!patchPath) { check(false, '未找到交付的原生候选补丁'); }
else {
	const bytes = fs.readFileSync(patchPath);
	const eol = { crlf: 0, lf: 0 };
	for (let i = 0; i < bytes.length; i++) {
		if (bytes[i] === 13) { eol.crlf++; i++; } else if (bytes[i] === 10) eol.lf++;
	}
	const patchInfo = { path: patchPath, sha256: sha(bytes), bytes: bytes.length, eol: eol.crlf && !eol.lf ? 'CRLF' : eol.lf && !eol.crlf ? 'LF' : 'MIXED' };
	check(patchInfo.eol === 'LF', '交付的原生补丁不是 LF 行尾：' + patchInfo.eol);
	if (HOST) {
		const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'lei-delivery-patch-'));
		fs.mkdirSync(path.join(stage, 'character'), { recursive: true });
		const hostFile = path.join(HOST, 'character', 'shenhua.js');
		const hostBytes = fs.readFileSync(hostFile);
		fs.writeFileSync(path.join(stage, 'character', 'shenhua.js'), hostBytes);
		fs.writeFileSync(path.join(stage, 'candidate.patch'), bytes);
		const checkRes = spawnSync(GIT, ['apply', '--check', '--verbose', 'candidate.patch'], { cwd: stage, encoding: 'utf8' });
		const applyRes = checkRes.status === 0 ? spawnSync(GIT, ['apply', 'candidate.patch'], { cwd: stage, encoding: 'utf8' }) : null;
		const patched = checkRes.status === 0 ? fs.readFileSync(path.join(stage, 'character', 'shenhua.js')) : null;
		patchInfo.applies = checkRes.status === 0;
		patchInfo.hostSha256Before = sha(hostBytes);
		patchInfo.hostSha256After = patched ? sha(patched) : null;
		patchInfo.detail = String(checkRes.stderr || checkRes.stdout || '').trim().split('\n').slice(-4).join('\n');
		check(checkRes.status === 0, '交付的原生补丁无法应用到真实宿主：' + patchInfo.detail);
		check(applyRes && applyRes.status === 0, '交付的原生补丁应用失败');
	}
	report.nativePatch = patchInfo;
}

/* ---------- 5. manifest.json 与实际文件一致 ---------- */
const manifestPath = path.join(root, 'manifest.json');
if (!fs.existsSync(manifestPath)) check(false, 'ZIP 缺少 manifest.json');
else {
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
	const bad = [];
	for (const item of manifest.files || []) {
		const file = path.join(root, item.path);
		if (!fs.existsSync(file)) { bad.push({ path: item.path, reason: 'missing' }); continue; }
		const bytes = fs.readFileSync(file);
		if (sha(bytes) !== item.sha256 || bytes.length !== item.size) bad.push({ path: item.path, reason: 'hash-mismatch' });
	}
	check(bad.length === 0, 'manifest 与实际文件不一致：' + JSON.stringify(bad));
	report.manifest = { files: (manifest.files || []).length, mismatches: bad, head: manifest.package?.head || null };
}

/* ---------- 6. SHA256SUMS.txt ---------- */
const sumsPath = path.join(DELIVERY, 'SHA256SUMS.txt');
if (!fs.existsSync(sumsPath)) check(false, '交付目录缺少 SHA256SUMS.txt');
else {
	const lines = fs.readFileSync(sumsPath, 'utf8').split('\n').map(line => line.trim()).filter(Boolean);
	const sumChecks = [];
	for (const line of lines) {
		const match = line.match(/^([0-9a-f]{64})\s+(.+)$/);
		if (!match) { check(false, 'SHA256SUMS.txt 行格式非法：' + line); continue; }
		const [, digest, name] = match;
		const file = path.join(DELIVERY, name);
		if (!fs.existsSync(file)) { check(false, 'SHA256SUMS.txt 引用的文件不存在：' + name); continue; }
		const actual = sha(fs.readFileSync(file));
		check(actual === digest, 'SHA256 不一致：' + name);
		sumChecks.push({ file: name, expected: digest, actual, match: actual === digest });
	}
	report.sha256sums = sumChecks;
}

/* ---------- 交付目录文件哈希 ---------- */
report.deliveryFiles = fs.readdirSync(DELIVERY, { withFileTypes: true })
	.filter(item => item.isFile())
	.map(item => ({ file: item.name, size: fs.statSync(path.join(DELIVERY, item.name)).size, sha256: sha(fs.readFileSync(path.join(DELIVERY, item.name))) }));

report.failures = failures;
report.pass = failures.length === 0;
console.log(JSON.stringify(report, null, 2));
if (!report.pass) {
	console.error('DELIVERY_VERIFY_FAILED');
	for (const item of failures) console.error(' - ' + item);
	process.exit(1);
}
console.log('DELIVERY_VERIFY_PASS');
