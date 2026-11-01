#!/usr/bin/env node
// 2026-11-01 审查补修：reqimou 人类手动操作回归（真实 UI 点击路径）。
// 覆盖：手动发动、自主选择不同支付值、扩展不篡改人类选择、取消后重发动、
// 对话框内切换托管、托管结算 clamp、卸载/重装/对话框内卸载，结算值与输入一致性。
// 每个用例独立浏览器上下文加载真实无名杀宿主；只固定公开局面，不替换技能实现。
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const seed = option('seed') || '20261101';
const onlyCase = option('case');
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
				config.mode = 'identity';
				config.extensions = [];
				config.extension_auto_import = false;
				data = Buffer.from(JSON.stringify(config));
			}
			res.setHeader('Content-Type', mime[path.extname(filename)] || 'application/octet-stream');
			res.setHeader('Cache-Control', 'no-store');
			res.end(data);
		}
	} catch { res.writeHead(404); res.end(); }
});

/* ---------- 页面内夹具与操作（全部在真实宿主上执行） ---------- */
const pageSetup = async () => {
	const { game, lib, get, _status, ui } = realHost;
	const me = game.me;
	const all = game.players.slice();
	const seatOf = p => all.indexOf(p);
	const fanSeats = new Set([3, 4]);
	for (const p of all) {
		p.clearSkills(true);
		p.dead = false;
		const idx = game.dead.indexOf(p);
		if (idx >= 0) game.dead.splice(idx, 1);
		const cards = p.getCards('hej');
		if (cards.length) await p.discard(cards);
		p.hp = p.maxHp = 4;
		for (const key of Object.keys(p.storage || {})) delete p.storage[key];
		p.stat = [{ card: {}, skill: {}, triggerSkill: {} }];
		p.awakenedSkills = [];
		p.identity = p === me ? 'zhu' : (fanSeats.has(seatOf(p)) ? 'fan' : 'zhong');
		p.identityShown = true;
		try { p.setIdentity(p.identity); } catch (e) {}
		p.update();
	}
	game.zhu = me;
	_status.currentPhase = me;
	me.addSkill('reqimou');
	me.addSkill('xinkuanggu');
	me.hp = me.maxHp = 4;
	// 支付-收益对照夹具：座位3 反贼 距离3 体力3 → 付2 即可达距并兑现击杀（原生 processAI 会付 hp-1=3）
	const fan3 = all[3], fan4 = all[4];
	fan3.hp = fan3.maxHp = 3;
	fan4.hp = fan4.maxHp = 4;
	me.update();
	const shas = [game.createCard('sha', 'spade', 301), game.createCard('sha', 'heart', 302), game.createCard('sha', 'club', 303)];
	await me.gain(shas, 'gain2');
	// UI 元素打标，供真实浏览器点击定位
	window.manualProbe = { me, fan3, fan4, payments: [], settled: [], pageError: null };
	const originalLoseHp = me.loseHp;
	me.loseHp = function (...values) {
		try {
			if (this.storage && typeof this.storage.reqimou2 === 'number') window.manualProbe.payments.push({ paid: this.storage.reqimou2, hpBefore: this.hp });
		} catch (e) {}
		return originalLoseHp.apply(this, values);
	};
	// chooseNumbers 生命周期记录：定位数字对话框由谁关闭/结算
	const originalChooseNumbers = me.chooseNumbers;
	me.chooseNumbers = function (...args) {
		const next = originalChooseNumbers.apply(this, args);
		try {
			const log = window.manualProbe.chooseLog || (window.manualProbe.chooseLog = []);
			const entry = { forced: !!next.forced, isMine: null, resolvedBy: null, numbers: null, at: Date.now() % 100000 };
			next.isMine && (entry.isMine = !!next.isMine());
			const originalFor = next.forResult;
			next.forResult = async function (...forArgs) {
				const result = await originalFor.apply(this, forArgs);
				entry.resolvedBy = window.__step || 'unknown';
				entry.result = JSON.parse(JSON.stringify(result || {}));
				log.push(entry);
				return result;
			};
		} catch (e) {}
		return next;
	};
	const markSkills = () => {
		try {
			for (const node of (ui.skills && ui.skills.childNodes ? Array.from(ui.skills.childNodes) : [])) {
				if (node.link) { node.dataset.manualSkill = node.link; }
			}
		} catch (e) {}
	};
	const markConfirm = () => {
		try {
			for (const node of (ui.confirm && ui.confirm.childNodes ? Array.from(ui.confirm.childNodes) : [])) {
				node.dataset.manualConfirm = node.link;
			}
		} catch (e) {}
	};
	window.manualMark = () => {
		markSkills();
		markConfirm();
		try { if (ui.auto) ui.auto.dataset.manualControl = 'auto'; } catch (e) {}
		try {
			for (const node of document.querySelectorAll('.control')) {
				if ((node.innerText || '').includes('结束回合')) node.dataset.manualControl = 'endturn';
			}
		} catch (e) {}
	};
	window.manualStartPhaseUse = async () => {
		const event = game.createEvent('manualReqimou', false);
		event.player = me;
		event.setContent(async () => {
			await me.phaseUse();
		});
		game.loop(event).then(() => { window.manualProbe.done = true; }).catch(error => { window.manualProbe.error = String(error && error.stack || error); });
	};
	window.manualState = () => ({
		payments: window.manualProbe.payments,
		chooseLog: window.manualProbe.chooseLog || [],
		hp: me.hp, maxHp: me.maxHp,
		paidStorage: typeof me.storage.reqimou2 === 'number' ? me.storage.reqimou2 : null,
		handCount: me.countCards('h'),
		handNames: me.getCards('h').map(c => c.name),
		hasReqimou2: me.hasSkill('reqimou2'),
		fan3: { hp: fan3.hp, dead: !!fan3.dead },
		fan4: { hp: fan4.hp, dead: !!fan4.dead },
		auto: !!_status.auto,
		eventName: _status.event && _status.event.name,
		eventType: _status.event && _status.event.type,
		numbers: _status.event && Array.isArray(_status.event.numbers) ? _status.event.numbers.slice() : null,
		numbersList: _status.event && Array.isArray(_status.event.list) ? JSON.parse(JSON.stringify(_status.event.list)) : null,
		dialogOpen: !!(_status.event && _status.event.dialog),
		dialogSelects: (() => {
			try {
				const d = _status.event && _status.event.dialog;
				if (!d) return null;
				return Array.from(d.querySelectorAll('select')).map(s => ({ id: s.id, value: s.value, options: Array.from(s.options).map(o => o.value) }));
			} catch (e) { return String(e); }
		})(),
		step: window.__step || null,
		paused: !!_status.paused,
		done: !!window.manualProbe.done,
		error: window.manualProbe.error,
	});
	window.manualUninstall = async () => {
		const mod = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
		mod.uninstallSkillAIPolicies();
		return mod.skillAIPolicyStats();
	};
	window.manualReinstall = async () => {
		const mod = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
		mod.installSkillAIPolicies();
		return mod.skillAIPolicyStats();
	};
	window.manualSkillContentMarked = () => {
		try {
			const info = lib.skill.reqimou;
			return !!(info && info.content && info.content.__djscSkillPolicy === 'reqimou:content');
		} catch (e) { return false; }
	};
	window.manualNativeContent = () => String(lib.skill.reqimou.content);
	window.manualUiDump = () => {
		try {
			const ui = realHost.ui;
			const describe = el => ({ tag: el.tagName, id: el.id || null, cls: String(el.className).slice(0, 60), link: el.link === undefined ? null : el.link, text: (el.innerText || '').slice(0, 16) });
			return {
				uiKeys: Object.keys(ui).filter(k => ui[k] && ui[k].nodeType === 1),
				skills: ui.skills ? Array.from(ui.skills.childNodes).map(describe) : null,
				skillsList: ui.skills && ui.skills.skills ? ui.skills.skills : null,
				skills2: ui.skills2 ? Array.from(ui.skills2.childNodes).map(describe) : null,
				skills3: ui.skills3 ? Array.from(ui.skills3.childNodes).map(describe) : null,
				confirm: ui.confirm ? Array.from(ui.confirm.childNodes).map(describe) : null,
				controls: Array.from(document.querySelectorAll('.control')).map(describe),
				auto: ui.auto ? describe(ui.auto) : null,
			};
		} catch (e) { return { dumpError: String(e) }; }
	};
	return { me: me.playerid, seats: all.length, fan3Distance: get.distance(me, fan3), fan4Distance: get.distance(me, fan4) };
};

let browser;
try {
	await fs.access(path.join(hostRoot, 'noname.js'));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	browser = await chromium.launch({ headless: true, ...(option('browser') ? { executablePath: option('browser') } : {}) });

	const results = [];
	const runCase = async (name, driver) => {
		if (onlyCase && name !== onlyCase) return;
		process.stderr.write('[manual] case start: ' + name + '\n');
		const context = await browser.newContext();
		await context.addInitScript(seedValue => {
			let state = 0;
			const text = String(seedValue || '20261101');
			for (let i = 0; i < text.length; i++) state = (Math.imul(state, 31) + text.charCodeAt(i)) >>> 0;
			if (!state) state = 20261101;
			Math.random = function () { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
			try { localStorage.setItem('noname_0.9_directstart', 'true'); } catch (e) {}
		}, seed);
		await context.route('**/*', route => {
			const url = new URL(route.request().url());
			return ['http:', 'https:'].includes(url.protocol) && !(url.hostname === '127.0.0.1' && Number(url.port) === server.address().port) ? route.abort() : route.continue();
		});
		const page = await context.newPage();
		const pageErrors = [];
		page.on('pageerror', error => pageErrors.push(error.message));
		page.on('dialog', async dialog => {
			try { await (dialog.message().includes('GPLv3') ? dialog.accept() : dialog.dismiss()); } catch (e) {}
		});
		try {
			await page.goto(`http://127.0.0.1:${server.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
			for (let attempt = 0; ; attempt++) {
				try {
					await page.waitForFunction(async () => !!(await import('/noname.js')).lib.config?.mode_config, {}, { timeout: 30000 });
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
						// 引导期开启托管以自动通过菜单/初始化询问（与批一运行器同口径）
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
					// 引导结束：切回人类手动模式
					await page.evaluate(() => {
						const { _status } = window.realHost;
						if (_status.auto) window.realHost.ui.click.auto();
						_status.auto = false;
					});
					break;
				} catch (error) {
					if (attempt >= 3) throw error;
					await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
					await page.waitForTimeout(800);
				}
			}
			// 安装策略层（被测对象）并布置夹具
			const fixture = await page.evaluate(async () => {
				const mod = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
				mod.installSkillAIPolicies();
				window.policyModule = mod;
				return null;
			});
			const info = await page.evaluate(pageSetup);
		await page.evaluate(step => { window.__step = step; }, 'pre-driver');
		await driver({ page, info });
		await page.evaluate(step => { window.__step = step; }, 'driver-done');
		const uiDump = await page.evaluate(() => window.manualUiDump ? window.manualUiDump() : null).catch(() => null);
			const state = await page.evaluate(() => window.manualState());
			const stats = await page.evaluate(() => window.policyModule ? window.policyModule.skillAIPolicyStats() : null);
			const nativeContent = await page.evaluate(() => window.manualNativeContent());
			results.push({ case: name, fixture: info, state, stats, nativeContent, uiDump, pageErrors, error: null });
			process.stderr.write('[manual] case done: ' + name + '\n');
		} catch (error) {
			let failureState = null;
			try { failureState = { state: await page.evaluate(() => window.manualState ? window.manualState() : { setup: false }), ui: await page.evaluate(() => window.manualUiDump ? window.manualUiDump() : null) }; } catch (e) { failureState = { stateReadError: String(e) }; }
			results.push({ case: name, error: String(error && error.stack || error), pageErrors, failureState });
			process.stderr.write('[manual] case FAILED: ' + name + ' :: ' + String(error).split('\n')[0] + '\n');
			try { process.stderr.write('[manual][state] ' + JSON.stringify(failureState) + '\n'); } catch (e) {}
		} finally {
			await page.close().catch(() => {});
			await context.close().catch(() => {});
		}
	};

	const step = async (page, label) => { await page.evaluate(l => { window.__step = l; }, label); };
	const waitPausedChooseToUse = async page => {
		await step(page, 'wait-chooseToUse');
		await page.waitForFunction(() => {
			const ev = window.realHost._status.event;
			return window.realHost._status.paused && ev && ev.name === 'chooseToUse' && ev.type === 'phase' && window.realHost.ui.skills;
		}, {}, { timeout: 30000 });
	};
	const waitDialogNumbers = async page => {
		await step(page, 'wait-numbers-dialog');
		await page.waitForFunction(() => {
			const ev = window.realHost._status.event;
			return window.realHost._status.paused && ev && ev.name === 'chooseNumbers' && ev.dialog;
		}, {}, { timeout: 30000 });
	};
	/* 结算稳定态：reqimou 的 loseHp+摸牌已完成，回到下一次 chooseToUse 暂停（人类路径），
	 * 或整回合结束（托管路径）。此时状态只读，之后直接销毁页面收尾。 */
	const waitSettled = async page => {
		await step(page, 'wait-settled');
		await page.waitForFunction(() => {
			const probe = window.manualProbe;
			if (!probe) return false;
			if (probe.done || probe.error) return true;
			const { _status } = window.realHost;
			const ev = _status.event;
			return _status.paused && ev && ev.name === 'chooseToUse' && probe.payments.length >= 1
				&& typeof probe.me.storage.reqimou2 === 'number' && _status.currentPhase === probe.me;
		}, {}, { timeout: 30000 });
	};
	const clickSkill = async (page, skill) => {
		await step(page, 'click-skill-' + skill);
		await page.evaluate(() => window.manualMark());
		await page.locator(`[data-manual-skill="${skill}"]`).first().click();
	};
	/* 结束回合 = 放弃本次出牌（chooseToUse 窗口没有取消按钮，宿主真实控件即“结束回合”） */
	const clickEndTurn = async page => {
		await step(page, 'click-end-turn');
		await page.evaluate(() => window.manualMark());
		await page.locator('[data-manual-control="endturn"]').first().click();
	};
	const pickNumber = async (page, value) => {
		await waitDialogNumbers(page);
		await step(page, 'pick-number-' + value);
		await page.evaluate(() => window.manualMark());
		// chooseNumbers 的 确定 按钮只在 change 事件后出现；初始值=1，先偏离再选回。
		// select 元素由宿主动态生成，用 event.dialog 现场定位，保证点在真实控件上。
		const markSelect = await page.evaluate(() => {
			const d = window.realHost._status.event.dialog;
			const selects = Array.from(d.querySelectorAll('select'));
			if (selects.length !== 1) throw Error('unexpected select count: ' + selects.length);
			selects[0].dataset.manualSelect = 'numbers';
			return { id: selects[0].id, value: selects[0].value, options: Array.from(selects[0].options).map(o => o.value) };
		});
		const sel = '[data-manual-select="numbers"]';
		if (Number(value) === 1) {
			await page.selectOption(sel, '2');
			await page.selectOption(sel, '1');
		} else {
			await page.selectOption(sel, String(value));
		}
		await step(page, 'pick-number-confirm-' + value);
		await page.locator('[data-manual-confirm="ok"]').first().click();
	};

	/* 调试用例：只打开选择窗口转储控件（--case probe-ui） */
	await runCase('probe-ui', async ({ page }) => {
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
	});

	/* 用例 1/2：人类手动发动（技能按钮点击即发动，无需确认）并自主选择不同支付值；
	 * 扩展不得篡改人类选择——3 高于 AI 最优档 2，结算必须仍是 3 */
	for (const pay of [2, 3]) {
		await runCase('human-pick' + pay, async ({ page }) => {
			await page.evaluate(() => window.manualStartPhaseUse());
			await waitPausedChooseToUse(page);
			await clickSkill(page, 'reqimou');
			await pickNumber(page, pay);
			await waitSettled(page);
		});
	}

	/* 用例 3：结束回合放弃本次出牌 → 重新进入出牌阶段再发动（放弃+重发动路径） */
	await runCase('human-cancel-refire', async ({ page }) => {
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
		await clickEndTurn(page);
		await page.waitForFunction(() => window.manualProbe.done || window.manualProbe.error, {}, { timeout: 30000 });
		await page.evaluate(() => { window.manualProbe.done = false; });
		// 重新进入出牌阶段发动
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
		await clickSkill(page, 'reqimou');
		await pickNumber(page, 1);
		await waitSettled(page);
	});

	/* 用例 4：数字对话框打开时切换托管 → 原生 processAI 结算（人类打开的窗口不被策略接管） */
	await runCase('human-dialog-autotoggle', async ({ page }) => {
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
		await clickSkill(page, 'reqimou');
		await waitDialogNumbers(page);
		await page.evaluate(() => window.manualMark());
		await page.locator('[data-manual-control="auto"]').first().click();
		await page.waitForFunction(() => window.manualProbe.done || window.manualProbe.error, {}, { timeout: 60000 });
	});

	/* 用例 5：托管模式整回合 → 策略 clamp 生效（付3→2） */
	await runCase('auto-clamp', async ({ page }) => {
		await page.evaluate(() => window.manualMark());
		await page.locator('[data-manual-control="auto"]').first().click();
		await page.waitForFunction(() => !!window.realHost._status.auto, {}, { timeout: 10000 });
		await page.evaluate(() => window.manualStartPhaseUse());
		await page.waitForFunction(() => window.manualProbe.done || window.manualProbe.error, {}, { timeout: 60000 });
		// 濒死/死亡触发器可能在事件完成后由全局触发器收尾，稍候再读终态
		await page.waitForTimeout(800);
	});

	/* 用例 6：对话框内卸载 → 结算仍与输入一致，无崩溃 */
	await runCase('uninstall-mid-dialog', async ({ page }) => {
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
		await clickSkill(page, 'reqimou');
		await waitDialogNumbers(page);
		await page.evaluate(() => window.manualUninstall());
		await pickNumber(page, 3);
		await waitSettled(page);
	});

	/* 用例 7：卸载 → 重装生命周期（字节级还原 + 重新挂载）。
	 * 引导期已安装策略，native 基线以“卸载后采样”为准，并用二次卸载验证字节级一致。 */
	await runCase('uninstall-reinstall-lifecycle', async ({ page }) => {
		const markedInstalled = await page.evaluate(() => window.manualSkillContentMarked());
		const nativeA = await page.evaluate(async () => { await window.manualUninstall(); return window.manualNativeContent(); });
		const markedUninstalled = await page.evaluate(() => window.manualSkillContentMarked());
		await page.evaluate(async () => { await window.manualReinstall(); });
		const markedReinstalled = await page.evaluate(() => window.manualSkillContentMarked());
		const nativeB = await page.evaluate(async () => { await window.manualUninstall(); return window.manualNativeContent(); });
		await page.evaluate(async () => { await window.manualReinstall(); });
		const markedFinal = await page.evaluate(() => window.manualSkillContentMarked());
		// 字节级一致 + 标记态正确
		assert.equal(markedInstalled, true, '引导期策略已挂载');
		assert.equal(markedUninstalled, false);
		assert.equal(nativeA, nativeB, '两次卸载后的 content 必须字节级一致（可还原）');
		assert.equal(markedReinstalled, true, '重装后策略已重新挂载');
		assert.equal(markedFinal, true, '再次重装后策略仍在');
		// 重装后再走一遍人类路径确认无回归
		await page.evaluate(() => window.manualStartPhaseUse());
		await waitPausedChooseToUse(page);
		await clickSkill(page, 'reqimou');
		await pickNumber(page, 3);
		await waitSettled(page);
	});

	/* ---------- 结果断言 ---------- */
	const output = { completedAt: new Date().toISOString(), seed, scope: 'reqimou 人类手动 UI 回归（真实点击路径）', results };
	if (onlyCase) {
		// 调试模式：单用例只收集现场，不做断言
		console.log(JSON.stringify(output, null, 2));
		if (option('output')) await fs.writeFile(option('output'), JSON.stringify(output, null, 2) + '\n');
		process.exit(results[0] && results[0].error ? 1 : 0);
	}
	const byCase = Object.fromEntries(results.map(r => [r.case, r]));
	let checks = 0;
	const verify = (name, fn) => { fn(); checks++; console.log('PASS', name); };
	const stateOf = name => {
		const r = byCase[name];
		assert(r, 'missing case: ' + name);
		assert(!r.error, 'case error [' + name + ']: ' + r.error);
		assert.equal(r.fixture.fan3Distance, 3, '夹具：反贼3距离必须为3');
		return r;
	};
	verify('手动发动+选2：结算值=2 且扩展未篡改', () => {
		const r = stateOf('human-pick2');
		assert.deepEqual(r.state.payments, [{ paid: 2, hpBefore: 4 }]);
		assert.equal(r.state.paidStorage, 2);
		assert.equal(r.state.hp, 2, 'loseHp(2) 后剩2');
		assert.equal(r.state.handCount, 5, '未出杀：3杀 + 摸2 = 5');
		assert.equal(r.state.hasReqimou2, true);
		assert.equal(r.stats.reqimouClamp, 0, '人类路径不得 clamp');
		assert.equal(r.stats.reqimouClampCalls, 0, '人类路径不得安装 clamp');
		assert.equal(r.pageErrors.length, 0);
	});
	verify('手动发动+选3：高于AI最优档的选择也不被篡改（结算=3）', () => {
		const r = stateOf('human-pick3');
		assert.deepEqual(r.state.payments, [{ paid: 3, hpBefore: 4 }]);
		assert.equal(r.state.paidStorage, 3);
		assert.equal(r.state.hp, 1, 'loseHp(3) 后剩1');
		assert.equal(r.state.handCount, 6, '未出杀：3杀 + 摸3 = 6');
		assert.equal(r.stats.reqimouClamp, 0);
		assert.equal(r.stats.reqimouClampCalls, 0);
		assert.equal(r.pageErrors.length, 0);
	});
	verify('取消后重发动：结算值=1', () => {
		const r = stateOf('human-cancel-refire');
		assert.deepEqual(r.state.payments, [{ paid: 1, hpBefore: 4 }]);
		assert.equal(r.state.paidStorage, 1);
		assert.equal(r.state.handCount, 4, '未出杀：3杀 + 摸1 = 4');
		assert.equal(r.stats.reqimouClamp, 0);
		assert.equal(r.pageErrors.length, 0);
	});
	verify('对话框内切托管：原生 processAI 结算（hp-1=3），策略不接管人类窗口', () => {
		const r = stateOf('human-dialog-autotoggle');
		assert.deepEqual(r.state.payments, [{ paid: 3, hpBefore: 4 }]);
		assert.equal(r.state.auto, true);
		assert.equal(r.stats.reqimouClamp, 0);
		assert.equal(r.stats.reqimouClampCalls, 0);
		assert.equal(r.pageErrors.length, 0);
	});
	verify('托管整回合：策略 clamp 3→2 且对距离3的3血反贼兑现致命', () => {
		const r = stateOf('auto-clamp');
		assert.deepEqual(r.state.payments, [{ paid: 2, hpBefore: 4 }]);
		assert.equal(r.stats.reqimouClamp, 1, '托管路径必须 clamp 一次');
		assert.equal(r.stats.reqimouClampCalls, 1);
		assert(r.state.fan3.hp <= 0 || r.state.fan3.dead, '付2后距离1，3杀对3血目标达成致命（hp=' + r.state.fan3.hp + ' dead=' + r.state.fan3.dead + '）');
		assert.equal(r.pageErrors.length, 0);
	});
	verify('对话框内卸载：结算与输入一致，无崩溃', () => {
		const r = stateOf('uninstall-mid-dialog');
		assert.deepEqual(r.state.payments, [{ paid: 3, hpBefore: 4 }]);
		assert.equal(r.state.paidStorage, 3);
		assert.equal(r.state.handCount, 6, '未出杀：3杀 + 摸3 = 6');
		assert.equal(r.pageErrors.length, 0);
	});
	verify('卸载/重装：content 字节级还原并可重新挂载', () => {
		const r = stateOf('uninstall-reinstall-lifecycle');
		assert.deepEqual(r.state.payments, [{ paid: 3, hpBefore: 4 }], '重装后人类路径仍原样结算');
		assert.equal(r.state.handCount, 6);
		assert.equal(r.pageErrors.length, 0);
	});

	output.checks = checks;
	if (option('output')) await fs.writeFile(option('output'), JSON.stringify(output, null, 2) + '\n');
	const failed = results.filter(r => r.error);
	if (failed.length || pageErrors.length) {
		console.log('FAILURES: ' + failed.length);
		process.exit(1);
	}
	console.log('ALL PASS (' + checks + ' checks, ' + results.length + ' cases)');
} finally {
	await browser?.close().catch(() => {});
	await new Promise(resolve => server.close(resolve));
}
