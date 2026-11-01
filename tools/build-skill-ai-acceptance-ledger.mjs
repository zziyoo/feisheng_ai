#!/usr/bin/env node
// 合并补修验收证据：逐场景、逐变体列出每一次尝试，不隐藏历史超时/失败。
// 用法：node tools/build-skill-ai-acceptance-ledger.mjs --evidence-dir <dir> --out <json>
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const DIR = path.resolve(option('evidence-dir') || 'C:/Users/32360/Desktop/repair-baseline/evidence');
const OUT = path.resolve(option('out') || path.join(DIR, 'repair-acceptance-ledger.json'));
const INITIAL = {
	native: 'repair-range-native.json',
	policy: 'repair-range-policy.json',
	extension: 'repair-range-extension.json',
};
const RETEST_FILES = [
	'repair-flaky-retest-1.json', 'repair-flaky-retest-2.json', 'repair-flaky-retest-3.json', 'repair-flaky-retest-4.json',
	'repair-flaky-retest-5.json', 'repair-flaky-retest-6.json', 'repair-flaky-retest-7.json', 'repair-flaky-retest-8.json',
	'repair-final-retest-native.json', 'repair-final-retest-policy.json', 'repair-final-retest-extension.json',
];
const POSTFIX_PRE = ['postfix-range-policy-startupfailure.json'];
const POSTFIX_RETEST = ['postfix-retest-policy.json', 'postfix-retest-extension.json'];
const POSTFIX = {
	native: 'postfix-range-native.json',
	policy: 'postfix-range-policy.json',
	extension: 'postfix-range-extension.json',
};
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const errorType = result => {
	if (!result.error) return 'passed';
	return /timeout|Timeout|watchdog/i.test(String(result.error)) ? 'timeout' : 'failed';
};
const attempts = new Map();

function load(file, source) {
	const full = path.join(DIR, file);
	if (!fs.existsSync(full)) return null;
	const data = JSON.parse(fs.readFileSync(full, 'utf8'));
	for (const result of data.results || []) {
		const variant = data.variant || result.variant;
		if (!variant) continue;
		const key = variant + '|' + result.scenario;
		if (!attempts.has(key)) attempts.set(key, []);
		attempts.get(key).push({
			source,
			file,
			completedAt: data.completedAt || null,
			status: errorType(result),
			error: result.error || null,
			pageErrors: result.pageErrors || [],
			paid: (result.reqimouPayments || []).map(item => item.paid),
			dead: result.after && result.after.dead || [],
		});
	}
	return {
		file,
		sha256: sha(full),
		completedAt: data.completedAt || null,
		status: data.status || null,
		variant: data.variant || null,
		scenarioCount: data.scenarioCount || (data.results || []).length,
	};
}

const sources = [];
for (const [variant, file] of Object.entries(INITIAL)) {
	const info = load(file, 'initial');
	if (info) sources.push({ ...info, role: 'initial', variant });
}
for (const file of RETEST_FILES) {
	const info = load(file, 'retest');
	if (info) sources.push({ ...info, role: 'retest' });
}
for (const file of POSTFIX_PRE) {
	const info = load(file, 'postfix-prefailure');
	if (info) sources.push({ ...info, role: 'postfix-prefailure' });
}
for (const [variant, file] of Object.entries(POSTFIX)) {
	const info = load(file, 'postfix');
	if (info) sources.push({ ...info, role: 'postfix', variant });
}
for (const file of POSTFIX_RETEST) {
	const info = load(file, 'postfix-retest');
	if (info) sources.push({ ...info, role: 'postfix-retest' });
}

const diagnostics = [];
for (const file of fs.readdirSync(DIR).filter(name => /^diag-.*\.json$/.test(name)).sort()) {
	const full = path.join(DIR, file);
	try {
		const data = JSON.parse(fs.readFileSync(full, 'utf8'));
		for (const result of data.results || []) {
			const diag = result.diag || null;
			diagnostics.push({
				file,
				sha256: sha(full),
				variant: data.variant || null,
				scenario: result.scenario || null,
				status: errorType(result),
				error: result.error || null,
				beats: diag && diag.beats,
				beatsAfterLastMark: diag && diag.beatsAfterLastMark,
				maxBeatGapMs: diag && diag.maxBeatGapMs,
				lastMark: diag && diag.lastMark,
				lastState: diag && diag.lastState,
				cpuAfterLastMark: diag && diag.cpuAfterLastMark,
				gameOverCalled: diag && diag.markCounts && diag.markCounts['game.over:call'] || 0,
				errorMarks: diag && diag.lastMark && diag.lastMark.stage,
			});
		}
	} catch (error) {
		diagnostics.push({ file, error: 'diagnostic parse failed: ' + String(error) });
	}
}

const variants = {};
for (const variant of ['native', 'policy', 'extension']) {
	const scenarios = [];
	for (const [key, list] of attempts) {
		const [currentVariant, scenario] = key.split('|');
		if (currentVariant !== variant) continue;
		const ordered = list.slice();
		const initial = ordered.find(item => item.source === 'initial') || null;
		const successful = ordered.filter(item => item.status === 'passed');
		const last = ordered[ordered.length - 1];
		const postfixChain = ordered.filter(item => item.source === 'postfix' || item.source === 'postfix-retest');
		const postfix = postfixChain[postfixChain.length - 1] || null;
		const postfixFull = ordered.find(item => item.source === 'postfix') || null;
		const postfixRetest = ordered.find(item => item.source === 'postfix-retest') || null;
		scenarios.push({
			scenario,
			attempts: ordered,
			initial_status: initial ? initial.status : 'missing',
			successful_attempts: successful.length,
			last_success: successful.length ? successful[successful.length - 1] : null,
			last_attempt: last,
			postfix_status: postfix ? postfix.status : 'missing',
			postfix_attempt: postfixFull,
			postfix_retest_attempt: postfixRetest,
			final_status: successful.length ? 'passed' : 'unresolved',
			historical_failures: ordered.filter(item => item.status !== 'passed').length,
		});
	}
	scenarios.sort((a, b) => a.scenario.localeCompare(b.scenario));
	const initial = scenarios.filter(item => item.initial_status === 'passed').length;
	const initialTimeout = scenarios.filter(item => item.initial_status === 'timeout').length;
	const initialFailed = scenarios.filter(item => !['passed', 'timeout'].includes(item.initial_status)).length;
	const retest = scenarios.flatMap(item => item.attempts.filter(attempt => attempt.source === 'retest'));
	const postfixFull = scenarios.map(item => item.postfix_attempt).filter(Boolean);
	const postfixRetests = scenarios.map(item => item.postfix_retest_attempt).filter(Boolean);
	const finalUnresolved = scenarios.filter(item => item.final_status !== 'passed');
	const postfixUnresolved = scenarios.filter(item => item.postfix_status !== 'passed');
	const postfixFullUnresolved = scenarios.filter(item => item.postfix_attempt && item.postfix_attempt.status !== 'passed');
	const lastFailures = scenarios.filter(item => item.last_attempt && item.last_attempt.status !== 'passed');
	variants[variant] = {
		scenarios,
		counts: {
			scenarios: scenarios.length,
			initial_pass: initial,
			initial_timeout: initialTimeout,
			initial_other_failure: initialFailed,
			retest_attempts: retest.length,
			retest_pass: retest.filter(item => item.status === 'passed').length,
			retest_timeout: retest.filter(item => item.status === 'timeout').length,
			retest_other_failure: retest.filter(item => item.status === 'failed').length,
			postfix_attempts: postfixFull.length,
			postfix_pass: postfixFull.filter(item => item.status === 'passed').length,
			postfix_timeout: postfixFull.filter(item => item.status === 'timeout').length,
			postfix_other_failure: postfixFull.filter(item => item.status === 'failed').length,
			postfix_missing: scenarios.length - postfixFull.length,
			postfix_full_unresolved: postfixFullUnresolved.length,
			postfix_retest_attempts: postfixRetests.length,
			postfix_retest_pass: postfixRetests.filter(item => item.status === 'passed').length,
			postfix_retest_failure: postfixRetests.filter(item => item.status !== 'passed').length,
			postfix_unresolved: postfixUnresolved.length,
			final_unresolved: finalUnresolved.length,
			last_attempt_failures: lastFailures.length,
			historical_failures: scenarios.reduce((sum, item) => sum + item.historical_failures, 0),
		},
	};
}

const ledger = {
	schema_version: '1.1',
	generated_at: new Date().toISOString(),
	scope: '第二轮补修 21 场景 × native/policy/extension；initial 为批次运行，retest 为看门狗超时后的独立重跑，postfix 为修复夹具后的完整重跑；final_status=至少一次成功，postfix_status 单独保留修复后结果。',
	fixture_note: 'postfix 运行的技能机制场景默认抑制宿主 game.over 胜负对话框；反贼全灭时主循环仍可正常结束。该夹具修正不改变 AI/技能/断言，只避免提前进入未测试的结算 UI。',
	sources,
	diagnostics,
	variants,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(ledger, null, 2) + '\n');

const lines = ['# 补修验收合并台账', '', `- 生成时间：${ledger.generated_at}`, `- 范围：${ledger.scope}`, `- 夹具修正：${ledger.fixture_note}`, '', '## 总览', '', '| 变体 | 场景 | 初次成功 | 初次超时 | 初次其他失败 | 历史重跑 | 重跑成功 | 重跑超时 | 修复后完整运行 | 完整通过 | 完整超时 | 完整失败(未解决) | 修复后重跑 | 重跑通过 | 最终未解决 | 末次尝试失败 | 历史失败次数 |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
for (const variant of ['native', 'policy', 'extension']) {
	const c = variants[variant].counts;
	lines.push(`| ${variant} | ${c.scenarios} | ${c.initial_pass} | ${c.initial_timeout} | ${c.initial_other_failure} | ${c.retest_attempts} | ${c.retest_pass} | ${c.retest_timeout} | ${c.postfix_attempts} | ${c.postfix_pass} | ${c.postfix_timeout} | ${c.postfix_full_unresolved} | ${c.postfix_retest_attempts} | ${c.postfix_retest_pass} | ${c.final_unresolved} | ${c.last_attempt_failures} | ${c.historical_failures} |`);
}
lines.push('', '> “最终未解决(任一次成功)”=没有任何一次成功运行；“修复后未解决”=game.over 抑制夹具修正后的完整重跑/重跑仍未通过；“末次尝试失败”=最后一次运行仍超时/失败但此前已有成功证据。历史超时/失败逐条保留，不用最后一次成功覆盖。', '', '## 逐场景尝试');
for (const variant of ['native', 'policy', 'extension']) {
	lines.push('', `### ${variant}`);
	for (const item of variants[variant].scenarios) {
		const history = item.attempts.map(attempt => `${attempt.source}:${attempt.status}@${attempt.completedAt || '?'}`).join(' → ');
		lines.push(`- \`${item.scenario}\`：initial=${item.initial_status}；postfix_full=${item.postfix_attempt ? item.postfix_attempt.status : 'missing'}；postfix_after_retest=${item.postfix_status}；成功次数=${item.successful_attempts}；final=${item.final_status}；${history}`);
	}
}
if (diagnostics.length) {
	lines.push('', '## 独立诊断证据（不并入验收计数）');
	for (const item of diagnostics) {
		const detail = item.lastState ? JSON.stringify(item.lastState) : (item.error || '');
		lines.push(`- \`${item.file}\` · ${item.variant || '?'} · ${item.scenario || '?'} · ${item.status} · beats=${item.beats ?? '?'} · afterLastMark=${item.beatsAfterLastMark ?? '?'} · game.over=${item.gameOverCalled} · last=${item.lastMark && item.lastMark.stage || '?'} · ${detail}`);
	}
}
fs.writeFileSync(OUT.replace(/\.json$/, '.md'), lines.join('\n') + '\n');
console.log(JSON.stringify({ out: OUT, sources: sources.length, variants: Object.fromEntries(Object.entries(variants).map(([k, v]) => [k, v.counts])) }, null, 2));
