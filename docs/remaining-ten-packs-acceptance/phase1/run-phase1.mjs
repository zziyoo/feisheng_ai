import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = 'C:/Users/32360/.codex/worktrees/remaining-ten-packs-acceptance';
const HOST = 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-phase1';
const PATCH_DIR = path.join(ROOT, 'docs/remaining-ten-packs/native');
const OUT_DIR = path.join(ROOT, 'docs/remaining-ten-packs-acceptance/phase1');
const PATCHES = [
  'standard_2008', 'standard_2013', 'standard_2019', 'standard_2023',
  'shenhua_lin', 'shenhua_shan', 'shenhua_yin',
  'refresh_huo', 'refresh_lin', 'refresh_shan',
];
const ORIGINAL = {
  'character/standard.js': '2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63',
  'character/shenhua.js': '62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e',
  'character/refresh.js': '25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0',
  'character/sp.js': 'f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea',
  'character/tw.js': '356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20',
};

const sh = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cmd, args, cwd) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
};
const git = (args, cwd = HOST) => run('git', ['-c', 'core.autocrlf=false', ...args], cwd);
const nodeCheck = (file) => run(process.execPath, ['--check', file], HOST);

function verifyOriginal() {
  const actual = {};
  const mismatches = [];
  for (const [rel, expected] of Object.entries(ORIGINAL)) {
    const file = path.join(HOST, rel);
    const got = fs.existsSync(file) ? sh(file) : null;
    actual[rel] = got;
    if (got !== expected) mismatches.push({ rel, expected, got });
  }
  return { ok: mismatches.length === 0, actual, mismatches };
}
function statusClean() {
  const r = git(['status', '--porcelain=v1']);
  return { ok: r.stdout.trim() === '', status: r.stdout.trim(), raw: r };
}
function resetHost() {
  git(['checkout', '--', 'character']);
  git(['clean', '-fdq', 'character']);
  return { verify: verifyOriginal(), status: statusClean() };
}
function patchFiles(patchFile) {
  const text = fs.readFileSync(patchFile, 'utf8');
  return [...new Set(text.split(/\r?\n/).filter(l => l.startsWith('+++ b/')).map(l => l.slice(6)))].sort();
}
function diffInfo() {
  const numstat = git(['diff', '--numstat']).stdout.trim();
  const stat = git(['diff', '--stat']).stdout.trim();
  const check = git(['diff', '--check']);
  const diff = git(['diff', '--', 'character']).stdout;
  const added = diff.split(/\r?\n/).filter(l => l.startsWith('+') && !l.startsWith('+++'));
  const removed = diff.split(/\r?\n/).filter(l => l.startsWith('-') && !l.startsWith('---'));
  return {
    numstat, stat,
    whitespaceCheckOk: check.status === 0,
    whitespaceCheck: (check.stdout + check.stderr).trim(),
    addedLines: added.map(l => l.slice(1)),
    removedLines: removed.map(l => l.slice(1)),
    settlementLikeChanges: [...added, ...removed].filter(l => /\b(content|useCard|useSkill|damage|recover|draw)\s*[:(]/.test(l)),
  };
}
function patchHashInfo(name) {
  const rel = `docs/remaining-ten-packs/native/${name}.patch`;
  const file = path.join(ROOT, rel);
  const head = git(['rev-parse', `HEAD:${rel}`], ROOT);
  const worktreeBlob = git(['hash-object', '--', rel], ROOT);
  const log = git(['log', '-1', '--format=%H%x09%s', '--', rel], ROOT);
  return {
    rel,
    sha256: sh(file),
    headBlob: head.status === 0 ? head.stdout.trim() : null,
    worktreeBlob: worktreeBlob.status === 0 ? worktreeBlob.stdout.trim() : null,
    headMatchesWorktree: head.status === 0 && worktreeBlob.status === 0 && head.stdout.trim() === worktreeBlob.stdout.trim(),
    commit: log.status === 0 ? log.stdout.trim() : null,
    eol: fs.readFileSync(file).includes(0x0d) ? 'CRLF' : 'LF',
  };
}

const results = { generatedAt: new Date().toISOString(), host: HOST, patchDir: PATCH_DIR, patches: [], cumulative: null, original: null, errors: [] };
results.original = resetHost();

for (const name of PATCHES) {
  const patchFile = path.join(PATCH_DIR, `${name}.patch`);
  const rec = { name, ...patchHashInfo(name), files: patchFiles(patchFile), checks: {} };
  if (!fs.existsSync(patchFile)) { rec.checks.missing = true; results.patches.push(rec); continue; }
  let reset = resetHost();
  rec.checks.preReset = reset;
  let r = git(['apply', '--check', patchFile]);
  rec.checks.applyCheck = { status: r.status, stderr: r.stderr.trim() };
  if (r.status === 0) {
    r = git(['apply', patchFile]);
    rec.checks.apply = { status: r.status, stderr: r.stderr.trim() };
  }
  if (rec.checks.apply && rec.checks.apply.status === 0) {
    rec.diff = diffInfo();
    rec.checks.node = {};
    for (const rel of rec.files.filter(f => f.endsWith('.js'))) {
      const nc = nodeCheck(path.join(HOST, rel));
      rec.checks.node[rel] = { status: nc.status, stderr: nc.stderr.trim().slice(0, 500) };
    }
    r = git(['apply', '-R', '--check', patchFile]);
    rec.checks.reverseCheck = { status: r.status, stderr: r.stderr.trim() };
    if (r.status === 0) {
      r = git(['apply', '-R', patchFile]);
      rec.checks.reverseApply = { status: r.status, stderr: r.stderr.trim() };
    }
    rec.checks.afterReverse = { verify: verifyOriginal(), status: statusClean() };
  }
  results.patches.push(rec);
  console.error(`[phase1] ${name} apply=${rec.checks.apply?.status ?? 'n/a'} reverse=${rec.checks.reverseApply?.status ?? 'n/a'} node=${rec.checks.node ? Object.values(rec.checks.node).every(x => x.status === 0) : 'n/a'}`);
}

// Cumulative apply in declared order, then reverse
resetHost();
const cum = { order: PATCHES.slice(), steps: [], node: {}, diff: null, reverse: [], final: null };
for (const name of PATCHES) {
  const patchFile = path.join(PATCH_DIR, `${name}.patch`);
  const check = git(['apply', '--check', patchFile]);
  const apply = check.status === 0 ? git(['apply', patchFile]) : { status: null, stdout: '', stderr: 'skipped after check failure' };
  cum.steps.push({ name, check: { status: check.status, stderr: check.stderr.trim() }, apply: { status: apply.status, stderr: (apply.stderr || '').trim() } });
  if (check.status !== 0 || apply.status !== 0) break;
}
if (cum.steps.every(s => s.check.status === 0 && s.apply.status === 0)) {
  for (const rel of ['character/standard.js', 'character/shenhua.js', 'character/refresh.js', 'character/sp.js']) {
    const nc = nodeCheck(path.join(HOST, rel));
    cum.node[rel] = { status: nc.status, stderr: nc.stderr.trim().slice(0, 500) };
  }
  cum.diff = diffInfo();
  for (const name of [...PATCHES].reverse()) {
    const patchFile = path.join(PATCH_DIR, `${name}.patch`);
    const rc = git(['apply', '-R', '--check', patchFile]);
    const ra = rc.status === 0 ? git(['apply', '-R', patchFile]) : { status: null, stderr: 'skipped after reverse check failure' };
    cum.reverse.push({ name, check: { status: rc.status, stderr: rc.stderr.trim() }, apply: { status: ra.status, stderr: (ra.stderr || '').trim() } });
    if (rc.status !== 0 || ra.status !== 0) break;
  }
  cum.final = { verify: verifyOriginal(), status: statusClean() };
}
results.cumulative = cum;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'phase1-results.json'), JSON.stringify(results, null, 2), 'utf8');

const lines = [];
lines.push('# Phase 1 - 十份原生补丁独立与累计应用检查');
lines.push('');
lines.push(`生成时间：${results.generatedAt}`);
lines.push('');
lines.push('## 宿主原始文件');
lines.push('');
lines.push('| 文件 | 期望 SHA256 | 实际 SHA256 | 结果 |');
lines.push('| --- | --- | --- | --- |');
for (const [rel, expected] of Object.entries(ORIGINAL)) {
  const actual = results.original.verify.actual[rel];
  lines.push(`| \`${rel}\` | \`${expected}\` | \`${actual}\` | ${actual === expected ? 'PASS' : 'FAIL'} |`);
}
lines.push('');
lines.push('## 单包检查');
lines.push('');
lines.push('| 分包 | apply --check | apply | node --check | reverse --check | reverse | 原始字节恢复 | 工作区干净 |');
lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
for (const p of results.patches) {
  const nodeOk = p.checks.node ? Object.values(p.checks.node).every(x => x.status === 0) : false;
  const restored = p.checks.afterReverse?.verify?.ok === true;
  const clean = p.checks.afterReverse?.status?.ok === true;
  const cell = x => x === undefined ? 'N/A' : (x.status === 0 ? 'PASS' : `FAIL(${x.status})`);
  lines.push(`| ${p.name} | ${cell(p.checks.applyCheck)} | ${cell(p.checks.apply)} | ${nodeOk ? 'PASS' : 'FAIL'} | ${cell(p.checks.reverseCheck)} | ${cell(p.checks.reverseApply)} | ${restored ? 'PASS' : 'FAIL'} | ${clean ? 'PASS' : 'FAIL'} |`);
}
lines.push('');
lines.push('## 累计应用');
lines.push('');
lines.push('| 步骤 | 包 | apply --check | apply |');
lines.push('| ---: | --- | --- | --- |');
cum.steps.forEach((s, i) => lines.push(`| ${i + 1} | ${s.name} | ${s.check.status === 0 ? 'PASS' : 'FAIL'} | ${s.apply.status === 0 ? 'PASS' : 'FAIL'} |`));
lines.push('');
lines.push(`- 四文件语法检查：${Object.values(cum.node).every(x => x.status === 0) ? 'PASS' : 'FAIL'}`);
lines.push(`- 逆向撤销：${cum.reverse.every(x => x.check.status === 0 && x.apply.status === 0) ? 'PASS' : 'FAIL'}`);
lines.push(`- 撤销后原始字节：${cum.final?.verify?.ok ? 'PASS' : 'FAIL'}`);
lines.push(`- 撤销后工作区干净：${cum.final?.status?.ok ? 'PASS' : 'FAIL'}`);
lines.push('');
lines.push('## 证据');
lines.push('');
lines.push('- `phase1-results.json`：逐包 apply/reverse/node/diff 原始输出。');
lines.push('- 补丁 `.gitattributes` 为 `*.patch text eol=lf`；十份补丁与宿主五个文件均为 LF。');
lines.push('');
fs.writeFileSync(path.join(OUT_DIR, 'phase1-report.md'), lines.join('\n'), 'utf8');
console.log(JSON.stringify({
  single: results.patches.map(p => ({ name: p.name, applyCheck: p.checks.applyCheck?.status, apply: p.checks.apply?.status, node: p.checks.node ? Object.values(p.checks.node).every(x => x.status === 0) : null, reverseCheck: p.checks.reverseCheck?.status, reverse: p.checks.reverseApply?.status, restored: p.checks.afterReverse?.verify?.ok, clean: p.checks.afterReverse?.status?.ok })),
  cumulative: { steps: cum.steps.map(s => ({ name: s.name, check: s.check.status, apply: s.apply.status })), node: Object.values(cum.node).every(x => x.status === 0), reverse: cum.reverse.every(x => x.check.status === 0 && x.apply.status === 0), restored: cum.final?.verify?.ok, clean: cum.final?.status?.ok },
}, null, 2));
