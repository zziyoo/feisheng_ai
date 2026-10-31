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
	'reqimou-near1-2sha-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 244], ['sha', 'heart', 245]], target: { index: 1, hp: 2 } },
	'reqimou-near2-2sha-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 246], ['sha', 'heart', 247]], target: { index: 2, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-zhangba': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 248], ['sha', 'heart', 249]], weapon: ['zhangba', 'spade', 250], target: { index: 4, hp: 2 } },
	'reqimou-far5-hp4-2sha-hp2-zhangba-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 251], ['sha', 'heart', 252]], weapon: ['zhangba', 'spade', 253], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 254]] } },
	'reqimou-far3-hp4-2sha-hp2-chitu': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 255], ['sha', 'heart', 256]], actorEquips: [['chitu', 'heart', 257]], target: { index: 4, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-noweapon': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 258], ['sha', 'heart', 259]], target: { index: 4, hp: 2 } },
	'reqimou-far4-hp4-2sha-hp2-kongcheng': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 260], ['sha', 'heart', 261]], target: { index: 4, hp: 2, skills: ['kongcheng'] } },
	'reqimou-blocked-far4-hp3-3sha-tao-hp2': { skills: ['reqimou', 'xinkuanggu'], hp: 3, hand: [['sha', 'spade', 262], ['sha', 'heart', 263], ['sha', 'club', 264], ['tao', 'heart', 265]], target: { index: 4, hp: 2 } },
	'reqimou-blocked-far5-hp4-3sha-tao-hp2-horse': { skills: ['reqimou', 'xinkuanggu'], hp: 4, hand: [['sha', 'spade', 266], ['sha', 'heart', 267], ['sha', 'club', 268], ['tao', 'heart', 269]], target: { index: 4, hp: 2, equips: [['jueying', 'spade', 270]] } },
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

let browser;
try {
	await fs.access(path.join(hostRoot, 'noname.js'));
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	browser = await chromium.launch({ headless: true, ...(option('browser') ? { executablePath: option('browser') } : {}) });

	const results = [];
	for (const name of scenarioNames) {
		process.stderr.write('[hp] scenario start: ' + name + '\n');
		const context = await browser.newContext();
		await context.addInitScript(seedValue => {
			let state = 0;
			const text = String(seedValue || '20261030');
			for (let i = 0; i < text.length; i++) state = (Math.imul(state, 31) + text.charCodeAt(i)) >>> 0;
			if (!state) state = 20261030;
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
					if (attempt >= 3) throw error;
					await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
					await page.waitForTimeout(800);
				}
			}
			const config = SCENARIOS[name];
			const watchdog = new Promise((resolve, reject) => {
				const started = Date.now();
				const timer = setInterval(() => {
					page.evaluate(() => {
						let path = [];
						try {
							let ev = _status.event;
							for (let i = 0; ev && i < 8; i++) { path.push(ev.name + (ev.skill ? ':' + ev.skill : '')); ev = ev.parent || ev.getParent?.(); }
						} catch (e) {}
						const ev = _status.event || {};
						return {
							event: ev.name, skill: ev.skill, player: ev.player && (ev.player.name1 || ev.player.name),
							hp: ev.player && ev.player.hp, paused: _status.paused, auto: _status.auto, path,
						};
					}).then(state => {
						process.stderr.write('[hp][watchdog] ' + JSON.stringify(state) + '\n');
					}).catch(() => {});
					if (Date.now() - started > 90000) { clearInterval(timer); reject(new Error('scenario-watchdog-timeout-90s')); }
				}, 10000);
			});
			const report = await Promise.race([
				page.evaluate(async ({ config, name, installExtension, policyOnly }) => {
				let policyModule = null;
				if (policyOnly) {
					policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
					policyModule.installSkillAIPolicies();
				}
				if (installExtension) {
					const score = await import('/extension/无名AI/score/index.js?v=41a');
					score.installScoreEngine();
					policyModule = await import('/extension/无名AI/score/decision/skills/skillAIPolicies.js?v=41a');
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				const { game, lib, get, _status } = realHost;
				const card = (value, suit = 'spade', number = 1) => game.createCard(value, suit, number);
				const hand = player => player.getCards('h').map(item => item.name);
				const equips = player => player.getEquips().map(item => item.name);
				const playerTag = player => player.playerid + ':' + (player.name1 || player.name || '?');
				const all = game.players.slice();
				const actor = all[0];
				const target = config.target ? all[config.target.index] : null;
				const resetAll = async () => {
					/* 主公+忠臣+至少两个远处反贼：击杀目标不会触发“反贼全灭”的 game.over。 */
					const backupFanSeats = new Set([4, 5].filter(index => index < all.length));
					const seatOf = player => all.indexOf(player);
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
						else if (target && player === target) player.identity = 'fan';
						else player.identity = backupFanSeats.has(seatOf(player)) ? 'fan' : 'zhong';
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
				};
				const give = async (player, list) => {
					if (!list || !list.length) return;
					const cards = list.map(([value, suit, number]) => card(value, suit, number));
					await player.gain(cards, 'gain2');
				};
				const snapshot = player => ({
					id: player.playerid, name: playerTag(player),
					hp: player.hp, maxHp: player.maxHp,
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
				const instrument = player => {
					const log = [];
					const backups = {};
					for (const method of ['useSkill', 'useCard', 'loseHp', 'damage', 'discard', 'draw', 'recover', 'gain']) {
						if (typeof player[method] !== 'function') continue;
						backups[method] = player[method];
						player[method] = function (...values) {
							try {
								if (log.length < 120) log.push({ op: method, args: describeArgs(values) });
							} catch (e) {}
							return backups[method].apply(this, values);
						};
					}
					return { log, restore() { for (const [method, fn] of Object.entries(backups)) player[method] = fn; } };
				};
				await resetAll();
				const actorProbe = instrument(actor);
				const targetProbe = target ? instrument(target) : null;
				for (const skill of config.skills || []) actor.addSkill(skill);
				actor.hp = config.hp || 4;
				actor.maxHp = config.maxHp || 4;
				await give(actor, config.hand);
				if (config.weapon) await actor.equip(card(...config.weapon));
				for (const equip of config.actorEquips || []) await actor.equip(card(...equip));
				if (target) {
					target.hp = config.target.hp || 4;
					target.maxHp = config.target.maxHp || 4;
					await give(target, config.target.hand);
					if (config.target.equip) await target.equip(card(...config.target.equip));
					for (const equip of config.target.equips || []) await target.equip(card(...equip));
					for (const skill of config.target.skills || []) target.addSkill(skill);
					target.update();
				}
				actor.update();
				const before = {
					actor: snapshot(actor), target: target ? snapshot(target) : null,
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
					await actor.phaseUse();
					if (config.counter && target && !target.dead) {
						await target.useCard(card('sha', 'spade', 900 + Number(config.counter)), actor);
					}
				});
				await game.loop(event);
				if (restoreChooseCard) restoreChooseCard();
				const after = {
					actor: snapshot(actor), target: target ? snapshot(target) : null,
					dead: game.dead.map(playerTag),
					policyStats: policyModule ? policyModule.skillAIPolicyStats() : null,
				};
				actorProbe.restore();
				if (targetProbe) targetProbe.restore();
				return {
					scenario: name,
					mode: get.mode(),
					before, after, debug,
					actorOps: actorProbe.log,
					targetOps: targetProbe ? targetProbe.log : [],
					error: null,
				};
			}, { config, name, installExtension: variant === 'extension', policyOnly: variant === 'policy' }),
				watchdog,
			]);
			process.stderr.write('[hp] scenario done: ' + name + '\n');
			report.pageErrors = pageErrors;
			results.push(report);
		} catch (error) {
			results.push({ scenario: name, error: String(error && error.stack || error), pageErrors });
		} finally {
			await page.close().catch(() => {});
			await context.close().catch(() => {});
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
