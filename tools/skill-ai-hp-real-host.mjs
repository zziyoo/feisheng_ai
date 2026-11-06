#!/usr/bin/env node
// 每个场景独立页面加载真实无名杀宿主，避免前一场景的技能次数/死亡玩家污染后一场景。
// 只固定公开局面；不替换 Player/GameEvent/技能实现，不伪造AI摸牌。
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const hostMode = option('mode') || 'identity';
assert(['doudizhu', 'identity', 'guozhan', 'versus'].includes(hostMode), 'unsupported mode');
const seed = option('seed') || '20261030';
const variant = option('variant') || 'native';
assert(['native', 'policy', 'extension'].includes(variant), 'unsupported variant');
const only = option('scenario');
const listed = option('scenarios');
const watchdogMs = Math.max(30000, Number(option('watchdog-ms')) || 90000);
/* 宿主初始化与场景看门狗分开：初始化超时只影响页面启动，不掩盖场景卡死。 */
const initTimeoutMs = Math.max(30000, Number(option('init-timeout-ms')) || 90000);
const trace = args.includes('--trace');
/* 技能机制场景不测试胜负界面；默认抑制宿主 game.over 对话框，避免夹具提前进入结算 UI。 */
const allowGameOver = args.includes('--allow-game-over');
/* --no-diag 关闭 Worker 心跳/CDP CPU 采样；默认开启，便于超时归因。 */
const noDiag = args.includes('--no-diag');
/* 长套件可每 N 个场景重启浏览器，排除累积渲染进程/内存状态；0=不重启。 */
const restartEvery = Math.max(0, Number(option('browser-restart-every')) || 0);
let diagSink = null;
const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const hostRoot = path.resolve(option('host-root') || path.join(repoRoot, '../..'));
const extensionRoot = path.resolve(option('extension-root') || repoRoot);
const require = createRequire(import.meta.url);
const { chromium } = require(option('playwright') || 'playwright');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const apiRoutes = new Set(['/checkFile', '/checkDir', '/getFileList', '/readFile', '/readFileAsText']);

const server = http.createServer(async (req, res) => {
	try {
		const url = new URL(req.url, 'http://localhost');
		if (url.pathname === '/__diag/beat') {
			/* Worker 心跳不经过页面主线程：主线程同步卡死时仍能到达 Node 侧。 */
			const kind = url.searchParams.get('kind') === 'main' ? 'main-beat' : 'worker-beat';
			if (diagSink) diagSink.push({ type: kind, n: Number(url.searchParams.get('n')) || 0, at: Date.now() });
			res.writeHead(204, { 'Cache-Control': 'no-store' });
			res.end();
			return;
		}
		const api = apiRoutes.has(url.pathname);
		const relative = api ? url.searchParams.get('fileName') || url.searchParams.get('dir') || '' : decodeURIComponent(url.pathname).replace(/^\//, '');
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
		} else {
			data = await fs.readFile(filename);
			if (relative === 'game/config.json') {
				const config = JSON.parse(data.toString());
				config.mode = hostMode;
				config.extensions = [];
				config.extension_auto_import = false;
				if (!config.mode_config.doudizhu) config.mode_config.doudizhu = {};
				if (!config.mode_config.versus) config.mode_config.versus = {};
				if (config.mode_config.doudizhu) config.mode_config.doudizhu.doudizhu_mode = 'normal';
				if (config.mode_config.versus) { config.mode_config.versus.versus_mode = 'two'; config.mode_config.versus.two_assign = false; }
				data = Buffer.from(JSON.stringify(config));
			}
			res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
			res.setHeader('Cache-Control', 'no-store');
			res.end(data);
		}
	} catch { res.writeHead(404); res.end(); }
});

const SCENARIOS = {
	'kurou-4hp-2cards': { skills: ['kurou'], hp: 4, hand: [['wuxie', 'spade', 201], ['sha', 'heart', 202]] },
	'kurou-3hp-1card': { skills: ['kurou'], hp: 3, hand: [['wuxie', 'spade', 203]] },
	'kurou-3hp-2cards': { skills: ['kurou'], hp: 3, hand: [['wuxie', 'spade', 204], ['sha', 'heart', 205]] },
	'kurou-2hp-1card': { skills: ['kurou'], hp: 2, hand: [['wuxie', 'spade', 206]] },
	'kurou-3hp-1card-counter': { skills: ['kurou'], hp: 3, hand: [['wuxie', 'spade', 207]], target: { index: 1, hp: 4 }, counter: 1 },
	'rekurou-4hp-2cards': { skills: ['rekurou', 'zhaxiang'], hp: 4, hand: [['wuxie', 'spade', 208], ['sha', 'heart', 209]] },
	'rekurou-3hp-2cards': { skills: ['rekurou', 'zhaxiang'], hp: 3, hand: [['wuxie', 'spade', 210], ['sha', 'heart', 211]] },
	'rekurou-2hp-2cards': { skills: ['rekurou', 'zhaxiang'], hp: 2, hand: [['wuxie', 'spade', 212], ['sha', 'heart', 213]] },
	'rekurou-2hp-2cards-counter': { skills: ['rekurou', 'zhaxiang'], hp: 2, hand: [['wuxie', 'spade', 214], ['sha', 'heart', 215]], target: { index: 1, hp: 4 }, counter: 1 },
	'rekurou-redsha-directhit': { skills: ['rekurou', 'zhaxiang'], hp: 4, hand: [['sha', 'heart', 216], ['sha', 'diamond', 217], ['wuxie', 'spade', 218]], target: { index: 1, hp: 4, hand: [['shan', 'diamond', 219]], attack: false } },
	'qimou-far4-3sha-hp3': { skills: ['qimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 220], ['sha', 'heart', 221], ['sha', 'club', 222]], target: { index: 4, hp: 3 } },
	'qimou-far4-3sha-hp4': { skills: ['qimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 223], ['sha', 'heart', 224], ['sha', 'club', 225]], target: { index: 4, hp: 4 } },
	'qimou-far3-2sha-hp2': { skills: ['qimou', 'xinkuanggu'], hp: 3, hand: [['sha', 'spade', 226], ['sha', 'heart', 227]], target: { index: 3, hp: 2, hand: [['tao', 'heart', 228]] } },
	'reqimou-far4-2sha-hp3': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 229], ['sha', 'heart', 230]], target: { index: 4, hp: 3, hand: [['tao', 'heart', 231]] } },
	'reqimou-near1-armor2-3sha': { skills: ['reqimou'], hp: 4, hand: [['sha', 'spade', 241], ['sha', 'heart', 242], ['sha', 'club', 243]], fanSeats: [1, 4, 5], target: { index: 1, hp: 1, hujia: 2 } },
	'reqimou-near1-2sha-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 244], ['sha', 'heart', 245]], target: { index: 1, hp: 2 } },
	'reqimou-near2-2sha-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 246], ['sha', 'heart', 247]], target: { index: 2, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-zhangba': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 248], ['sha', 'heart', 249]], weapon: ['zhangba', 'spade', 250], target: { index: 4, hp: 2 } },
	'reqimou-far5-hp4-2sha-hp2-zhangba-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 251], ['sha', 'heart', 252]], weapon: ['zhangba', 'spade', 253], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 254]] } },
	'reqimou-far3-hp4-2sha-hp2-chitu': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 255], ['sha', 'heart', 256]], actorEquips: [['chitu', 'heart', 257]], target: { index: 4, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-noweapon': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 258], ['sha', 'heart', 259]], target: { index: 4, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-kongcheng': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 260], ['sha', 'heart', 261]], target: { index: 4, hp: 2, skills: ['kongcheng'] } },
	'reqimou-blocked-far4-hp3-3sha-tao-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 3, hand: [['sha', 'spade', 262], ['sha', 'heart', 263], ['sha', 'club', 264], ['tao', 'heart', 265]], target: { index: 4, hp: 2 } },
	'reqimou-blocked-far5-hp4-3sha-tao-hp2-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 266], ['sha', 'heart', 267], ['sha', 'club', 268], ['tao', 'heart', 269]], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 270]] } },
	/* ===== 2026-11-01 审查补修场景 ===== */
	/* P1：酒同样可濒死自救（canSaveCard 自救口径），原生付4 → 自救 → 击杀；策略档位上限同步放宽。 */
	'reqimou-far5-hp4-3sha-jiu-hp2-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 271], ['sha', 'heart', 272], ['sha', 'club', 273], ['jiu', 'spade', 274]], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 275]] } },
	/* P1 反向：桃位换成无懈（不可自救）；唯一敌人就是远距离目标（fanSeats=[4]），
	 * 原生 mindist=4<5 不发动；策略付4必死，同样不发动。 */
	'reqimou-far5-hp4-3sha-wuxie-hp2-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 276], ['sha', 'heart', 277], ['sha', 'club', 278], ['wuxie', 'spade', 279]], fanSeats: [4], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 280]] } },
	/* P1：有自救但小档位足够 → clamp 收紧原生“付满”：付3即可达距且兑现3血击杀（距离4）。 */
	'reqimou-far4-hp4-3sha-tao-hp3-clampsave': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 281], ['sha', 'heart', 282], ['sha', 'club', 283], ['tao', 'heart', 284]], target: { index: 4, hp: 3 } },
	/* P2：诸葛连弩（无限杀次数）+ 远处2血目标：支付只按距离需要，1+3次足够击杀。
	 * 不带狂骨：连弩无限出杀 × 狂骨黑判摸牌会形成超长出杀循环，偏离本场景意图。 */
	'reqimou-crossbow-far4-3sha-hp2': { skills: ['reqimou'], hp: 4, hand: [['sha', 'spade', 285], ['sha', 'heart', 286], ['sha', 'club', 287]], weapon: ['zhuge', 'spade', 288], target: { index: 4, hp: 2 } },
	/* P2 反向：连弩+贴脸2血目标：次数已无限、距离可达 → 策略 gate 必须跳过（不为其无意义支付）；
	 * 原生 gate 会放行并支付 hp-1（记录为已修正差异，见 REPAIR-REPORT）。 */
	'reqimou-crossbow-near1-2sha-hp2-idleskip': { skills: ['reqimou'], hp: 4, hand: [['sha', 'spade', 289], ['sha', 'heart', 290]], weapon: ['zhuge', 'spade', 291], target: { index: 1, hp: 2 } },
	/* P1-2 双目标：A(座位1)距离1血2（非免费，需2次出杀）、B(座位4)距离4血3、3杀
	 * → 付1兑现A；B在该档位不可及。第三反贼(座位6,8血)只用于避免“反贼全灭”触发 game.over。 */
	'reqimou-multi2-pay1-killa': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 292], ['sha', 'heart', 293], ['sha', 'club', 294]], fanSeats: [1, 4, 6], targets: [{ index: 1, hp: 2 }, { index: 4, hp: 3 }, { index: 6, hp: 8 }] },
	/* P1-2 三目标：A(d1,1血) B(d3,2血) C(d3,2血)、4杀 → 付2兑现 A+B 两杀。 */
	'reqimou-multi3-pay2-killab': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 295], ['sha', 'heart', 296], ['sha', 'club', 297], ['sha', 'diamond', 298]], fanSeats: [1, 3, 5], targets: [{ index: 1, hp: 1 }, { index: 3, hp: 2 }, { index: 5, hp: 2 }] },
	'reqimou-far4-2sha-hp4-defense': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 232], ['sha', 'heart', 233]], target: { index: 4, hp: 4, equip: ['bagua', 'spade', 234], hand: [['shan', 'diamond', 235], ['shan', 'club', 236], ['tao', 'heart', 237]] } },
	'qiangxix-2hp-target1-save': { skills: ['qiangxix'], hp: 2, target: { index: 1, hp: 1, hand: [['tao', 'heart', 238]] } },
	'qiangxix-2hp-target2': { skills: ['qiangxix'], hp: 2, target: { index: 1, hp: 2 } },
	'qiangxix-3hp-target3': { skills: ['qiangxix'], hp: 3, target: { index: 1, hp: 3 } },
	'qiangxix-2hp-weapon-target2': { skills: ['qiangxix'], hp: 2, weapon: ['zhangba', 'spade', 239], target: { index: 1, hp: 2 } },
	'qiangxix-1hp-weapon-target2': { skills: ['qiangxix'], hp: 1, weapon: ['zhangba', 'club', 240], target: { index: 1, hp: 2 } },
	'qiangxix-1hp-noweapon-target2': { skills: ['qiangxix'], hp: 1, target: { index: 1, hp: 2 } },
	'qiangxix-2hp-final-kill1': { skills: ['qiangxix'], hp: 2, target: { index: 1, hp: 1 } },
	'qiangxix-losehp-zhaxiang': { skills: ['qiangxix', 'zhaxiang'], hp: 3, target: { index: 1, hp: 2 } },
	'olqiangxi-2hp-target1-save': { skills: ['olqiangxi'], hp: 2, target: { index: 1, hp: 1, hand: [['tao', 'heart', 241]] } },
	'olqiangxi-2hp-target2': { skills: ['olqiangxi'], hp: 2, target: { index: 1, hp: 2 } },
	'olqiangxi-3hp-target3': { skills: ['olqiangxi'], hp: 3, target: { index: 1, hp: 3 } },
	'olqiangxi-2hp-weapon-target2': { skills: ['olqiangxi'], hp: 2, weapon: ['zhangba', 'heart', 242], target: { index: 1, hp: 2 } },
	'olqiangxi-1hp-weapon-target2': { skills: ['olqiangxi'], hp: 1, weapon: ['zhangba', 'diamond', 243], target: { index: 1, hp: 2 } },
	'olqiangxi-1hp-noweapon-target2': { skills: ['olqiangxi'], hp: 1, target: { index: 1, hp: 2 } },
	'olqiangxi-2hp-final-kill1': { skills: ['olqiangxi'], hp: 2, target: { index: 1, hp: 1 } },
	'olqiangxi-damage-yiji': { skills: ['olqiangxi', 'yiji'], hp: 3, target: { index: 1, hp: 2 } },
};

const scenarioNames = listed ? listed.split(',').map(item => item.trim()).filter(Boolean) : (only ? [only] : Object.keys(SCENARIOS));
for (const name of scenarioNames) assert(SCENARIOS[name], 'unknown scenario: ' + name);

function summarizeDiag(events, lastState, lastStateAt, finalState) {
	const marks = events.filter(item => item.type === 'mark');
	const beats = events.filter(item => item.type === 'worker-beat');
	let maxGap = 0;
	for (let i = 1; i < beats.length; i++) maxGap = Math.max(maxGap, beats[i].at - beats[i - 1].at);
	const cpu = events.filter(item => item.type === 'cpu');
	const byProcess = {};
	for (const sample of cpu) {
		for (const item of sample.processInfo || []) {
			const key = item.type + ':' + item.id;
			(byProcess[key] ||= []).push({ at: sample.at, cpuTime: item.cpuTime });
		}
	}
	const cpuDelta = {};
	for (const [key, list] of Object.entries(byProcess)) {
		if (list.length < 2) continue;
		const first = list[0], last = list[list.length - 1];
		cpuDelta[key] = { cpuSeconds: +(last.cpuTime - first.cpuTime).toFixed(3), spanMs: last.at - first.at };
	}
	const lastMark = marks[marks.length - 1] || null;
	const cpuAfterLastMark = (() => {
		if (!lastMark) return null;
		const samples = cpu.filter(item => item.at >= lastMark.at);
		if (samples.length < 2) return null;
		const byKey = {};
		for (const sample of samples) {
			for (const item of sample.processInfo || []) {
				const key = item.type + ':' + item.id;
				(byKey[key] ||= []).push({ at: sample.at, cpuTime: item.cpuTime });
			}
		}
		const result = {};
		for (const [key, list] of Object.entries(byKey)) {
			if (list.length < 2) continue;
			const first = list[0], last = list[list.length - 1];
			result[key] = { cpuSeconds: +(last.cpuTime - first.cpuTime).toFixed(3), spanMs: last.at - first.at };
		}
		return result;
	})();
	return {
		markCount: marks.length,
		firstMark: marks[0] || null,
		lastMark,
		markCounts: marks.reduce((result, item) => ({ ...result, [item.stage]: (result[item.stage] || 0) + 1 }), {}),
		beats: beats.length,
		firstBeatAt: beats[0]?.at || null,
		lastBeatAt: beats[beats.length - 1]?.at || null,
		maxBeatGapMs: maxGap,
		beatsAfterLastMark: lastMark ? beats.filter(item => item.at > lastMark.at).length : beats.length,
		lastState,
		lastStateAt,
		finalState,
		cpuSamples: cpu.length,
		cpuDelta,
		cpuAfterLastMark,
		cpuUnavailable: events.filter(item => item.type === 'cpu-unavailable').map(item => item.error),
	};
}

let browser;
try {
	await fs.access(path.join(hostRoot, 'noname.js'));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	const launchBrowser = () => chromium.launch({ headless: true, ...(option('browser') ? { executablePath: option('browser') } : {}) });
	browser = await launchBrowser();

	const results = [];
	for (let scenarioIndex = 0; scenarioIndex < scenarioNames.length; scenarioIndex++) {
		const name = scenarioNames[scenarioIndex];
		if (restartEvery && scenarioIndex > 0 && scenarioIndex % restartEvery === 0) {
			process.stderr.write('[hp] restart browser before: ' + name + '\n');
			await browser?.close().catch(() => {});
			browser = await launchBrowser();
		}
		process.stderr.write('[hp] scenario start: ' + name + '\n');
		const traceEvents = [];
		diagSink = traceEvents;
		let cpuSession = null;
		let cpuTimer = null;
		const context = await browser.newContext();
		await context.addInitScript(({ seedValue, traceEnabled }) => {
			let state = 0;
			const text = String(seedValue || '20261030');
			for (let i = 0; i < text.length; i++) state = (Math.imul(state, 31) + text.charCodeAt(i)) >>> 0;
			if (!state) state = 20261030;
			Math.random = function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
			try { localStorage.setItem('noname_0.9_directstart', 'true'); } catch (e) {}
			window.__hpDiag = { enabled: !!traceEnabled, marks: [], startedAt: Date.now(), perfStart: performance.now() };
			window.__hpMark = function (stage, data) {
				try {
					if (!window.__hpDiag.enabled) return;
					if (window.__hpDiag.marks.length >= 4000) return;
					const item = { type: 'mark', stage, at: Date.now(), perf: Math.round(performance.now()), data: data === undefined ? null : data };
					window.__hpDiag.marks.push(item);
					console.log('[hp-diag]' + JSON.stringify(item));
				} catch (e) {}
			};
			window.__hpMark('init-script');
		}, { seedValue: seed, traceEnabled: trace });
		await context.route('**/*', route => {
			const url = new URL(route.request().url());
			return ['http:', 'https:'].includes(url.protocol) && !(url.hostname === '127.0.0.1' && Number(url.port) === server.address().port) ? route.abort() : route.continue();
		});
		const page = await context.newPage();
		const pageErrors = [];
		page.on('pageerror', error => pageErrors.push(error.message));
		if (trace) {
			page.on('console', message => {
				const text = message.text();
				const index = text.indexOf('[hp-diag]');
				if (index >= 0) {
					try { traceEvents.push(JSON.parse(text.slice(index + 9))); } catch (e) { traceEvents.push({ type: 'mark-parse-error', text }); }
				} else if (message.type() === 'error') {
					traceEvents.push({ type: 'console-error', at: Date.now(), text });
				}
			});
			page.on('requestfailed', request => {
				traceEvents.push({ type: 'request-failed', at: Date.now(), url: request.url(), error: request.failure()?.errorText });
			});
			page.on('response', response => {
				if (response.status() >= 400) traceEvents.push({ type: 'http-error', at: Date.now(), status: response.status(), url: response.url() });
			});
		}
		if (!noDiag) {
			try {
				cpuSession = await browser.newBrowserCDPSession();
				cpuTimer = setInterval(() => {
					cpuSession.send('SystemInfo.getProcessInfo').then(result => {
						traceEvents.push({ type: 'cpu', at: Date.now(), processInfo: result.processInfo || [] });
					}).catch(error => {
						traceEvents.push({ type: 'cpu-sample-error', at: Date.now(), error: String(error) });
					});
				}, 1000);
				cpuTimer.unref?.();
			} catch (error) {
				traceEvents.push({ type: 'cpu-unavailable', error: String(error) });
			}
		}
		page.on('dialog', async dialog => {
			try { await (dialog.message().includes('GPLv3') ? dialog.accept() : dialog.dismiss()); } catch (e) {}
		});
		const diagState = { hostReadyAt: null, watchdogStartedAt: null, lastState: null, lastStateAt: null, lastEnemyDieAt: null };
		let readPageState = null;
		try {
			await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
			for (let attempt = 0; ; attempt++) {
				const initStarted = Date.now();
				process.stderr.write(`[hp][init] attempt ${attempt + 1} timeout=${initTimeoutMs}ms\n`);
				try {
					await page.waitForFunction(async () => !!(await import('/noname.js')).lib.config?.mode_config, {}, { timeout: initTimeoutMs });
					await page.evaluate(async () => {
						window.realHost = await import('/noname.js');
						const { game, lib, _status } = window.realHost;
						for (let i = 0; i < 400 && !lib.config; i++) await new Promise(r => setTimeout(r, 50));
						if (!lib.config) throw Error('host-config-not-ready');
						window.originalPhaseLoop ||= game.phaseLoop;
						game.phaseLoop = function (...args) { window.smokePhaseArgs = args; window.smokeReady = true; };
						lib.config.animation = false;
						lib.config.duration = 0;
						lib.config.game_speed = 'vvfast';
						_status.auto = true;
					});
					if (await page.getByText('跳过向导', { exact: true }).isVisible()) await page.getByText('跳过向导', { exact: true }).click();
					if (await page.getByText(/1\.11\.6更新内容/).isVisible()) await page.getByText('确定', { exact: true }).click();
					await page.evaluate(() => { if (realHost._status.paused) { realHost._status.auto = false; realHost.ui.click.auto(); } });
					await page.waitForFunction(() => window.smokeReady === true || document.body.innerText.includes('1.11.6更新内容'), {}, { timeout: initTimeoutMs });
					if (!await page.evaluate(() => window.smokeReady === true)) {
						await page.getByText('确定', { exact: true }).click();
						await page.waitForFunction(() => window.smokeReady === true, {}, { timeout: initTimeoutMs });
					}
					process.stderr.write(`[hp][init] ready after ${Date.now() - initStarted}ms\n`);
					break;
				} catch (error) {
					process.stderr.write(`[hp][init] attempt ${attempt + 1} failed after ${Date.now() - initStarted}ms: ${error && error.message || error}\n`);
					if (attempt >= 3) throw error;
					await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
					await page.waitForTimeout(800);
				}
			}
			const config = SCENARIOS[name];
			const hostReadyAt = Date.now();
			diagState.hostReadyAt = hostReadyAt;
			if (!noDiag) {
				await page.evaluate(() => window.__hpMark && window.__hpMark('host-ready')).catch(() => {});
				try {
					await page.evaluate(() => {
						/* blob: Worker 里的相对 URL 会解析成 blob: 路径；必须用绝对 origin。 */
						const base = location.origin;
						const source = `const base=${JSON.stringify(location.origin)};let n=0;function beat(){n++;fetch(base+'/__diag/beat?n='+n+'&t='+Date.now(),{cache:'no-store'}).catch(()=>{});}setInterval(beat,500);beat();`;
						window.__hpDiagWorker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
						window.__hpDiagWorker.onerror = event => window.__hpMark('diag-worker-error', { message: event.message, filename: event.filename });
						window.__hpMark('diag-worker-started', { origin: base });
					});
					await page.evaluate(async () => {
						try {
							const response = await fetch('/__diag/beat?n=0&kind=main', { cache: 'no-store' });
							window.__hpMark('diag-main-fetch', { status: response.status });
						} catch (error) {
							window.__hpMark('diag-main-fetch-error', String(error));
						}
					});
					await page.evaluate(() => {
						const read = () => {
							try {
								const status = (window.realHost && window.realHost._status) || window._status || {};
								const now = status.event || {};
								let ev = status.event;
								const path = [];
								for (let i = 0; ev && i < 10; i++) { path.push(ev.name + (ev.skill ? ':' + ev.skill : '')); ev = ev.parent || ev.getParent?.(); }
								const game = window.realHost && window.realHost.game;
								window.__hpMark('tick', {
									event: now.name, skill: now.skill, path,
									paused: status.paused, auto: status.auto,
									currentPhase: status.currentPhase && (status.currentPhase.name1 || status.currentPhase.name),
									aliveFans: game && game.players ? game.players.filter(item => !item.dead && item.identity === 'fan').length : null,
								});
							} catch (error) {
								window.__hpMark('tick-error', String(error));
							}
						};
						window.__hpDiagTicker = setInterval(read, 2000);
						read();
					});
				} catch (error) {
					traceEvents.push({ type: 'worker-start-failed', error: String(error) });
				}
			}
			readPageState = () => page.evaluate(() => {
				const status = (window.realHost && window.realHost._status) || window._status || {};
				let path = [];
				try {
					let ev = status.event;
					for (let i = 0; ev && i < 10; i++) { path.push(ev.name + (ev.skill ? ':' + ev.skill : '')); ev = ev.parent || ev.getParent?.(); }
				} catch (e) {}
				const ev = status.event || {};
				const game = window.realHost && window.realHost.game;
				return {
					event: ev.name, skill: ev.skill, player: ev.player && (ev.player.name1 || ev.player.name),
					hp: ev.player && ev.player.hp, paused: status.paused, auto: status.auto, path,
					currentPhase: status.currentPhase && (status.currentPhase.name1 || status.currentPhase.name),
					aliveFans: game && game.players ? game.players.filter(item => !item.dead && item.identity === 'fan').length : null,
				};
			});
			let watchdogTimer = null;
			const watchdog = new Promise((resolve, reject) => {
				const started = Date.now();
				diagState.watchdogStartedAt = started;
				traceEvents.push({ type: 'watchdog-start', at: started, hostReadyAt });
				watchdogTimer = setInterval(() => {
					readPageState().then(state => {
						diagState.lastState = state;
						diagState.lastStateAt = Date.now();
						process.stderr.write('[hp][watchdog] ' + JSON.stringify(state) + '\n');
						if (state.event === 'die' && state.aliveFans === 0) {
							if (!diagState.lastEnemyDieAt) diagState.lastEnemyDieAt = Date.now();
							else if (Date.now() - diagState.lastEnemyDieAt > 9000) {
								clearInterval(watchdogTimer);
								reject(new Error('fixture-stalled-in-die-after-last-enemy'));
							}
						} else {
							diagState.lastEnemyDieAt = null;
						}
					}).catch(error => { diagState.lastStateError = String(error); });
					if (Date.now() - started > watchdogMs) { clearInterval(watchdogTimer); reject(new Error('scenario-watchdog-timeout-' + watchdogMs + 'ms')); }
				}, 10000);
				watchdogTimer.unref?.();
			});
			let report;
			try {
				report = await Promise.race([
				page.evaluate(async ({ config, name, installExtension, policyOnly, traceEnabled, allowGameOver }) => {
				const mark = (stage, data) => { try { window.__hpMark && window.__hpMark(stage, data); } catch (e) {} };
				const runtimeVariant = installExtension ? 'extension' : (policyOnly ? 'policy' : 'native');
				mark('scenario-evaluate-start', { name, variant: runtimeVariant });
				let policyModule = null;
				if (policyOnly) {
					mark('policy-install-start');
					policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
					policyModule.installSkillAIPolicies();
					mark('policy-install-end');
				}
				if (installExtension) {
					mark('score-install-start');
					const score = await import('/extension/无名AI/score/index.js?v=41a');
					score.installScoreEngine();
					mark('score-install-end');
					policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
					mark('policy-import-end');
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				const { game, lib, get, _status } = realHost;
				mark('host-binding-ready', { mode: get.mode && get.mode() });
				let gameOverSuppressed = 0;
				if (!allowGameOver) {
					const originalGameOver = game.over;
					game.over = function (...values) {
						gameOverSuppressed++;
						mark('game.over:suppressed', { count: gameOverSuppressed, args: values.map(String) });
						return undefined;
					};
				}
				const card = (value, suit = 'spade', number = 1) => game.createCard(value, suit, number);
				const hand = player => player.getCards('h').map(item => item.name);
				const equips = player => player.getEquips().map(item => item.name);
				const playerTag = player => player.playerid + ':' + (player.name1 || player.name || '?');
				const all = game.players.slice();
				const actor = all[0];
				const seatOf = player => all.indexOf(player);
				const targetSpecs = config.targets && config.targets.length
					? config.targets
					: (config.target ? [config.target] : []);
				/* 反贼座位 = 显式 fanSeats ∪ 所有目标座位（旧夹具语义：目标必为敌人） */
				const fanSeats = new Set([...(config.fanSeats || [4, 5]), ...targetSpecs.map(spec => spec.index)].filter(index => index < all.length));
				const target = targetSpecs.length ? all[targetSpecs[0].index] : null;
				const targets = targetSpecs.map(spec => all[spec.index]);
				const resetAll = async () => {
					mark('reset:start');
					/* 主公+忠臣+至少两个远处反贼：击杀目标不会触发“反贼全灭”的 game.over。
					 * 2026-11-01 补修：fanSeats/targets 可配置，用于多目标 reqimou 场景。 */
					for (const player of all) {
						player.clearSkills(true);
						player.dead = false;
						const index = game.dead.indexOf(player);
						if (index >= 0) game.dead.splice(index, 1);
						const cards = player.getCards('hej');
						if (cards.length) await player.discard(cards);
						player.hp = player.maxHp = 4;
						for (const key of Object.keys(player.storage || {})) delete player.storage[key];
						player.stat = [{ card: {}, skill: {}, triggerSkill: {} }];
						player.awakenedSkills = [];
						if (player === actor) player.identity = 'zhu';
						else if (fanSeats.has(seatOf(player))) player.identity = 'fan';
						else player.identity = 'zhong';
						player.identityShown = true;
						try { player.setIdentity(player.identity); } catch (e) {}
						player.update();
					}
					game.zhu = actor;
					_status.currentPhase = actor;
					try {
						for (const key of ['cards', 'targets', 'buttons']) {
							const list = realHost.ui.selected[key];
							if (Array.isArray(list)) list.length = 0;
						}
					} catch (e) {}
					mark('reset:end');
				};
				const give = async (player, list) => {
					if (!list || !list.length) return;
					const cards = list.map(([value, suit, number]) => card(value, suit, number));
					await player.gain(cards, 'gain2');
				};
				const snapshot = player => ({
					id: player.playerid, name: playerTag(player),
					hp: player.hp, maxHp: player.maxHp, hujia: player.hujia,
					hand: hand(player), equips: equips(player),
					skills: player.getSkills().filter(skill => lib.skill[skill] && !lib.skill[skill].charlotte),
					dead: !!player.dead,
				});
				const describeArgs = values => values.map(value => {
					try {
						if (Array.isArray(value)) return value.map(item => {
							try { return item && (item.name || item.playerid || item); } catch (e) { return '?'; }
						});
						if (value && get.itemtype && get.itemtype(value) === 'player') return 'P:' + value.playerid;
						if (value && value.name) return value.name;
						return value;
					} catch (e) { return '?'; }
				});
				if (traceEnabled && typeof game.over === 'function' && !game.__hpOverWrapped) {
					const originalGameOver = game.over;
					game.over = function (...values) {
						mark('game.over:call', { args: describeArgs(values) });
						return originalGameOver.apply(this, values);
					};
					game.__hpOverWrapped = true;
				}
				const instrument = player => {
					const log = [];
					const backups = {};
					for (const method of ['useSkill', 'useCard', 'loseHp', 'damage', 'discard', 'draw', 'recover', 'gain', 'die']) {
						if (typeof player[method] !== 'function') continue;
						backups[method] = player[method];
						player[method] = function (...values) {
							try {
								if (log.length < 120) log.push({ op: method, args: describeArgs(values) });
								mark('op:' + method, { player: playerTag(player), seat: seatOf(player), hp: this && this.hp, args: describeArgs(values) });
							} catch (e) {}
							return backups[method].apply(this, values);
						};
					}
					return { log, restore() { for (const [method, fn] of Object.entries(backups)) player[method] = fn; } };
				};
				await resetAll();
				const actorProbe = instrument(actor);
				const targetProbe = target ? instrument(target) : null;
				const extraProbes = [];
				if (traceEnabled) {
					for (const player of targets) {
						if (!player || player === actor || player === target) continue;
						if (extraProbes.some(item => item.player === player)) continue;
						extraProbes.push({ player, probe: instrument(player) });
					}
				}
				/* reqimou 支付探针：content 先设置 storage.reqimou2 再 loseHp(支付值)。
				 * 只记录支付值；支付后可攻击目标集合由验证脚本按
				 * distance − paid ≤ attackRange（及 usableIgnoringDistance）确定性推导，
				 * 不在结算栈内做同步读局，避免探针与 mod/触发器链重入。 */
				const reqimouPayments = [];
				const originalActorLoseHp = actor.loseHp;
				actor.loseHp = function (...values) {
					try {
						if (this.storage && typeof this.storage.reqimou2 === 'number') {
							reqimouPayments.push({ paid: this.storage.reqimou2, hpBefore: this.hp });
							mark('reqimou:payment', { paid: this.storage.reqimou2, hpBefore: this.hp, args: describeArgs(values) });
						}
					} catch (e) {}
					return originalActorLoseHp.apply(this, values);
				};
				for (const skill of config.skills || []) actor.addSkill(skill);
				actor.hp = config.hp || 4;
				actor.maxHp = config.maxHp || 4;
				await give(actor, config.hand);
				if (config.weapon) await actor.equip(card(...config.weapon));
				for (const equip of config.actorEquips || []) await actor.equip(card(...equip));
				for (const [spec, targetPlayer] of targetSpecs.map((spec, i) => [spec, targets[i]])) {
					targetPlayer.hp = spec.hp || 4;
					targetPlayer.maxHp = spec.maxHp || 4;
					if (typeof spec.hujia === 'number') targetPlayer.hujia = spec.hujia;
					await give(targetPlayer, spec.hand);
					if (spec.equip) await targetPlayer.equip(card(...spec.equip));
					for (const equip of spec.equips || []) await targetPlayer.equip(card(...equip));
					for (const skill of spec.skills || []) targetPlayer.addSkill(skill);
					targetPlayer.update();
				}
				actor.update();
				mark('setup-done', {
					hand: hand(actor), hp: actor.hp, skills: config.skills,
					targets: targetSpecs.map(spec => ({ seat: spec.index, hp: (all[spec.index] || {}).hp, distance: targets[targetSpecs.indexOf(spec)] ? get.distance(actor, all[spec.index]) : null })),
				});
				if (typeof actor.chooseNumbers === 'function') {
					const originalChooseNumbers = actor.chooseNumbers;
					actor.chooseNumbers = function (...values) {
						mark('chooseNumbers:call', { args: describeArgs(values) });
						const next = originalChooseNumbers.apply(this, values);
						try {
							if (next && typeof next.forResult === 'function') {
								const originalForResult = next.forResult;
								next.forResult = async function (...forArgs) {
									const result = await originalForResult.apply(this, forArgs);
									mark('chooseNumbers:result', { numbers: result && result.numbers ? result.numbers : null });
									return result;
								};
							}
						} catch (error) { mark('chooseNumbers:wrap-error', String(error)); }
						return next;
					};
				}
				const before = {
					actor: snapshot(actor), target: target ? snapshot(target) : null,
					enemies: all.filter(p => p !== actor && fanSeats.has(seatOf(p))).map(p => ({
						seat: seatOf(p), ...snapshot(p),
						distance: get.distance(actor, p),
						currentlyInRange: !!actor.canUse('sha', p),
						canUseIgnoringDistance: !!actor.canUse('sha', p, false),
					})),
					distance: target ? get.distance(actor, target) : null,
					attackDistance: target ? get.distance(actor, target, 'attack') : null,
					attackRange: typeof actor.getAttackRange === 'function' ? (() => { try { return actor.getAttackRange(); } catch (e) { return null; } })() : null,
					attitude: target ? get.attitude(actor, target) : null,
					skillGate: Object.fromEntries((config.skills || []).map(skill => {
						let enabled = null, error = null;
						try {
							enabled = lib.filter.filterEnable({ type: 'phase', name: 'chooseToUse', player: actor, filterCard: () => true, filterTarget: () => false }, actor, skill);
						} catch (e) { error = String(e); }
						return [skill, { enabled, error }];
					})),
					orderProbe: Object.fromEntries((config.skills || []).map(skill => {
						let order = null, error = null;
						try { order = get.order(skill, actor); } catch (e) { error = String(e); }
						return [skill, { order, error, declared: lib.skill[skill] && lib.skill[skill].ai && lib.skill[skill].ai.order }];
					})),
					resultProbe: Object.fromEntries((config.skills || []).map(skill => {
						let playerResult = null, effectUse = null, error = null;
						try {
							const res = get.result(skill);
							playerResult = typeof res.player === 'function' ? res.player(actor) : res.player;
						} catch (e) { error = String(e); }
						try { effectUse = get.effect_use(undefined, skill, actor, actor); } catch (e) { effectUse = 'ERR:' + e; }
						return [skill, { playerResult, effectUse, error }];
					})),
				};
				const debug = { aiType: typeof ai, chooseCardCalls: [] };
				let restoreChooseCard = null;
				try {
					const { ai: aiInstance } = await import('/noname/ai/index.js');
					debug.aiType = 'imported';
					if (aiInstance && aiInstance.basic && typeof aiInstance.basic.chooseCard === 'function') {
						const originalChooseCard = aiInstance.basic.chooseCard;
						aiInstance.basic.chooseCard = function (...args) {
							const entry = { skills: null, uiSkills: null, before: null, after: null };
							try {
								const ev = _status.event;
								entry.skills = get.skills();
								entry.uiSkills = realHost.ui.skills && realHost.ui.skills.skills ? realHost.ui.skills.skills.slice(0) : null;
								entry.before = {
									eventName: ev && ev.name,
									eventSkill: ev && ev.skill,
									selectedCards: realHost.ui.selected.cards.map(c => c.name),
									selectedTargets: realHost.ui.selected.targets.map(p => p.playerid),
									qimouScore: typeof args[0] === 'function' ? args[0]('qimou') : null,
									shaScore: typeof args[0] === 'function' ? args[0](actor.getCards('h', 'sha')[0]) : null,
								};
							} catch (e) { entry.error = String(e); }
							const result = originalChooseCard.apply(this, args);
							try {
								const ev = _status.event;
								entry.after = {
									eventSkill: ev && ev.skill,
									selectedCards: realHost.ui.selected.cards.map(c => c.name),
									selectedTargets: realHost.ui.selected.targets.map(p => p.playerid),
									result,
								};
							} catch (e) { entry.afterError = String(e); }
							debug.chooseCardCalls.push(entry);
							return result;
						};
						restoreChooseCard = () => { aiInstance.basic.chooseCard = originalChooseCard; };
					}
				} catch (e) { debug.hookError = String(e); }
				const event = game.createEvent('hpScene', false);
				event.player = actor;
				event.setContent(async () => {
					mark('phaseUse:start');
					await actor.phaseUse();
					mark('phaseUse:end');
					if (config.counter && target && !target.dead) {
						mark('counter:start');
						await target.useCard(card('sha', 'spade', 900 + Number(config.counter)), actor);
						mark('counter:end');
					}
				});
				mark('game.loop:call');
				const loopPromise = game.loop(event);
				mark('game.loop:returned');
				await loopPromise;
				mark('game.loop:resolved');
				if (restoreChooseCard) restoreChooseCard();
				mark('scene:evaluate-finish');
				const after = {
					actor: snapshot(actor), target: target ? snapshot(target) : null,
					enemies: all.filter(p => p !== actor && fanSeats.has(seatOf(p))).map(p => ({ seat: seatOf(p), ...snapshot(p) })),
					dead: game.dead.map(playerTag),
					policyStats: policyModule ? policyModule.skillAIPolicyStats() : null,
				};
				actorProbe.restore();
				if (targetProbe) targetProbe.restore();
				for (const item of extraProbes) item.probe.restore();
				return {
					scenario: name,
					mode: get.mode(),
					before, after, debug,
					reqimouPayments,
					gameOverSuppressed,
					actorOps: actorProbe.log,
					targetOps: targetProbe ? targetProbe.log : [],
					extraOps: extraProbes.map(item => ({ seat: seatOf(item.player), id: item.player.playerid, ops: item.probe.log })),
					error: null,
				};
			}, { config, name, installExtension: variant === 'extension', policyOnly: variant === 'policy', traceEnabled: trace, allowGameOver }),
				watchdog,
			]);
			} finally {
				clearInterval(watchdogTimer);
			}
			process.stderr.write('[hp] scenario done: ' + name + '\n');
			report.pageErrors = pageErrors;
			if (trace) {
				report.diag = summarizeDiag(traceEvents, diagState.lastState, diagState.lastStateAt, null);
				report.trace = traceEvents;
			}
			results.push(report);
		} catch (error) {
			let finalState = null;
			if (!noDiag && readPageState) {
				const probe = readPageState();
				finalState = await Promise.race([
					probe.catch(stateError => ({ probeError: String(stateError) })),
					new Promise(resolve => { const timer = setTimeout(() => resolve({ probe: 'timeout-2000ms' }), 2000); timer.unref?.(); }),
				]);
				traceEvents.push({ type: 'timeout-probe', at: Date.now(), finalState });
				process.stderr.write('[hp][diag] timeout probe: ' + JSON.stringify(finalState) + '\n');
			}
			results.push({
				scenario: name,
				error: String(error && error.stack || error),
				pageErrors,
				...(noDiag ? {} : { diag: summarizeDiag(traceEvents, diagState.lastState, diagState.lastStateAt, finalState), diagState, ...(trace ? { trace: traceEvents } : {}) }),
			});
		} finally {
			await page.close().catch(() => {});
			await context.close().catch(() => {});
			clearInterval(cpuTimer);
			if (cpuSession) await cpuSession.detach().catch(() => {});
			diagSink = null;
		}
	}
	const output = {
		completedAt: new Date().toISOString(),
		status: results.every(result => !result.error) ? 'passed' : 'failed',
		scope: '每个场景独立页面加载真实无名杀宿主；固定公开局面，不伪造AI摸牌',
		seed, variant, mode: hostMode,
		scenarioCount: results.length,
		results,
	};
	if (option('output')) await fs.writeFile(option('output'), JSON.stringify(output, null, 2) + '\n');
	console.log(JSON.stringify(output, null, 2));
	assert.equal(output.status, 'passed');
} finally {
	await browser?.close().catch(() => {});
	await new Promise(resolve => server.close(resolve));
}
