# 无名AI 技能 AI 分包交付机制

日期：2026-11-01。范围：第一、二批已完成策略的按分包拆分与交付；不启动第三批，不修改原生技能规则，不改 134 维模型契约。

## 一、为什么拆

原实现把界制衡、缔盟、箜声、突袭、奇谋等策略集中在两个文件。任何分包要独立交付都必须改同一份共享文件，容易互相覆盖。现改为：

```
score/decision/skills/
  policyCore.js            # 共享核心：安装/卸载、备份、统计、宿主只读助手
  skillAIPolicies.js       # facade：只调用核心与注册表
  skillAIPolicyPacks.js    # 注册表：唯一允许追加的合并点（带 @djsc-pack-* marker）
  packs/<pack>.js          # 分包策略：只注册本包技能
  rules/<pack>.js          # 分包纯规则：不 import 宿主
  skillAIPolicyRules.js    # 仅测试用的规则聚合出口，不参与运行时
```

约束：

- 同一个技能 ID 只能由一个分包注册；技能归属由架构测试检查。
- 分包之间不互相 import，不携带其他分包代码。
- 共享核心不包含任何具体技能名；卸载按备份逆序恢复，且只在当前值仍是本层包装时恢复。
- 分包同时启用时，注册表只追加自己的 import/条目；回滚只移除自己的行。
- 不修改原生技能规则、`filterCard/filterTarget`、134 维模型契约。

## 二、分包与状态

`142-task-list.json` schema 4.0 按真实 `category` 归组：

| 分包 ID | 名称 | 状态 | 交付状态 |
| --- | --- | --- | --- |
| `standard_2008` / `2013` / `2019` / `2023` | 标准包各版本组 | 正在审查 / 尚未开始 | 未打包 |
| `shenhua_feng/huo/lin/shan/yin/lei` | 神话再临六包 | 部分修复 / 正在审查 / 尚未开始 | 未打包 |
| `refresh_standard/feng/huo/lin/shan` | 界限突破五包 | 部分修复 / 正在审查 / 尚未开始 | 未打包 |
| `out_of_scope` | 清单外角色（活动武将/界鲁肃 `redimeng`） | 验证完成 | 阶段性 |

状态口径：

- 尚未开始：没有技能被审查。
- 正在审查：有技能已审查，但没有已实施修复或仍有未审查项。
- 部分修复：至少一个缺陷已修复，但仍有未审查/未解决技能。
- 验证完成：该包全部目标武将的全部登记技能均已审查，已修复项有真实宿主证据，无阻塞项。
- 可交付：验证完成且测试/打包验收通过。
- 已交付：已生成并登记可复核的完整交付包（不是阶段性包）。

当前没有分包达到“可交付/已交付”：`out_of_scope` 的技能审查完成，但仍按阶段性包交付，等待外部集成验收；其余包仍有大量未审查技能。**阶段包不得冒充完整交付。**

## 三、生成分包 ZIP

```bash
node tools/build-skill-ai-pack.mjs --pack refresh_standard
node tools/build-skill-ai-pack.mjs --all
```

默认输出 `C:/Users/32360/Desktop/feisheng-ai-packs/`。构建器要求工作区干净（运行时文件用 `git show HEAD` 导出）；测试期可用 `--worktree-source`，但不得用于正式交付。

每个 ZIP 包含：

- `source/`：本包策略模块、纯规则、共享核心、facade、完整注册表参考；不含其他分包代码。
- `contract/`：只读的 `features.js`、`dimensionAdapter.js`、`info.json`（134 维/版本契约）。
- `integration/`：`apply-pack.mjs`、`rollback-pack.mjs`、只含本包的注册表。
- `patches/`：基线→HEAD 的本包相关 diff、`score/index.js` diff。
- `checklist.json` / `checklist.md`：本包全部目标武将、技能 ID、状态、实现、测试、证据摘要。
- `tests/`：本包纯规则测试、分包架构/134 维测试、跨平台 verify 回归、宿主场景运行器；`run-pack-tests.mjs` 一键执行包内测试。
- `evidence/`：本包相关原始产物（含超时/重跑/最终台账，不删失败）。
- `manifest.json`：每个文件的尺寸、SHA256、提交、批次、用途。
- `verify.py`：独立 SHA256/路径校验。
- `README.md` / `COMMANDS.md`：集成、回滚、测试与限制。

## 四、集成与回滚

```bash
node integration/apply-pack.mjs --extension-root <无名AI根目录> --dry-run
node integration/apply-pack.mjs --extension-root <无名AI根目录>
node integration/rollback-pack.mjs --extension-root <无名AI根目录>
```

- 目标必须已有策略 facade 接线；否则先应用 `patches/score-index.diff`。
- 共享核心版本一致才复制；不一致时拒绝写入，避免覆盖其他开发者修改。
- 注册表存在时只在 marker 内追加；不存在时写只含本包的注册表。
- 安装记录写入 `<扩展>/.djsc-pack-backups/<pack>/record.json`。
- 回滚只删除本包且未被修改的文件、只移除本包注册行；共享核心保留（可能被其他包复用）。
- 多包共存已在临时扩展根验证：A→B 安装，回滚 A 保留 B，回滚 B 保留共享核心，重新安装 A 成功。

## 五、每个分包的验收

分包验收必须包含：

1. 本包全部相关真实宿主场景（原生/仅策略/完整扩展三组）。
2. 纯规则测试 + 分包架构/134 维契约 + verify.py 跨平台回归。
3. 人类操作与 AI 托管隔离（适用于有交互的技能，如 reqimou）。
4. 已交付分包的回归（全量宿主套件、41 项 Node 回归）。
5. 文件完整性、manifest、ZIP 复现。

阶段包只能证明“已实现部分 + 证据”，不能证明整包完成；`checklist.md` 必须显示剩余未审查技能。

## 六、当前证据与限制

- 拆分后：`split-suite-native.json` 68 场景、`split-suite-policy.json` 69 场景、`split-suite-extension.json` 69 场景，均 passed、无 pageerror；`split-manual-ui.json` 8 用例/7 断言 PASS。
- 分包化后 21×3 全量复核：policy 20/21、native 19/21（重跑 2/2 成功）、extension 19/21；policy blocked-far5 与 extension blocked-far5/multi3 仍是看门狗超时，未解决项为 1/0/2。不得据此宣称第二批无条件可合并；详见 REPAIR-REPORT 8.4。
- 第二轮 21×3 场景（补修代码、pre-split）：最终未解决 0；历史超时 native/policy/extension = 9/2/1；末次尝试失败 1（native multi2，此前有成功）。见 `repair-acceptance-ledger.md`。
- Android 真机长跑、完整 142 将验收仍是公开发版前置条件。
- 阶段包不是可直接安装的完整扩展；不得把源码补丁 ZIP 冒充扩展包。
