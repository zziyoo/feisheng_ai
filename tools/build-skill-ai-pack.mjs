#!/usr/bin/env node
// 按分包生成独立交付 ZIP。用法：
//   node tools/build-skill-ai-pack.mjs --pack refresh_standard
//   node tools/build-skill-ai-pack.mjs --all
// 默认只接受干净工作区（source/tests 用 git show HEAD 导出）；测试期可用 --worktree-source。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const HERE = path.dirname(fileURLToPath(import.meta.url));
const GIT = option('git') || process.env.DJSC_GIT || 'git';
const REPO = path.resolve(option('repo') || process.env.DJSC_REPO || path.join(HERE, '..'));
const TASK_PATH = path.join(REPO, 'docs', 'skill-ai-20261030', '142-task-list.json');
const EVIDENCE = path.resolve(option('evidence') || process.env.DJSC_EVIDENCE || path.join(REPO, 'docs', 'skill-ai-repair-20261101', 'evidence'));
const OUT = path.resolve(option('out') || process.env.DJSC_PACK_OUT || path.join(REPO, '..', 'feisheng-ai-packs'));
const STAGE_ROOT = path.resolve(option('stage-root') || process.env.DJSC_PACK_STAGE || path.join(OUT, '.stage'));
const BASELINE = option('baseline') || process.env.DJSC_BASELINE || '1fe5292eb3022dd8d1db494617b21a12be912e61';
const ALL_REGISTERED = ['rezhiheng', 'new_retuxi', 'qimou', 'reqimou', 'olkongsheng', 'redimeng', 'xinkuanggu', 'luanji', 'jushou', 'xinshensu', 'xinfu_guhuo', 'huangtian'];
const useWorktree = args.includes('--worktree-source');
if (!fs.existsSync(TASK_PATH)) throw new Error(`仓库缺少任务清单：${TASK_PATH}；请用 --repo 指向无名AI仓库根目录`);

const git = (params, encoding = 'utf8') => {
	try {
		return execFileSync(GIT, params, { cwd: REPO, encoding, maxBuffer: 1024 * 1024 * 128 });
	} catch (error) {
		throw new Error(`git 调用失败（${GIT}）：${error.message}；请安装 Git 或用 --git 指定可执行文件`);
	}
};
const HEAD = git(['rev-parse', 'HEAD']).trim();
const dirty = git(['status', '--porcelain']).trim();
if (dirty && !useWorktree) throw new Error('工作区不干净；请先提交，或仅测试时使用 --worktree-source');
const sourceOf = repoPath => useWorktree ? fs.readFileSync(path.join(REPO, repoPath)) : git(['show', `${HEAD}:${repoPath}`], null);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const textOf = repoPath => sourceOf(repoPath).toString('utf8');
const { evaluateDualAcceptance } = await import('data:text/javascript;base64,' + sourceOf('tools/dual-feng-acceptance.mjs').toString('base64'));
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
// 配置及任务清单同样来自本次选择的源码版本；外部证据仍独立读取。
const { CODE_PACKS } = await import('data:text/javascript;base64,' + sourceOf('tools/skill-ai-pack-config.mjs').toString('base64'));
const selected = option('pack') ? [option('pack')] : (args.includes('--all') ? CODE_PACKS.map(item => item.id) : []);
if (!selected.length) throw new Error('usage: --pack <id> | --all [--repo <dir>] [--evidence <dir>] [--out <dir>] [--stage-root <dir>] [--git <git>]');
if (selected.some(id => id !== 'shenhua_feng' && id !== 'shenhua_lei' && id !== 'refresh_feng' && id !== 'refresh_standard') && !fs.existsSync(EVIDENCE)) throw new Error(`证据目录不存在：${EVIDENCE}；请用 --evidence 指定`);
const task = JSON.parse(textOf('docs/skill-ai-20261030/142-task-list.json'));
const taskPacks = Object.fromEntries((task.packs || []).map(pack => [pack.pack_id, pack]));
const taskRecords = task.records || [];
const generatedAt = git(['show', '-s', '--format=%cI', HEAD]).trim();
const short = HEAD.slice(0, 7);
const sourcePaths = new Map();
const write = (stage, rel, data) => {
	const full = path.join(stage, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, data);
	sourcePaths.delete(rel);
};
const copyRepo = (stage, repoPath, rel) => { write(stage, rel, sourceOf(repoPath)); sourcePaths.set(rel, repoPath); };
const copyDisk = (stage, source, rel) => write(stage, rel, fs.readFileSync(source));
const hashFile = file => { const data = fs.readFileSync(file); return { size: data.length, sha256: sha(data) }; };

const CONSTRAINTS = {
	refresh_standard: {
		required: ['TARGET_POLICIES', 'retuxiHandBonus', 'DEFENSE_RULES'],
		forbidden: ['get.value(button'],
	},
	shenhua_feng: {
		required: ['shouldBypassQimouCountBlock', 'lib.filter.cardUsable', 'kuangguChoice', 'jushouShouldActivate', 'shensu1ShouldUse', 'guhuoShouldBluff', 'huangtianShouldGive'],
		forbidden: ['reqimou'],
	},
	shenhua_huo: {
		required: ['luanjiAllyLethal'],
		forbidden: ['lianhuan', 'lianhuanLinkedTargetSkip', 'get.value(button'],
	},
	refresh_feng: {
		required: ['reqimouOptimalX', 'player.getAttackRange()', 'player.canSaveCard(card, player)'],
		forbidden: ['player.attackRange', "getCardUsable('sha') || 1"],
	},
	shenhua_lei: {
		required: ['olkongshengCostNeedsFix', 'olkongshengExpansionView'],
		forbidden: ['get.value(button'],
	},
	out_of_scope: {
		required: ['shouldMaskHiddenButtonChoice', 'fairButtonScore', 'redimengFindNeedsFix'],
		forbidden: ['get.value(button'],
	},
};

function recordsFor(packId) {
	if (packId === 'out_of_scope') return [{ out_of_scope: true, ...(task.out_of_scope_findings || []).find(item => item.skill_id === 'redimeng') }];
	return taskRecords.filter(record => record.pack_id === packId);
}

function checklistMarkdown(pack, records) {
	const levels = {};
	for (const record of records) {
		const skills = record.out_of_scope ? record.skill_statuses : record.skills;
		for (const skill of skills) {
			const level = skill.validation_level || '未标注';
			levels[level] = (levels[level] || 0) + 1;
		}
	}
	const externalReceipt = pack.delivery && pack.delivery.external_integration_receipt;
	const externalText = externalReceipt === 'pending' ? '待取得（可交付外部集成，未声明已交付）' : (externalReceipt || '未登记');
	const lines = [`# ${pack.pack_name} 技能验收清单`, '', `- 分包状态：${pack.review_status}`, `- 交付状态：${pack.delivery_status}`, `- 完整可交付：${pack.can_mark_deliverable ? '是' : '否'}`, `- 外部集成回执：${externalText}`, `- 验证级别汇总：${Object.entries(levels).map(([level, count]) => `${level} ${count}`).join('；')}`, ''];
	lines.push('| 武将 | 技能ID | 技能 | 审查状态 | 验证级别 | 实现 | 测试 | 证据摘要 |');
	lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
	for (const record of records) {
		if (record.out_of_scope) {
			const skill = record.skill_statuses[0];
			lines.push(`| ${record.character} | ${skill.id} | ${skill.name} | ${skill.status} | ${skill.validation_level || '-'} | ${skill.implementation} | ${skill.test} | ${String(skill.evidence || '').replace(/\|/g, '/').slice(0, 120)} |`);
			continue;
		}
		for (const skill of record.skills) {
			lines.push(`| ${record.character_name} (${record.character_id}) | ${skill.id} | ${skill.name} | ${skill.status} | ${skill.validation_level || '-'} | ${skill.implementation} | ${skill.test} | ${String(skill.evidence || '').replace(/\|/g, '/').slice(0, 120)} |`);
		}
	}
	return lines.join('\n') + '\n';
}

function readme(pack, config, evidenceNames) {
	const missing = pack.counts.unreviewed_skills;
	const deliverable = !!pack.can_mark_deliverable && ['可交付', '已交付'].includes(pack.delivery_status);
	const reviewOnly = config.implementedSkills.length === 0;
	const externalReceipt = pack.delivery && pack.delivery.external_integration_receipt;
	const externalNote = externalReceipt === 'pending'
		? '\n**外部集成回执：待取得。** 本包已完成质量审查并可交付外部开发者集成；尚未收到外部集成回执，因此不作为“已交付”声明。\n'
		: '';
	const nativePatchEvidence = evidenceNames.some(name => name.startsWith('wind-native/'))
		? 'wind-native'
		: evidenceNames.some(name => name.startsWith('huo-native/')) ? 'huo-native' : null;
	const nativePatchNote = nativePatchEvidence
		? `
## 原生 AI 补丁（与扩展分包二选一）

本包同时提供宿主原生 AI 补丁 \`evidence/${nativePatchEvidence}/${nativePatchEvidence}.patch\`（以及逐武将补丁），适用于宿主 1.11.7 \`character/shenhua.js\`；基线/最终 SHA256 见 \`evidence/${nativePatchEvidence}/SHA256.json\`。

- **方式 A：无名AI 扩展分包**：按下方“集成”安装 \`source/...\` 策略模块，由扩展的 \`host.wrap\` 接管 AI。
- **方式 B：宿主原生 AI 补丁**：只对宿主的 \`character/shenhua.js\` 应用 \`evidence/${nativePatchEvidence}/${nativePatchEvidence}.patch\` 或逐武将补丁，不安装本扩展分包。

不要在同一个宿主同时应用原生补丁并安装本分包：两者会重复接管同一 AI 入口，后续维护可能出现两处逻辑漂移。扩展虽然会在原生结果上做幂等判断，不会重复扣血/摸牌，但这不等于应当同时启用。原生补丁只修改 AI 决策函数，不改技能规则、目标合法性、伤害/回复结算或非 AI 流程。
`
		: '';
	const nativeRouteNote = config.id === 'out_of_scope'
		? `
## 部署路线限制（out_of_scope）

本包只有扩展路线。宿主 1.11.7 原生 \`redimeng.find(2)\` 仍会抛 \`ReferenceError\`，本包不提供原生补丁；不要把本包与任何原生补丁或其他分包重复接管同一入口。原生/扩展覆盖差异见交付目录 \`ACCEPTANCE.md\`。
`
		: '';
	const intro = deliverable
		? (reviewOnly
			? `**完整复核包。** 本包登记 ${pack.counts.characters} 名武将、${pack.counts.skills} 个技能已全部审查；复核后未发现需要覆盖的 AI 缺陷，因此本包不包含运行时策略覆盖。
源码、完整回归、安装/卸载/回滚、文件校验均已通过。Android 真机长跑等公开发版门槛不因本包单独通过而解除。`
			: `**完整可交付包。** 本包登记 ${pack.counts.characters} 名武将、${pack.counts.skills} 个技能已全部审查，缺陷已解决且无阻塞项；
源码、完整回归、安装/卸载/回滚、文件校验均已通过。Android 真机长跑等公开发版门槛不因本包单独通过而解除。`)
		: `**阶段性包，不是完整交付。** 本包只交付已实现并有真实宿主证据的策略代码；
当前登记 ${pack.counts.characters} 名武将、${pack.counts.skills} 个技能，仍有 ${missing} 个技能未审查。
只有这些技能全部审查、缺陷解决且无阻塞项后，才能标记完整可交付。`;
	return `# ${pack.pack_name} · 无名AI 技能 AI 分包（${deliverable ? '可交付' : '阶段性'}）

> ${intro}
${externalNote}
- 分包 ID：\`${pack.pack_id}\`
- 分包状态：\`${pack.review_status}\`
- 交付状态：\`${pack.delivery_status}\`
- 外部集成回执：\`${externalReceipt || '未登记'}\`
- 基线：\`${BASELINE}\`；HEAD：\`${HEAD}\`
- 已实现策略：${config.implementedSkills.length ? config.implementedSkills.map(id => '`' + id + '`').join('、') : '无（复核包，不覆盖宿主 AI）'}
- 版本：无名AI 4.4.4 / 无名杀 1.11.7；134 维模型契约未改

## 代码交付

- \`source/score/decision/skills/policyCore.js\`：共享核心（生命周期/备份/统计）
- \`source/score/decision/skills/skillAIPolicies.js\`：共享 facade
- \`source/score/decision/skills/skillAIPolicyPacks.js\`：只含本分包的注册表（独立解压可 import）
- \`source/score/decision/skills/packs/${config.module}.js\`：本分包策略模块
- \`source/score/decision/skills/rules/${config.rules}.js\`：本分包纯规则
- \`integration/pack-only/skillAIPolicyPacks.js\`：只包含本分包的注册表

**不包含**其他分包未完成的策略代码、模型权重、训练数据、后端配置或完整扩展包。
${nativePatchNote}${nativeRouteNote}
## 集成

目标必须是已接入无名AI策略 facade 的扩展（\`score/index.js\` 含 \`installSkillAIPolicies\`/\`uninstallSkillAIPolicies\`；否则先应用 \`patches/score-index.diff\`）。

\`\`\`bash
node integration/apply-pack.mjs --extension-root <无名AI根目录> --dry-run
node integration/apply-pack.mjs --extension-root <无名AI根目录>
\`\`\`

apply-pack 会一并写入共享模块 \`score/decision/skills/skillVetoRegistry.js\`（分包运行时依赖，缺失则分包无法加载）。

### 完整引擎接线（可选，仅完整扩展需要）

分包运行时依赖 \`skillVetoRegistry.js\` 已随 apply-pack 写入；若目标还运行**完整决策引擎**（score/decision/engine），需再执行可选接线脚本，让引擎候选层/staging 层尊重分包动态否决：

\`\`\`bash
node integration/apply-engine-wiring.mjs --extension-root <无名AI根目录> --dry-run
node integration/apply-engine-wiring.mjs --extension-root <无名AI根目录>          # 幂等；备份到 .djsc-pack-backups/engine-wiring/
node integration/apply-engine-wiring.mjs --extension-root <无名AI根目录> --rollback
\`\`\`

接线只新增三处 import 与查询调用（skillPlayBrain.vetoSkill 规则⑤、activeSkillEligibility 枚举过滤、override/use.js staging 守卫），不改任何既有判断；逐文件备份、应用后 node --check 校验、失败自动恢复。仅使用策略层（policyOnly）时无需本步。

脚本只新增本分包文件，并在共享注册表的 \`@djsc-pack-*\` marker 内追加一行；
共享核心与目标版本不一致时拒绝覆盖并退出，避免覆盖其他开发者修改。
若目标没有注册表，会写入只含本分包的注册表。多个分包同时启用时，后续分包只追加自己的注册行。
安装前会预检注册表引用的模块是否存在，并把将被修改的注册表备份到 \`.djsc-pack-backups/<pack>/\`；
任一步写入失败会恢复安装前状态。重复安装为幂等操作。

回滚只撤销本包安装记录内且未被他人修改的文件，并只移除本包的注册行；不会覆盖其他分包或开发者后续修改。
回滚最后一个分包时保留带 marker 的空注册表，保证共享 facade 仍可加载；共享核心不会被删除。

回滚：

\`\`\`bash
node integration/rollback-pack.mjs --extension-root <无名AI根目录>
\`\`\`

回滚只删除本包安装记录内且未被他人修改的文件，并只移除本包的注册行；不会覆盖其他分包。

## 测试

\`\`\`bash
node tests/run-pack-tests.mjs          # 本分包纯规则 + 分包架构/134维契约
python tests/test-verify-zip.py        # verify.py 跨平台 ZIP 路径回归
python verify.py --zip <本包.zip>      # 全文件 SHA256
\`\`\`

宿主场景（需要完整无名杀宿主与 Playwright）：

\`\`\`bash
# hp-real-host 只识别其 SCENARIOS 表中的 qimou/reqimou/qiangxi/kurou 等场景；
# 第一批场景（rezhiheng/retuxi/redimeng/olkongsheng 等）用 smoke 的完整套件。
node tests/skill-ai-hp-real-host.mjs --mode identity --variant policy --scenarios "$(node -e "console.log(require('./pack.json').scenes.join(','))")" --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright> --output policy.json
node tests/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>
\`\`\`

运行器默认抑制宿主 \`game.over\` 胜负对话框（\`--allow-game-over\` 可关闭）；技能机制场景不测试胜负 UI。\`--trace\` 打开 Worker 心跳、CDP 进程 CPU 与阶段 mark。

## 证据与限制

包内 \`evidence/\` 为原始运行产物；\`evidence/acceptance-ledger.json\`（若存在）逐场景列出初次成功、超时失败、重跑与最终未解决数量。
逐包/共存验收结果由 \`tools/accept-skill-ai-pack.mjs\` 对**实际 ZIP** 生成，随交付目录的 \`accept-<pack>.json\`、\`accept-combined.json\`、\`pack-acceptance-matrix.md\` 提供（不放进包内，避免 ZIP 自引用导致哈希漂移）。
宿主运行器默认抑制宿主 \`game.over\` 胜负对话框（\`--allow-game-over\` 可关闭），技能机制场景不测试胜负 UI；这是夹具控制，不改变技能或断言。
本包不宣称长期性能、全 142 将完成或 Android 长跑通过；这些仍是后续发布门槛。

## 文件完整性

\`manifest.json\` 记录每个文件的尺寸、SHA256、来源提交与用途；\`verify.py\` 可独立复核。
生成时间：${generatedAt}；构建方式：${useWorktree ? '工作区内容（仅测试）' : 'git show HEAD'}。
证据文件：${evidenceNames.length} 个。
`;
}

function buildPack(config) {
	sourcePaths.clear();
	const pack = taskPacks[config.id];
	if (!pack) throw new Error('task list missing pack: ' + config.id);
	const windCandidate = config.id === 'shenhua_feng';
	const leiCandidate = config.id === 'shenhua_lei';
	const refreshFengCandidate = config.id === 'refresh_feng';
	const standardCandidate = config.id === 'refresh_standard';
	const nativeSkills = config.nativeOptimizationSkills || [];
	const historicalSkills = config.historicalOptimizationSkills || [];
	const newlyFixedSkills = config.newlyFixedSkills || [];
	const reviewedNoChangeSkills = config.reviewedNoChangeSkills || [];
	const notApplicableSkills = config.notApplicableSkills || [];
	const unresolvedConfirmedDefects = config.unresolvedConfirmedDefects || [];
	const pendingVerificationSkills = config.pendingCurrentFixVerificationSkills || [];
	const extensionSkills = config.extensionOptimizationSkills || [];
	const existingExtensionSkills = config.existingExtensionSkills || [];
	const runtimeVerifiedSkills = config.runtimeVerifiedSkills || [];
	const nativeOnlySkills = nativeSkills.filter(skill => !extensionSkills.includes(skill));
	const standardCounts = standardCandidate ? {
		registered_characters: pack.target_characters.length,
		registered_skills: config.auditedSkills.length,
		reviewed_skills: config.auditedSkills.length,
		unreviewed_skills: Math.max(0, pack.target_skills.length - config.auditedSkills.length),
		historical_optimization_skills: historicalSkills.length,
		current_round_fixed_skills: newlyFixedSkills.length,
		native_optimization_skills: nativeSkills.length,
		extension_optimization_skills: extensionSkills.length,
		native_only_optimization_skills: nativeOnlySkills.length,
		existing_extension_skills: existingExtensionSkills.length,
		extension_registered_skills: extensionSkills.length + existingExtensionSkills.length,
		reviewed_no_change_skills: reviewedNoChangeSkills.length,
		not_applicable_skills: notApplicableSkills.length,
		unresolved_confirmed_defects: unresolvedConfirmedDefects.length,
		confirmed_defect_resolution_skills: newlyFixedSkills.length,
		extension_safe_takeover_limited_skills: nativeOnlySkills.length,
		historically_special_validated_skills: historicalSkills.length,
		current_round_verified_skills: runtimeVerifiedSkills.length,
	} : null;
	const refreshFengCounts = refreshFengCandidate ? { characters: pack.target_characters.length, skills: pack.target_skills.length, reviewed_skills: config.auditedSkills.length, unreviewed_skills: Math.max(0, pack.target_skills.length - config.auditedSkills.length), native_modified_skills: nativeSkills.length, extension_wired_skills: extensionSkills.length, native_only_skills: nativeOnlySkills.length, newly_fixed_skills: newlyFixedSkills.length, unresolved_confirmed_defects: unresolvedConfirmedDefects.length, current_fix_pending_verification_skills: pendingVerificationSkills.length, current_round_runtime_verified_skills: 0 } : null;
	const leiCounts = { characters: 8, skills: 16, reviewed_skills: 16, unreviewed_skills: 0, native_modified_skills: 4, extension_wired_skills: 3, runtime_verified_skills: 0 };
	const records = recordsFor(config.id);
	const stage = path.join(STAGE_ROOT, config.id);
	fs.rmSync(stage, { recursive: true, force: true });
	for (const dir of ['source/score/decision/skills/packs', 'source/score/decision/skills/rules', 'contract/score/model/features', 'tests', 'evidence', 'integration/pack-only', 'patches', 'docs']) {
		fs.mkdirSync(path.join(stage, dir), { recursive: true });
	}

	for (const name of ['policyCore.js', 'skillAIPolicies.js', 'skillAIPolicyPacks.js', 'skillVetoRegistry.js']) copyRepo(stage, `score/decision/skills/${name}`, `source/score/decision/skills/${name}`);
	copyRepo(stage, `score/decision/skills/packs/${config.module}.js`, `source/score/decision/skills/packs/${config.module}.js`);
	copyRepo(stage, `score/decision/skills/rules/${config.rules}.js`, `source/score/decision/skills/rules/${config.rules}.js`);
	if (config.id === 'refresh_standard') {
		for (const file of ['skillPlanHints.js', 'rules/boundedSkillUtility.js', 'rules/refreshStandardPlans.js']) copyRepo(stage, `score/decision/skills/${file}`, `source/score/decision/skills/${file}`);
	}
	copyRepo(stage, 'score/model/features/features.js', 'contract/score/model/features/features.js');
	copyRepo(stage, 'score/model/features/dimensionAdapter.js', 'contract/score/model/features/dimensionAdapter.js');
	copyRepo(stage, 'info.json', 'contract/info.json');

	if (!windCandidate && !leiCandidate && !refreshFengCandidate && !standardCandidate) {
		copyRepo(stage, `tools/pack-templates/${config.id}.test.mjs`, 'tests/test-pack-rules.mjs');
		copyRepo(stage, 'tools/pack-templates/test-pack-architecture.mjs', 'tests/test-pack-architecture.mjs');
		copyRepo(stage, 'tools/pack-templates/run-pack-tests.mjs', 'tests/run-pack-tests.mjs');
	}
	copyRepo(stage, 'tools/verify.py', 'verify.py');
	if (!windCandidate && !leiCandidate && !refreshFengCandidate && !standardCandidate) {
		copyRepo(stage, 'tools/test-verify-zip.py', 'tests/test-verify-zip.py');
		for (const name of ['skill-ai-hp-real-host.mjs', 'skill-ai-host-scenes.mjs', 'trick-real-host-smoke.mjs', 'test-fullgame-settlement.mjs']) copyRepo(stage, `tools/${name}`, `tests/${name}`);
	}
	if (config.id === 'refresh_feng' && !refreshFengCandidate) {
		for (const name of ['reqimou-manual-ui.mjs', 'verify-repair-outcomes.mjs']) copyRepo(stage, `tools/${name}`, `tests/${name}`);
	}
	copyRepo(stage, 'tools/pack-templates/apply-pack.mjs', 'integration/apply-pack.mjs');
	copyRepo(stage, 'tools/pack-templates/apply-engine-wiring.mjs', 'integration/apply-engine-wiring.mjs');
	copyRepo(stage, 'tools/pack-templates/rollback-pack.mjs', 'integration/rollback-pack.mjs');
	copyRepo(stage, 'tools/build-skill-ai-pack.mjs', 'build-skill-ai-pack.mjs');
	copyRepo(stage, 'tools/skill-ai-pack-config.mjs', 'skill-ai-pack-config.mjs');

	const packOnlyRegistry = `// Generated for ${config.id} (${pack.pack_name}); stage package.\n// @djsc-pack-imports-begin\nimport { pack as ${config.module} } from './packs/${config.module}.js?v=41a';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\t${config.module},\n\t// @djsc-pack-registry-end\n];\n`;
	write(stage, 'integration/pack-only/skillAIPolicyPacks.js', packOnlyRegistry);
	/* source/ 只带本分包注册表，保证独立解压后 import 图完整；完整共享注册表不随包交付。 */
	write(stage, 'source/score/decision/skills/skillAIPolicyPacks.js', packOnlyRegistry);

	const evidenceNames = [];
	for (const name of (windCandidate || leiCandidate || refreshFengCandidate || standardCandidate) ? [] : config.evidence) {
		const source = path.join(EVIDENCE, name);
		if (!fs.existsSync(source)) throw new Error(`missing evidence ${name} for ${config.id}; rerun the scenario or use --evidence`);
		copyDisk(stage, source, `evidence/${name}`);
		evidenceNames.push(name);
		if (name.endsWith('.json')) {
			const logRel = name.replace(/\.json$/, '.log');
			const log = path.join(EVIDENCE, logRel);
			if (fs.existsSync(log) && logRel !== name && !evidenceNames.includes(logRel)) {
				copyDisk(stage, log, `evidence/${logRel}`);
				evidenceNames.push(logRel);
			}
		}
	}
	if (windCandidate) {
		copyRepo(stage, 'docs/skill-ai-quality-20261103/feisheng-ai-shenhua-feng-native-ai.patch', 'feisheng-ai-shenhua-feng-native-ai.patch');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/WIND-REVIEW-CANDIDATE.md', 'docs/WIND-REVIEW-CANDIDATE.md');
	}

	if (leiCandidate) {
		copyRepo(stage, 'docs/skill-ai-quality-20261103/lei-native/lei-native-candidate.patch', 'feisheng-ai-shenhua-lei-native-ai.patch');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/lei-native/REVIEW.md', 'docs/REVIEW.md');
	}

	if (refreshFengCandidate) {
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/refresh-feng-native-candidate.patch', 'feisheng-ai-refresh-feng-native-ai.patch');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/REVIEW.md', 'docs/REVIEW.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/PROGRESS.md', 'docs/PROGRESS.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/FOURTH-ACCEPTANCE.md', 'docs/FOURTH-ACCEPTANCE.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/FULL-SKILL-AUDIT.md', 'docs/FULL-SKILL-AUDIT.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/FULL-SKILL-ACCEPTANCE-HANDOFF.md', 'docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md');
		write(stage, 'ACCEPTANCE.md', '# 界风候选：待独立验收\n\n不屈修复已纳入正式源码候选，隔离试验通过；正式补丁尚待独立复验。飘零与历史技能的未覆盖分支仍待验证。历史互斥及场景证据见 docs/FOURTH-ACCEPTANCE.md，不能作为本包最终验收。\n');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/fourth-exclusive-host.json', 'docs/fourth-exclusive-host.json');
	}
	if (standardCandidate) {
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/refresh-standard-native-candidate.patch', 'feisheng-ai-refresh-standard-native-ai.patch');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/PACK-ACCEPTANCE-HANDOFF.md', 'docs/PACK-ACCEPTANCE-HANDOFF.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/VALIDATION-HANDOFF.md', 'docs/VALIDATION-HANDOFF.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/BATCH3-HANDOFF.md', 'docs/BATCH3-HANDOFF.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/BATCH4-HANDOFF.md', 'docs/BATCH4-HANDOFF.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/FULL-SKILL-AUDIT.md', 'docs/FULL-SKILL-AUDIT.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/FULL-SKILL-ACCEPTANCE-HANDOFF.md', 'docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md');
	}

	const deliverable = !standardCandidate && !refreshFengCandidate && !leiCandidate && !windCandidate && !!pack.can_mark_deliverable && ['可交付', '已交付'].includes(pack.delivery_status);
	const packJson = {
		schema_version: '1.0',
		id: config.id,
		name: pack.pack_name,
		group: pack.pack_group,
		delivery_stage: deliverable ? '可交付' : '阶段性',
		complete_delivery: deliverable,
		pack_status: pack.review_status,
		delivery_status: pack.delivery_status,
		can_mark_deliverable: pack.can_mark_deliverable,
		external_integration_receipt: pack.delivery && pack.delivery.external_integration_receipt || null,
		external_integration_note: pack.delivery && pack.delivery.external_integration_note || null,
		module: config.module,
		rules: config.rules,
		implemented_skills: config.implementedSkills,
		optimization_types: config.optimizationTypes || undefined,
		review_only: config.implementedSkills.length === 0,
		audited_skills: config.auditedSkills,
		target_skills: pack.target_skills,
		target_characters: pack.target_characters,
		all_registered_skills: ALL_REGISTERED,
		counts: pack.counts,
		scenes: config.scenes,
		review_scenes: config.reviewScenes || [],
		required: CONSTRAINTS[config.id].required,
		forbidden: CONSTRAINTS[config.id].forbidden,
		shared_files: {
			'policyCore.js': sha(sourceOf('score/decision/skills/policyCore.js')),
			'skillAIPolicies.js': sha(sourceOf('score/decision/skills/skillAIPolicies.js')),
			'skillVetoRegistry.js': sha(sourceOf('score/decision/skills/skillVetoRegistry.js')),
		},
		registry_template_sha256: sha(Buffer.from(packOnlyRegistry)),
		pack_files: {
			[`packs/${config.module}.js`]: sha(sourceOf(`score/decision/skills/packs/${config.module}.js`)),
			[`rules/${config.rules}.js`]: sha(sourceOf(`score/decision/skills/rules/${config.rules}.js`)),
			...(config.id === 'refresh_standard' ? Object.fromEntries(['skillPlanHints.js', 'rules/boundedSkillUtility.js', 'rules/refreshStandardPlans.js'].map(file => [file, sha(sourceOf(`score/decision/skills/${file}`))])) : {}),
		},
		dependencies: ['score/index.js 已接线策略 facade', 'score/foundation/adapt/host.js', 'score/decision/safety/aiOverride.js'],
		head: HEAD,
		source_mode: useWorktree ? 'worktree' : 'git-show-head',
		worktree_dirty: !!dirty,
		baseline: BASELINE,
	};
	if (windCandidate) Object.assign(packJson, {
		delivery_stage: '待验证候选', complete_delivery: false, pack_status: '已静态审查', delivery_status: '待验证',
		can_mark_deliverable: false, external_integration_receipt: null, external_integration_note: null,
		counts: { characters: 8, implemented_skills: 11, passive_related_skills: 1 },
		all_registered_skills: config.implementedSkills,
		native_patch: 'feisheng-ai-shenhua-feng-native-ai.patch',
		extension_difference: '天香新评分仅在原生补丁中；扩展独立安装使用宿主原始AI。',
		required: ['shouldBypassQimouCountBlock', 'kuangguChoice', 'jushouShouldActivate', 'shensu1ShouldUse', 'guhuoShouldBluff', 'huangtianTargetScore', 'installLiegong', 'installBuqu'],
		scenes: [], review_scenes: [],
	});
	if (windCandidate || refreshFengCandidate) {
		const peer = windCandidate ? 'refreshFeng' : 'shenhuaFeng';
		packJson.wind_compatibility = { protocol: 'dual-feng-shared-entry-v1', peer_module: peer, peer_sha256: sha(sourceOf(`score/decision/skills/packs/${peer}.js`)) };
	}
	if (leiCandidate) Object.assign(packJson, { delivery_stage: '待验证候选', complete_delivery: false, pack_status: '已静态审查', delivery_status: '待验证', can_mark_deliverable: false, counts: leiCounts, native_patch: 'feisheng-ai-shenhua-lei-native-ai.patch', all_registered_skills: config.implementedSkills, scenes: [], review_scenes: [] });
	if (refreshFengCandidate) Object.assign(packJson, { delivery_stage: '待验证候选', complete_delivery: false, pack_status: '全量静态审查；不屈修复待正式复验', delivery_status: '待验证', can_mark_deliverable: false, counts: refreshFengCounts, audited_skills: config.auditedSkills, native_skills: nativeSkills, extension_skills: extensionSkills, native_only_skills: nativeOnlySkills, unresolved_skills: unresolvedConfirmedDefects, pending_verification_skills: pendingVerificationSkills, audit_report: 'docs/FULL-SKILL-AUDIT.md', acceptance_handoff: 'docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md', native_patch: 'feisheng-ai-refresh-feng-native-ai.patch', all_registered_skills: config.implementedSkills, incompatible_packs: [], compatibility_note: '双风共享入口为待验证候选；仅相同共享核心和精确匹配的新版对包可安装，旧版须先回滚并迁移。', scenes: [], review_scenes: [] });
	if (standardCandidate) Object.assign(packJson, { delivery_stage: '全量源码审查完成·待最终验收', complete_delivery: false, pack_status: '全量静态审查完成；本轮3项AI修复待验收', delivery_status: '封包待验收', can_mark_deliverable: false, external_integration_receipt: null, external_integration_note: null, counts: standardCounts, audited_skills: config.auditedSkills, historical_optimization_skills: historicalSkills, newly_fixed_skills: newlyFixedSkills, reviewed_no_change_skills: reviewedNoChangeSkills, not_applicable_skills: notApplicableSkills, native_skills: nativeSkills, extension_optimization_skills: extensionSkills, native_only_optimization_skills: nativeOnlySkills, existing_extension_skills: existingExtensionSkills, current_round_verified_skills: runtimeVerifiedSkills, all_registered_skills: config.implementedSkills, scenes: [], review_scenes: [], dependencies: [...packJson.dependencies, 'score/decision/utility/utilityPipeline.js (applyOwnedUtility)', 'score/decision/utility/utilityVector.js'], audit_report: 'docs/FULL-SKILL-AUDIT.md', acceptance_handoff: 'docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md', native_patch: 'feisheng-ai-refresh-standard-native-ai.patch', validation_note: '前四批17项为历史专项验收基线；本轮新增3项源码修复尚未执行验证；完整封包、安装与回滚由独立Agent验收。' });
	if (refreshFengCandidate) packJson.pending_verification_scope = '仅列本轮新增修复；飘零及历史PARTIAL待验收内容见交接文档';
	let dualStatus = null;
	if (windCandidate || refreshFengCandidate) {
		const evidencePath = 'docs/skill-ai-quality-20261103/refresh-feng/final-candidate/acceptance-evidence.json';
		const evidence = JSON.parse(textOf(evidencePath));
		const runtimeChanges = git(['diff', '--name-only', evidence.baseline.head, HEAD, '--', 'score', 'js', 'extension.js', 'info.json', 'tools/skill-ai-pack-config.mjs', 'tools/pack-templates/rollback-pack.mjs', 'docs/skill-ai-quality-20261103/refresh-feng/dual-feng-native-candidate.patch', 'docs/skill-ai-quality-20261103/refresh-feng/refresh-feng-native-candidate.patch', 'docs/skill-ai-quality-20261103/feisheng-ai-shenhua-feng-native-ai.patch']).trim();
		dualStatus = evaluateDualAcceptance(evidence, { runtime_equivalent: !runtimeChanges, clean_source: !dirty && !useWorktree, installer_sha256: sha(sourceOf('tools/pack-templates/apply-pack.mjs')), builder_sha256: sha(sourceOf('tools/build-skill-ai-pack.mjs')), gate_sha256: sha(sourceOf('tools/dual-feng-acceptance.mjs')) });
		copyRepo(stage, evidencePath, 'evidence/dual-feng-acceptance.json');
	}
	const applyDualStatus = obj => {
		Object.assign(obj, dualStatus);
		delete obj.pending_verification_scope;
		delete obj.pending_verification_skills;
		if (obj.counts) { delete obj.counts.current_fix_pending_verification_skills; delete obj.counts.current_round_runtime_verified_skills; }
	};
	if (windCandidate || refreshFengCandidate) applyDualStatus(packJson);
	write(stage, 'pack.json', JSON.stringify(packJson, null, 2) + '\n');

	const checklist = {
		schema_version: '1.0',
		pack_id: pack.pack_id,
		pack_name: pack.pack_name,
		pack_status: pack.review_status,
		delivery_status: pack.delivery_status,
		can_mark_deliverable: pack.can_mark_deliverable,
		external_integration_receipt: pack.delivery && pack.delivery.external_integration_receipt || null,
		external_integration_note: pack.delivery && pack.delivery.external_integration_note || null,
		criteria: pack.criteria,
		counts: pack.counts,
		target_characters: pack.target_characters,
		target_skills: pack.target_skills,
		records,
	};
	if (windCandidate) Object.assign(checklist, {
		pack_status: '已静态审查', delivery_status: '待验证', can_mark_deliverable: false,
		external_integration_receipt: null, external_integration_note: null,
		counts: { characters: 8, implemented_skills: 11, passive_related_skills: 1 }, criteria: [], records: [],
	});
	if (leiCandidate) Object.assign(checklist, { pack_status: '已静态审查', delivery_status: '待验证', can_mark_deliverable: false, counts: leiCounts, records: [], criteria: [] });
	if (refreshFengCandidate) Object.assign(checklist, { pack_status: '全量静态审查；不屈修复待正式复验', delivery_status: '待验证', can_mark_deliverable: false, counts: refreshFengCounts, audited_skills: config.auditedSkills, native_skills: nativeSkills, extension_skills: extensionSkills, unresolved_skills: unresolvedConfirmedDefects, pending_verification_skills: pendingVerificationSkills, records: [], criteria: [] });
	if (standardCandidate) Object.assign(checklist, { pack_status: '全量静态审查完成；本轮3项AI修复待验收', delivery_status: '封包待验收', can_mark_deliverable: false, external_integration_receipt: null, external_integration_note: null, counts: standardCounts, audited_skills: config.auditedSkills, historical_optimization_skills: historicalSkills, newly_fixed_skills: newlyFixedSkills, reviewed_no_change_skills: reviewedNoChangeSkills, not_applicable_skills: notApplicableSkills, native_skills: nativeSkills, extension_optimization_skills: extensionSkills, native_only_optimization_skills: nativeOnlySkills, existing_extension_skills: existingExtensionSkills, records: [], criteria: [] });
	if (refreshFengCandidate) checklist.pending_verification_scope = '仅列本轮新增修复；飘零及历史PARTIAL待验收内容见交接文档';
	if (windCandidate || refreshFengCandidate) applyDualStatus(checklist);
	write(stage, 'checklist.json', JSON.stringify(checklist, null, 2) + '\n');
	write(stage, 'checklist.md', windCandidate ? '# 风包候选检查清单\n\n8名武将、11项原生AI修改：曹仁据守；夏侯渊神速；于吉蛊惑；魏延奇谋、狂骨；小乔天香；张角雷击、鬼道、黄天；黄忠烈弓；周泰不屈。红颜为被动关联，不单独修改。宿主场景和安装回滚均待验证。详见 docs/WIND-REVIEW-CANDIDATE.md。\n' : checklistMarkdown(pack, records));
	write(stage, 'README.md', windCandidate ? `# 神话再临·风 AI 候选（待验证）\n\n8名武将、11项原生AI修改；红颜为被动关联，不单独修改。宿主1.11.7，无名AI 4.4.4；源码提交 ${HEAD}。\n\n原生方案：仅使用根目录 feisheng-ai-shenhua-feng-native-ai.patch，对干净宿主 character/shenhua.js 应用。历史 wind-native.patch 和 0001–0013 不得叠加。\n\n扩展方案：执行 node integration/apply-pack.mjs --extension-root <扩展目录>；回滚使用 node integration/rollback-pack.mjs --extension-root <扩展目录>。先使用 --dry-run 检查。天香新评分仅在原生补丁中，扩展独立安装沿用宿主原始AI；不建议同时接管。\n\n本候选未完成宿主及安装回滚验收，历史结果不能代表本版本。详见 docs/WIND-REVIEW-CANDIDATE.md；manifest.json 含文件SHA256。\n` : readme(pack, config, evidenceNames));
	if (leiCandidate) {
		write(stage, 'README.md', '# 神话再临·雷候选（待验证）\n\n8名武将、16项技能已静态审查，4项原生候选修改，3项扩展接线；宿主场景未验证。镇骨新评分仅原生补丁支持。详见 docs/REVIEW.md。\n\n原生：对1.11.7的 character/shenhua.js 应用根目录累计补丁。扩展：先确认 score/index.js 已接入策略 facade，再运行 node integration/apply-pack.mjs --extension-root <扩展目录>；回滚使用 integration/rollback-pack.mjs。先用 --dry-run 检查，不建议同时接管。\n');
		write(stage, 'checklist.md', '# 雷包候选\n\n16项已静态审查；4项原生候选，3项扩展接线，0项宿主运行验证通过。\n');
	}
	if (refreshFengCandidate) {
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/PACK-README.md', 'README.md');
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-feng/FULL-SKILL-AUDIT.md', 'checklist.md');
	}
	if (standardCandidate) {
		write(stage, 'README.md', textOf('docs/skill-ai-quality-20261103/refresh-standard/PACK-README.md').replaceAll('{{HEAD}}', HEAD).replaceAll('{{BASELINE}}', BASELINE));
		copyRepo(stage, 'docs/skill-ai-quality-20261103/refresh-standard/PACK-COVERAGE.md', 'checklist.md');
	}
	if (windCandidate) fs.appendFileSync(path.join(stage, 'README.md'), '\n双风部署必须二选一：使用匹配新版的双风扩展并保持相关原生 AI 未打补丁，或从干净宿主应用双风组合原生补丁并停用两个风包扩展策略。同技能原生与扩展叠加不受支持；安装器无法自动检测宿主原生补丁，部署者须自行核对。\n');
	write(stage, 'COMMANDS.md', [
		'# 本分包测试命令', '',
		'```bash',
		'node tests/run-pack-tests.mjs',
		'python tests/test-verify-zip.py',
		'python verify.py',
		'python verify.py --zip <本包.zip>',
		'```', '',
		'宿主场景（需要完整无名杀宿主与 Playwright）：',
		'```bash',
		`SC="${config.scenes.join(',')}"`,
		'for v in native policy extension; do',
		'  node tests/skill-ai-hp-real-host.mjs --mode identity --variant $v --scenarios "$SC" --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright> --output $v.json',
		'done',
		'node tests/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>',
		...(config.reviewScenes && config.reviewScenes.length ? [
			'',
			'逐项技能审查场景：',
			'```bash',
			`node tests/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-extension --scenes "${config.reviewScenes.join(',')}" --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>`,
			'```',
		] : []),
		'',
		'不抑制 `game.over` 的有界完整对局：',
		'```bash',
		'node tests/test-fullgame-settlement.mjs --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>',
		'```', '',
		'运行器默认抑制宿主 `game.over` 胜负对话框（`--allow-game-over` 可关闭）；技能机制场景不测试胜负 UI。`--trace` 打开 Worker 心跳/CDP CPU/阶段 mark。完整对局测试不抑制 `game.over`，独立于技能固定场景。',
		'集成本包：`node integration/apply-pack.mjs --extension-root <扩展> --dry-run`，确认后再执行；apply 会预检注册表依赖、备份将被修改文件并在失败时恢复。回滚：`node integration/rollback-pack.mjs --extension-root <扩展>`；回滚最后一个包保留空注册表，共享核心不删除。',
	].join('\n') + '\n');
	if (windCandidate || leiCandidate || refreshFengCandidate) write(stage, 'COMMANDS.md', '# 候选包检查\n\n文件完整性：`python verify.py --zip <本包.zip>`。宿主场景与安装回滚尚未验证。\n');
	if (refreshFengCandidate) write(stage, 'COMMANDS.md', '# 候选包检查\n\n文件完整性：`python verify.py --zip <本包.zip>`。双风兼容为待验证候选；旧包须先回滚，迁移前退出宿主，完成操作后重启。原生补丁与同技能扩展策略不得叠加；安装器无法自动检测宿主原生补丁，部署者须先核对。\n');
	if (standardCandidate) write(stage, 'COMMANDS.md', '# 标准包集成与验收\n\n安装、回滚、依赖和验证范围见 README.md。文件校验：`python verify.py --zip <本包.zip>`；最终封包验收由独立 Agent 完成。\n');

	if (windCandidate || refreshFengCandidate) {
		const status = `历史基线 fcc9eb2 已通过独立交付验收；${dualStatus.delivery_status}（源码 HEAD：${HEAD}）。外部集成回执 pending，尚未发布。本次输入验证证据见 evidence/dual-feng-acceptance.json；实际 ZIP 交付校验结果见外部 ACCEPTANCE.md。`;
		write(stage, 'README.md', `# 双风兼容分包最终候选\n\n${status}\n\n宿主 1.11.7。原生组合补丁与双风扩展只能二选一，禁止叠加；安装器不能自动识别宿主原生补丁，安装前须人工核对。旧版先退出宿主并备份，按旧包记录回滚；共享核心或对包冲突须核对所有使用者并安全迁移，不可强制覆盖。详见交付目录 UPGRADE.md。\n`);
		write(stage, 'checklist.md', `# 双风候选检查\n\n${status}\n\n运行 verify.py 检查包完整性，按交付说明复核安装、回滚和部署边界。历史技能审查见 docs/。\n`);
		write(stage, 'ACCEPTANCE.md', `# 双风验收状态\n\n${status}\n`);
		write(stage, 'COMMANDS.md', `# 双风候选命令\n\n${status}\n\n校验：python verify.py --zip <本包.zip>。先用 node integration/apply-pack.mjs --extension-root <扩展目录> --dry-run 检查；安装去掉 --dry-run，回滚使用 integration/rollback-pack.mjs。详见交付目录 UPGRADE.md。\n`);
	}

	const patchPaths = [
		'score/decision/skills/policyCore.js', 'score/decision/skills/skillAIPolicies.js', 'score/decision/skills/skillAIPolicyPacks.js',
		`score/decision/skills/packs/${config.module}.js`, `score/decision/skills/rules/${config.rules}.js`,
		'score/decision/skills/skillAIPolicyRules.js',
		'tools/verify.py', 'tools/test-verify-zip.py', 'tools/zip-package.py',
		'tools/pack-templates', 'tools/skill-ai-pack-config.mjs', 'tools/build-skill-ai-pack.mjs',
		'tools/build-skill-ai-task-list.py',
	];
	if (!windCandidate && !leiCandidate && !refreshFengCandidate && !standardCandidate) write(stage, `patches/pack-code.diff`, git(['diff', `${BASELINE}..${HEAD}`, '--binary', '--', ...patchPaths], null));
	write(stage, 'patches/score-index.diff', git(['diff', `${BASELINE}..${HEAD}`, '--binary', '--', 'score/index.js'], null));
	write(stage, 'integration/registry-snippet.txt', [
		`import { pack as ${config.module} } from './packs/${config.module}.js?v=41a';`,
		`// 在 SKILL_AI_PACKS 数组中追加：`,
		`\t${config.module},`,
		'',
	].join('\n'));

	// manifest：所有文件（除 manifest 自身）都进入清单。
	const files = [];
	const walk = rel => {
		const full = path.join(stage, rel);
		if (!fs.existsSync(full)) return;
		for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
			const child = rel ? rel + '/' + entry.name : entry.name;
			if (entry.isDirectory()) { walk(child); continue; }
			if (child === 'manifest.json') continue;
			const hash = hashFile(path.join(stage, child));
			const repoPath = sourcePaths.get(child) || null;
			let commit = null;
			if (repoPath && !useWorktree) {
				commit = git(['log', '-1', '--format=%h', HEAD, '--', repoPath]).trim() || null;
			}
			const purpose = child.startsWith('source/') ? '运行时分包代码或生成的注册表'
				: child.startsWith('contract/') ? '只读契约（134维/版本）'
				: child.startsWith('tests/') ? '测试脚本'
				: child.startsWith('evidence/') ? '原始运行产物（未修改）'
				: child.startsWith('patches/') ? 'Git 补丁'
				: child.startsWith('integration/') ? '安全集成/回滚脚本'
				: child === 'verify.py' ? '独立 SHA256 校验脚本'
				: child === 'pack.json' ? '分包元数据与哈希'
				: '交付文档';
			const source_kind = repoPath ? (useWorktree ? 'worktree' : 'git-blob') : (child.startsWith('evidence/') ? 'external-evidence' : 'generated');
			files.push({ path: child, size: hash.size, sha256: hash.sha256, commit, source_kind, repo_path: repoPath, batch: '分包' + config.id, purpose });
		}
	};
	walk('');
	for (const name of ['README.md', 'COMMANDS.md', 'checklist.json', 'checklist.md', 'pack.json', 'verify.py']) {
		if (files.some(file => file.path === name)) continue;
		const hash = hashFile(path.join(stage, name));
		files.push({ path: name, size: hash.size, sha256: hash.sha256, commit: null, batch: '分包' + config.id, purpose: '交付文档' });
	}
	files.sort((a, b) => a.path.localeCompare(b.path));
	const manifest = {
		schema_version: '1.0',
		generated_at: generatedAt,
		package: {
			name: `feisheng-ai-${config.id.replace(/_/g, '-')}`,
			pack_id: config.id,
			pack_name: pack.pack_name,
			delivery_stage: deliverable ? '可交付' : '阶段性',
			pack_status: pack.review_status,
			delivery_status: pack.delivery_status,
			complete_delivery: deliverable,
			can_mark_deliverable: pack.can_mark_deliverable,
			external_integration_receipt: pack.delivery && pack.delivery.external_integration_receipt || null,
			external_integration_note: pack.delivery && pack.delivery.external_integration_note || null,
			target_skills: pack.target_skills,
			implemented_skills: config.implementedSkills,
			review_only: config.implementedSkills.length === 0,
			head: HEAD,
			baseline_commit: BASELINE,
			head_short: short,
			source_mode: useWorktree ? 'worktree' : 'git-show-head',
			worktree_dirty: !!dirty,
			extension_version: '4.4.4',
			host_version: '1.11.7',
			evidence_files: evidenceNames,
		},
		files,
	};
	if (windCandidate) Object.assign(manifest.package, { delivery_stage: '待验证候选', pack_status: '已静态审查', delivery_status: '待验证', complete_delivery: false, can_mark_deliverable: false, external_integration_receipt: null, external_integration_note: null });
	if (packJson.wind_compatibility) manifest.package.wind_compatibility = packJson.wind_compatibility;
	if (leiCandidate) Object.assign(manifest.package, { delivery_stage: '待验证候选', pack_status: '已静态审查', delivery_status: '待验证', complete_delivery: false, can_mark_deliverable: false, counts: leiCounts });
	if (refreshFengCandidate) Object.assign(manifest.package, { delivery_stage: '待验证候选', pack_status: '全量静态审查；不屈修复待正式复验', delivery_status: '待验证', complete_delivery: false, can_mark_deliverable: false, counts: refreshFengCounts, audited_skills: config.auditedSkills, native_skills: nativeSkills, extension_skills: extensionSkills, native_only_skills: nativeOnlySkills, unresolved_skills: unresolvedConfirmedDefects, pending_verification_skills: pendingVerificationSkills, incompatible_packs: [], compatibility_note: '双风共享入口待验证；仅精确匹配的新版对包和共享核心可共同安装。' });
	if (standardCandidate) Object.assign(manifest.package, { delivery_stage: '全量源码审查完成·待最终验收', pack_status: '全量静态审查完成；本轮3项AI修复待验收', delivery_status: '封包待验收', complete_delivery: false, can_mark_deliverable: false, external_integration_receipt: null, external_integration_note: null, counts: standardCounts, audited_skills: config.auditedSkills, historical_optimization_skills: historicalSkills, newly_fixed_skills: newlyFixedSkills, reviewed_no_change_skills: reviewedNoChangeSkills, not_applicable_skills: notApplicableSkills, native_skills: nativeSkills, extension_optimization_skills: extensionSkills, native_only_optimization_skills: nativeOnlySkills, existing_extension_skills: existingExtensionSkills, native_patch: 'feisheng-ai-refresh-standard-native-ai.patch', audit_report: 'docs/FULL-SKILL-AUDIT.md', acceptance_handoff: 'docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md', validation_note: '前四批17项为历史专项验收基线；本轮新增3项源码修复及全量归档尚待独立验收。' });
	if (refreshFengCandidate) manifest.package.pending_verification_scope = '仅列本轮新增修复；飘零及历史PARTIAL待验收内容见交接文档';
	if (windCandidate || refreshFengCandidate) applyDualStatus(manifest.package);
	write(stage, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');

	const zipName = `feisheng-ai-${config.id.replace(/_/g, '-')}.zip`;
	const zipPath = path.join(OUT, zipName);
	fs.mkdirSync(OUT, { recursive: true });
	execFileSync('python', [path.join(REPO, 'tools', 'zip-package.py'), stage, zipPath], { cwd: REPO, encoding: 'utf8' });
	const verifyOut = execFileSync('python', [path.join(stage, 'verify.py'), '--zip', zipPath], { cwd: stage, encoding: 'utf8' });
	if (!verifyOut.includes('VERIFY PASS')) throw new Error('verify failed for ' + zipPath + '\n' + verifyOut);
	const zipHash = hashFile(zipPath).sha256;
	if (standardCandidate) {
		const nativeName = 'feisheng-ai-refresh-standard-native-ai.patch';
		const nativeBytes = sourceOf('docs/skill-ai-quality-20261103/refresh-standard/refresh-standard-native-candidate.patch');
		fs.writeFileSync(path.join(OUT, nativeName), nativeBytes);
		fs.writeFileSync(path.join(OUT, 'SHA256SUMS.txt'), `${zipHash}  ${zipName}\n${sha(nativeBytes)}  ${nativeName}\n`);
	}
	return { pack_id: config.id, zip: zipPath, zip_sha256: zipHash, zip_size: fs.statSync(zipPath).size, files: files.length, evidence: evidenceNames.length, verify: verifyOut.trim().split('\n').slice(-1)[0] };
}

const results = [];
for (const id of selected) {
	const config = CODE_PACKS.find(item => item.id === id);
	if (!config) throw new Error('unknown pack: ' + id);
	results.push(buildPack(config));
}

const deliveryPath = path.join(REPO, 'docs', 'skill-ai-20261030', 'pack-delivery.json');
let delivery = { schema_version: '1.0', updated_at: new Date().toISOString(), packs: [] };
if (fs.existsSync(deliveryPath)) {
	try { delivery = readJson(deliveryPath); } catch (e) {}
}
delivery.packs ||= [];
for (const result of results) {
	if (result.pack_id === 'shenhua_feng' || result.pack_id === 'shenhua_lei' || result.pack_id === 'refresh_feng' || result.pack_id === 'refresh_standard') continue;
	const entry = delivery.packs.find(item => item.pack_id === result.pack_id) || { pack_id: result.pack_id };
	const pack = taskPacks[result.pack_id];
	const deliverable = !!pack.can_mark_deliverable && ['可交付', '已交付'].includes(pack.delivery_status);
	const status = pack.delivery_status === '未打包' ? (deliverable ? '可交付' : '阶段性') : pack.delivery_status;
	Object.assign(entry, {
		status,
		delivery_status: status,
		zip_name: path.basename(result.zip),
		zip_sha256: result.zip_sha256,
		zip_size: result.zip_size,
		built_at: new Date().toISOString(),
	});
	entry.note = deliverable
		? '完整可交付包：本包登记技能已全部审查、无阻塞项，安装/卸载/回滚/宿主加载验收通过。'
		: (entry.note || '阶段包：仍有登记技能未审查，不可标记完整交付。');
	if (!delivery.packs.includes(entry)) delivery.packs.push(entry);
}
if (results.some(result => result.pack_id !== 'shenhua_feng' && result.pack_id !== 'refresh_feng' && result.pack_id !== 'refresh_standard')) fs.writeFileSync(deliveryPath, JSON.stringify(delivery, null, 2) + '\n');
console.log(JSON.stringify({ head: HEAD, results }, null, 2));
