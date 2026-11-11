#!/usr/bin/env node
/*
 * 神话雷历史技能专项真实宿主运行器。
 *
 * 配置：
 *   N  未打补丁的真实宿主，未安装扩展        （宿主旧行为基线）
 *   P  未打补丁的真实宿主 + 正式神话雷扩展     （扩展部署）
 *   C  应用原生候选补丁的真实宿主，未安装扩展  （原生部署）
 *   D  应用原生候选补丁的真实宿主 + 正式扩展    （隔离用：验证指纹跳过，不作为正常部署）
 *
 * 原生候选补丁以 git blob 字节（LF）在临时目录用 git apply 真实应用到宿主副本，
 * 不修改真实宿主文件；应用结果同时用于证明“原生补丁实际可应用”。
 *
 * 用法：
 *   node tools/lei-history-real-host.mjs --host-root <无名杀resources/app> \
 *        --browser <Chrome> --playwright <playwright-core> [--extension-root <扩展根>] \
 *        [--patch-lei-native] [--policy] --output <报告.json>
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const has = name => args.includes('--' + name);
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const hostRoot = path.resolve(option('host-root') || path.join(repoRoot, '../..'));
const extensionRoot = path.resolve(option('extension-root') || repoRoot);
const seed = option('seed') || '20261111';
const patchLeiNative = has('patch-lei-native');
const installPolicy = has('policy');
const require = createRequire(import.meta.url);
const { chromium } = require(option('playwright') || 'playwright');
const GIT = option('git') || process.env.DJSC_GIT || 'git';

const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const apiRoutes = new Set(['/checkFile', '/checkDir', '/getFileList', '/readFile', '/readFileAsText']);

const sha = data => {
	const { createHash } = require('node:crypto');
	return createHash('sha256').update(data).digest('hex');
};

/* ---- 原生候选补丁：取 git blob（LF）并在临时目录真实应用 ---- */
const PATCH_REPO_PATH = 'docs/skill-ai-quality-20261103/lei-native/lei-native-candidate.patch';
let nativePatchInfo = null;
let patchedShenhua = null;
if (patchLeiNative) {
	const blob = spawnSync(GIT, ['cat-file', 'blob', `HEAD:${PATCH_REPO_PATH}`], { cwd: repoRoot, maxBuffer: 1024 * 1024 * 64 });
	if (blob.status !== 0) throw new Error('无法读取原生候选补丁 blob：' + PATCH_REPO_PATH);
	const patchBytes = Buffer.from(blob.stdout);
	const stage = fsSync.mkdtempSync(path.join(os.tmpdir(), 'lei-native-stage-'));
	fsSync.mkdirSync(path.join(stage, 'character'), { recursive: true });
	const hostFile = path.join(hostRoot, 'character', 'shenhua.js');
	const hostBytes = fsSync.readFileSync(hostFile);
	fsSync.writeFileSync(path.join(stage, 'character', 'shenhua.js'), hostBytes);
	const patchFile = path.join(stage, 'candidate.patch');
	fsSync.writeFileSync(patchFile, patchBytes);
	const check = spawnSync(GIT, ['apply', '--check', '--verbose', patchFile], { cwd: stage, encoding: 'utf8' });
	if (check.status !== 0) throw new Error('原生候选补丁无法应用到真实宿主：\n' + (check.stderr || check.stdout));
	const applied = spawnSync(GIT, ['apply', patchFile], { cwd: stage, encoding: 'utf8' });
	if (applied.status !== 0) throw new Error('原生候选补丁应用失败：\n' + (applied.stderr || applied.stdout));
	patchedShenhua = fsSync.readFileSync(path.join(stage, 'character', 'shenhua.js'));
	nativePatchInfo = {
		repoPath: PATCH_REPO_PATH,
		patchSha256: sha(patchBytes),
		hostSha256Before: sha(hostBytes),
		hostSha256After: sha(patchedShenhua),
		applied: true,
	};
}

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://localhost');
		const api = apiRoutes.has(url.pathname);
		const relative = api ? (url.searchParams.get('fileName') || url.searchParams.get('dir') || '') : decodeURIComponent(url.pathname).replace(/^\//, '');
		const extensionPrefix = 'extension/无名AI/';
		const selectedRoot = relative.startsWith(extensionPrefix) ? extensionRoot : hostRoot;
		const selectedPath = relative.startsWith(extensionPrefix) ? relative.slice(extensionPrefix.length) : relative;
		const filename = path.resolve(selectedRoot, selectedPath);
		if (path.basename(filename) === 'noname.config.txt') {
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ success: true, data: null }));
			return;
		}
		if (filename !== selectedRoot && !filename.startsWith(selectedRoot + path.sep)) { res.writeHead(403); res.end(); return; }
		if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
		let data;
		if (api) {
			if (url.pathname === '/checkFile' || url.pathname === '/checkDir') {
				const stat = await fs.stat(filename).catch(() => null);
				data = stat ? (stat.isFile() ? 'file' : 'directory') : null;
			} else if (url.pathname === '/getFileList') {
				const entries = await fs.readdir(filename, { withFileTypes: true });
				data = { folders: entries.filter(e => e.isDirectory()).map(e => e.name), files: entries.filter(e => e.isFile()).map(e => e.name) };
			} else {
				const bytes = await fs.readFile(filename);
				data = url.pathname === '/readFileAsText' ? bytes.toString('utf8') : Array.from(bytes);
			}
			res.setHeader('Content-Type', 'application/json');
			res.end(JSON.stringify({ success: true, data }));
			return;
		}
		if (relative === 'character/shenhua.js' && patchedShenhua) {
			data = patchedShenhua;
		} else {
			data = await fs.readFile(filename);
		}
		if (relative === 'game/config.json') {
			const config = JSON.parse(data.toString());
			config.mode = 'identity';
			config.extensions = [];
			config.extension_auto_import = false;
			data = Buffer.from(JSON.stringify(config));
		}
		res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
		res.setHeader('Cache-Control', 'no-store');
		res.end(data);
	} catch (error) {
		res.writeHead(404);
		res.end(String((error && error.message) || error));
	}
});

let browser, debugPage;
try {
	await fs.access(path.join(hostRoot, 'noname.js'));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	browser = await chromium.launch({ headless: true, ...(option('browser') ? { executablePath: option('browser') } : {}) });
	const context = await browser.newContext();
	await context.addInitScript(seedValue => {
		let state = 0;
		const text = String(seedValue || '20261111');
		for (let i = 0; i < text.length; i++) state = (Math.imul(state, 31) + text.charCodeAt(i)) >>> 0;
		if (!state) state = 20261111;
		Math.random = function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
	}, seed);
	await context.route('**/*', route => {
		const url = new URL(route.request().url());
		return ['http:', 'https:'].includes(url.protocol) && !(url.hostname === '127.0.0.1' && Number(url.port) === server.address().port) ? route.abort() : route.continue();
	});
	const page = await context.newPage();
	debugPage = page;
	const errors = [];
	let startupComplete = false;
	page.on('pageerror', error => { errors.push(error.message); console.error('[host-error]', error.stack); });
	page.on('dialog', async dialog => {
		const license = dialog.message().includes('GPLv3');
		try {
			if (license) await dialog.accept();
			else { errors.push(dialog.message()); await dialog.dismiss(); }
		} catch (error) {
			if (!license || startupComplete) errors.push(error.message);
		}
	});
	await page.goto('http://127.0.0.1:' + server.address().port + '/index.html', { waitUntil: 'domcontentloaded' });
	for (let startupAttempt = 0; ; startupAttempt++) {
		try {
			await page.waitForFunction(async () => !!(await import('/noname.js')).lib.config?.mode_config, {}, { timeout: 30000 });
			await page.evaluate(async () => {
				window.realHost = await import('/noname.js');
				for (let i = 0; i < 400 && !window.realHost.lib.config; i++) await new Promise(r => setTimeout(r, 50));
				const { game, lib, _status } = window.realHost;
				if (!lib.config) throw Error('host-config-not-ready');
				window.originalPhaseLoop ||= game.phaseLoop;
				game.phaseLoop = function (...inner) { window.smokePhaseArgs = inner; window.smokeReady = true; };
				lib.config.animation = false;
				lib.config.duration = 0;
				lib.config.game_speed = 'vvfast';
				_status.auto = true;
			});
			if (await page.getByText('跳过向导', { exact: true }).isVisible()) await page.getByText('跳过向导', { exact: true }).click();
			if (await page.getByText(/1\.11\.6更新内容/).isVisible()) await page.getByText('确定', { exact: true }).click();
			await page.evaluate(() => { if (realHost._status.paused) { realHost._status.auto = false; realHost.ui.click.auto(); } });
			await page.waitForFunction(() => window.smokeReady === true || document.body.innerText.includes('1.11.6更新内容'), {}, { timeout: 30000 });
			if (!await page.evaluate(() => window.smokeReady === true)) {
				await page.getByText('确定', { exact: true }).click();
				await page.waitForFunction(() => window.smokeReady === true, {}, { timeout: 30000 });
			}
			break;
		} catch (error) {
			console.error('[startup]', JSON.stringify(await page.evaluate(() => ({
				auto: realHost?._status.auto,
				paused: realHost?._status.paused,
				event: realHost?._status.event?.name,
				player: realHost?._status.event?.player?.name,
				body: document.body.innerText.slice(-700),
			})).catch(() => null)));
			if (startupAttempt >= 3) throw error;
		}
	}
	startupComplete = true;
	await page.evaluate(() => { realHost._status.auto = true; });
	const { runLeiHistoryScenes } = await import('./lei-history-host-scenes.mjs');
	const sceneFilter = option('scenes') ? option('scenes').split(',').map(item => item.trim()).filter(Boolean) : null;
	const report = await runLeiHistoryScenes(page, { installPolicy, patchedHost: patchLeiNative, scenes: sceneFilter });
	/* 已知夹具噪声：测试服务器对 noname.config.txt 返回 null，宿主 BrowserAdapter 的
	 * stat 偶发把该次 fetch 失败报成 IO_ERROR 并弹出“加载内容失败”。与本包代码无关。 */
	const BENIGN = /noname\.config\.txt|加载内容失败/;
	const benignErrors = errors.filter(item => BENIGN.test(item));
	const realErrors = errors.filter(item => !BENIGN.test(item));
	const result = {
		completedAt: new Date().toISOString(),
		status: realErrors.length ? 'failed' : 'passed',
		scope: '真实无名杀1.11.7身份局宿主；固定公开手牌；真实技能 cost/ai.effect.target/get.effect 消费路径；非完整对局',
		config: { patchedHost: patchLeiNative, policyInstalled: installPolicy },
		nativePatch: nativePatchInfo,
		seed,
		browserVersion: await browser.version(),
		...report,
		errors: realErrors,
		benignErrors,
	};
	if (option('output')) await fs.writeFile(option('output'), JSON.stringify(result, null, 2) + '\n', 'utf8');
	console.log(JSON.stringify({ status: result.status, config: result.config, errors: result.errors, benignErrors: result.benignErrors, scenes: (result.scenes || []).map(s => s.name) }, null, 2));
	assert.deepEqual(realErrors, []);
	assert.equal(result.installState.hasSkill === true, true);
} catch (error) {
	if (debugPage) {
		await debugPage.screenshot({ path: path.join(repoRoot, 'tools', '.lei-history-failure.png') }).catch(() => {});
		console.error(await debugPage.evaluate(() => document.body.innerText.slice(0, 2000)).catch(() => ''));
	}
	throw error;
} finally {
	if (browser) await browser.close();
	await new Promise(resolve => server.close(resolve));
}
