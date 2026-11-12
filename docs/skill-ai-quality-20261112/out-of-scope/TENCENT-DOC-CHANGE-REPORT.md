# 腾讯文档变更报告（out_of_scope，2026-11-12）

## 1. 执行边界

- 已读取本地底稿 6 个工作表及其真实列结构（A:G / sheet 06 为 A:D）。
- **未编辑腾讯在线表**：本会话没有在线表授权或稳定编辑器；原底稿也未改写。交付的是可直接录入的更新行清单。
- 未改 `02_标准包5条_已知` 的 refresh_standard 记录；未在 2008 标准包中新增或借用任何记录。
- 未把“审查”写成“修复”，未把“内部验收”写成“公开发布”。

## 2. 变更汇总

| 类型 | 工作表 | 行号 | 内容 |
| --- | --- | --- | --- |
| 新增 | `01_四包32名_匹配底稿` | 34 | out_of_scope / activity_lusu / redimeng |
| 新增 | `03_技能修复明细` | 31 | redimeng 暗牌公平 + find(2) 修复 |
| 新增 | `04_分包交付凭据` | 7 | out_of_scope ZIP 与 SHA256 |
| 更新 | `06_覆盖范围与待办` | 7 | out_of_scope 从“未知/不标PASS”改为“扩展路线内部PASS” |
| 更新 | `06_覆盖范围与待办` | 8 | 双风兼容条件与“旧互斥”表述的版本限定 |

- 新增 3 行，更新 2 行，删除 0 行。
- 跳过：`02_标准包5条_已知`（refresh_standard，不改）、2008 标准包（底稿中无对应表，不混填）、其他已封版分包（不属于本任务）。
- 未新增任何“仅审查未修改”的技能行。

## 3. 旧值/新值（sheet 06）

### 第 7 行 out_of_scope

- 旧 B：历史 redimeng 暗牌公平性专项，独立完整包交付未知
- 新 B：2026-11-12 独立验收完成：1武将/1技能；redimeng 暗牌公平 + find(2) 目标修复；扩展路线内部PASS；真实宿主五场景通过
- 旧 C：不标包级PASS
- 新 C：可填写（仅扩展路线）
- 旧 D：下轮 Agent 独立验收并构建
- 新 D：主表按 activity_lusu/redimeng 新增；原生路线未覆盖；不得写公开发布

### 第 8 行 标准包已验收互斥问题

- 旧 B：双风正式兼容为双owner，但标准验收文字有互斥说法
- 新 B：双风正式兼容为双 owner；2026-11-12 以 7d79d8c 双风包 + 共享核心 545ee71d + dual-feng-shared-entry-v1 复核六包共存通过
- 旧 C：仅填实际已验收项
- 新 C：仅填实际已验收项（不变）
- 旧 D：整合前再次核查共享协调器版本与共存约定
- 新 D：标准包旧“互斥”文字仅适用于旧单 owner/旧包；不修改双风代码；记录版本依赖

## 4. 证据映射

| 更新内容 | 证据 |
| --- | --- |
| redimeng 暗牌公平/置换不变 | `evidence/accept-out_of_scope.json`（`permute-invariance`） |
| find(2) 修复、合法/0费/不可行 | `evidence/accept-out_of_scope.json`（`target-*`） |
| 上游 1fe5292 独立安装 | `evidence/accept-upstream-out_of_scope.json` |
| ZIP/交付哈希 | `evidence/coexist-summary.json`、ZIP `f1d06169…` |
| 六包共存、卸载/重装 | `evidence/host-coexist.json`、`host-after-rollback.json`、`host-coexist-reinstalled.json` |
| 双风条件 | `evidence/coexist-summary.json`、`host-coexist.json` |
| 零写入/故障恢复 | `evidence/apply-mismatch.json`、`evidence/apply-fault.json`、`score-diff.txt`、`fault-diff.txt` |

## 5. 回读与待办

- 本地更新行已生成到 `tencent-doc-update-rows.csv`，并用实际 ZIP/SHA256、142 任务清单和验收结果做了一致性回读（见 `tencent-update-check.log`）。
- 未在线写入，因此无法做在线表逐行回读；录入时请按子包 + `activity_lusu` 匹配，若已有行则更新而不是新增。
- 在线录入后应回读 A:G，重点确认：D 列 ID 未被同名 2008 鲁肃覆盖；G 列保留“扩展路线/原生未覆盖”；06 页状态不写成公开发布。
