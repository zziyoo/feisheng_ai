# 剩余十包第二阶段专项验收 - 真实宿主边界报告

生成时间：2026-11-13

## 1. 范围与环境

- 开发分支/HEAD：`codex/remaining-ten-packs` / `1598a41cb7fb1ca03607657da2e6550f72ebe0cb`（未改动）。
- 验收分支：`codex/remaining-ten-packs-acceptance`，本轮起点 `075508dd36a484d812b607cea01da5369f71eb7b`。
- 宿主：无名杀 1.11.7，真实 Chrome，身份局，seed `20261030`；Playwright 只读加载宿主，不替换 Player、GameEvent、技能 content 或结算。
- 干净宿主：`C:/Users/32360/AppData/Local/Temp/shv-accept/host-a`。
- 累计十补丁宿主：`C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten`。
- 场景：14 个，干净/补丁各执行一次；干净宿主的两处预期异常在场景内被捕获并记录，测试断言未改写。
- 证据：`host/evidence/edge-clean.json`、`host/evidence/edge-patched.json`；结构化摘要 `phase2b/real-host-edge-summary.json`。

宿主五文件 SHA256：

| 文件 | 干净 host-a | 累计补丁 host-ten |
| --- | --- | --- |
| `character/standard.js` | `2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63` | `614be8c1ee9bcf82e37477ab9a09f1e781dbe2f32c77aa9725446e1689bc9b48` |
| `character/shenhua.js` | `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e` | `7b7bb42574cbe06283505e7417217af8e6691aee4f1d824ae61ca6cd28d3a3ed` |
| `character/refresh.js` | `25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0` | `73fd1f6c1ee90bb6a6e35591249415dd4f23f51fd38864c9d01c9471735e3e01` |
| `character/sp.js` | `f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea` | `8386e05b611762321acf1730e1387231bb947fae32884335acbd975c8a654e2f` |
| `character/tw.js` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` |

## 2. 四项未决技能

### 2.1 `dimeng` 缔盟（shenhua_lin）

**此前 INCONCLUSIVE 的更正。** 第一阶段报告称“技能模块的 `ui.selected` 与测试页 `lib.ui.selected` 不是同一实例”。本轮预检与直接探针证明：`lib.ui === realHost.ui`、`lib.ui.selected === realHost.ui.selected` 均为 true；直接设置 `realHost.ui.selected.targets = [ally]` 后，补丁宿主返回 0，原宿主抛错。此前 `-6` 的原因是其余四名玩家仍为反贼，第二目标候选 `list` 非空，并非 UI 实例不一致。

真实固定局（全员友善、仅 `ally` 已有第一目标、其余玩家均有手牌；`ui.selected.cards` 2 张）：

| 场景 | 干净宿主 | 补丁宿主 |
| --- | --- | --- |
| 直接调用 `dimeng.ai.result.target(actor, enemy1)` | `TypeError: Cannot read properties of undefined (reading 'countCards')`，位置 `character/shenhua.js:5832`（`list[0].countCards`） | 返回 `0`，无异常 |
| 真实 `chooseTarget(2, dimeng.filterTarget)` + `get.effect_use` AI，第一目标选中后无敌方候选 | 选择事件抛同一 TypeError；第一目标停留为 `ally` | 事件正常取消，`result.bool=false`，无目标残留 |
| 合法非空候选（ally 1 手、enemy1 3 手） | 选中 `ally` + `enemy1`，事件成功；`useSkill('dimeng', 2 牌, 双目标)` 后双方手牌互换，使用者手牌清空 | 与干净宿主完全一致 |
| 取消/无合法第二目标 | 抛错，事件未正常结束 | 正常取消，不进入结算 |

结论：空候选在真实 `chooseTarget` 事件中确实可达；补丁 `!list.length` 防御生效；合法非空候选与交换结算无回归。**证据等级 A。**

### 2.2 `tuntian` 屯田（shenhua_shan）

公开状态固定：`enemy1` 为 2 张隐藏手牌，观察者 `ally` 与来源 `actor` 均不识字，`knownByActor=0`、`knownByViewer=0`；`enemy1` 有友方、未被来源/观察者控制、非当前回合。仅替换隐藏牌面：

| 隐藏手牌（公开张数均为 2） | 干净宿主 `juedou` 估值 | 补丁宿主 `juedou` 估值 | 干净 `get.effect` | 补丁 `get.effect` |
| --- | --- | --- | --- | --- |
| 杀 + 桃 | `[0.5, 1]` | `[0.5, 0.9880952381]` | `-1.2250624984` | `-1.1667261890` |
| 杀 + 杀 | `[0.5, 2]` | `[0.5, 0.9880952381]` | `-6.1253124920` | `-1.1667261890` |
| 闪 + 桃 | `[0.5, 1]` | `[0.5, 0.9880952381]` | `-1.2250624984` | `-1.1667261890` |

原宿主按实际隐藏牌名读取杀/闪数量，评分随暗牌组成变化；补丁改用 `mayHaveSha/mayHaveShan(viewer, ..., "count")`，两种隐藏组成均稳定为 0.9881。`sha` 的早期 `mayHaveShan(viewer, "use")` 分支仍带概率估计，数值变化来自随机 roll，不是按牌名读取；隐藏信息判据以 `juedou` 与 `get.effect` 为准。

结论：原实现存在隐藏信息泄露，补丁已消除；**证据等级 A。** 国战专用分支未在本轮构造。

### 2.3 `olhaoshi` 好施（refresh_lin）

真实 `olhaoshi_give` content（`phaseDrawEnd`，6 手牌）与真实 `chooseCardTarget`：

- 候选顺序：`ally`（首名，态度 -4）在前，`enemy1`（态度 +6）在后；两者均为并列最低手牌（0）。
- 原宿主 `ai1` 的 `for...of` 在首位后无条件 `break`，只检查 `ally`，`goon=false`；补丁 `.some` 检查全部候选，`goon=true`。
- `ai1` 分值：干净 `0.1666666667`；补丁 `2`。
- 实际选牌：干净交出 `[wuxie, sha, tao]`；补丁交出 `[wuzhong, wuxie, wuxie]`；两者都交给 `enemy1`（友方），交牌数量均为 3，目标与结算不变。

真实 `olhaoshi_help` content（`useCardToTargeted`，攻击者为 `enemy2`，目标为持有者 `actor`，受援者 `ally`；`getTrigger().player`/`.target` 分别为攻击者/持有者）：

| 项目 | 干净宿主 | 补丁宿主 |
| --- | --- | --- |
| 受援者 `ai` 对闪分值 | `0` | `2` |
| 受援者 `ai` 对桃分值 | `0` | `0` |
| 实际选择 | 不交牌，`result.bool=false` | 交出 `shan`，`result.bool=true` |
| 持有者手牌 | `[tao]` | `[shan, tao]` |

结论：交牌回调的“只检查首位”缺陷与援助回调的来牌目标/已知牌缺陷均在真实宿主产生可观察差异；补丁通过。**证据等级 A。**

### 2.4 `rehuashen` 化身（refresh_shan）

合法初始化：真实 `lib.skill.rehuashen.init` + `addHuashens(actor, 3)`；`character.length=3`，阶段过滤器 true。

两轮真实选择（`phaseBegin` 与 `phaseEnd` 各一次，均执行 cost + content）：

| 轮次 | 干净宿主 | 补丁宿主 |
| --- | --- | --- |
| `phaseBegin` | `cond=phaseBegin`；选中 `current=ol_jsrg_caocao`、`current2=oldingxi`；`currentLegal=true` | `cond=in`；选中 `current=dc_sb_xusheng`、`current2=dcsbqinqiang`；`currentLegal=true` |
| `phaseEnd` | `cond=phaseEnd`；选中 `current=clan_xunshuang`、`current2=clandaojie`；`currentLegal=true` | `cond=out`；保持 `current=dc_sb_xusheng`，切换 `current2=dcsbyizhen`；`currentLegal=true` |

补丁宿主本轮抽到的 `rawVsMap` 明确包含被过滤技能：`ren_jiangwei` 的 `renguxing`、`clan_zhongyan` 的 `clanbaozu` 只存在于 `get.character(...).skills`，不在 `storage.rehuashen.map`；补丁只对 `map` 中的合法技能排名，实际选中的 `dcsbqinqiang/dcsbyizhen` 均在 map 内。干净宿主使用 `phaseBegin/phaseEnd`，补丁使用 `in/out`，`get.skillRank` 结果产生差异（例如补丁宿主 `dcsbqinqiang` 的 in/out 为 1.3/1.0，`dcsbyizhen` 为 1.0/1.1）。

空化身池：

- 真实阶段过滤器在 `character=[]` 时为 `false`，因此 `phaseBegin` 等阶段触发无法合法到达空池。
- 在真实 init 后人工清空 `character/map`（明确标记为人工破坏态，不是合法可达性证明）：干净宿主 `cost` 返回 `bool=true, cost_data="制衡其他化身"`；补丁返回 `bool=false, cost_data="cancel2"`，安全退出。
- 开局/入场 `addHuashens(3)` 在正常角色池下成功；未观察到合法空池。

结论：合法化身选择、两轮切换和技能合法性通过；空池防御有效但空池不可由阶段触发合法到达。**证据等级 A（合法流程）/ B（空池可达性）。**

## 3. 三个宿主边界

### 3.1 归属与补丁命中

逐 hunk 扫描十份补丁（按宿主文件旧行号回溯最近技能定义）：

| 补丁 | 命中技能 |
| --- | --- |
| `shenhua_lin.patch` | `dimeng`、`roulin`、`luanwu` |
| `shenhua_shan.patch` | `tuntian`、`zhiba` |
| `shenhua_yin.patch` | `nzry_kuizhu`、`nzry_mingren`（2557 行属于溃诛，不是飞军） |
| `refresh_lin.patch` | `olhaoshi`（两处）、`oldimeng` |
| `refresh_shan.patch` | `olzhiba2`、`rehuashen`（四处） |
| 其余五包 | `oljieming`、`stdxiaoguo`、`stdshushen`、`shenzhi`、`tieji`、`yiji`、`retongji`、`xinfu_jijie`、`xinfu_jiyuan` |

`qizhi`、`reqiaobian`、`nzry_feijun` 不出现在任何十包补丁中；均为宿主原生技能，本轮结果不归因于十包补丁。

### 3.2 `qizhi` 奇制（shenhua_yin，宿主原生）

使用真实 `qizhi.cost` + `qizhi.content`；受保护装备通过测试探针的 `canBeDiscarded` mod 接入宿主真实合法性接口（`getDiscardableCards` / `discardPlayerCard`）：

- 混合场景：`bagua` 受保护、`tao` 可弃；`discardable=["tao"]`、`nonDiscardable=["bagua"]`；结算弃置 `tao`、保留 `bagua`，随后摸 1 张。
- 全部受保护：目标只有受保护 `bagua`；`discardable=[]`；`discardPlayerCard` 返回 0 张，但 `qizhi.content` 仍执行 `target.draw()`，目标获得 1 张（干净/补丁一致）。
- 结论：宿主原生 P2——全部牌受保护时仍产生一次摸牌；补丁未修改该规则。证据等级 B（保护状态由探针技能构造）。

### 3.3 `reqiaobian` 巧变（refresh_shan，宿主原生）

使用真实 `reqiaobian_draw.content`；用测试探针的 `cardDiscardable` mod 制造三种“仅在特定子技上下文可弃”的牌：

| 场景 | 过滤器（使用 `reqiaobian_judge` 上下文） | `reqiaobian_draw` 自身上下文 | 实际结果 |
| --- | --- | --- | --- |
| 仅 judge 可弃 | true | false | 控件只提供 `cancel2`，不取消阶段、不付费；无非法跳过 |
| 仅 draw 可弃 | false | true | 过滤器阻断，合法跳过机会被漏掉；内容未执行 |
| 两上下文均可弃 | true | true | 弃 1 张，阶段取消，随后正常进入摸牌分支 |

未复现“强制弃牌失败后仍取消阶段”的非法结算；确认的是宿主原生 P2——过滤器固定复用 `reqiaobian_judge` 弃牌上下文，可能在 draw/use/discard 上下文中漏掉合法触发。补丁未修改。证据等级 B（上下文限制由探针技能构造）。

### 3.4 `feijun` 飞军（shenhua_yin，宿主原生）

真实 `useSkill('nzry_feijun', [1 张手牌])`：

- 支付前：使用者 1 手、敌方 1 手、双方 0 装备；`filter=true`；`ai.result.player(actor)` 返回 `undefined`（记录为 null），不会主动发动。
- 支付后：使用者 0 手、敌方 1 手；真实 content 选择敌方，取得 1 张；`storage` 记录该目标，`nzry_binglve` 标记为 true，实际摸 2（使用者手牌 1→3，敌方 1→0）。
- 无合法目标：使用者支付后 0 手，其他角色 0 手 0 装备；content 的 `list` 为空，安全结束，无异常，使用者手牌 1→0，storage 为空。
- 结论：宿主原生 P2——AI 发动评分使用支付前张数，漏估“支付后合法且能联动兵略”的机会；补丁未修改。证据等级 A（真实 useSkill + content + 兵略）。

## 4. 分包最终状态（原生 AI 补丁范围）

| 分包 | 状态 | 依据 |
| --- | --- | --- |
| `standard_2008` | **PASS** | tieji/yiji 真实差异（第一阶段） |
| `standard_2013` | **PASS** | retongji 真实差异 |
| `standard_2019` | **PASS** | xinfu_jijie/xinfu_jiyuan 真实差异 |
| `standard_2023` | **PASS** | stdshushen/shenzhi/stdxiaoguo 真实差异 |
| `shenhua_lin` | **PASS** | dimeng 空候选 P0 已真实复现并修复；luanwu/roulin PASS；合法交换结算不变 |
| `shenhua_shan` | **PASS** | tuntian 隐藏信息差异已证明并修复；zhiba PASS |
| `shenhua_yin` | **PASS** | kuizhu/mingren PASS；宿主原生 qizhi/feijun P2 保留（非补丁回归） |
| `refresh_huo` | **PASS** | oljieming 真实差异 |
| `refresh_lin` | **PASS** | olhaoshi 两处真实差异；oldimeng PASS |
| `refresh_shan` | **PASS** | rehuashen 两轮选择/合法性 PASS；olzhiba2 PASS；宿主原生 reqiaobian P2 保留 |

## 5. P0/P1/P2

- **未关闭 P0/P1（可归因于十包补丁）：无。**
- 已关闭/已验证 P0：`dimeng` 空候选 TypeError（真实事件链复现，补丁后取消）；`tuntian` 隐藏牌面读取（补丁后稳定）。
- **P2（全部保留，未清零）**：
  - `qizhi`：全部牌受保护时仍摸 1 张（宿主原生，补丁未改）。
  - `reqiaobian`：过滤器复用 `reqiaobian_judge` 上下文，draw/use/discard 上下文可弃时可能漏触发（宿主原生，补丁未改）。
  - `feijun`：AI 发动评分使用支付前张数，漏估支付后合法目标（宿主原生，补丁未改）。
  - `rehuashen`：空化身池仅能由人工破坏状态构造；阶段过滤器阻断，补丁为防御性 `cancel2`（未证明合法可达）。
  - 开发台账中其他 P2 未在本轮逐项重审。

## 6. 十包原生 + 旧六包扩展组合

本轮**未执行**组合测试，不声明十六包兼容 PASS。

可以进入组合验收，进入前必须固定并记录：

1. 旧六包扩展 ZIP 与 SHA256、安装顺序、扩展启用配置。
2. 十份原生补丁的安装顺序（以 `shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan` 及其余标准包的实际交付顺序为准）。
3. 旧六包扩展是否对 `dimeng/tuntian/olhaoshi/rehuashen` 等技能有 AI 接管；若有，必须区分“原生补丁生效”“扩展接管生效”“重复接管/覆盖”。
4. 组合后的受支持范围、回滚路径和失败恢复；不得把未验证的扩展策略包装成十包交付。

## 7. 复现命令

```bash
node docs/remaining-ten-packs-acceptance/host/run-host.mjs \
  --host-root "C:/Users/32360/AppData/Local/Temp/shv-accept/host-a" \
  --extension-root "C:/Users/32360/.codex/worktrees/remaining-ten-packs-acceptance" \
  --browser "C:/Program Files/Google/Chrome/Application/chrome.exe" \
  --playwright "C:/Users/32360/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright" \
  --mode identity --edge --allow-errors \
  --output docs/remaining-ten-packs-acceptance/host/evidence/edge-clean.json
```

补丁宿主将 `--host-root` 替换为 `C:/Users/32360/AppData/Local/Temp/remaining-ten-accept/host-ten`，去掉 `--allow-errors`。生成摘要：

```bash
node docs/remaining-ten-packs-acceptance/phase2b/build-edge-report.mjs
```

## 8. 结论

- 四项未决技能：`dimeng`、`tuntian`、`olhaoshi`、`rehuashen` 均取得真实宿主对照证据，原 PARTIAL/BLOCKED 阻塞已解决。
- 三个边界：均为宿主原生、未被十份补丁修改；`qizhi` 全保护摸牌、`reqiaobian` 上下文过滤、`feijun` 支付前 AI 估值作为 P2 保留，不构成本轮补丁回归。
- 十包原生 AI 补丁范围：**满足内部交付门禁，无未关闭 P0/P1**；可表述为“剩余10个分包最终内部交付 PASS（仅限原生 AI 补丁范围）”。
- 但 P2 未清零，且十包原生 + 旧六包扩展的受支持组合尚未执行；因此**不宣布十六包全量兼容 PASS，也不宣布 P2 已关闭**。

**未 push、未合并、未创建 Release/Tag；开发分支未被修改。**
