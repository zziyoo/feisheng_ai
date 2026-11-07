# 界限突破·标准全量静态审查候选

- 分包：`refresh_standard`；无名 AI 4.4.4；目标宿主无名杀 1.11.7。
- 本包源码 HEAD：`{{HEAD}}`；无名 AI 上游基线：`{{BASELINE}}`。
- 范围为 29 名武将、57 项登记技能，已经完成静态源码审查。完整入口及结论见 `docs/FULL-SKILL-AUDIT.md`。
- 当前是源码候选；三项修复已完成独立宿主专项验证，但累计原生补丁的 hunk 元数据 P0 修复后仍需独立 Agent 复验封包。`delivery_stage` 为“全量源码审查完成·待最终验收”；`complete_delivery` 和 `can_mark_deliverable` 为 false。

## 本版变化

此前第一至第四批包含 17 项技能专项优化。本候选在保留这 17 项的基础上，加入全量 57 项审查及三项原生与扩展修复：离间 `lijian`、急救 `jijiu`、倾国 `qingguo`。原生累计 AI 优化 20 项。前四批的专项验收结论按既有交接记录保留；本轮三项修复及代表性回归已由独立 Agent 在隔离 1.11.7 宿主完成，但累计补丁 hunk 元数据 P0 导致交付判定 FAIL。本版已做补丁元数据定向修复，最终封包与宿主复验仍待独立 Agent 新一轮 PASS 报告。

这不表示 29 名武将均获得了代码优化，也不代表完整宿主回归或正式发布验收。

## 原生补丁与扩展策略范围

累计原生补丁涵盖 20 项：`rezhiheng`、`rerende`、`new_reyiji`、`new_reluoyi`、`new_yijue`、`refanjian`、`new_reqingnang`、`rejieyin`、`new_qingjian`、`new_liyu`、`retieji`、`reganglie`、`reqianxun`、`relianying`、`olyajiao`、`refankui`、`zhaxiang`、`lijian`、`jijiu`、`qingguo`。

扩展接管 13 项方案 B 优化：`rezhiheng`、`rerende`、`new_yijue`、`refanjian`、`new_reqingnang`、`rejieyin`、`retieji`、`reganglie`、`reqianxun`、`refankui`、`lijian`、`jijiu`、`qingguo`；另保留既有突袭 `new_retuxi`，扩展策略共注册 14 项。遗计 `new_reyiji`、裸衣 `new_reluoyi`、清俭 `new_qingjian`、利驭 `new_liyu`、连营 `relianying`、涯角 `olyajiao`、诈降 `zhaxiang` 的新增优化只在原生补丁中，扩展独立安装沿用宿主原始 AI。

原生补丁和扩展是替代路线。不要在同一技能上同时启用两条接管。

## 已知边界

- 铁骑 `retieji` AI 标签存在极端状态变化边界；反馈 `refankui` 多装备场景仍有未覆盖边界。
- 诈降 `zhaxiang` 的真实 `loseHp` 牌载体与合成测试场景处于不同验证层级。
- 谦逊 `reqianxun` 的完整引擎消费路径尚未全量证明。
- 前四批的专项验收不替代本轮完整归档、安装、回滚和跨技能组合验收。
- Codex 开发阶段没有执行测试、语法检查、补丁应用、宿主、安装或构建；独立 Agent 的验证结果、P0 复现与复验关口见仓库 `docs/skill-ai-quality-20261103/refresh-standard/P0-PATCH-FIX-HANDOFF.md`（该交接为仓库文档，不随候选 ZIP 复制）。

## 集成和依赖

包内包含标准策略、局部规则、共享策略核心及实际依赖模块，包括 `skillPlanHints.js`、`boundedSkillUtility.js`、`refreshStandardPlans.js`、安装和回滚工具。完整引擎还须提供策略 facade、host adapter、安全接管与 utility 模块。旧引擎若未接入 `applySkillPlanHints`，软建议不会因此仅凭模块复制而生效。

安装前先在隔离扩展副本检查共享核心版本冲突，再按 `integration/apply-pack.mjs` 说明安装；回滚使用 `integration/rollback-pack.mjs`。安装器拒绝不兼容共享核心时，不得强制覆盖。旧神话风、火、雷、界风包无需重发；它们可能依赖不同哈希的共享核心，需由开发者协调迁移。神话风和界风仍互斥。

## 补丁适用性

`feisheng-ai-refresh-standard-native-ai.patch` 目标为宿主 1.11.7 的 `character/refresh.js` 与 `character/standard.js`。目标宿主提交和既有【酒】次数修复可能有差异。先对隔离副本核对版本和 diff，再检查补丁适用性；不得强制应用或覆盖现有修改。补丁修改 AI 评分、目标/材料选择回调及必要的 AI 过滤、技能标签判断；不修改技能 `content`、伤害/回复/牌移动结算。历史 17 项中含少量 AI 过滤与技能标签修订，均按对应批次验收；本轮三项仅修改 `character/standard.js` 的评分索引返回与“离间”决斗参与者参数。

## 验收与完整性

独立验收已完成 3 项新增技能、9 项历史代表回归、安装/回滚与真实宿主冒烟；因累计原生补丁 `standard.js` 三个 hunk 的上下文/行数元数据损坏，判定 FAIL，未生成最终完整版。本版已定向修复补丁元数据，等待独立 Agent 从新 Commit 复验。候选 manifest 仍保持 `complete_delivery=false`、`can_mark_deliverable=false`、`current_round_verified_skills=0`，不得提前改为发布通过；最终交付以新一轮 PASS 报告为准。全量审查矩阵见 `docs/FULL-SKILL-AUDIT.md`，定向验收步骤见 `docs/FULL-SKILL-ACCEPTANCE-HANDOFF.md`，P0 修复与五关复验见仓库 `docs/skill-ai-quality-20261103/refresh-standard/P0-PATCH-FIX-HANDOFF.md`。构建器生成的 `manifest.json` 会记录当前 HEAD、Git blob 来源和包内文件哈希；独立 Agent 应重新构建、核对包内文件、原生补丁、依赖、安装、回滚和三项新修复，再记录实际 ZIP 与补丁 SHA256。`evidence_files=[]` 来自标准候选分支的当前构建规则（候选阶段不复制 evidence），不等于整个工程没有运行证据；最终包如需内嵌 evidence，必须调整构建规则或在外置验收报告中绑定证据哈希，不得伪造字段。
