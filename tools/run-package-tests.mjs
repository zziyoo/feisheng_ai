#!/usr/bin/env node
// 包内可执行测试入口：用包内 source/ 组装临时“仓库形状”，运行纯规则与契约测试。
// 依赖：Node.js >= 20（无需浏览器、无需完整仓库）。
// 其余 41 个 Node 回归入口与真实宿主场景需要完整仓库/宿主机，见 COMMANDS.md。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TESTS = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(TESTS);
const source = path.join(PKG, 'source');
const contract = path.join(source, 'contract');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'feisheng-audit-tests-'));
let failed = 0;

function copyTree(src, dst) {
	if (!fs.existsSync(src)) return;
	const stat = fs.statSync(src);
	if (stat.isFile()) {
		fs.mkdirSync(path.dirname(dst), { recursive: true });
		fs.copyFileSync(src, dst);
		return;
	}
	fs.mkdirSync(dst, { recursive: true });
	for (const name of fs.readdirSync(src)) copyTree(path.join(src, name), path.join(dst, name));
}
function copyFile(src, dst) {
	if (!fs.existsSync(src)) return;
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.copyFileSync(src, dst);
}

try {
	copyTree(path.join(source, 'score'), path.join(temp, 'score'));
	copyTree(path.join(contract, 'score', 'model', 'features'), path.join(temp, 'score', 'model', 'features'));
	copyTree(path.join(contract, 'score', 'model', 'net'), path.join(temp, 'score', 'model', 'net'));
	copyFile(path.join(contract, 'extension.js'), path.join(temp, 'extension.js'));
	copyFile(path.join(contract, 'info.json'), path.join(temp, 'info.json'));
	copyFile(path.join(PKG, 'docs', 'baseline.json'), path.join(temp, 'docs', 'skill-ai-20261030', 'baseline.json'));
	copyFile(path.join(TESTS, 'test-skill-ai-policies.mjs'), path.join(temp, 'tools', 'test-skill-ai-policies.mjs'));
	copyFile(path.join(TESTS, 'test-skill-ai-architecture.mjs'), path.join(temp, 'tools', 'test-skill-ai-architecture.mjs'));

	for (const test of ['test-skill-ai-policies.mjs', 'test-skill-ai-architecture.mjs']) {
		try {
			const out = execFileSync(process.execPath, ['--experimental-vm-modules', path.join('tools', test)], {
				cwd: temp, encoding: 'utf8', timeout: 120000,
			});
			const last = out.trim().split('\n').pop();
			console.log('PASS ' + test + ' :: ' + last);
		} catch (error) {
			failed++;
			console.log('FAIL ' + test);
			console.log((error.stdout || '') + (error.stderr || ''));
		}
	}
} finally {
	fs.rmSync(temp, { recursive: true, force: true });
}

if (failed) {
	console.log('FAILURES:', failed);
	process.exit(1);
}
console.log('ALL PASS (package-level: 2 suites; 41 repo/host suites require full repository)');
