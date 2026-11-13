#!/usr/bin/env node
// 验收通过后收口神话风 ZIP 元数据：只改状态/文档/证据并重算 manifest，不改 source/ 字节。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const option = name => { const i = process.argv.indexOf('--' + name); return i < 0 ? null : process.argv[i + 1]; };
const candidate = path.resolve(option('candidate') || path.join(ROOT, 'build/feisheng-ai-shenhua-feng.zip'));
const out = path.resolve(option('out') || path.join(ROOT, 'build/feisheng-ai-shenhua-feng-final.zip'));
const acceptancePath = path.resolve(option('acceptance') || path.join(ROOT, 'evidence/accept-six-new-feng.json'));
const fourPath = path.resolve(option('four-config') || path.join(ROOT, 'evidence/kuanggu-four-config.json'));
const rulePath = path.resolve(option('rule-matrix') || path.join(ROOT, 'evidence/kuanggu-rule-matrix.json'));
const stage = path.join(ROOT, 'build/final-stage');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const read = file => fs.readFileSync(file);
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const json = file => JSON.parse(read(file).toString('utf8'));
const sourceHead = '25b950356627b9c236c4faf3be82e3481ad09111';
const fixCommit = 'ede9966';
const candidateSha = sha(read(candidate));
const acceptance = json(acceptancePath);
if (!acceptance.pass) throw new Error('六包验收尚未通过，不能收口为内部验收通过：' + (acceptance.error || ''));
const fengCheck = acceptance.skillChecks && acceptance.skillChecks.shenhua_feng;
if (!fengCheck) throw new Error('六包验收缺少 shenhua_feng 检查结果');
const four = json(fourPath);
const rule = json(rulePath);

fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });
execFileSync('python', ['-m', 'zipfile', '-e', candidate, stage], { cwd: ROOT, stdio: 'inherit' });

const packJsonPath = path.join(stage, 'pack.json');
const manifestPath = path.join(stage, 'manifest.json');
const pack = json(packJsonPath);
const manifest = json(manifestPath);
const accepted = {
	delivery_stage: '内部验收通过',
	complete_delivery: true,
	pack_status: '内部验收通过',
	delivery_status: '内部验收通过',
	can_mark_deliverable: true,
	external_integration_receipt: 'pending',
	external_integration_note: '外部集成回执尚未取得',
	publication_status: '未发布',
};
const kuangguFix = {
	skill: 'xinkuanggu',
	development_head: sourceHead,
	fix_commit: fixCommit,
	decision_rule: '受伤且回复收益>0时，hp<=1 或杀资源充足或 回复收益>摸牌收益 回复；否则摸牌。与正式双风原生补丁公式一致。',
	real_host_original: { recoverEffect: 19.5, drawEffect: 13, shaReady: 1, shaUsable: 0, old_extension: 'draw_card', native_baseline: 'recover_hp', native_patch: 'recover_hp', fixed_extension: 'recover_hp' },
	retired_legacy_assertions: [
		'shenhua-kuanggu-draw (3血+连弩+1杀，旧规则摸牌；正式原生补丁与新扩展回复)',
		'quality-kuanggu-midhp (3血无手牌，旧规则摸牌；正式原生补丁与新扩展回复)',
	],
	real_host_fullhp_draw: { recoverEffect: 0, drawEffect: 13.5, choice: 'draw_card' },
	evidence: 'evidence/kuanggu-fix-acceptance.json',
	notes: '真实宿主默认回复:摸牌收益比为 1.5:1；摸牌高于回复的边界无法用默认宿主收益构造，规则级 synthetic 行仅作边界覆盖。',
};
const acceptanceMeta = {
	status: 'PASS',
	scope: '真实宿主四配置狂骨对照 + 六包统一集成安装/逆序回滚',
	development_head: sourceHead,
	fix_commit: fixCommit,
	source_head: sourceHead,
	candidate_zip_sha256: candidateSha,
	six_pack_result: 'accept-six-new-feng.json',
	evidence: 'evidence/kuanggu-fix-acceptance.json',
	install_order_note: '双风对包哈希为单向声明：必须先安装 refresh_feng，再安装本包；反序会被安装器安全拒绝且零写入。',
	not_public_release: true,
};
Object.assign(pack, accepted, { kuanggu_fix: kuangguFix, acceptance: acceptanceMeta });
write(packJsonPath, JSON.stringify(pack, null, 2) + '\n');

Object.assign(manifest.package, accepted, { kuanggu_fix: kuangguFix, acceptance: acceptanceMeta });

const compact = {
	schema_version: '1.0',
	pack: 'shenhua_feng',
	source_head: sourceHead,
	fix_commit: fixCommit,
	candidate_zip_sha256: candidateSha,
	host: four.host,
	configs: four.configs,
	scenes: four.scenes,
	real_host_conclusion: four.conclusion,
	rule_matrix: {
		rule_sha256: rule.rule_sha256,
		verdict: rule.verdict,
		rows: rule.rows,
	},
	six_pack_acceptance: {
		pass: acceptance.pass,
		packs: (acceptance.packs || []).map(item => ({ id: item.id, zip_sha256: item.zip_sha256, delivery_stage: item.delivery_stage })),
		skill_checks: {
			shenhua_feng: fengCheck.signature,
			refresh_feng: acceptance.skillChecks.refresh_feng && acceptance.skillChecks.refresh_feng.signature,
			shenhua_lei: acceptance.skillChecks.shenhua_lei && acceptance.skillChecks.shenhua_lei.signature,
		},
		rollback_steps: (acceptance.steps || []).filter(step => String(step.step).startsWith('rollback-coexist')).map(step => ({ pack: step.pack, status: step.status, remaining: step.remaining })),
	},
};
write(path.join(stage, 'evidence/kuanggu-fix-acceptance.json'), JSON.stringify(compact, null, 2) + '\n');

const readme = `# 神话再临·风 AI 扩展（内部验收通过）

8名武将、11项原生AI修改；红颜为被动关联，不单独修改。宿主 1.11.7，无名AI 4.4.4；源码 HEAD \`${sourceHead}\`（狂骨修复提交 \`${fixCommit}\`）。

本版修复【狂骨】回复/摸牌决策：按宿主真实 \`get.recoverEffect\` / \`get.effect\` 比较收益，与正式双风原生补丁公式一致。原封版在“3血、已出杀、剩余杀次数0”时选择摸牌，而真实宿主回复收益为 19.5、摸牌收益为 13（威胁缩放后仍为 1.5:1），原生基线与正式原生补丁均选择回复；新扩展选择回复。详见 \`ACCEPTANCE.md\`、\`docs/KUANGGU-P1-FIX.md\` 和 \`evidence/kuanggu-fix-acceptance.json\`。

原生方案：仅使用根目录 \`feisheng-ai-shenhua-feng-native-ai.patch\`，对干净宿主 \`character/shenhua.js\` 应用。历史 \`wind-native.patch\` 和 0001–0013 不得叠加。

扩展方案：执行 \`node integration/apply-pack.mjs --extension-root <扩展目录>\`；回滚使用 \`node integration/rollback-pack.mjs --extension-root <扩展目录>\`。先使用 \`--dry-run\` 检查。天香新评分仅在原生补丁中；扩展独立安装使用宿主原始AI。

双风共存：本包与旧 \`refresh_feng\` 包的对包哈希是单向声明，必须先安装 \`refresh_feng\`，再安装本包；反序会被安装器安全拒绝且不写入任何文件。原生补丁与同技能扩展策略不得叠加；安装器无法自动检测宿主原生补丁，部署者须自行核对。

本包为内部开发者交付，未公开发布；外部集成回执待取得。完整六包顺序、迁移与限制见交付目录 \`README.md\` / \`UPGRADE.md\`。
`;
write(path.join(stage, 'README.md'), readme);

const acceptanceDoc = `# 神话再临·风 AI 扩展验收状态

状态：**内部验收通过**（开发者交付）；未公开发布。

- 开发 HEAD：\`${sourceHead}\`
- 狂骨修复提交：\`${fixCommit}\`
- 源码构建 HEAD：\`${sourceHead}\`
- 候选测试 ZIP SHA256：\`${candidateSha}\`
- 最终 ZIP SHA256：见交付目录 \`SHA256SUMS.txt\`（最终 ZIP 仅收口状态/文档/证据元数据，\`source/\` 字节与候选 ZIP 完全一致）。

## 验收范围

1. 真实无名杀 1.11.7 身份局四配置对照：未修复原生、正式双风原生补丁、封版扩展、新修复扩展；覆盖原场景、满血、低血、无杀手牌、连弩、直伤和连续伤害。
2. 六包统一集成：按兼容顺序安装、全部加载、共享核心一致、双风共存、狂骨新策略生效、镇骨/鞬出/缔盟等关键修复、卸载神话风、逆序全量回滚、重装、故障注入与共享核心冲突拒绝。
3. ZIP 完整性：\`verify.py --zip\`、manifest 路径/哈希、\`source/\` 与 Git blob 哈希一致。

## 结论

- 原始狂骨 P1 成立：封版扩展在原场景选择摸牌，正式原生补丁与真实收益均要求回复。
- 新扩展在 8 个真实宿主场景的决策与正式原生补丁逐项一致；未发现新的结算异常。
- 旧 \`shenhua-kuanggu-draw\` / \`quality-kuanggu-midhp\` 断言基于旧封版摸牌策略，与正式原生补丁冲突；已作为历史对照保留，默认验收改用满血摸牌与 3 血回复场景。
- 双风安装顺序依赖：必须先安装 \`refresh_feng\`，再安装本包；反序会被安全拒绝（零写入）。

## 限制

未做公开发布、外部集成回执、Android 真机、联机、斗地主/国战/2v2、浏览器人工点击级验证；不支持的叠加组合见交付目录 \`README.md\` C 节。
`;
write(path.join(stage, 'ACCEPTANCE.md'), acceptanceDoc);

const commandsDoc = `# 本分包测试命令

\`\`\`bash
python verify.py
python verify.py --zip <本包.zip>
\`\`\`

扩展安装（先检查）：

\`\`\`bash
node integration/apply-pack.mjs --extension-root <扩展目录> --dry-run
node integration/apply-pack.mjs --extension-root <扩展目录>
node integration/rollback-pack.mjs --extension-root <扩展目录>
\`\`\`

双风共存：先安装 \`refresh_feng\`，再安装本包。原生补丁与扩展策略不得叠加；安装器无法自动检测宿主原生补丁，部署者须自行核对。
`;
write(path.join(stage, 'COMMANDS.md'), commandsDoc);

const checklistPath = path.join(stage, 'checklist.json');
const checklist = json(checklistPath);
Object.assign(checklist, {
	pack_status: '内部验收通过',
	delivery_status: '内部验收通过',
	can_mark_deliverable: true,
	external_integration_receipt: 'pending',
	external_integration_note: '外部集成回执尚未取得',
	kuanggu_fix: kuangguFix,
});
write(checklistPath, JSON.stringify(checklist, null, 2) + '\n');
write(path.join(stage, 'checklist.md'), `# 神话再临·风 AI 检查清单

状态：内部验收通过；未公开发布。

- 8 名武将、11 项原生 AI 修改；红颜为被动关联。
- 狂骨：按真实回复/摸牌收益比较，修复 3 血已出杀场景；与正式双风原生补丁一致。
- 真实宿主四配置与六包统一集成/逆序回滚证据见 \`evidence/kuanggu-fix-acceptance.json\`。
- 双风安装顺序：先 \`refresh_feng\`，后本包。
`);

write(path.join(stage, 'docs/KUANGGU-P1-FIX.md'), `# 狂骨 P1 修复与验收

## 结论

原始 P1 成立。封版扩展在“3血、已出杀、剩余杀次数0、手牌仍有杀”时选择摸牌；真实宿主回复收益 19.5、摸牌收益 13（威胁缩放后仍为 1.5:1）。未修复原生、正式双风原生补丁和新修复扩展均选择回复。新扩展与正式原生补丁在 8 个真实宿主场景逐项一致。

## 四配置真实宿主

| 场景 | A 未修复原生 | B 正式原生补丁 | C 封版扩展 | D 新扩展 |
| --- | --- | --- | --- | --- |
| 原场景 hp3 2杀 | 回复 | 回复 | 摸牌 | 回复 |
| 满血 hp4 2杀 | 摸牌 | 摸牌 | 摸牌 | 摸牌 |
| 低血 hp1 2杀 | 回复 | 回复 | 回复 | 回复 |
| 无杀 hp3 1杀 | 回复 | 回复 | 摸牌 | 回复 |
| 3血无手牌直伤 | 摸牌 | 回复 | 摸牌 | 回复 |
| 连续两次伤害 | 摸牌 | 回复 | 摸牌 | 回复 |
| 连弩 3血 1杀 | 摸牌 | 回复 | 摸牌 | 回复 |

## 验收口径变化

旧默认场景 \`shenhua-kuanggu-draw\` 和 \`quality-kuanggu-midhp\` 期望摸牌，基于封版扩展的旧策略；正式原生补丁在同一状态回复，因此不再作为新包默认验收，保留为历史对照。默认摸牌分支改由满血（回复收益 0）场景覆盖；3 血同局面改由 \`quality-kuanggu-midhp-recover\` 验证回复及结算。

## 证据

- \`evidence/kuanggu-fix-acceptance.json\`：四配置、规则矩阵、六包验收摘要。
- 交付目录 \`evidence/kuanggu-A-native.json\`、\`kuanggu-B-native-patched.json\`、\`kuanggu-C-old-extension.json\`、\`kuanggu-D-new-extension-lf.json\`、\`kuanggu-rule-matrix.json\`、\`accept-six-new-feng.json\`。
`);

const files = [];
const walk = rel => {
	for (const entry of fs.readdirSync(path.join(stage, rel), { withFileTypes: true })) {
		const child = rel ? rel + '/' + entry.name : entry.name;
		if (entry.isDirectory()) walk(child);
		else if (child !== 'manifest.json') {
			const bytes = read(path.join(stage, child));
			const old = (manifest.files || []).find(item => item.path === child);
			files.push(old
				? { ...old, size: bytes.length, sha256: sha(bytes) }
				: { path: child, size: bytes.length, sha256: sha(bytes), commit: null, source_kind: 'generated', repo_path: null, batch: '分包shenhua_feng', purpose: '验收证据/交付文档' });
		}
	}
};
walk('');
files.sort((a, b) => a.path.localeCompare(b.path));
manifest.files = files;
write(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

fs.rmSync(out, { force: true });
execFileSync('python', [path.join(ROOT, 'tools/zip-package.py'), stage, out], { cwd: ROOT, stdio: 'inherit' });
const verify = execFileSync('python', [path.join(stage, 'verify.py'), '--zip', out], { cwd: ROOT, encoding: 'utf8' });
console.log(verify.trim());
if (!verify.includes('VERIFY PASS')) throw new Error('最终 ZIP 校验失败');
const finalSha = sha(read(out));
console.log(JSON.stringify({ candidate, candidate_sha256: candidateSha, final: out, final_sha256: finalSha, size: fs.statSync(out).size, files: files.length }, null, 2));
