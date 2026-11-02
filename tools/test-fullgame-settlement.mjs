#!/usr/bin/env node
// 有界完整对局：不抑制 game.over，确认真实胜负结算完成；独立于技能固定场景。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? null : args[index + 1]; };
const HOST = option('host-root');
const EXT = path.resolve(option('extension-root') || REPO);
const CHROME = option('browser');
const PW = option('playwright');
const MODE = option('mode') || 'doudizhu';
const SEED = option('seed') || '20261030';
const OUT = path.resolve(option('output') || path.join(REPO, 'fullgame-settlement.json'));
const TIMEOUT = Number(option('timeout-ms') || 240000);
if (!HOST || !CHROME || !PW) {
	console.error('usage: node tools/test-fullgame-settlement.mjs --host-root <dir> --browser <chrome> --playwright <dir> --output <json>');
	process.exit(2);
}
const raw = OUT + '.raw.json';
const command = [path.join(REPO, 'tools/trick-real-host-smoke.mjs'),
	'--mode', MODE, '--autoplay', '--seed', SEED,
	'--host-root', HOST, '--extension-root', EXT,
	'--browser', CHROME, '--playwright', PW, '--output', raw];
const result = spawnSync(process.execPath, command, { cwd: REPO, encoding: 'utf8', timeout: TIMEOUT });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
let report = null;
try { report = JSON.parse(fs.readFileSync(raw, 'utf8')); } catch (error) {}
const settlement = report && report.report ? {
	mode: MODE,
	done: !!report.report.done,
	overCalls: report.report.overCalls || 0,
	result: report.report.result === undefined ? null : report.report.result,
	phases: report.report.phases || 0,
	uses: report.report.uses || 0,
	decisions: report.report.decisions || 0,
	elapsedMs: report.report.elapsedMs || null,
	error: report.report.error || null,
	stalled: !!report.report.stalled,
	timedOut: !!report.report.timedOut,
	alive: report.report.alive || [],
	dead: report.report.dead || [],
	errors: report.errors || [],
} : null;
const summary = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	scope: '真实宿主完整托管对局；不抑制 game.over，验证真实胜负结算；不修改技能固定场景断言',
	command: [process.execPath, ...command].join(' '),
	exit: result.status,
	settlement,
	pass: false,
};
try {
	assert.equal(result.status, 0, '完整对局进程失败：' + String(result.stderr || '').slice(-1200));
	assert(report, '缺少完整对局报告');
	assert.equal(report.status, 'passed', '完整对局未通过：' + JSON.stringify(report.report || {}));
	assert(settlement.done, '游戏未结束');
	assert(settlement.overCalls > 0, 'game.over 未被调用');
	assert(settlement.result != null, 'game.over 未返回胜负结果');
	assert(settlement.phases > 0 && settlement.uses > 0 && settlement.decisions > 0, '对局缺少真实阶段/用牌/决策');
	assert(!settlement.error && !settlement.stalled && !settlement.timedOut, '对局异常/停滞/超时');
	assert.deepEqual(settlement.errors, [], '页面错误');
	summary.pass = true;
} catch (error) {
	summary.error = String(error && error.message || error);
}
fs.writeFileSync(OUT, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (!summary.pass) process.exit(1);
