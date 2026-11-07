# 原生累计补丁 P0 修复与独立复验交接

## 状态

- 修复对象：`docs/skill-ai-quality-20261103/refresh-standard/refresh-standard-native-candidate.patch`
- 修复性质：仅修正 `character/standard.js` 三个 hunk 的统一 Diff 元数据（上下文行与 old/new 计数）。
- Codex 本轮未执行 `git apply --check`、GNU patch、补丁应用、`node --check`、测试、Chrome 宿主、构建、安装或回滚；以下结果全部留给独立 Agent 复验。
- 当前仍是源码候选，`complete_delivery=false`、`can_mark_deliverable=false`、`current_round_verified_skills=0` 保持不变。

## 修改内容

`character/refresh.js` 段（21 个 hunk）未改动。`character/standard.js` 段只做以下元数据修正：

1. 倾国 `qingguo` 评分索引（原 `@@ -1067,7 +1067,7 @@`，实际 6/6）：
   - 改为 `@@ -1067,7 +1067,7 @@`，补齐前置上下文行 `});`；
   - 正文仍为：
     - `- cards2.indexOf(card);`
     - `+ return cards2.indexOf(card);`
2. 急救 `jijiu` 评分索引（原 `@@ -2232,7 +2232,7 @@`，实际 6/6）：
   - 改为 `@@ -2232,7 +2232,7 @@`，补齐前置上下文行
     `cards2.sort((a, b) => (get.name(a) === "tao" ? 1 : 2) - (get.name(b) === "tao" ? 1 : 2));`；
   - 正文仍为：
     - `- cards2.indexOf(card);`
     - `+ return cards2.indexOf(card);`
3. 离间 `lijian` 决斗参与者参数（原 `@@ -2437,7 +2437,8 @@`，实际 7/7）：
   - 改为 `@@ -2438,7 +2438,7 @@`，以 `if (ui.selected.targets.length === 0) {` 为起始上下文，
     末尾补 `},` 上下文，删除前置的 `target(player, target) {` 上下文；
   - 正文仍为：
     - `- return get.effect(target, { name: "juedou" }, ui.selected.targets[0], target);`
     - `+ return get.effect(ui.selected.targets[0], { name: "juedou" }, target, player);`

未修改：技能 `content`、结算流程、合法性规则、手牌/装备处理、AI 其他评分公式、134 维模型契约、扩展方案 B 源码。

## 复验关口

### 第一关：补丁适用性

从新 Commit 取 Git blob 补丁，在已核实的 1.11.7 宿主副本上检查：

- `git apply --check`；
- 实际应用；
- `character/refresh.js` 与 `character/standard.js` 语法；
- 历史 17 项保持不变（与历史第四批补丁 `a37b315ac6eea9fa9d7a587e41c829fd2abd9f005ddf90752071a7054fce067c` 的 AI 段一致）；
- 新增 3 项 AI 修改完全一致。

独立验收已得到的预期值（Codex 本轮未重新计算，仅供复验对照）：

- `character/refresh.js` SHA256：`dd2f72347176923b9b2d1f28794d36b2671c576a90f3426293066a4a44031517`
- `character/standard.js` SHA256：`5b71aa89854beea6ec10ad232e41153bd38bad4b30c1a8fddd467dc946d51630`

比较前必须确认换行形式与源码基线一致。宿主源码与补丁文件为 LF；Windows `git apply` 副本可能为 CRLF，
`dd2f…` / `5b71…` 是上一轮验收副本（CRLF）的哈希。按去 CR 内容比较，`standard.js` 应只有上述 3 行差异；
不得把 CRLF 差异直接判为算法差异。

### 第二关：最终封包

用新 Commit 创建干净隔离工作树，运行现有标准包构建器，生成全新 ZIP、原生补丁及 SHA256SUMS。确认：

- 全部 `source_kind=git-blob` 文件逐字节一致；
- 包内原生补丁为修复后的新版本，不是旧 FAIL 候选；
- manifest 哈希全部正确；
- 20 项原生优化、13 项扩展方案 B 接线、既有突袭 1 项、扩展注册 14 项、仅原生 7 项说明准确；
- 无缺失依赖。

旧 FAIL 候选 ZIP（`ecaa2d7b60a922522a66a3c1b79195dde27731ad49494d0089b92df84b3397d8`）不得继续使用。

### 第三关：专项回归

复用已完成的测试夹具，至少检查：

- 离间目标选择（含 `phaseUse` 下第二目标从 enemy2 变为 ally 的决策变化）；
- 急救濒死救援与红牌材料排序；
- 倾国黑牌响应与保留；
- 历史 17 项中的 9 项代表性回归（制衡、仁德、青囊、结姻、铁骑、刚烈、谦逊、反馈、诈降）；
- 原生与扩展路线一致性；
- 技能结算不变。

本轮 P0 只是补丁格式问题，不要求重建完整 57 项技能矩阵；但必须证明最终 ZIP 中的实际代码与已通过专项验收的内容一致。

### 第四关：安装升级

复用已通过的安装器回归与实际包安装序列，重新验证：

- 首次安装、重复安装、正常回滚；
- 共享核心冲突拒绝；
- 中途故障恢复；
- 其他分包保护；
- Windows CRLF 差异保护；
- 最终 ZIP 真实加载。

如果能够取得此前四批合并的旧 ZIP，补做“旧版回滚 → 新版安装”；如果不可获得，如实记录未验证，不得伪造升级通过。

### 第五关：最终报告

输出新的标准包 ZIP、原生累计补丁、SHA256SUMS、ACCEPTANCE.md、UPGRADE.md 和必要 evidence 目录，并给出：

- 新 HEAD；
- ZIP 实际大小与 SHA256；
- 新原生补丁 SHA256（必须由独立 Agent 重新计算，不得沿用旧候选哈希）；
- Git blob 一致性结果；
- 补丁适用性；
- 新增三项真实宿主结果；
- 历史回归结果；
- 安装与回滚结果；
- 旧包升级验证状态；
- 已知限制；
- 最终 PASS/PARTIAL/FAIL。

## 候选元数据说明

- `evidence_files=[]` 与 `current_round_verified_skills=0` 是标准候选分支当前的构建状态，不是“工程从未运行验证”。
- 构建器支持 `--evidence <dir>`，但 `tools/build-skill-ai-pack.mjs` 对标准候选分支当前固定 `evidenceNames=[]`；最终包如需内嵌 evidence，必须调整该规则或在外置 ACCEPTANCE.md 中绑定证据哈希，不得伪造 manifest 字段。
- 最终验收报告可参考上一轮独立验收材料：
  `C:\Users\32360\Desktop\无名AI-acceptance-20261107\ACCEPTANCE-REPORT.md`
  与同目录 `evidence\`。该报告为 FAIL（P0），只作为复验输入，不作为本轮通过结论。
