#!/usr/bin/env node
// 按分包生成独立交付 ZIP。用法：
//   node tools/build-skill-ai-pack.mjs --pack refresh_standard
//   node tools/build-skill-ai-pack.mjs --all
// 默认只接受干净工作区（source/tests 用 git show HEAD 导出）；测试期可用 --worktree-source。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CODE_PACKS } from './skill-ai-pack-config.mjs';

const args = process.argv.slice(2);
const option = name => { const i = args.indexOf('--' + name); return i < 0 ? null : args[i + 1]; };
const GIT = 'C:/Users/32360/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/git/cmd/git.exe';
const REPO = path.resolve(option('repo') || 'C:/Users/32360/.codex/worktrees/release-444/无名AI');
const TASK_PATH = path.join(REPO, 'docs', 'skill-ai-20261030', '142-task-list.json');
const EVIDENCE = path.resolve(option('evidence') || 'C:/Users/32360/Desktop/repair-baseline/evidence');
const OUT = path.resolve(option('out') || 'C:/Users/32360/Desktop/feisheng-ai-packs');
const STAGE_ROOT = path.resolve(option('stage-root') || 'C:/Users/32360/Desktop/repair-baseline/pack-stage');
const BASELINE = '1fe5292eb3022dd8d1db494617b21a12be912e61';
const ALL_REGISTERED = ['rezhiheng', 'new_retuxi', 'qimou', 'reqimou', 'olkongsheng', 'redimeng'];
const useWorktree = args.includes('--worktree-source');
const selected = option('pack') ? [option('pack')] : (args.includes('--all') ? CODE_PACKS.map(item => item.id) : []);
if (!selected.length) throw new Error('usage: --pack <id> | --all');

const git = (params, encoding = 'utf8') => execFileSync(GIT, params, { cwd: REPO, encoding, maxBuffer: 1024 * 1024 * 128 });
const HEAD = git(['rev-parse', 'HEAD']).trim();
const dirty = git(['status', '--porcelain']).trim();
if (dirty && !useWorktree) throw new Error('工作区不干净；请先提交，或仅测试时使用 --worktree-source');
const sourceOf = repoPath => useWorktree ? fs.readFileSync(path.join(REPO, repoPath)) : git(['show', `${HEAD}:${repoPath}`], null);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const textOf = repoPath => sourceOf(repoPath).toString('utf8');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const task = readJson(TASK_PATH);
const taskPacks = Object.fromEntries((task.packs || []).map(pack => [pack.pack_id, pack]));
const taskRecords = task.records || [];
const generatedAt = git(['show', '-s', '--format=%cI', HEAD]).trim();
const short = HEAD.slice(0, 7);
const write = (stage, rel, data) => {
	const full = path.join(stage, rel);
	fs.mkdirSync(path.dirname(full), { recursive: true });
	fs.writeFileSync(full, data);
};
const copyRepo = (stage, repoPath, rel) => write(stage, rel, sourceOf(repoPath));
const copyDisk = (stage, source, rel) => write(stage, rel, fs.readFileSync(source));
const hashFile = file => { const data = fs.readFileSync(file); return { size: data.length, sha256: sha(data) }; };

const CONSTRAINTS = {
	refresh_standard: {
		required: ['TARGET_POLICIES', 'retuxiHandBonus', 'DEFENSE_RULES'],
		forbidden: ['get.value(button'],
	},
	shenhua_feng: {
		required: ['shouldBypassQimouCountBlock', 'lib.filter.cardUsable'],
		forbidden: ['reqimou'],
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
		required: ['shouldMaskHiddenButtonChoice', 'fairButtonScore'],
		forbidden: ['get.value(button'],
	},
};

function recordsFor(packId) {
	if (packId === 'out_of_scope') return [{ out_of_scope: true, ...(task.out_of_scope_findings || []).find(item => item.skill_id === 'redimeng') }];
	return taskRecords.filter(record => record.pack_id === packId);
}

function checklistMarkdown(pack, records) {
	const lines = [`# ${pack.pack_name} 技能验收清单`, '', `- 分包状态：${pack.review_status}`, `- 交付状态：${pack.delivery_status}`, `- 完整可交付：${pack.can_mark_deliverable ? '是' : '否'}`, ''];
	lines.push('| 武将 | 技能ID | 技能 | 审查状态 | 实现 | 测试 | 证据摘要 |');
	lines.push('| --- | --- | --- | --- | --- | --- | --- |');
	for (const record of records) {
		if (record.out_of_scope) {
			const skill = record.skill_statuses[0];
			lines.push(`| ${record.character} | ${skill.id} | ${skill.name} | ${skill.status} | ${skill.implementation} | ${skill.test} | ${String(skill.evidence || '').replace(/\|/g, '/').slice(0, 120)} |`);
			continue;
		}
		for (const skill of record.skills) {
			lines.push(`| ${record.character_name} (${record.character_id}) | ${skill.id} | ${skill.name} | ${skill.status} | ${skill.implementation} | ${skill.test} | ${String(skill.evidence || '').replace(/\|/g, '/').slice(0, 120)} |`);
		}
	}
	return lines.join('\n') + '\n';
}

function readme(pack, config, evidenceNames) {
	const missing = pack.counts.unreviewed_skills;
	return `# ${pack.pack_name} · 无名AI 技能 AI 分包（阶段性）

> **阶段性包，不是完整交付。** 本包只交付已实现并有本轮真实宿主证据的策略代码；
> 当前登记 ${pack.counts.characters} 名武将、${pack.counts.skills} 个技能，仍有 ${missing} 个技能未审查。
> 只有这些技能全部审查、缺陷解决且无阻塞项后，才能标记完整可交付。

- 分包 ID：\`${pack.pack_id}\`
- 分包状态：\`${pack.review_status}\`
- 交付状态：\`${pack.delivery_status}\`
- 基线：\`${BASELINE}\`；HEAD：\`${HEAD}\`
- 已实现策略：${config.implementedSkills.map(id => '`' + id + '`').join('、')}
- 版本：无名AI 4.4.4 / 无名杀 1.11.7；134 维模型契约未改

## 代码交付

- \`source/score/decision/skills/policyCore.js\`：共享核心（生命周期/备份/统计）
- \`source/score/decision/skills/skillAIPolicies.js\`：共享 facade
- \`source/score/decision/skills/skillAIPolicyPacks.js\`：只含本分包的注册表（独立解压可 import）
- \`source/score/decision/skills/packs/${config.module}.js\`：本分包策略模块
- \`source/score/decision/skills/rules/${config.rules}.js\`：本分包纯规则
- \`integration/pack-only/skillAIPolicyPacks.js\`：只包含本分包的注册表

**不包含**其他分包未完成的策略代码、模型权重、训练数据、后端配置或完整扩展包。

## 集成

目标必须是已接入无名AI策略 facade 的扩展（\`score/index.js\` 含 \`installSkillAIPolicies\`/\`uninstallSkillAIPolicies\`；否则先应用 \`patches/score-index.diff\`）。

\`\`\`bash
node integration/apply-pack.mjs --extension-root <无名AI根目录> --dry-run
node integration/apply-pack.mjs --extension-root <无名AI根目录>
\`\`\`

脚本只新增本分包文件，并在共享注册表的 \`@djsc-pack-*\` marker 内追加一行；
共享核心与目标版本不一致时拒绝覆盖并退出，避免覆盖其他开发者修改。
若目标没有注册表，会写入只含本分包的注册表。多个分包同时启用时，后续分包只追加自己的注册行。

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
node tests/skill-ai-hp-real-host.mjs --mode identity --variant policy --scenarios "$(node -e "console.log(require('./pack.json').scenes.join(','))")" --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright> --output policy.json
node tests/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>
\`\`\`

## 证据与限制

包内 \`evidence/\` 为原始运行产物；\`evidence/acceptance-ledger.json\`（若存在）逐场景列出初次成功、超时失败、重跑与最终未解决数量。
本包不宣称长期性能、全 142 将完成或 Android 长跑通过；这些仍是后续发布门槛。

## 文件完整性

\`manifest.json\` 记录每个文件的尺寸、SHA256、来源提交与用途；\`verify.py\` 可独立复核。
生成时间：${generatedAt}；构建方式：${useWorktree ? '工作区内容（仅测试）' : 'git show HEAD'}。
证据文件：${evidenceNames.length} 个。
`;
}

function buildPack(config) {
	const pack = taskPacks[config.id];
	if (!pack) throw new Error('task list missing pack: ' + config.id);
	const records = recordsFor(config.id);
	const stage = path.join(STAGE_ROOT, config.id);
	fs.rmSync(stage, { recursive: true, force: true });
	for (const dir of ['source/score/decision/skills/packs', 'source/score/decision/skills/rules', 'contract/score/model/features', 'tests', 'evidence', 'integration/pack-only', 'patches', 'docs']) {
		fs.mkdirSync(path.join(stage, dir), { recursive: true });
	}

	for (const name of ['policyCore.js', 'skillAIPolicies.js', 'skillAIPolicyPacks.js']) copyRepo(stage, `score/decision/skills/${name}`, `source/score/decision/skills/${name}`);
	copyRepo(stage, `score/decision/skills/packs/${config.module}.js`, `source/score/decision/skills/packs/${config.module}.js`);
	copyRepo(stage, `score/decision/skills/rules/${config.rules}.js`, `source/score/decision/skills/rules/${config.rules}.js`);
	copyRepo(stage, 'score/model/features/features.js', 'contract/score/model/features/features.js');
	copyRepo(stage, 'score/model/features/dimensionAdapter.js', 'contract/score/model/features/dimensionAdapter.js');
	copyRepo(stage, 'info.json', 'contract/info.json');

	copyDisk(stage, path.join(REPO, 'tools', 'pack-templates', `${config.id}.test.mjs`), 'tests/test-pack-rules.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'pack-templates', 'test-pack-architecture.mjs'), 'tests/test-pack-architecture.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'pack-templates', 'run-pack-tests.mjs'), 'tests/run-pack-tests.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'verify.py'), 'verify.py');
	copyDisk(stage, path.join(REPO, 'tools', 'test-verify-zip.py'), 'tests/test-verify-zip.py');
	for (const name of ['skill-ai-hp-real-host.mjs', 'skill-ai-host-scenes.mjs', 'trick-real-host-smoke.mjs']) copyDisk(stage, path.join(REPO, 'tools', name), `tests/${name}`);
	if (config.id === 'refresh_feng') {
		for (const name of ['reqimou-manual-ui.mjs', 'verify-repair-outcomes.mjs']) copyDisk(stage, path.join(REPO, 'tools', name), `tests/${name}`);
	}
	copyDisk(stage, path.join(REPO, 'tools', 'pack-templates', 'apply-pack.mjs'), 'integration/apply-pack.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'pack-templates', 'rollback-pack.mjs'), 'integration/rollback-pack.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'build-skill-ai-pack.mjs'), 'build-skill-ai-pack.mjs');
	copyDisk(stage, path.join(REPO, 'tools', 'skill-ai-pack-config.mjs'), 'skill-ai-pack-config.mjs');

	const packOnlyRegistry = `// Generated for ${config.id} (${pack.pack_name}); stage package.\n// @djsc-pack-imports-begin\nimport { pack as ${config.module} } from './packs/${config.module}.js?v=41a';\n// @djsc-pack-imports-end\n\nexport const SKILL_AI_PACKS = [\n\t// @djsc-pack-registry-begin\n\t${config.module},\n\t// @djsc-pack-registry-end\n];\n`;
	write(stage, 'integration/pack-only/skillAIPolicyPacks.js', packOnlyRegistry);
	/* source/ 只带本分包注册表，保证独立解压后 import 图完整；完整共享注册表不随包交付。 */
	write(stage, 'source/score/decision/skills/skillAIPolicyPacks.js', packOnlyRegistry);

	const evidenceNames = [];
	for (const name of config.evidence) {
		const source = path.join(EVIDENCE, name);
		if (!fs.existsSync(source)) throw new Error(`missing evidence ${name} for ${config.id}; rerun the scenario or use --evidence`);
		copyDisk(stage, source, `evidence/${name}`);
		evidenceNames.push(name);
		const log = path.join(EVIDENCE, name.replace(/\.json$/, '.log'));
		if (fs.existsSync(log)) {
			copyDisk(stage, log, `evidence/${path.basename(log)}`);
			evidenceNames.push(path.basename(log));
		}
	}

	const packJson = {
		schema_version: '1.0',
		id: config.id,
		name: pack.pack_name,
		group: pack.pack_group,
		delivery_stage: '阶段性',
		complete_delivery: false,
		pack_status: pack.review_status,
		delivery_status: pack.delivery_status,
		can_mark_deliverable: pack.can_mark_deliverable,
		module: config.module,
		rules: config.rules,
		implemented_skills: config.implementedSkills,
		audited_skills: config.auditedSkills,
		target_skills: pack.target_skills,
		target_characters: pack.target_characters,
		all_registered_skills: ALL_REGISTERED,
		counts: pack.counts,
		scenes: config.scenes,
		required: CONSTRAINTS[config.id].required,
		forbidden: CONSTRAINTS[config.id].forbidden,
		shared_files: {
			'policyCore.js': sha(sourceOf('score/decision/skills/policyCore.js')),
			'skillAIPolicies.js': sha(sourceOf('score/decision/skills/skillAIPolicies.js')),
			'skillAIPolicyPacks.js': sha(Buffer.from(packOnlyRegistry)),
		},
		pack_files: {
			[`packs/${config.module}.js`]: sha(sourceOf(`score/decision/skills/packs/${config.module}.js`)),
			[`rules/${config.rules}.js`]: sha(sourceOf(`score/decision/skills/rules/${config.rules}.js`)),
		},
		dependencies: ['score/index.js 已接线策略 facade', 'score/foundation/adapt/host.js', 'score/decision/safety/aiOverride.js'],
		head: HEAD,
		baseline: BASELINE,
	};
	write(stage, 'pack.json', JSON.stringify(packJson, null, 2) + '\n');

	const checklist = {
		schema_version: '1.0',
		pack_id: pack.pack_id,
		pack_name: pack.pack_name,
		pack_status: pack.review_status,
		delivery_status: pack.delivery_status,
		criteria: pack.criteria,
		counts: pack.counts,
		target_characters: pack.target_characters,
		target_skills: pack.target_skills,
		records,
	};
	write(stage, 'checklist.json', JSON.stringify(checklist, null, 2) + '\n');
	write(stage, 'checklist.md', checklistMarkdown(pack, records));
	write(stage, 'README.md', readme(pack, config, evidenceNames));
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
		'node tests/skill-ai-hp-real-host.mjs --mode identity --variant policy --scenarios "$SC" --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright> --output policy.json',
		'node tests/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy --host-root <宿主> --extension-root <扩展> --browser <Chrome> --playwright <Playwright>',
		'```', '',
		'集成本包：`node integration/apply-pack.mjs --extension-root <扩展> --dry-run`，确认后再执行；回滚：`node integration/rollback-pack.mjs --extension-root <扩展>`。',
	].join('\n') + '\n');

	const patchPaths = [
		'score/decision/skills/policyCore.js', 'score/decision/skills/skillAIPolicies.js', 'score/decision/skills/skillAIPolicyPacks.js',
		`score/decision/skills/packs/${config.module}.js`, `score/decision/skills/rules/${config.rules}.js`,
		'score/decision/skills/skillAIPolicyRules.js',
		'tools/verify.py', 'tools/test-verify-zip.py', 'tools/zip-package.py',
		'tools/pack-templates', 'tools/skill-ai-pack-config.mjs', 'tools/build-skill-ai-pack.mjs',
		'docs/skill-ai-20261030/142-task-list.json', 'docs/skill-ai-20261030/142-task-list.csv',
		'docs/skill-ai-20261030/pack-delivery.json', 'tools/build-skill-ai-task-list.py',
	];
	write(stage, `patches/pack-code.diff`, git(['diff', `${BASELINE}..${HEAD}`, '--binary', '--', ...patchPaths], null));
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
			const repoPath = child.startsWith('source/')
				? child.slice('source/'.length)
				: (child.startsWith('tests/') ? 'tools/' + child.slice('tests/'.length) : null);
			let commit = null;
			if (repoPath) {
				try { commit = git(['log', '-1', '--format=%h', '--', repoPath]).trim() || short; } catch (e) { commit = short; }
			}
			const purpose = child.startsWith('source/') ? '运行时分包代码（git show 导出）'
				: child.startsWith('contract/') ? '只读契约（134维/版本）'
				: child.startsWith('tests/') ? '测试脚本'
				: child.startsWith('evidence/') ? '原始运行产物（未修改）'
				: child.startsWith('patches/') ? 'Git 补丁'
				: child.startsWith('integration/') ? '安全集成/回滚脚本'
				: child === 'verify.py' ? '独立 SHA256 校验脚本'
				: child === 'pack.json' ? '分包元数据与哈希'
				: '交付文档';
			files.push({ path: child, size: hash.size, sha256: hash.sha256, commit, batch: '分包' + config.id, purpose });
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
			delivery_stage: '阶段性',
			pack_status: pack.review_status,
			delivery_status: pack.delivery_status,
			complete_delivery: false,
			target_skills: pack.target_skills,
			implemented_skills: config.implementedSkills,
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
	write(stage, 'manifest.json', JSON.stringify(manifest, null, 2) + '\n');

	const zipName = `feisheng-ai-${config.id.replace(/_/g, '-')}.zip`;
	const zipPath = path.join(OUT, zipName);
	fs.mkdirSync(OUT, { recursive: true });
	execFileSync('python', [path.join(REPO, 'tools', 'zip-package.py'), stage, zipPath], { cwd: REPO, encoding: 'utf8' });
	const verifyOut = execFileSync('python', [path.join(stage, 'verify.py'), '--zip', zipPath], { cwd: stage, encoding: 'utf8' });
	if (!verifyOut.includes('VERIFY PASS')) throw new Error('verify failed for ' + zipPath + '\n' + verifyOut);
	const zipHash = hashFile(zipPath).sha256;
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
	const entry = delivery.packs.find(item => item.pack_id === result.pack_id) || { pack_id: result.pack_id };
	Object.assign(entry, {
		status: '阶段性',
		delivery_status: '阶段性',
		zip_name: path.basename(result.zip),
		zip_sha256: result.zip_sha256,
		zip_size: result.zip_size,
		built_at: new Date().toISOString(),
	});
	if (!delivery.packs.includes(entry)) delivery.packs.push(entry);
}
fs.writeFileSync(deliveryPath, JSON.stringify(delivery, null, 2) + '\n');
console.log(JSON.stringify({ head: HEAD, results }, null, 2));
