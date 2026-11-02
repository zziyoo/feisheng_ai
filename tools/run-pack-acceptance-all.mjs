#!/usr/bin/env node
// 对五个最终分包 ZIP 逐包验收 + 五包共存验收；任一失败即非零退出。
// 用法：node tools/run-pack-acceptance-all.mjs --packs-dir <dir> --evidence <dir>
//   [--repo <worktree>] [--host-root <dir>] [--browser <chrome>] [--playwright <dir>]
//   [--base-ref <git-ref> --prefix accept-upstream-]  # 在上游干净副本上验证接线/安装/回滚
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = name => { const index = args.indexOf('--' + name); return index < 0 ? null : args[index + 1]; };
const PACKS_DIR = path.resolve(option('packs-dir') || path.join(HERE, '..', '..', 'feisheng-ai-packs'));
const EVIDENCE = path.resolve(option('evidence') || path.join(HERE, '..', '..', 'repair-baseline', 'evidence'));
const REPO = path.resolve(option('repo') || path.join(HERE, '..'));
const HOST = option('host-root');
const CHROME = option('browser');
const PLAYWRIGHT = option('playwright');
const BASE_REF = option('base-ref') || null;
const PREFIX = option('prefix') || (BASE_REF ? 'accept-upstream-' : 'accept-');
const BASELINE_PREFIX = option('baseline-prefix') || PREFIX;
const WORK_TAG = BASE_REF ? 'upstream' : 'head';
const IDS = ['refresh_standard', 'shenhua_feng', 'shenhua_huo', 'refresh_feng', 'shenhua_lei', 'out_of_scope'];
const SCENES = {
	refresh_standard: ['rezhiheng-3hp', 'new-retuxi-order'],
	shenhua_feng: [
		'hp-qimou-distance4-hp3', 'hp-qimou-distance4-hp4-negative', 'hp-qimou-distance3-hp2',
		'shenhua-releiji-target', 'shenhua-guidao-replace', 'shenhua-guidao-decline',
		'shenhua-huangtian-give', 'shenhua-huangtian-negative',
		'shenhua-guhuo-claim', 'shenhua-guhuo-ai-use', 'shenhua-guhuo-real-questioned',
		'shenhua-guhuo-fake-questioned', 'shenhua-guhuo-phase',
		'shenhua-shensu-skip', 'shenhua-shensu-negative',
		'shenhua-tianxiang-redirect', 'shenhua-tianxiang-negative', 'shenhua-hongyan-suit',
		'shenhua-kuanggu-draw', 'shenhua-kuanggu-recover',
		'shenhua-jushou-4hp-empty', 'shenhua-jushou-lowhp',
		'shenhua-buqu-damage', 'shenhua-buqu-negative', 'shenhua-buqu-recover-choice',
		'shenhua-liegong-hit', 'shenhua-liegong-negative',
	],
	shenhua_huo: [
		'hp-qiangxix-2hp-target1', 'hp-qiangxix-2hp-weapon-target2',
		'shenhua-huo-quhu-compare', 'shenhua-huo-quhu-no-target', 'shenhua-huo-quhu-risky-decline',
		'shenhua-huo-jieming-damage', 'shenhua-huo-jieming-no-benefit',
		'shenhua-huo-lianhuan-tiesuo', 'shenhua-huo-lianhuan-ally-risk', 'shenhua-huo-lianhuan-recast',
		'shenhua-huo-oldniepan-dying', 'shenhua-huo-oldniepan-tao',
		'shenhua-huo-tianyi-compare', 'shenhua-huo-tianyi-win-sha', 'shenhua-huo-tianyi-lose-sha', 'shenhua-huo-tianyi-lose-content',
		'shenhua-huo-shuangxiong-judge', 'shenhua-huo-shuangxiong-duel', 'shenhua-huo-shuangxiong-no-judge',
		'shenhua-huo-luanji-wanjian', 'shenhua-huo-luanji-wanjian-use', 'shenhua-huo-luanji-no-pair',
		'shenhua-huo-huoji-red', 'shenhua-huo-huoji-use', 'shenhua-huo-huoji-no-red',
		'shenhua-huo-kanpo-response', 'shenhua-huo-kanpo-no-black',
		'shenhua-huo-bazhen-bagua', 'shenhua-huo-bazhen-armor-negative',
		'shenhua-huo-jianchu-sha', 'shenhua-huo-jianchu-no-equip',
		'shenhua-huo-passive-rules',
	],
	refresh_feng: ['hp-reqimou-distance4-hp3'],
	shenhua_lei: ['olkongsheng-array-count', 'olkongsheng-repeat'],
	out_of_scope: ['redimeng-hidden-info', 'redimeng-permute-values'],
};
const UNION = IDS.flatMap(id => SCENES[id]).filter((name, index, list) => list.indexOf(name) === index);
const zips = IDS.map(id => ({ id, zip: path.join(PACKS_DIR, `feisheng-ai-${id.replace(/_/g, '-')}.zip`) }));
for (const item of zips) if (!fs.existsSync(item.zip)) throw new Error('缺少分包 ZIP：' + item.zip);

const baseArgs = ['--repo', REPO];
if (HOST) baseArgs.push('--host-root', HOST);
if (CHROME) baseArgs.push('--browser', CHROME);
if (PLAYWRIGHT) baseArgs.push('--playwright', PLAYWRIGHT);
if (BASE_REF) baseArgs.push('--base-ref', BASE_REF, '--wire-index-diff');
const results = [];
function run(label, packArgs, out) {
	const fullArgs = [path.join(HERE, 'accept-skill-ai-pack.mjs'), ...packArgs, ...baseArgs, '--out', out];
	const result = spawnSync(process.execPath, fullArgs, { cwd: REPO, encoding: 'utf8', timeout: 1800000 });
	const tail = String(result.stdout || '').trim().split('\n').slice(-3).join('\n');
	console.log(`[${label}] exit=${result.status}\n${tail}`);
	if (result.status !== 0) console.error(String(result.stderr || '').slice(-2000));
	results.push({ label, status: result.status, out });
	return result.status === 0;
}

let ok = true;
for (const item of zips) {
	const out = path.join(EVIDENCE, `${PREFIX}${item.id}.json`);
	ok = run(item.id, ['--zip', item.zip, '--scenes', SCENES[item.id].join(','), '--workdir', path.join(EVIDENCE, 'accept-work', WORK_TAG, item.id)], out) && ok;
}
const combinedArgs = [];
for (const item of zips) combinedArgs.push('--zip', item.zip);
ok = run('combined', [
	...combinedArgs,
	'--scenes', UNION.join(','),
	'--baseline-dir', EVIDENCE,
	'--baseline-prefix', BASELINE_PREFIX,
	'--workdir', path.join(EVIDENCE, 'accept-work', WORK_TAG, 'combined'),
], path.join(EVIDENCE, `${PREFIX}combined.json`)) && ok;

const summary = {
	generated_at: new Date().toISOString(),
	base_ref: BASE_REF,
	prefix: PREFIX,
	packs_dir: PACKS_DIR,
	evidence: EVIDENCE,
	results,
	pass: ok,
};
const summaryPath = path.join(EVIDENCE, BASE_REF ? 'accept-upstream-summary.json' : 'accept-all-summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (!ok) process.exit(1);
