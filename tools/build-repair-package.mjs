#!/usr/bin/env node
// 2026-11-01 审查补修包构建：staging → git 导出 source/tests/docs → patches → evidence 复制 → manifest。
// 产物：feisheng-ai-skill-audit-repair-20261101.zip（供第三方独立校验，不推送/不安装）。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const GIT = 'C:/Users/32360/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const REPO = path.resolve(option('repo') || 'C:/Users/32360/.codex/worktrees/release-444/无名AI');
const STAGE = path.resolve(option('stage') || 'C:/Users/32360/Desktop/repair-baseline/stage/feisheng-ai-skill-audit-repair-20261101');
const EVIDENCE = path.resolve(option('evidence') || 'C:/Users/32360/Desktop/repair-baseline/evidence');
const PRIOR = path.resolve('C:/Users/32360/Desktop/repair-baseline/zip/feisheng-ai-skill-audit-batch1-batch2');
const BASELINE = '3bb24347710c8fac192a0d96196a9a1f479a4af1';

const git = (args2, opts = {}) => execFileSync(GIT, args2, { cwd: REPO, encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, ...opts }).toString().trim();
const HEAD = git(['rev-parse', 'HEAD']);
const fileHash = file => {
	const data = fs.readFileSync(file);
	return { sha256: crypto.createHash('sha256').update(data).digest('hex'), size: data.length };
};

// 1) staging 目录重建
fs.rmSync(STAGE, { recursive: true, force: true });
for (const dir of ['source/score/decision/skills', 'source/contract/score/model/features', 'source/contract/score/model/net', 'patches', 'tests', 'docs', 'evidence', 'deployment']) {
	fs.mkdirSync(path.join(STAGE, dir), { recursive: true });
}
const exportFile = (repoPath, stagePath) => {
	const dest = path.join(STAGE, stagePath);
	fs.mkdirSync(path.dirname(dest), { recursive: true });
	fs.writeFileSync(dest, git(['show', `${HEAD}:${repoPath}`], { maxBuffer: 1024 * 1024 * 64 }));
};
// source：批二包同构（两个策略文件 + score/index.js + 只读契约子集）
exportFile('score/decision/skills/skillAIPolicies.js', 'source/score/decision/skills/skillAIPolicies.js');
exportFile('score/decision/skills/skillAIPolicyRules.js', 'source/score/decision/skills/skillAIPolicyRules.js');
exportFile('score/index.js', 'source/score/index.js');
exportFile('extension.js', 'source/contract/extension.js');
exportFile('info.json', 'source/contract/info.json');
exportFile('score/model/features/dimensionAdapter.js', 'source/contract/score/model/features/dimensionAdapter.js');
exportFile('score/model/features/features.js', 'source/contract/score/model/features/features.js');
exportFile('score/model/net/policyModelV2.js', 'source/contract/score/model/net/policyModelV2.js');
// tests：tools/ 导出映射 + 包内交付物
const TEST_MAP = [
	'test-skill-ai-policies.mjs', 'test-skill-ai-architecture.mjs', 'skill-ai-hp-real-host.mjs',
	'skill-ai-host-scenes.mjs', 'trick-real-host-smoke.mjs', 'reqimou-manual-ui.mjs',
	'verify-repair-outcomes.mjs', 'run-node-regressions.mjs', 'bench-skill-ai-policies.mjs',
	'test-policy-model-v2-reachability.mjs', 'build-skill-ai-task-list.py', 'rollback-skill-ai-live.py',
];
for (const name of TEST_MAP) exportFile('tools/' + name, 'tests/' + name);
for (const name of ['run-package-tests.mjs', 'test-verify-zip.py']) {
	fs.copyFileSync(path.join(PRIOR, 'tests', name), path.join(STAGE, 'tests', name));
}
// docs：批二包 docs 原样 + 补修报告/命令（提交内容）
for (const name of ['REPORT.md', 'test-report.md', 'next-batches.md', 'README.md', '142-task-list.json', '142-task-list.csv', 'baseline.json']) {
	fs.copyFileSync(path.join(PRIOR, 'docs', name), path.join(STAGE, 'docs', name));
}
fs.mkdirSync(path.join(STAGE, 'docs/live-install'), { recursive: true });
for (const name of ['manifest.json', 'verification.json']) fs.copyFileSync(path.join(PRIOR, 'docs/live-install', name), path.join(STAGE, 'docs/live-install', name));
for (const name of ['REPAIR-REPORT.md', 'COMMANDS.md']) fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-repair-20261101', name), path.join(STAGE, 'docs', name));
/* COMMANDS.md 与批二包同构放在包根；docs/ 只保留 REPAIR-REPORT.md */
fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-repair-20261101', 'COMMANDS.md'), path.join(STAGE, 'COMMANDS.md'));
fs.rmSync(path.join(STAGE, 'docs', 'COMMANDS.md'), { force: true });
for (const name of ['deployment-plan.md', 'source-review.md']) fs.copyFileSync(path.join(PRIOR, 'deployment', name), path.join(STAGE, 'deployment', name));
// verify.py / 包内交付物
fs.copyFileSync(path.join(PRIOR, 'verify.py'), path.join(STAGE, 'verify.py'));
/* 清单构建脚本本身（可复核构建过程），与批二包 build-manifest.mjs 同位 */
fs.copyFileSync(path.join(REPO, 'tools', 'build-repair-package.mjs'), path.join(STAGE, 'build-repair-package.mjs'));

// 2) patches：补修净 diff + 全量 diff（3bb2434 补修基线 与 v4.4.4 上游基线）
const diffRepair = git(['diff', `${BASELINE}..HEAD`, '--binary', '--', 'score/decision/skills', 'tools/test-skill-ai-policies.mjs', 'tools/test-skill-ai-architecture.mjs', 'tools/skill-ai-hp-real-host.mjs', 'tools/bench-skill-ai-policies.mjs']);
fs.writeFileSync(path.join(STAGE, 'patches', `repair-3bb2434..${HEAD.slice(0, 7)}.diff`), diffRepair);
const diffFull = git(['diff', '1fe5292eb3022dd8d1db494617b21a12be912e61..HEAD', '--binary']);
fs.writeFileSync(path.join(STAGE, 'patches', `v4.4.4-baseline-1fe5292..${HEAD.slice(0, 7)}.diff`), diffFull);

// 3) evidence：本轮补修产物（缺失即提示，由调用方决定是否补跑）
const EVIDENCE_COPY = [
	'repair-range-native.json', 'repair-range-policy.json', 'repair-range-extension.json',
	'repair-manual-ui.json', 'repair-node-tests.json', 'repair-mode-doudizhu.json', 'repair-mode-versus.json',
	'repair-package-tests.log', 'repair-verify-zip.log',
];
for (const name of EVIDENCE_COPY) {
	const src = path.join(EVIDENCE, name);
	if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, 'evidence', name));
	else console.log('[build] missing evidence: ' + name);
}

// 4) manifest
const lastCommitFor = repoPath => {
	try { return git(['log', '-1', '--format=%h', '--', repoPath]) || null; } catch (e) { return null; }
};
const PURPOSE = {
	'source/score/index.js': '运行时入口：策略层 install/uninstall 接线（第一批引入，补修未改动）',
	'source/score/decision/skills/skillAIPolicies.js': '技能AI薄策略层宿主钩子（第一批+第二批+20261101补修：自救上限/次数四态）',
	'source/score/decision/skills/skillAIPolicyRules.js': '纯规则层：防御保留/箜声视图/reqimou收益档位与自救上限（含P1/P1-2/P2修复）',
	'tests/reqimou-manual-ui.mjs': 'reqimou 人类手动 UI 回归（真实点击路径，20261101补修新增）',
	'tests/verify-repair-outcomes.mjs': '补修宿主场景程序化验收脚本（20261101补修新增）',
	'tests/run-node-regressions.mjs': '批一41项Node回归聚合入口（20261101补修新增）',
	'tests/test-skill-ai-policies.mjs': '技能策略纯规则单元测试（41条，含补修11条）',
	'tests/test-skill-ai-architecture.mjs': '架构与134维模型契约测试（11条，含补修契约）',
	'tests/skill-ai-hp-real-host.mjs': '第二批独立页面运行器+补修场景/多目标夹具/支付探针',
	'tests/skill-ai-host-scenes.mjs': '第一批 41+ 场景宿主套件（未改动）',
	'tests/trick-real-host-smoke.mjs': '宿主场景/托管局公共运行器（未改动）',
	'tests/bench-skill-ai-policies.mjs': '策略纯规则微基准（含reqimou支付评估）',
	'tests/test-policy-model-v2-reachability.mjs': 'v2 模型可达性取证测试（未改动）',
	'tests/build-skill-ai-task-list.py': '142将技能级清单生成器（未改动）',
	'tests/rollback-skill-ai-live.py': '第一批试验安装回滚脚本（未改动）',
	'tests/run-package-tests.mjs': '包内可执行测试入口（审查补修新增，未改动）',
	'tests/test-verify-zip.py': 'verify.py --zip 多 manifest 回归测试（未改动）',
};
const repoPathOf = stagedPath => {
	if (stagedPath.startsWith('source/contract/')) return stagedPath.slice('source/contract/'.length);
	if (stagedPath.startsWith('source/')) return stagedPath.slice('source/'.length);
	if (stagedPath.startsWith('tests/')) return 'tools/' + stagedPath.slice('tests/'.length);
	if (stagedPath === 'docs/REPAIR-REPORT.md' || stagedPath === 'docs/COMMANDS.md') return 'docs/skill-ai-repair-20261101/' + stagedPath.slice('docs/'.length);
	return null;
};
const EVIDENCE_BATCH = {
	'repair-range-native.json': '补修后 reqimou/qimou 场景组（原生对照）',
	'repair-range-policy.json': '补修后 reqimou/qimou 场景组（仅策略层）',
	'repair-range-extension.json': '补修后 reqimou/qimou 场景组（完整扩展）',
	'repair-manual-ui.json': 'reqimou 人类手动 UI 回归（真实点击路径）',
	'repair-node-tests.json': '批一41项Node回归汇总',
	'repair-mode-doudizhu.json': '三模式托管（斗地主）',
	'repair-mode-versus.json': '三模式托管（2V2）',
	'repair-package-tests.log': '包内测试入口运行日志',
	'repair-verify-zip.log': 'verify.py --zip 回归日志',
};
const files = [];
const walk = rel => {
	const full = path.join(STAGE, rel);
	if (!fs.existsSync(full)) return;
	for (const name of fs.readdirSync(full, { withFileTypes: true })) {
		const child = rel ? rel + '/' + name.name : name.name;
		if (name.isDirectory()) { walk(child); continue; }
		if (child === 'manifest.json') continue;
		const hash = fileHash(path.join(full, name.name));
		const isEvidence = child.startsWith('evidence/');
		const packageOnly = child === 'tests/run-package-tests.mjs';
		const repoPath = isEvidence ? null : repoPathOf(child);
		files.push({
			path: child,
			size: hash.size,
			sha256: hash.sha256,
			commit: (isEvidence || packageOnly || !repoPath || child.startsWith('patches/')) ? null : (lastCommitFor(repoPath) || HEAD.slice(0, 7)),
			batch: isEvidence ? (EVIDENCE_BATCH[path.basename(child)] || '运行产物') : (child.startsWith('patches/') ? '第一批+第二批+补修' : '第一批+第二批+补修'),
			purpose: isEvidence ? '真实宿主/Node 运行原始产物（未修改）' : (PURPOSE[child] || (child.startsWith('patches/') ? 'git diff（基线→补修HEAD）' : '')),
		});
	}
};
for (const dir of ['source', 'patches', 'tests', 'docs', 'evidence']) walk(dir);
for (const p of ['COMMANDS.md', 'verify.py']) {
	const hash = fileHash(path.join(STAGE, p));
	files.push({ path: p, size: hash.size, sha256: hash.sha256, commit: null, batch: '交付物', purpose: p === 'COMMANDS.md' ? '测试复现命令' : '独立 SHA256 校验脚本' });
}
{
	const hash = fileHash(path.join(STAGE, 'deployment/deployment-plan.md'));
	files.push({ path: 'deployment/deployment-plan.md', size: hash.size, sha256: hash.sha256, commit: null, batch: '交付物', purpose: '第二批→安装目录部署计划（补修沿用，不改变部署方式）' });
	const hash2 = fileHash(path.join(STAGE, 'deployment/source-review.md'));
	files.push({ path: 'deployment/source-review.md', size: hash2.size, sha256: hash2.sha256, commit: null, batch: '交付物', purpose: '第二批源码交付前审查记录（补修沿用）' });
	const hash3 = fileHash(path.join(STAGE, 'build-repair-package.mjs'));
	files.push({ path: 'build-repair-package.mjs', size: hash3.size, sha256: hash3.sha256, commit: HEAD.slice(0, 7), batch: '交付物', purpose: '本清单生成脚本（可复核清单构建过程）' });
}
files.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
	schema_version: '1.0',
	generated_at: new Date().toISOString(),
	package: {
		name: 'feisheng-ai-skill-audit-repair-20261101',
		head: HEAD,
		head_tag: 'skill-ai-repair-20261101',
		baseline_commit: BASELINE,
		baseline_tag: 'skill-ai-20261031',
		baseline_upstream: '1fe5292eb3022dd8d1db494617b21a12be912e61',
		review_fix_commits: ['356d487', '3bb2434'],
		repair_commit: HEAD.slice(0, 7),
		extension_version: '4.4.4',
		host_version: '1.11.7',
		prior_package: 'feisheng-ai-skill-audit-batch1-batch2（HEAD 3bb2434，2026-10-31 补修重发版）',
		notes: 'source/ 与 tests/ 为 git show 导出的提交内容；docs/REPAIR-REPORT.md 与 COMMANDS.md 为提交内容；evidence/ 为实际运行产物，不在 Git 内。',
	},
	files,
};
fs.writeFileSync(path.join(STAGE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest files:', files.length);
console.log('head:', HEAD);
console.log('stage:', STAGE);
