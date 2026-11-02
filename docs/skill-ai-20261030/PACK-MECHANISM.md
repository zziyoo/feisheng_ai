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
| `shenhua_feng` | 神话再临·风 | 验证完成（qimou 已修复；其余 11 项已验证无问题） | 可交付 |
| `shenhua_huo/lin/shan/yin/lei` | 神话再临其余五包 | 部分修复 / 正在审查 / 尚未开始 | 未打包 |
| `refresh_standard/feng/huo/lin/shan` | 界限突破五包 | 部分修复 / 正在审查 / 尚未开始 | 未打包 |
| `out_of_scope` | 清单外角色（活动武将/界鲁肃 `redimeng`） | 验证完成 | 可交付 |

状态口径：

- 尚未开始：没有技能被审查。
- 正在审查：有技能已审查，但没有已实施修复或仍有未审查项。
- 部分修复：至少一个缺陷已修复，但仍有未审查/未解决技能。
- 验证完成：该包全部目标武将的全部登记技能均已审查，已修复项有真实宿主证据，无阻塞项。
- 可交付：验证完成且测试/打包验收通过。
- 已交付：已生成并登记可复核的完整交付包（不是阶段性包）。

当前 `out_of_scope` 与 `shenhua_feng` 已完成全部登记技能审查、缺陷修复/验证、无阻塞项，并通过实际 ZIP 的逐包与上游 1fe5292 验收，标记为 `可交付`；最终 ZIP 生成并登记后，待外部集成回执齐全再升级 `已交付`。`shenhua_feng` 的 12 项登记技能中，`qimou` 已修复，`xinkuanggu` 及张角/于吉/夏侯渊/小乔/曹仁/周泰/黄忠共 11 项为已验证无问题。其余三个代码包仍有未审查技能，保持 `阶段性`。**阶段包不得冒充完整交付。**

## 三、生成分包 ZIP

```bash
node tools/build-skill-ai-pack.mjs --pack refresh_standard \
  --repo <无名AI仓库> --evidence <证据目录> \
  --out <输出目录> --stage-root <staging目录>
node tools/build-skill-ai-pack.mjs --all ...
```

构建器使用系统 PATH 中的 `git`（可用 `--git` 覆盖），仓库/证据/输出/stage 目录均可配置；默认仓库为脚本所在仓库根、默认输出为仓库同级 `feisheng-ai-packs/`。构建器要求工作区干净（运行时文件用 `git show HEAD` 导出）；测试期可用 `--worktree-source`，但不得用于正式交付。

每个 ZIP 包含：

- `source/`：本包策略模块、纯规则、共享核心、facade、只含本包的注册表；不含其他分包代码，也不含完整共享注册表。
- `contract/`：只读的 `features.js`、`dimensionAdapter.js`、`info.json`（134 维/版本契约）。
- `integration/`：`apply-pack.mjs`、`rollback-pack.mjs`、只含本包的注册表。
- `patches/`：基线→HEAD 的本包相关 diff、`score/index.js` diff。
- `checklist.json` / `checklist.md`：本包全部目标武将、技能 ID、状态、实现、测试、证据摘要。
- `tests/`：本包纯规则测试、分包架构/134 维测试、跨平台 verify 回归、宿主场景运行器；`run-pack-tests.mjs` 一键执行包内测试。
- `evidence/`：本包相关原始产物（含超时/重跑/最终台账、独立诊断与逐包验收结果，不删失败）。
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
- 安装前预检：共享核心版本一致、注册表所有 `./packs/*.js` 导入真实存在、目标文件不冲突。
- **一致性预检**：注册表已含本包 import/注册行但分包文件缺失时，拒绝安装；否则补齐文件后回滚会留下悬空导入。旧版安装记录回滚遇到同类状态时也硬性阻止删除，`--force` 不放行。
- 将被修改的注册表备份到 `<扩展>/.djsc-pack-backups/<pack>/`；写入使用临时文件+rename。
- 任一步失败（含测试注入 `DJSC_PACK_TEST_FAIL_AFTER`）自动恢复安装前状态；未完成事务可在下次 apply 时自动清理。
- 注册表存在时只在 marker 内追加；不存在时写只含本包的注册表。
- 重复安装幂等；同包已有安装记录且状态不一致时拒绝继续，避免覆盖。
- 回滚只删除本包且未被修改的文件、只移除本包注册行；共享核心保留（可能被其他包复用）。
- 回滚最后一个分包时保留带 marker 的空注册表，保证 facade 卸载后仍可加载。
- 多包共存已在临时扩展根验证：A→B 安装，乱序回滚 A→B/B→A 均不复活已回滚包，重新安装成功；失败注入、共享核心冲突、注册表缺模块、预存行缺模块均有回归。
- 逐包安装/回滚回归：`node tools/test-pack-install.mjs`（13 条 PASS）。

## 五、每个分包的验收

分包验收必须包含：

1. 本包全部相关真实宿主场景（原生/仅策略/完整扩展三组）。
2. 纯规则测试 + 分包架构/134 维契约 + verify.py 跨平台回归。
3. 人类操作与 AI 托管隔离（适用于有交互的技能，如 reqimou）。
4. 已交付分包的回归（全量宿主套件、41 项 Node 回归）。
5. 文件完整性、manifest、ZIP 复现。

阶段包只能证明“已实现部分 + 证据”，不能证明整包完成；`checklist.md` 必须显示剩余未审查技能。

逐包独立验收（实际 ZIP，不是仅跑共享核心单测）：

```bash
node tools/accept-skill-ai-pack.mjs --zip <pack.zip> --repo <仓库> --workdir <临时目录> \
  --scenes <本包技能场景> --host-root <无名杀宿主> --browser <Chrome> --playwright <Playwright目录> \
  --out <evidence>/accept-<pack>.json
```

验收内容：ZIP 解压与 `verify.py --zip/--dir`、包内测试、干净扩展副本单包安装、对应技能的真实宿主场景、
卸载/回滚后再次加载、重装、134 维契约哈希、注册表依赖；多 ZIP 一起传入时额外验证五包共存、
他人注册行保留与乱序回滚，并以 `--baseline-dir` 逐包对照单包技能签名。
`--base-ref 1fe5292 --wire-index-diff` 会在上游 v4.4.4 干净副本上先确认未接线时 apply 拒绝，再应用包内
`patches/score-index.diff`，随后执行安装、宿主场景、卸载与回滚。上游源码包必须先接线，不能描述成直接安装包。

每包绑定的默认场景：`refresh_standard=rezhiheng-3hp,new-retuxi-order`；
`shenhua_feng=hp-qimou-distance4-hp3`；`refresh_feng=hp-reqimou-distance4-hp3`；
`shenhua_lei=olkongsheng-array-count,olkongsheng-repeat`；
`out_of_scope=redimeng-hidden-info,redimeng-permute-values`（校验 `fairRedimeng>0`、
`redimengMaskFailed=0`、同位置置换索引一致、结算前后牌张守恒）。五包共存时场景取并集，
并逐包对照单包签名，防止其他分包改变结果。

## 六、当前证据与限制

- 拆分后：`split-suite-native.json` 68 场景、`split-suite-policy.json` 69 场景、`split-suite-extension.json` 69 场景，均 passed、无 pageerror；`split-manual-ui.json` 8 用例/7 断言 PASS。
- 分包化后 21×3 全量复核（历史）：policy 20/21、native 19/21（重跑 2/2 成功）、extension 19/21；policy blocked-far5 与 extension blocked-far5/multi3 曾看门狗超时。独立诊断（REPAIR-REPORT 8.5）定位为夹具 `game.over` 陷阱：反贼全灭后宿主进入结算 UI，`die` 事件不返回；Worker 心跳/CDP CPU 证明不是策略死循环。运行器默认抑制 `game.over` 后完整重跑，原始超时日志仍保留。
- 第二轮 21×3 场景（补修代码、pre-split，历史）：最终未解决 0；历史超时 native/policy/extension = 9/2/1，逐条保留。见 `repair-acceptance-ledger.md`。
- 本轮夹具修正后完整重跑：native 21/21；policy/extension 各 20/21，唯一失败均为场景前 host-init 超时，单场景重跑通过；`final_unresolved=0`。历史失败逐条保留，见 `repair-acceptance-ledger.md` 与 `postfix-range-*`。
- 逐包验收（实际 ZIP，2026-11-02）：五个单包均通过解压/`verify.py`/包内测试/单包安装/对应技能场景/卸载回滚后再加载/重装/134 维契约；五包共存安装、乱序回滚、他人注册行保留亦 PASS，组合技能签名与五个单包逐项一致。
- 上游 v4.4.4 `1fe5292`（2026-11-02）：五个单包与五包组合均通过“未接线 apply 拒绝 → 应用 `score/index.diff` → 安装 → 宿主场景 → 卸载/回滚 → 重装”；上游干净副本不依赖已交付的其他分包。
- 矩阵（`pack-acceptance-matrix.md`）：单包契约与组合契约分列，未执行显示“未执行”，不把未运行项目误报为失败；组合行 `contract_passed=true` 来自实际共存安装/134 维检查。
- 不抑制 `game.over` 的有界完整对局（斗地主，seed 20261030）：`done=true`、`overCalls=1`、`result=true`、3 phases / 17 uses / 12 decisions，无页面错误；该测试独立于技能固定场景，不修改奇谋断言。见 `fullgame-settlement.json`。
- 神话再临·风：12 项登记技能全部审查；`qimou` 已修复，其余 11 项有真实宿主固定局面且未复现缺陷，状态为 `已验证无问题`。证据 `shenhua-feng-review.json`、`shenhua-feng-review-native.json`、`shenhua-feng-review-compare.json`（原生/扩展逐场景对照，对称敌人座位差异单列）。
- Android 真机长跑、完整 142 将验收仍是公开发版前置条件。
- 阶段包不是可直接安装的完整扩展；不得把源码补丁 ZIP 冒充扩展包。
