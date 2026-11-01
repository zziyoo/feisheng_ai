#!/usr/bin/env node
// 批一 41 项 Node 回归聚合入口（与审查包 evidence/node-tests.log 同口径）。
// 用法：node tools/run-node-regressions.mjs [--output <json>] [--filter <substr>]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const filter = option('filter') || '';
const output = option('output');
const tools = path.dirname(fileURLToPath(import.meta.url));

const SUITES = [
	'test-skill-ai-policies.mjs', 'test-skill-ai-architecture.mjs', 'test-regressions.mjs',
	'test-2v2-reentry.mjs', 'test-response-lifecycle.mjs', 'test-weights.mjs',
	'test-extension-shadow-lifecycle.mjs', 'test-guard-runtime-failure.mjs', 'test-ai-boundaries.mjs',
	'test-trick-boundaries.mjs', 'test-policy-model-v3.mjs', 'test-mobile-performance.mjs',
	'test-mobile-shadow.mjs', 'test-mobile-db.mjs', 'test-mobile-diagnostics.mjs',
	'test-mobile-v5.mjs', 'test-mobile-v3-disable.mjs', 'test-2v2-aoe.mjs',
	'test-2v2-attack-choice.mjs', 'test-2v2-context.mjs', 'test-2v2-friendly-fire.mjs',
	'test-2v2-lethal.mjs', 'test-2v2-material-reserve.mjs', 'test-2v2-resource-reserve.mjs',
	'test-2v2-seat-tactics.mjs', 'test-2v2-settings.mjs', 'test-2v2-team.mjs',
	'test-cooperation-scope.mjs', 'test-response-material-packing.mjs', 'test-removal-cooperation.mjs',
	'test-suggestion-fusion.mjs', 'test-wuxie-player-intent.mjs', 'test-manual-fire-control.mjs',
	'test-jiedao-pair.mjs', 'test-jiedao-response.mjs', 'test-ingest-contract.mjs',
	'test-decision-audit.mjs', 'test-decision-state-fingerprint.mjs', 'test-identity.mjs',
	'test-friendly-strip-plan.mjs', 'test-utility-boundaries.mjs',
];

const results = [];
let failed = 0;
for (const suite of SUITES) {
	if (filter && !suite.includes(filter)) continue;
	const started = Date.now();
	try {
		const out = execFileSync(process.execPath, ['--experimental-vm-modules', path.join(tools, suite)], {
			cwd: path.dirname(tools), encoding: 'utf8', timeout: 300000, stdio: ['ignore', 'pipe', 'pipe'],
		});
		// 退出码 0 即通过；仅把“非零 FAIL 计数/显式 FAIL 行”视为失败（各套件输出格式不一）
		const lines = out.trim().split('\n');
		const summary = lines[lines.length - 1] || '';
		const failing = lines.filter(line => /\bFAILS?\b[:\s]*[1-9]|\bFAILS?\b[:\s]*[1-9][0-9]*/i.test(line) || /^FAIL\b/i.test(line)).slice(0, 2);
		if (!failing.length) {
			results.push({ suite, status: 'PASS', summary, ms: Date.now() - started });
			console.log('PASS ' + suite.replace(/\.mjs$/, ''));
		} else {
			failed++;
			results.push({ suite, status: 'FAIL', summary: failing.join(' | '), ms: Date.now() - started });
			console.log('FAIL ' + suite.replace(/\.mjs$/, '') + ' :: ' + failing.join(' | '));
		}
	} catch (error) {
		failed++;
		const tail = ((error.stdout || '') + (error.stderr || '')).trim().split('\n').slice(-3).join(' | ');
		results.push({ suite, status: 'FAIL', summary: tail, ms: Date.now() - started });
		console.log('FAIL ' + suite.replace(/\.mjs$/, ''));
		console.log(tail);
	}
}
const summary = { completedAt: new Date().toISOString(), total: results.length, failed, results };
if (output) fs.writeFileSync(output, JSON.stringify(summary, null, 2) + '\n');
console.log((failed ? 'FAILED: ' + failed : 'ALL PASS') + ' (' + results.length + ' suites)');
process.exit(failed ? 1 : 0);
