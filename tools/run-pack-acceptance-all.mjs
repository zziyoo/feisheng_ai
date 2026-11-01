#!/usr/bin/env node
// 对五个最终分包 ZIP 逐包验收 + 五包共存验收；任一失败即非零退出。
// 用法：node tools/run-pack-acceptance-all.mjs --packs-dir <dir> --evidence <dir>
//   [--repo <worktree>] [--host-root <dir>] [--browser <chrome>] [--playwright <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const option = name => { const index = process.argv.indexOf('--' + name); return index < 0 ? null : process.argv[index + 1]; };
const PACKS_DIR = path.resolve(option('packs-dir') || path.join(HERE, '..', '..', 'feisheng-ai-packs'));
const EVIDENCE = path.resolve(option('evidence') || path.join(HERE, '..', '..', 'repair-baseline', 'evidence'));
const REPO = path.resolve(option('repo') || path.join(HERE, '..'));
const HOST = option('host-root');
const CHROME = option('browser');
const PLAYWRIGHT = option('playwright');
const IDS = ['refresh_standard', 'shenhua_feng', 'refresh_feng', 'shenhua_lei', 'out_of_scope'];
const SCENES = {
	refresh_standard: 'reqimou-near1-2sha-hp2',
	shenhua_feng: 'qimou-far4-3sha-hp3',
	refresh_feng: 'reqimou-blocked-far5-hp4-3sha-tao-hp2-horse',
	shenhua_lei: 'reqimou-near1-2sha-hp2',
	out_of_scope: 'reqimou-near1-2sha-hp2',
};
const zips = IDS.map(id => ({ id, zip: path.join(PACKS_DIR, `feisheng-ai-${id.replace(/_/g, '-')}.zip`) }));
for (const item of zips) if (!fs.existsSync(item.zip)) throw new Error('缺少分包 ZIP：' + item.zip);

const baseArgs = ['--repo', REPO];
if (HOST) baseArgs.push('--host-root', HOST);
if (CHROME) baseArgs.push('--browser', CHROME);
if (PLAYWRIGHT) baseArgs.push('--playwright', PLAYWRIGHT);
const results = [];
function run(label, args, out) {
	const fullArgs = [path.join(HERE, 'accept-skill-ai-pack.mjs'), ...args, '--out', out];
	const result = spawnSync(process.execPath, fullArgs, { cwd: REPO, encoding: 'utf8', timeout: 900000 });
	const tail = String(result.stdout || '').trim().split('\n').slice(-3).join('\n');
	console.log(`[${label}] exit=${result.status}\n${tail}`);
	if (result.status !== 0) console.error(String(result.stderr || '').slice(-2000));
	results.push({ label, status: result.status, out });
	return result.status === 0;
}

let ok = true;
for (const item of zips) {
	const out = path.join(EVIDENCE, `accept-${item.id}.json`);
	ok = run(item.id, ['--zip', item.zip, ...baseArgs, '--scene', SCENES[item.id], '--workdir', path.join(EVIDENCE, 'accept-work', item.id)], out) && ok;
}
const combinedArgs = [];
for (const item of zips) combinedArgs.push('--zip', item.zip);
ok = run('combined', [...combinedArgs, ...baseArgs, '--scene', 'reqimou-near1-2sha-hp2', '--workdir', path.join(EVIDENCE, 'accept-work', 'combined')], path.join(EVIDENCE, 'accept-combined.json')) && ok;

const summary = { generated_at: new Date().toISOString(), packs_dir: PACKS_DIR, evidence: EVIDENCE, results, pass: ok };
fs.writeFileSync(path.join(EVIDENCE, 'accept-all-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (!ok) process.exit(1);
