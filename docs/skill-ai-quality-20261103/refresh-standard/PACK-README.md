# 界限突破·标准：方案 B 第一至第四批开发者候选

- 分包 `refresh_standard`；无名AI 4.4.4，目标宿主无名杀 1.11.7。
- 本包源码 HEAD：`{{HEAD}}`；无名AI 上游基线：`{{BASELINE}}`。
- 用户提供的信息称四批技能专项验收已通过；本 ZIP 的封包、安装、回滚及兼容性尚须独立 Agent 验收。包内未附完整原始验收证据，不能由本包单独复核该结论。
- 四批专项验收不代表界限突破·标准全部武将完成优化，也不代表完整宿主发布验收。Android 真机性能、完整回归和模型训练均未由本包证明。

## 实际范围和接线

相较已发送的第一、第二批标准包，本候选新增第三批结姻、清俭、利驭、铁骑、刚烈及第四批谦逊、连营、涯角、反馈、诈降，共 **10 项**。累计原生补丁包含四批 17 项独立技能的 AI 修改，完整 ID 及分批清单见 `checklist.md`。

扩展接线覆盖制衡、仁德、义绝、反间、青囊、结姻、铁骑、刚烈、谦逊、反馈，共 10 项方案 B 优化，另保留既有突袭 `new_retuxi`，共注册 11 项。遗计、裸衣、清俭、利驭、连营、涯角、诈降的新评分仅原生补丁支持，单独安装扩展沿用宿主相应原始 AI。完整引擎候选层不一定消费宿主评分，局部规划选择也不等于完整引擎主动提交或结算成功。

已知观察：铁骑 AI 标签在极端状态变化时存在边界；反馈的多装备场景尚有未覆盖边界；诈降真实 `loseHp` 牌载体与合成场景的验证层级不同；谦逊宿主效果评分是否被完整引擎最终消费尚未全量证明。这些是待进一步验证的边界，不等于已修复缺陷或已证实的 P1。技能决策细节见 `docs/BATCH3-HANDOFF.md` 和 `docs/BATCH4-HANDOFF.md`；两份文件保留开发时状态，后续专项验收结论依据用户提供的信息，并不代表本 ZIP 已通过封包验收。

本包元数据的 `delivery_stage` 为“封包待验收候选”、`delivery_status` 为“封包待验收”，`complete_delivery` 和 `can_mark_deliverable` 均为 false，表示该归档尚未完成独立封包验收，而非否认既有技能专项结果。独立 Agent 可通过外部验收报告记录该 ZIP 的精确哈希及结果；若要修改包内字段，必须重新生成并重新校验该最终归档，不能将旧 ZIP 的验收转移到修改后的 ZIP。即使开发者集成测试候选通过，亦不等于正式发布验收。

原生补丁与扩展是**替代路线**：不要同时为相同技能启用两份 AI 接管。本包不会自动应用原生补丁。原生路线使用 `feisheng-ai-refresh-standard-native-ai.patch`，目标是 1.11.7 的 `character/refresh.js`。补丁基于开发时的本地宿主副本生成；不同 1.11.7 提交及已有酒次数修复可能产生差异。先在隔离副本确认目标版本、核对 diff 并检查补丁适用性，不可强制应用或覆盖现有修复。

## 扩展依赖和安装

包内包括策略模块、局部规则、`policyCore.js`、`skillAIPolicies.js`、`skillVetoRegistry.js`、`skillPlanHints.js`、`boundedSkillUtility.js`、`refreshStandardPlans.js`，以及安装和回滚脚本。宿主扩展还须提供 `score/index.js` 的策略 facade、`score/foundation/adapt/host.js`、`score/decision/safety/aiOverride.js`、`score/decision/utility/utilityPipeline.js`（含 `applyOwnedUtility`）和 `utilityVector.js`。共享依赖使用 `?v=41a` 导入。

本包不负责升级完整引擎。旧引擎若没有调用 `applySkillPlanHints`，宿主策略仍可接线，但完整引擎候选的软建议不会生效；先由开发者审查并迁移兼容的完整引擎，不能把复制模块称为已接线。

退出宿主后，在隔离扩展副本中解压本包，先运行：

```bash
node integration/apply-pack.mjs --extension-root <扩展根目录> --dry-run
node integration/apply-pack.mjs --extension-root <扩展根目录>
```

旧神话风、火、雷和界风包无需重发。它们所用共享核心可能与本包哈希不同：安装预检会拒绝覆盖，不能强制覆盖或直接替换现有文件。先备份扩展和安装记录，检查冲突及现有分包依赖；由开发者在隔离副本协调并迁移兼容共享核心和引擎后重新预检。神话风与界风仍互斥，标准包不解除该限制。

回滚本包：

```bash
node integration/rollback-pack.mjs --extension-root <扩展根目录>
```

回滚按安装记录保护外部修改和共享引擎依赖；遇到冲突应保留现场供开发者处理，不手工删除仍被引擎引用的模块。上述安装生命周期对最终 ZIP 尚待独立验证。

## 完整性

`manifest.json` 包含除自身外的包内文件大小和 SHA256；外部 `SHA256SUMS.txt` 应包含最终 ZIP 和独立原生补丁的完整哈希。在输出目录执行 `sha256sum -c SHA256SUMS.txt`，也可用包内 `python verify.py --zip <本包.zip>` 检查包内文件。验收必须再核对包内补丁与独立补丁字节一致、文件来源与 HEAD 一致。
