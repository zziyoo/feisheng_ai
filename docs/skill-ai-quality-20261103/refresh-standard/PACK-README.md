# 界限突破·标准：方案 B 第一、第二批开发者候选

- 分包 `refresh_standard`；无名AI 4.4.4，目标宿主无名杀 1.11.7。
- 本包源码 HEAD：`{{HEAD}}`；无名AI 上游基线：`{{BASELINE}}`。
- 用户提供的信息称两批专项验收已通过；本 ZIP 的封包、安装、回滚及兼容性尚须独立 Agent 验收。包内未附对应完整原始验收证据，不能由本包单独复核该结论。
- 方案B第一、第二批的专项验收不代表界限突破·标准全部武将完成优化，也不代表完整宿主发布验收。Android 真机性能、完整回归和模型训练均未由本包证明。

## 实际范围和接线

第一批为制衡 `rezhiheng`、仁德 `rerende`；第二批为遗计 `new_reyiji`、裸衣 `new_reluoyi`、义绝 `new_yijue`、反间 `refanjian`、青囊 `new_reqingnang`。累计原生补丁包含以上七项的 AI 候选修改。

扩展接线覆盖制衡、仁德、义绝、反间、青囊，并保留既有突袭 `new_retuxi` 策略。遗计与裸衣的新评分嵌在宿主选择事件中，独立安装扩展时仍使用宿主原始 AI。技能覆盖和风险见 `checklist.md` 与 `docs/VALIDATION-HANDOFF.md`。完整引擎候选层不一定消费宿主评分，已有局部规划选择也不等于完整引擎主动提交或结算成功。

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
