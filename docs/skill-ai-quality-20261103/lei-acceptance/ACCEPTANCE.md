# 神话再临·雷 AI 分包：独立验收报告

验收结论：**神话雷 AI 分包最终内部交付 PASS**（无 P0/P1 阻塞项）。

- 验收分支：`codex/shenhua-lei-acceptance`
- 开发 HEAD（Codex 交付）：`bd9eaf6c882c58d6c849750ccd407ed9824358aa`（`codex/shenhua-lei-ai`）
- 宿主：无名杀 1.11.7（`game/update.js` version `1.11.7`，`character/shenhua.js` SHA256 `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e`）
- 验收方式：独立验收 Agent，在独立 worktree `C:/Users/32360/.codex/worktrees/shenhua-lei-acceptance` 操作，未修改 Codex 开发工作树
- 证据：本目录 `evidence/`

## 一、验收基线

| 项目 | 结果 |
| --- | --- |
| 开发 HEAD 与交接文档一致 | PASS（`bd9eaf6`，`docs/SHENHUA_LEI_HANDOFF.md`） |
| 开发工作区干净 | PASS（验收分支自建，未触碰开发树） |
| 镇骨两个运行文件与研究阶段试验版一致 | PASS（git blob 逐字节相同：`packs/shenhuaLei.js` `8406964…`、`rules/shenhuaLei.js` `8d510a9…`） |
| 正式构建产物在真实宿主被正确加载 | PASS（见第二、三节，非仅静态等价） |

基线锁定结论：**源码相同不等于新构建必然加载正确**。本轮所有镇骨结论均在真实无名杀 1.11.7 宿主中对「正式分支构建」重新执行，未直接继承研究阶段结论。

## 二、镇骨 P1 验收（`drlt_zhengu`）

四配置真实宿主矩阵（`evidence/zhengu-*.json`，对比器 `tools/zhengu-compare.mjs`）：

| 配置 | 含义 |
| --- | --- |
| A | 未修复宿主，无扩展（宿主旧行为基线） |
| B | 未修复宿主 + 正式神话雷扩展 |
| C | 应用原生候选补丁的宿主，无扩展 |
| D | 应用原生候选补丁的宿主 + 扩展（仅用于验证指纹跳过与防重复修正） |

八档敌友矩阵（自己/目标手牌 → 评分 / 发动 / 目标即时变化）：

| 场景 | A 旧宿主 | B 扩展 | C 原生 | D 原生+扩展 |
| --- | --- | --- | --- | --- |
| 7/6 敌方 | 4 / 是 / 0 | 0 / 否 / 0 | 0 / 否 / 0 | 0 / 否 / 0 |
| 6/8 敌方 | 12 / 是 / -2 | 8 / 是 / -2 | 8 / 是 / -2 | 8 / 是 / -2 |
| 3/1 敌方 | -8 / 否 / 0 | -8 / 否 / 0 | -8 / 否 / 0 | -8 / 否 / 0 |
| 3/5 敌方 | 8 / 是 / -2 | 8 / 是 / -2 | 8 / 是 / -2 | 8 / 是 / -2 |
| 7/6 友方 | -6 / 否 / 0 | 0 / 否 / 0 | 0 / 否 / 0 | 0 / 否 / 0 |
| 6/8 友方 | -18 / 否 / 0 | -12 / 否 / 0 | -12 / 否 / 0 | -12 / 否 / 0 |
| 3/1 友方 | 12 / 是 / +2 | 12 / 是 / +2 | 12 / 是 / +2 | 12 / 是 / +2 |
| 3/5 友方 | -12 / 否 / 0 | -12 / 否 / 0 | -12 / 否 / 0 | -12 / 否 / 0 |

- 对比器结论：`COMPARE_OK`、`unpatchedExtensionEqualsNative=true`、`patchedExtensionSkips=true`。
- **自身 7 张、敌方 6 张时扩展与原生均不发动镇骨**（评分为 0）；旧宿主评分为 4 并发动，属于虚假收益，已修复。
- 实际结算与宿主 `sync` 完全一致（弃牌数按自身真实手牌、摸牌上限 5）。
- 本轮矩阵与研究阶段 `3e7bc7c` 矩阵逐行一致（静态等价 + 真实宿主复现双重成立）。

### 事件安全与钩子冲突

| 检查项 | 结果 | 证据场景 |
| --- | --- | --- |
| 仅处理镇骨指定的选择事件 | PASS | `foreign-choice-target`（外部技能评分 0.125 原样保留） |
| 不影响其他技能的 `chooseTarget` | PASS | 同上 |
| 不修改 `cost` / `content` / `sync` | PASS | `costSnapshot` 中 prompt、selectTarget=[1,1]、forced=false、filterTarget 均未变 |
| 不改变玩家手动选择 | 结构级 PASS | 接线只替换 `event.ai`（AI 评分回调），不触碰 prompt/selectTarget/filterTarget/forced；未做浏览器点击级人工操作测试 |
| 取消后可正常重试 | PASS | `cancel-retry`（取消无标记、phaseEnd 不结算，随后 3/1 正常发动 +2） |
| 两名角色使用镇骨互不污染 | PASS | `two-users`（B/C/D 双方均不发动、标记 0；A 双方均错误发动） |
| 多次嵌套选择不错绑 AI | PASS | `same-event-multi-choice`（两次选择各自独立接管，无残留） |
| AI 回调异常安全回退 | PASS | `ai-callback-exception`（宿主原回调被调用、返回 7、无异常外抛） |
| 卸载后原有行为恢复 | PASS | `lifecycle`（卸载后 7/6 敌方回落到旧评分 4 并发动） |
| 重装后修复重新生效 | PASS | `lifecycle`（重装后 7/6 敌方取消、评分 0） |
| 其他扩展在安装前占用 `onChooseTarget` | PASS（安全降级） | `hook-conflict-preinstall`：外部钩子保留、冲突计数=1、修复不生效并回落宿主旧行为、卸载不删除外部钩子、移除外部钩子后重装恢复本包钩子 |
| 其他扩展在安装后替换钩子 | PASS（安全降级） | `hook-conflict-postinstall`：替换后修复静默失效但不崩溃、卸载不删除外部钩子、恢复安装后本包钩子重新装上 |
| 其他扩展自身异常 | PASS | 钩子整体 try/catch，回退宿主原回调 |
| 卸载时钩子身份已变化 | PASS | 卸载按身份校验，不删除他人实现 |

## 三、历史神话雷技能回归

四配置：N 未修复宿主 / P 未修复宿主+扩展 / C 原生补丁宿主 / D 原生补丁宿主+扩展。对比器 `tools/lei-history-compare.mjs` 结论：`COMPARE_OK`、`extensionEqualsNative=true`、`nativePlusExtensionEqualsNative=true`，与旧宿主基线存在差异的场景为 `kongsheng-count-threshold`、`qianjie-tiesuo`、`fuyin-history`（即三项历史修复确实生效）。

### 箜声 `olkongsheng`

| 检查项 | N 旧宿主 | P 扩展 | C 原生 | D 原生+扩展 |
| --- | --- | --- | --- | --- |
| 扩展牌数量判断（1 张箜 + 已选 1 张，良姻阈值成立） | 评分 1（阈值失真） | 评分 0（阈值命中） | 评分 0 | 评分 0 |
| 已选择牌数量（未选牌时阈值不成立） | 评分 1 | 评分 1 | 评分 1 | 评分 1 |
| 良姻触发阈值 | 旧式数组加法把数量变成字符串，阈值永不命中 | 即时数量正确，阈值命中 | 命中 | 命中 |
| 临时视图恢复（cost 返回后） | — | `getExpansions` 已还原 | 未安装视图 | 未安装视图 |
| 异常退出（cost 抛错） | 抛出 | 抛出且视图已还原 | 抛出且视图已还原 | 抛出且视图已还原 |
| 嵌套调用作用域 | — | 作用域计数归零后恢复，不提前还原 | — | — |

### 谦节 `drlt_qianjie`

| 检查项 | N 旧宿主 | P 扩展 | C 原生 | D 原生+扩展 |
| --- | --- | --- | --- | --- |
| 未横置目标被铁索指定 | `zeroplayertarget`（阻止） | `zeroplayertarget` | `zeroplayertarget` | `zeroplayertarget` |
| 已横置目标被铁索指定（应允许解除） | `zeroplayertarget`（**错误阻止**） | 允许（无限制返回） | 允许 | 允许 |
| `noLink` 标签 | 保持 | 保持 | 保持 | 保持 |
| 扩展与原生同时安装是否重复修正 | — | — | — | 行为与 C 完全一致，无二次修正 |

### 父荫 `xinfu_fuyin`

| 检查项 | N 旧宿主 | P 扩展 | C 原生 | D 原生+扩展 |
| --- | --- | --- | --- | --- |
| 本回合首次成为杀目标 | 评分数组（父荫生效） | 同 | 同 | 同 |
| 本回合首次成为决斗目标 | 评分数组 | 同 | 同 | 同 |
| 再次成为目标（历史已含一次指定） | 仍返回评分（**未排除**） | 返回 1（不再排除） | 返回 1 | 返回 1 |
| 历史读取对象 | 读的是出牌者 | 读的是被指定者 | 被指定者 | 被指定者 |
| 当前事件是否计入历史 | 否（`currentEventInHistory=false`，历史长度 0） | 同 | 同 | 同 |

### 其他技能台账冒烟

16 项已审查技能（征荣、鸿举、往烈、谦节、决堰、破势、良姻、箜声、雄乱、从谏、踞襄、庸肆、伪帝、镇骨、罪论、父荫）逐项核对：技能定义存在、`cost` / `ai` / `ai.effect.target` / `ai.result.target` / `check` / `sync` 入口形态在安装前后逐字节一致（`skill-ledger-smoke` 快照相同），无重复注册。

## 四、原生补丁与扩展策略等价性

- 镇骨：八档敌友矩阵、混合目标、双人同技能、取消重试、第二次同步、外部包装在 B/C/D 之间逐项一致。
- 箜声、谦节、父荫：决策等价性由 `lei-history-compare.mjs` 断言 `P == C`、`D == C`。
- 防重复修正：D 配置下扩展识别原生指纹后跳过镇骨（`zhenguCompatible=false`）、箜声、父荫接线，行为与纯原生 C 一致。
- **部署必须二选一**：原生补丁与扩展分包不得在同一宿主同时作为“唯一方案”使用。

## 五、原生候选补丁可应用性

| 项目 | 结果 |
| --- | --- |
| 补丁来源 | git blob（HEAD），SHA256 `805ec28922619748d829886ec0ca581162bc7b91085f261eab8756d9d894734a` |
| 行尾 | LF（可对 LF 宿主文件应用） |
| 对真实 1.11.7 宿主 `character/shenhua.js` | 4/4 hunk 全部干净应用（箜声 792、镇骨 1177、父荫 1384、谦节 1420） |
| 宿主文件 SHA256 | 应用前 `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e` → 应用后 `37328a22bd1b6c78b9118fc6992e174792d7a1bd068538d4d6e6df7f43791a5f` |
| 真实宿主文件是否被修改 | 否（补丁只在临时副本上应用并用于 C/D 配置） |
| **Windows 工作树检出副本（CRLF）** | **无法应用**（`git apply` 上下文失配）→ 已加 `.gitattributes`（`*.patch text eol=lf`）并在交付时按 blob 字节交付 |

## 六、多分包共存与生命周期

| 项目 | 结果 |
| --- | --- |
| 五分包同时加载 | PASS：`out_of_scope`、`refresh_standard`、`shenhua_lei`、`shenhua_feng`、`shenhua_huo` |
| 技能注册无异常重复 | PASS |
| 共享协调器 | PASS（共享核心与注册表未改动） |
| 卸载雷包后其他分包 | PASS（其余 4 包仍在注册表；镇骨钩子、箜声/父荫/谦节包装全部还原） |
| 卸载雷包后镇骨 | PASS（钩子移除，行为回到宿主旧评分） |
| 重装雷包 | PASS（钩子与三处包装全部恢复） |
| 全量卸载 / 全量重装 | PASS（`not-installed` → `installed`，包装全部恢复） |
| 重新安装不累积包装 | PASS（`__djscSkillPolicy` 标记单一，无叠加） |

## 七、遗留问题

| 级别 | 问题 | 状态 |
| --- | --- | --- |
| P0 | 无 | — |
| P1 | 镇骨扩展误估已按研究方案修复并通过真实宿主四配置验证 | 已关闭 |
| P2 | 罪论排序与不可见信息问题 | 保留，非阻塞（未找到安全修复方案，本轮未修改） |
| P2 | 雄乱 `countCards` 权重不生效 | 保留，非阻塞（策略限制） |
| P2 | 踞襄送出装备的机会成本估计不足 | 保留，非阻塞（策略限制） |
| P2 | 第三方占用/替换 `onChooseTarget` 时镇骨修复失效 | 保留，为已知安全降级设计；未破坏其他扩展、不误删他人钩子、不卡死 |
| P2 | 手工点击级“手动选择不受影响”未做浏览器人工操作验证 | 结构级证据充分（只替换 `event.ai`），保留为覆盖缺口 |
| P2 | 原生补丁的 CRLF 检出副本不可应用 | 已通过 `.gitattributes` + 按 blob 字节交付收敛 |
| 覆盖缺口 | 其他 12 项技能只做静态审查 + 入口完整性冒烟，未逐项跑完整对局 | 与任务约定一致（不要求每个技能完整对局） |

## 八、测试资源控制说明

- 继承研究阶段证据的部分：仅镇骨“源码逐字节一致”这一静态等价性结论，且在真实宿主上重新执行了完整矩阵，不直接继承运行结论。
- 本轮实际重新执行：镇骨四配置矩阵 + 10 个事件安全/钩子冲突场景；箜声/谦节/父荫四配置 + 技能台账 + 多包生命周期；原生补丁可应用性校验；ZIP 安装/卸载/回滚/重装。
- 静态等价性证明：镇骨两个运行文件的 git blob 哈希与研究阶段完全一致。
- 真实宿主测试：全部关键结论均来自真实无名杀 1.11.7 宿主（Chrome headless，固定种子，身份局 8 人，真实 `phaseJieshu`/`phaseEnd`/`chooseTarget`/`get.effect`/技能 `sync` 结算）。
- 已知夹具噪声：测试服务器对 `noname.config.txt` 返回空值，宿主 `BrowserAdapter.stat` 偶发把该次 fetch 失败报成 `IO_ERROR` 并弹出“加载内容失败”；已单独归入 `benignErrors`，与本包代码无关。

## 九、交付产物

| 项目 | 值 |
| --- | --- |
| 交付目录 | `C:\Users\32360\Desktop\feisheng-ai-shenhua-lei-final-ca9d2d2` |
| 正式 ZIP | `feisheng-ai-shenhua-lei.zip`，54 文件，257628 字节，SHA256 `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277` |
| 原生补丁 | `feisheng-ai-shenhua-lei-native-ai.patch`，2268 字节，SHA256 `805ec28922619748d829886ec0ca581162bc7b91085f261eab8756d9d894734a` |
| **最终构建输入（ZIP 对应源码提交）** | `ca9d2d221a02920f34aef99614245f2e20a4a8c1`（验收分支 `codex/shenhua-lei-acceptance`，构建时工作区干净） |
| 交付台账记录提交 | 记录 ZIP SHA256 的提交晚于构建提交，只改 `docs/skill-ai-20261030/pack-delivery.json`，不改任何运行文件 |
| 交付核验 | `DELIVERY_VERIFY_PASS`：ZIP 路径安全、运行文件与 HEAD blob 一致、注册表为构建期生成且与模板一致、镇骨修复标记齐全、原生补丁 LF 且可对真实宿主应用、manifest 53/53 一致、SHA256SUMS 一致；连续三次运行结果稳定 |
| 实际 ZIP 验收 | `ACCEPTANCE PASS (1 pack)`：解压/校验、包内 15 项测试、安装、安装核验、宿主加载、回滚、回滚核验、回滚后宿主加载、重装全部 passed；134 维契约未改 |

ZIP 为可复现构建：成员按 POSIX 路径排序、时间戳固定，`manifest.json` 记录每个文件的 SHA256 与来源提交。

## 十、复现命令

```bash
# 镇骨四配置与对比
node tools/zhengu-real-host.mjs --host-root <宿主> --browser <Chrome> --playwright <pw> --extension-root <扩展> --output A-unpatched-baseline.json
node tools/zhengu-real-host.mjs ... --policy --output B-unpatched-policy.json
node tools/zhengu-real-host.mjs ... --patch-zhengu-native --output C-patched-native.json
node tools/zhengu-real-host.mjs ... --patch-zhengu-native --policy --output D-patched-policy.json
node tools/zhengu-compare.mjs <报告目录> <输出目录>

# 历史技能四配置与对比
node tools/lei-history-real-host.mjs ... --output N-lei-history.json
node tools/lei-history-real-host.mjs ... --policy --output P-lei-history.json
node tools/lei-history-real-host.mjs ... --patch-lei-native --output C-lei-history.json
node tools/lei-history-real-host.mjs ... --patch-lei-native --policy --output D-lei-history.json
node tools/lei-history-compare.mjs <报告目录> <输出目录>

# 原生补丁可应用性
node tools/lei-native-patch-verify.mjs --host-root <宿主> --out patch-verify.json

# 交付核验
node tools/lei-delivery-verify.mjs --zip <zip> --delivery <目录> --host-root <宿主>
```
