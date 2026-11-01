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
// source：共享核心 + 分包模块/规则 + facade/注册表 + 只读契约子集
for (const repoPath of [
	'score/decision/skills/policyCore.js',
	'score/decision/skills/skillAIPolicies.js',
	'score/decision/skills/skillAIPolicyPacks.js',
	'score/decision/skills/skillAIPolicyRules.js',
	'score/decision/skills/packs/outOfScope.js',
	'score/decision/skills/packs/refreshStandard.js',
	'score/decision/skills/packs/shenhuaLei.js',
	'score/decision/skills/packs/shenhuaFeng.js',
	'score/decision/skills/packs/refreshFeng.js',
	'score/decision/skills/rules/outOfScope.js',
	'score/decision/skills/rules/refreshStandard.js',
	'score/decision/skills/rules/shenhuaLei.js',
	'score/decision/skills/rules/shenhuaFeng.js',
	'score/decision/skills/rules/refreshFeng.js',
	'score/index.js',
]) exportFile(repoPath, 'source/' + repoPath);
for (const repoPath of [
	'extension.js',
	'info.json',
	'score/model/features/dimensionAdapter.js',
	'score/model/features/features.js',
	'score/model/net/policyModelV2.js',
]) exportFile(repoPath, 'source/contract/' + repoPath);
// tests：tools/ 导出映射 + 包内交付物
const TEST_MAP = [
	'test-skill-ai-policies.mjs', 'test-skill-ai-architecture.mjs', 'skill-ai-hp-real-host.mjs',
	'skill-ai-host-scenes.mjs', 'trick-real-host-smoke.mjs', 'reqimou-manual-ui.mjs',
	'verify-repair-outcomes.mjs', 'run-node-regressions.mjs', 'bench-skill-ai-policies.mjs',
	'test-policy-model-v2-reachability.mjs', 'build-skill-ai-task-list.py', 'rollback-skill-ai-live.py',
	'build-skill-ai-acceptance-ledger.mjs', 'run-package-tests.mjs', 'test-verify-zip.py',
];
for (const name of TEST_MAP) exportFile('tools/' + name, 'tests/' + name);
for (const name of ['build-skill-ai-pack.mjs', 'skill-ai-pack-config.mjs', 'zip-package.py']) {
	exportFile('tools/' + name, 'pack-tools/' + name);
}
for (const name of fs.readdirSync(path.join(REPO, 'tools', 'pack-templates'))) {
	exportFile('tools/pack-templates/' + name, 'pack-tools/templates/' + name);
}
// docs：批二包 docs 原样 + 补修报告/命令（提交内容）
for (const name of ['REPORT.md', 'test-report.md', 'baseline.json']) {
	fs.copyFileSync(path.join(PRIOR, 'docs', name), path.join(STAGE, 'docs', name));
}
for (const name of ['README.md', 'next-batches.md', '142-task-list.json', '142-task-list.csv', 'pack-delivery.json', 'PACK-MECHANISM.md']) {
	fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-20261030', name), path.join(STAGE, 'docs', name));
}
fs.mkdirSync(path.join(STAGE, 'docs/live-install'), { recursive: true });
for (const name of ['manifest.json', 'verification.json']) fs.copyFileSync(path.join(PRIOR, 'docs/live-install', name), path.join(STAGE, 'docs/live-install', name));
for (const name of ['REPAIR-REPORT.md', 'COMMANDS.md']) fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-repair-20261101', name), path.join(STAGE, 'docs', name));
/* COMMANDS.md 与批二包同构放在包根；docs/ 只保留 REPAIR-REPORT.md */
fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-repair-20261101', 'COMMANDS.md'), path.join(STAGE, 'COMMANDS.md'));
fs.rmSync(path.join(STAGE, 'docs', 'COMMANDS.md'), { force: true });
for (const name of ['deployment-plan.md', 'source-review.md']) fs.copyFileSync(path.join(REPO, 'docs', 'skill-ai-repair-20261101', name), path.join(STAGE, 'deployment', name));
// verify.py / 包内交付物
fs.copyFileSync(path.join(REPO, 'tools', 'verify.py'), path.join(STAGE, 'verify.py'));
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
	'repair-flaky-retest-1.json', 'repair-flaky-retest-2.json', 'repair-flaky-retest-3.json',
	'repair-flaky-retest-4.json', 'repair-flaky-retest-5.json', 'repair-flaky-retest-6.json',
	'repair-flaky-retest-7.json', 'repair-flaky-retest-8.json',
	'repair-final-retest-native.json', 'repair-final-retest-policy.json', 'repair-final-retest-extension.json',
	'repair-acceptance-ledger.json', 'repair-acceptance-ledger.md',
	'split-suite-native.json', 'split-suite-policy.json', 'split-suite-extension.json',
	'split-range-native.json', 'split-range-policy.json', 'split-range-extension.json',
	'split-retest-native.json', 'split-retest-policy.json', 'split-manual-ui.json',
	'repair-manual-ui.json', 'repair-node-tests.json', 'repair-mode-doudizhu.json', 'repair-mode-versus.json',
	'repair-verify-zip.log',
];
for (const name of EVIDENCE_COPY) {
	const src = path.join(EVIDENCE, name);
	if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, 'evidence', name));
	else console.log('[build] missing evidence: ' + name);
	const log = path.join(EVIDENCE, name.replace(/\.(json|md)$/, '.log'));
	if (fs.existsSync(log)) fs.copyFileSync(log, path.join(STAGE, 'evidence', path.basename(log)));
}
for (const name of ['split-retest-extension.log']) {
	const src = path.join(EVIDENCE, name);
	if (fs.existsSync(src)) fs.copyFileSync(src, path.join(STAGE, 'evidence', name));
}
// 包内测试入口与 verify 回归：真实执行后写入 evidence（不伪造日志）
const pkgTests = execFileSync(process.execPath, ['tests/run-package-tests.mjs'], { cwd: STAGE, encoding: 'utf8', timeout: 180000 });
fs.writeFileSync(path.join(STAGE, 'evidence', 'repair-package-tests.log'), pkgTests);
const zipRegression = execFileSync('python', ['tests/test-verify-zip.py'], { cwd: STAGE, encoding: 'utf8', timeout: 120000 });
fs.writeFileSync(path.join(STAGE, 'evidence', 'repair-verify-zip-regression.log'), zipRegression);

// 4) manifest
const lastCommitFor = repoPath => {
	try { return git(['log', '-1', '--format=%h', '--', repoPath]) || null; } catch (e) { return null; }
};
const PURPOSE = {
	'source/score/index.js': '运行时入口：策略层 install/uninstall 接线（第一批引入，分包化未改动）',
	'source/score/decision/skills/policyCore.js': '共享核心：安装/卸载/备份/统计/宿主只读助手（分包化新增）',
	'source/score/decision/skills/skillAIPolicies.js': 'facade：只调用共享核心与注册表（分包化改造）',
	'source/score/decision/skills/skillAIPolicyPacks.js': '分包注册表（带 @djsc-pack-* 合并 marker）',
	'source/score/decision/skills/skillAIPolicyRules.js': '规则聚合出口（仅测试/兼容 import，不参与运行时）',
	'source/score/decision/skills/packs/outOfScope.js': '清单外 redimeng 策略模块',
	'source/score/decision/skills/packs/refreshStandard.js': '界限突破·标准策略模块（rezhiheng/new_retuxi）',
	'source/score/decision/skills/packs/shenhuaLei.js': '神话再临·雷策略模块（olkongsheng）',
	'source/score/decision/skills/packs/shenhuaFeng.js': '神话再临·风策略模块（qimou）',
	'source/score/decision/skills/packs/refreshFeng.js': '界限突破·风策略模块（reqimou）',
	'source/score/decision/skills/rules/outOfScope.js': 'redimeng 纯规则',
	'source/score/decision/skills/rules/refreshStandard.js': '界制衡/界突袭纯规则',
	'source/score/decision/skills/rules/shenhuaLei.js': '箜声纯规则',
	'source/score/decision/skills/rules/shenhuaFeng.js': '奇谋纯规则',
	'source/score/decision/skills/rules/refreshFeng.js': 'OL奇谋纯规则',
	'tests/reqimou-manual-ui.mjs': 'reqimou 人类手动 UI 回归（真实点击路径）',
	'tests/verify-repair-outcomes.mjs': '补修宿主场景程序化验收脚本',
	'tests/run-node-regressions.mjs': '批一41项Node回归聚合入口',
	'tests/test-skill-ai-policies.mjs': '技能策略纯规则单元测试（42条）',
	'tests/test-skill-ai-architecture.mjs': '架构/分包归属/134维模型契约测试（15条）',
	'tests/skill-ai-hp-real-host.mjs': '第二批独立页面运行器+补修场景/多目标夹具/支付探针',
	'tests/skill-ai-host-scenes.mjs': '第一批宿主套件',
	'tests/trick-real-host-smoke.mjs': '宿主场景/托管局公共运行器',
	'tests/bench-skill-ai-policies.mjs': '策略纯规则微基准（含reqimou支付评估）',
	'tests/test-policy-model-v2-reachability.mjs': 'v2 模型可达性取证测试',
	'tests/build-skill-ai-task-list.py': '142将技能级/分包级清单生成器（schema 4.0）',
	'tests/rollback-skill-ai-live.py': '第一批试验安装回滚脚本',
	'tests/build-skill-ai-acceptance-ledger.mjs': '逐场景尝试合并台账生成器',
	'tests/run-package-tests.mjs': '包内可执行测试入口（纯规则+架构）',
	'tests/test-verify-zip.py': 'verify.py --zip 跨平台路径回归',
	'pack-tools/build-skill-ai-pack.mjs': '分包 ZIP 构建器（可复核构建过程）',
	'pack-tools/skill-ai-pack-config.mjs': '分包代码/证据/场景配置',
	'pack-tools/zip-package.py': '可复现 ZIP 打包器（固定时间戳/排序）',
	'pack-tools/templates/apply-pack.mjs': '分包安全集成脚本模板',
	'pack-tools/templates/rollback-pack.mjs': '分包回滚脚本模板',
	'pack-tools/templates/run-pack-tests.mjs': '分包包内测试入口模板',
	'pack-tools/templates/test-pack-architecture.mjs': '分包架构/134维契约测试模板',
};
const repoPathOf = stagedPath => {
	if (stagedPath.startsWith('source/contract/')) return stagedPath.slice('source/contract/'.length);
	if (stagedPath.startsWith('source/')) return stagedPath.slice('source/'.length);
	if (stagedPath.startsWith('tests/')) return 'tools/' + stagedPath.slice('tests/'.length);
	if (stagedPath.startsWith('pack-tools/templates/')) return 'tools/pack-templates/' + stagedPath.slice('pack-tools/templates/'.length);
	if (stagedPath.startsWith('pack-tools/')) return 'tools/' + stagedPath.slice('pack-tools/'.length);
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
	'repair-flaky-retest-1.json': '历史重跑 1（未删除失败）',
	'repair-flaky-retest-2.json': '历史重跑 2（含超时）',
	'repair-flaky-retest-3.json': '历史重跑 3（含超时）',
	'repair-flaky-retest-4.json': '历史重跑 4',
	'repair-flaky-retest-5.json': '历史重跑 5',
	'repair-flaky-retest-6.json': '历史重跑 6（含超时）',
	'repair-flaky-retest-7.json': '历史重跑 7',
	'repair-flaky-retest-8.json': '历史重跑 8',
	'repair-final-retest-native.json': '复核重跑（native，multi2 仍超时）',
	'repair-final-retest-policy.json': '复核重跑（policy）',
	'repair-final-retest-extension.json': '复核重跑（extension）',
	'repair-acceptance-ledger.json': '逐场景尝试合并台账（不隐藏历史失败）',
	'repair-acceptance-ledger.md': '逐场景尝试合并台账（可读版）',
	'split-suite-native.json': '分包化后原生宿主套件',
	'split-suite-policy.json': '分包化后仅策略宿主套件',
	'split-suite-extension.json': '分包化后完整扩展宿主套件',
	'split-range-native.json': '分包化后 21 场景原生对照（含超时）',
	'split-range-policy.json': '分包化后 21 场景仅策略（含超时）',
	'split-range-extension.json': '分包化后 21 场景完整扩展（含超时）',
	'split-retest-native.json': '分包化后 native 超时场景重跑成功',
	'split-retest-policy.json': '分包化后 policy 超时场景重跑（仍超时）',
	'split-manual-ui.json': '分包化后 reqimou 人类手动 UI 回归',
	'repair-package-tests.log': '包内测试入口运行日志（构建时实际执行）',
	'repair-verify-zip-regression.log': 'verify.py 跨平台回归日志（构建时实际执行）',
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
		const isPackTool = child.startsWith('pack-tools/');
		const packageOnly = child === 'tests/run-package-tests.mjs';
		const repoPath = isEvidence ? null : repoPathOf(child);
		const batch = isEvidence ? (EVIDENCE_BATCH[path.basename(child)] || '运行产物') : (isPackTool ? '分包机制' : (child.startsWith('patches/') ? '第一批+第二批+补修' : '第一批+第二批+补修'));
		files.push({
			path: child,
			size: hash.size,
			sha256: hash.sha256,
			commit: (isEvidence || packageOnly || !repoPath || child.startsWith('patches/')) ? null : (lastCommitFor(repoPath) || HEAD.slice(0, 7)),
			batch,
			purpose: isEvidence ? '真实宿主/Node 运行原始产物（未修改）' : (PURPOSE[child] || (isPackTool ? '分包机制工具/模板' : (child.startsWith('patches/') ? 'git diff（基线→补修HEAD）' : ''))),
		});
	}
};
for (const dir of ['source', 'patches', 'tests', 'docs', 'evidence', 'pack-tools']) walk(dir);
for (const p of ['COMMANDS.md', 'verify.py']) {
	const hash = fileHash(path.join(STAGE, p));
	files.push({ path: p, size: hash.size, sha256: hash.sha256, commit: null, batch: '交付物', purpose: p === 'COMMANDS.md' ? '测试复现命令' : '独立 SHA256 校验脚本' });
}
{
	const hash = fileHash(path.join(STAGE, 'deployment/deployment-plan.md'));
	files.push({ path: 'deployment/deployment-plan.md', size: hash.size, sha256: hash.sha256, commit: null, batch: '交付物', purpose: '分包化后的安装目录部署/回滚计划（未执行覆盖）' });
	const hash2 = fileHash(path.join(STAGE, 'deployment/source-review.md'));
	files.push({ path: 'deployment/source-review.md', size: hash2.size, sha256: hash2.sha256, commit: null, batch: '交付物', purpose: '源码交付前审查记录（含分包化补充审查）' });
	const hash3 = fileHash(path.join(STAGE, 'build-repair-package.mjs'));
	files.push({ path: 'build-repair-package.mjs', size: hash3.size, sha256: hash3.sha256, commit: HEAD.slice(0, 7), batch: '交付物', purpose: '本清单生成脚本（可复核清单构建过程）' });
}
files.sort((a, b) => a.path.localeCompare(b.path));

const packDelivery = fs.existsSync(path.join(REPO, 'docs', 'skill-ai-20261030', 'pack-delivery.json'))
	? JSON.parse(fs.readFileSync(path.join(REPO, 'docs', 'skill-ai-20261030', 'pack-delivery.json'), 'utf8'))
	: { packs: [] };
const manifest = {
	schema_version: '1.0',
	generated_at: git(['show', '-s', '--format=%cI', 'HEAD']),
	package: {
		name: 'feisheng-ai-skill-audit-repair-20261101',
		scope: '补修证据收尾 + 分包任务结构/打包机制 + 已完成策略的分包化',
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
		pack_mechanism: {
			task_list_schema: '4.0',
			pack_count: 16,
			code_packs: ['refresh_standard', 'shenhua_feng', 'refresh_feng', 'shenhua_lei', 'out_of_scope'],
			stage_packages: packDelivery.packs.filter(item => item.status === '阶段性').map(item => item.zip_name || item.pack_id),
			complete_delivery: false,
		},
		notes: 'source/ 与 tests/ 为 git show 导出的提交内容；docs/REPAIR-REPORT.md 与 COMMANDS.md 为提交内容；evidence/ 为实际运行产物，不在 Git 内；stage 包不代表完整分包交付。',
	},
	files,
};
fs.writeFileSync(path.join(STAGE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('manifest files:', files.length);
console.log('head:', HEAD);
console.log('stage:', STAGE);
