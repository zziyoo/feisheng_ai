import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/32360/.codex/worktrees/remaining-ten-packs-acceptance';
const TMP = 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept';
const PHASE1 = path.join(ROOT, 'docs/remaining-ten-packs-acceptance/phase1/phase1-results.json');
const CLEAN = path.join(ROOT, 'docs/remaining-ten-packs-acceptance/host/evidence/real-host-clean.json');
const PATCHED = path.join(ROOT, 'docs/remaining-ten-packs-acceptance/host/evidence/real-host-patched.json');
const OUT = path.join(ROOT, 'docs/remaining-ten-packs-acceptance/phase2');
const HOSTS = {
  clean: 'C:/Users/32360/AppData/Local/Temp/shv-accept/host-a',
  patched: 'C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten',
};
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => { let v = JSON.parse(fs.readFileSync(p, 'utf8')); if (typeof v === 'string') v = JSON.parse(v); return v; };
const clean = read(CLEAN);
const patched = read(PATCHED);
const phase1 = read(PHASE1);
const scene = (r, n) => (r.scenes || []).find(s => s.name === n) || {};
const compact = o => { const x = { ...o }; delete x.before; delete x.after; delete x.durationMs; return x; };

const probes = [
  { pack: 'standard_2008', skill: 'tieji 铁骑', scene: 'tieji-roulin-tags', status: 'PASS', clean: 'directHit_ai=true; skillTagFilter=function', patched: 'directHit_ai=null; skillTagFilter=undefined', note: '移除未公开顶牌读取与必中标签；肉林同场景确认移除 directHit_ai/skillTagFilter' },
  { pack: 'standard_2008', skill: 'yiji 遗计', scene: 'yiji-nogain', status: 'PASS', clean: '目标选择为自身（nogain 未生效）', patched: '目标选择为正常可获牌友方', note: '真实 damage→yiji content→chooseTarget 调用链；自身与 nogain 友方均被补丁降为 0，正常友方被选中' },
  { pack: 'standard_2013', skill: 'retongji 同疾', scene: 'retongji-hidden', status: 'PASS', clean: 'check=true（读取同疾拥有者真实手牌）', patched: 'check=false（仅按目标已知牌判断）', note: '真实 retongji.cost→chooseToDiscard check；隐藏手牌交换后补丁不再依赖未公开信息' },
  { pack: 'standard_2019', skill: 'xinfu_jijie 机捷', scene: 'xinfu-jijie-nogain', status: 'PASS', clean: '目标选择为自身', patched: '目标选择为正常可获牌友方', note: '真实 xinfu_jijie.content→chooseTarget；自身 nogain 被跳过' },
  { pack: 'standard_2019', skill: 'xinfu_jiyuan 急援', scene: 'xinfu-jiyuan-check', status: 'PASS', clean: 'recover=true', patched: 'recover=false；dying=true 两侧相同', note: '真实 check 调用；濒死窗口保留，非濒死 nogain 目标被排除' },
  { pack: 'standard_2023', skill: 'shenzhi 神智', scene: 'shenzhi-check', status: 'PASS', clean: 'full=true; damaged=true', patched: 'full=false; damaged=true', note: '满血不再弃整手；受伤分支保留' },
  { pack: 'standard_2023', skill: 'stdshushen 淑慎', scene: 'stdshushen-nogain', status: 'PASS', clean: '选择 nogain 友方', patched: '无合法正常目标时取消', note: '真实 stdshushen.cost→chooseTarget；补丁不再把 nogain 目标当作正收益' },
  { pack: 'standard_2023', skill: 'stdxiaoguo 骁果', scene: 'stdxiaoguo-eff', status: 'PASS', clean: 'eff=6', patched: 'eff=-12.15', note: '真实 stdxiaoguo.cost→chooseToDiscard eff；无装备的 noe 目标不再获得正收益' },
  { pack: 'shenhua_lin', skill: 'luanwu 乱武', scene: 'luanwu-no-zhu', status: 'PASS', clean: 'TypeError: Cannot read properties of null (reading isZhu)', patched: '返回 -2.6667，无异常', note: 'P0 无主公场景已关闭' },
  { pack: 'shenhua_lin', skill: 'roulin 肉林', scene: 'tieji-roulin-tags', status: 'PASS', clean: 'directHit_ai=true; skillTagFilter=function; halfneg=true', patched: 'directHit_ai=null; skillTagFilter=undefined; halfneg=true', note: '移除错误必中标签，保留 halfneg' },
  { pack: 'shenhua_lin', skill: 'dimeng 缔盟', scene: 'dimeng-friendly', status: 'INCONCLUSIVE', clean: 'result=-6（未进入空候选分支）', patched: 'result=-6（未进入空候选分支）', note: '静态补丁含 !list.length guard；真实宿主中技能模块的 ui.selected 与测试页 lib.ui.selected 非同一实例，无法在不替换宿主实现的情况下强制空候选；P0 仍需手工选目标/完整对局确认' },
  { pack: 'shenhua_shan', skill: 'tuntian 屯田', scene: 'tuntian-viewer', status: 'INCONCLUSIVE', clean: '[0.6,0.75]; mayActor=true; mayAlly=true', patched: '[0.6,0.75]; mayActor=true; mayAlly=true', note: '补丁改为按观察者 mayHaveSha/mayHaveShan 与 getKnownCards 估计；当前固定局两种视角同值，未能构造可观察差异；静态 diff 已核对' },
  { pack: 'shenhua_shan', skill: 'zhiba 制霸', scene: 'zhiba-hidden', status: 'PASS', clean: 'olzhiba2=1; zhiba_global=1', patched: 'olzhiba2=0; zhiba_global=0', note: '隐藏高点手牌（13/12）未被公开；补丁不再读取真实点数' },
  { pack: 'shenhua_yin', skill: 'nzry_kuizhu 溃诛', scene: 'kuizhu-target', status: 'PASS', clean: '未选出合法伤害目标', patched: '选出 hp=2 的匹配目标', note: '真实 phaseDiscard 历史 + 伤害分支 chooseTarget；补丁要求目标体力等于弃牌数；AI 函数上下文由宿主事件提供，单独调用值不作结论' },
  { pack: 'shenhua_yin', skill: 'nzry_mingren 明任', scene: 'mingren-samecolor', status: 'PASS', clean: 'aiCandidate=87.27', patched: 'aiCandidate=0', note: '真实 nzry_mingren_1.cost→chooseCard AI；补丁改为统计换后仍留手的同色响应，本固定局无剩余同色牌故为 0' },
  { pack: 'refresh_huo', skill: 'oljieming 节命', scene: 'oljieming-maxhp', status: 'PASS', clean: '[1,2]', patched: '[0,4]', note: '按体力上限而非当前体力计算受伤补牌收益' },
  { pack: 'refresh_lin', skill: 'oldimeng 缔盟', scene: 'oldimeng-public', status: 'PASS', clean: '6.9205', patched: '2', note: '目标评分改为公开手牌数差，不再读取未知牌面' },
  { pack: 'refresh_shan', skill: 'olzhiba2 制霸', scene: 'zhiba-hidden', status: 'PASS', clean: 'olzhiba2=1', patched: 'olzhiba2=0', note: '隐藏高点手牌；补丁改用 getKnownCards' },
  { pack: 'refresh_lin', skill: 'olhaoshi 好施', scene: null, status: 'NOT TESTED', clean: '-', patched: '-', note: '补丁含 ai1 与援助 chooseCard AI 两处；本轮未构造真实交牌/援助固定局' },
  { pack: 'refresh_shan', skill: 'rehuashen 化身', scene: null, status: 'NOT TESTED', clean: '-', patched: '-', note: '补丁含阶段控制、制衡按钮、返回过滤三处；本轮未构造真实化身池固定局' },
];

const packStatus = [
  ['standard_2008', 'PASS', 'tieji/yiji 两项修改技能均有真实宿主差异'],
  ['standard_2013', 'PASS', 'retongji 修改技能有真实宿主差异'],
  ['standard_2019', 'PASS', 'xinfu_jijie/xinfu_jiyuan 均有真实宿主差异'],
  ['standard_2023', 'PASS', 'stdshushen/shenzhi/stdxiaoguo 均有真实宿主差异'],
  ['shenhua_lin', 'PARTIAL / BLOCKED', 'luanwu/roulin PASS；dimeng P0 真实空候选未直接确认'],
  ['shenhua_shan', 'PARTIAL', 'zhiba PASS；tuntian 隐藏信息差异未观察'],
  ['shenhua_yin', 'PASS', 'nzry_kuizhu/nzry_mingren 均有真实宿主差异'],
  ['refresh_huo', 'PASS', 'oljieming 有真实宿主差异'],
  ['refresh_lin', 'PARTIAL', 'oldimeng PASS；olhaoshi 未测'],
  ['refresh_shan', 'PARTIAL', 'olzhiba2 PASS；rehuashen 未测'],
];

const hostHashes = {};
for (const [k, dir] of Object.entries(HOSTS)) {
  hostHashes[k] = {};
  for (const f of ['standard', 'shenhua', 'refresh', 'sp', 'tw']) hostHashes[k][f] = sha(`${dir}/character/${f}.js`);
}
const patchHashes = (phase1.patches || []).map(p => [p.name, p.sha256, p.commit || '', p.headMatchesWorktree]);
const counts = {
  total: probes.length,
  pass: probes.filter(p => p.status === 'PASS').length,
  inconclusive: probes.filter(p => p.status === 'INCONCLUSIVE').length,
  notTested: probes.filter(p => p.status === 'NOT TESTED').length,
  packsPass: packStatus.filter(x => x[1] === 'PASS').length,
  packsPartial: packStatus.filter(x => x[1] !== 'PASS').length,
};

const lines = [];
lines.push('# 剩余十包独立验收 - 真实宿主报告');
lines.push('');
lines.push(`生成时间：${new Date().toISOString()}`);
lines.push('');
lines.push('## 1. 环境与对象');
lines.push('');
lines.push('- 宿主：无名杀 1.11.7（本机 Windows x64），身份局，seed `20261030`，Chrome 真实宿主。');
lines.push('- 开发分支/HEAD：`codex/remaining-ten-packs` / `1598a41cb7fb1ca03607657da2e6550f72ebe0cb`。');
lines.push('- 验收分支：`codex/remaining-ten-packs-acceptance`（工作树 `C:/Users/32360/.codex/worktrees/remaining-ten-packs-acceptance`）。');
lines.push('- 干净宿主：`host-a`，五文件哈希与交接文档原始值一致。');
lines.push('- 补丁宿主：`host-ten`，累计应用十份补丁后的四文件哈希见下表。');
lines.push('- 方法：Playwright 加载真实宿主；不替换 Player/GameEvent/技能 content 和结算；同一场景在干净/补丁宿主各跑一次。');
lines.push('');
lines.push('## 2. 宿主文件哈希');
lines.push('');
lines.push('| 文件 | 干净 host-a | 累计补丁 host-ten |');
lines.push('| --- | --- | --- |');
for (const f of ['standard', 'shenhua', 'refresh', 'sp', 'tw']) lines.push(`| \`character/${f}.js\` | \`${hostHashes.clean[f]}\` | \`${hostHashes.patched[f]}\` |`);
lines.push('');
lines.push('## 3. 真实宿主探针结果');
lines.push('');
lines.push('| 分包 | 技能 | 场景 | 干净宿主 | 补丁宿主 | 结论 |');
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const p of probes) lines.push(`| ${p.pack} | ${p.skill} | ${p.scene || '—'} | ${p.clean} | ${p.patched} | **${p.status}** |`);
lines.push('');
lines.push(`探针合计：**${counts.total}**；PASS **${counts.pass}**；INCONCLUSIVE **${counts.inconclusive}**；NOT TESTED **${counts.notTested}**。`);
lines.push('');
lines.push('### 关键说明');
lines.push('');
for (const p of probes.filter(x => x.status !== 'PASS')) lines.push(`- **${p.pack} / ${p.skill}（${p.status}）**：${p.note}`);
lines.push('');
lines.push('## 4. 分包验收状态');
lines.push('');
lines.push('| 分包 | 状态 | 依据 |');
lines.push('| --- | --- | --- |');
for (const [p, s, n] of packStatus) lines.push(`| ${p} | **${s}** | ${n} |`);
lines.push('');
lines.push('## 5. P0/P1/P2 与覆盖边界');
lines.push('');
lines.push('- **P0**：`luanwu` 无主公真实宿主已从 TypeError 修复为正常返回；`dimeng` 空候选静态 guard 已确认存在，但真实宿主空候选选择未被直接确认；`huashen` 空池异常仍为未解决/未覆盖。');
lines.push('- **P1**：`tieji`、`roulin`、`retongji`、`yiji`、`xinfu_jijie`、`xinfu_jiyuan`、`shenzhi`、`stdshushen`、`stdxiaoguo`、`zhiba`、`olzhiba2`、`nzry_kuizhu`、`nzry_mingren`、`oljieming`、`oldimeng` 均有真实宿主差异；`tuntian` 未观察到差异；`olhaoshi`、`rehuashen` 未测。');
lines.push('- **未覆盖宿主边界**：`qizhi` 受保护牌、`reqiaobian` 弃牌上下文、`feijun` 支付后目标、`huashen` 空池、完整 81 将/164 技能矩阵、Android/联机/斗地主/国战/2v2、旧六包扩展与十包原生叠加。');
lines.push('- **P2**：沿用开发台账；本轮未清零，也未把 P2 改写成 PASS。');
lines.push('');
lines.push('## 6. 覆盖数量');
lines.push('');
lines.push('- 开发台账登记：81 名武将 / 164 项技能关联；十包补丁修改 20 项登记技能条目（开发报告称 24 个回调检查，其中 1 项为不变对照）。');
lines.push('- 本轮真实宿主探针覆盖 16 个技能场景；20 项登记技能条目中 18 项有测试（16 项 PASS、2 项 INCONCLUSIVE：dimeng、tuntian），2 项 NOT TESTED（olhaoshi、rehuashen）。');
lines.push('- 其余未修改技能沿用开发台账的审查/历史证据，未在本轮逐项真实对局。');
lines.push('');
lines.push('## 7. 十包补丁 SHA256 与 Git');
lines.push('');
lines.push('| 分包 | SHA256 | 开发提交 | 工作树=HEAD |');
lines.push('| --- | --- | --- | --- |');
for (const [name, hash, commit, match] of patchHashes) lines.push(`| ${name} | \`${hash}\` | ${commit} | ${match ? 'PASS' : 'FAIL'} |`);
lines.push('');
lines.push('- 十份补丁独立/累计应用、语法、逆向撤销、原始字节恢复见 `../phase1/phase1-report.md`。');
lines.push('- 验收分支未 push、未合并、未创建 Release/Tag；开发分支未被修改。');
lines.push('');
lines.push('## 8. 结论');
lines.push('');
lines.push('**第一阶段十份原生补丁交付门禁 PASS；真实宿主导入门禁为部分通过。**');
lines.push('');
lines.push('按分包：standard_2008、standard_2013、standard_2019、standard_2023、shenhua_yin、refresh_huo 的修改技能均取得真实宿主差异；shenhua_lin（dimeng P0）、shenhua_shan（tuntian）、refresh_lin（olhaoshi）、refresh_shan（rehuashen）仍存在未确认/未覆盖项。');
lines.push('');
lines.push('因此本轮 **不宣布“剩余10个分包最终内部交付 PASS”**。只有在 dimeng 空候选、tuntian 隐藏视角、olhaoshi、rehuashen 以及未覆盖宿主边界取得可复现证据后，才能进行最终十六包兼容性评估。');
lines.push('');
lines.push('**未公开发布；未 push；P2 未关闭；本报告为内部验收记录。**');
lines.push('');

fs.writeFileSync(path.join(OUT, 'real-host-report.md'), lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'real-host-summary.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  devHead: '1598a41cb7fb1ca03607657da2e6550f72ebe0cb',
  acceptanceBranch: 'codex/remaining-ten-packs-acceptance',
  hostHashes, patchHashes, probes, packStatus, counts,
  overall: 'PHASE1_PASS_REAL_HOST_PARTIAL',
  fullTenPackPass: false,
}, null, 2), 'utf8');
const patchArtifacts = phase1.patches.map(p => {
  const file = path.join(ROOT, p.rel);
  return { pack: p.name, file: p.rel, size: fs.statSync(file).size, sha256: p.sha256, commit: p.commit, headMatchesWorktree: p.headMatchesWorktree, eol: p.eol };
});
const evidenceFiles = [
  'docs/remaining-ten-packs-acceptance/phase1/phase1-report.md',
  'docs/remaining-ten-packs-acceptance/phase1/phase1-results.json',
  'docs/remaining-ten-packs-acceptance/phase2/real-host-report.md',
  'docs/remaining-ten-packs-acceptance/phase2/real-host-summary.json',
  'docs/remaining-ten-packs-acceptance/host/evidence/real-host-clean.json',
  'docs/remaining-ten-packs-acceptance/host/evidence/real-host-patched.json',
  'docs/remaining-ten-packs-acceptance/host/run-host.mjs',
  'docs/remaining-ten-packs-acceptance/host/ten-pack-scenes.mjs',
];
const evidence = evidenceFiles.map(rel => ({
  file: rel,
  size: fs.statSync(path.join(ROOT, rel)).size,
  sha256: sha(path.join(ROOT, rel)),
}));
const manifest = {
  generatedAt: new Date().toISOString(),
  devHead: '1598a41cb7fb1ca03607657da2e6550f72ebe0cb',
  acceptanceBranch: 'codex/remaining-ten-packs-acceptance',
  deliveryRoute: 'native-ai-patches-only; no extension ZIPs',
  overall: 'PHASE1_PASS_REAL_HOST_PARTIAL',
  fullTenPackPass: false,
  patches: patchArtifacts,
  hostHashes,
  evidence,
  blockers: [
    'shenhua_lin dimeng empty-candidate P0 real-host manual selection not directly confirmed',
    'shenhua_shan tuntian hidden-viewer difference not observed',
    'refresh_lin olhaoshi real-host fixed scenario not executed',
    'refresh_shan rehuashen real-host fixed scenario not executed',
    'qizhi protected-card, reqiaobian discard context, feijun post-payment, huashen empty pool, old six-pack coexistence, full 81/164 matrix not covered',
  ],
};
fs.writeFileSync(path.join(ROOT, 'docs/remaining-ten-packs-acceptance/artifact-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
const d = [];
d.push('# 剩余十包独立验收 - 交付产物与兼容性说明');
d.push('');
d.push(`生成时间：${manifest.generatedAt}`);
d.push('');
d.push('## 交付路线');
d.push('');
d.push('- 本轮交付物为 **十份原生 AI 补丁 + 逐技能审查/验收记录**；现有构建器不支持十包扩展 ZIP，**未擅自生成扩展 ZIP**。');
d.push('- 十份补丁可独立应用，也可按声明顺序累计应用；静态应用/语法/逆向恢复见 `phase1/phase1-report.md`。');
d.push('- 与已封版六包的扩展策略混用时，同一技能只能二选一；本轮未完成十包原生与六包扩展的完整共存验收，**不得宣称双端全覆盖**。');
d.push('');
d.push('## 十份补丁');
d.push('');
d.push('| 分包 | 补丁 | 大小(B) | SHA256 | 开发提交 | 工作树=HEAD |');
d.push('| --- | --- | ---: | --- | --- | --- |');
for (const p of patchArtifacts) d.push(`| ${p.pack} | \`${path.basename(p.file)}\` | ${p.size} | \`${p.sha256}\` | ${p.commit} | ${p.headMatchesWorktree ? 'PASS' : 'FAIL'} |`);
d.push('');
d.push('## 应用/撤销');
d.push('');
d.push('```bash');
d.push('git -c core.autocrlf=false apply --check <补丁>');
d.push('git -c core.autocrlf=false apply <补丁>');
d.push('node --check character/standard.js  # 按补丁触及文件');
d.push('git -c core.autocrlf=false apply -R --check <补丁>');
d.push('git -c core.autocrlf=false apply -R <补丁>');
d.push('```');
d.push('');
d.push('累计顺序：`standard_2008 → standard_2013 → standard_2019 → standard_2023 → shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan`。');
d.push('');
d.push('## 验收证据');
d.push('');
d.push('| 文件 | 大小(B) | SHA256 |');
d.push('| --- | ---: | --- |');
for (const e of evidence) d.push(`| \`${e.file}\` | ${e.size} | \`${e.sha256}\` |`);
d.push('');
d.push('## 状态与限制');
d.push('');
d.push('- Phase 1：十份补丁独立/累计应用、四文件语法、逆向恢复、原始字节恢复、HEAD 一致性、LF 检查全部 PASS。');
d.push('- 真实宿主：16 项 PASS、2 项 INCONCLUSIVE（dimeng、tuntian）、2 项 NOT TESTED（olhaoshi、rehuashen）；按分包 6 PASS / 4 PARTIAL。');
d.push('- **不宣布“剩余10个分包最终内部交付 PASS”**；P0/P1 阻塞项与未覆盖边界见 `phase2/real-host-report.md`。');
d.push('- 未 push、未合并、未创建 Release/Tag；P2 未关闭；P2 沿用开发台账。');
d.push('');
d.push(`开发 HEAD：\`${manifest.devHead}\`；验收分支：\`${manifest.acceptanceBranch}\`。`);
d.push('');
fs.writeFileSync(path.join(ROOT, 'docs/remaining-ten-packs-acceptance/DELIVERY.md'), d.join('\n'), 'utf8');
console.log(JSON.stringify({ counts, packStatus, artifacts: patchArtifacts.length, evidence: evidence.length, out: OUT }, null, 2));
