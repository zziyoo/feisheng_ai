# 无名 AI v4 六项 P2 开发交接

开发分支 `codex/sixteen-packs-p2-final-v4`，独立工作树 `C:/Users/32360/.codex/worktrees/sixteen-packs-p2-final-v4`。基线为 v3 `c5ec662359ca0aba9c3e01ff0b40ce9dbfa6c402`，最后一笔运行源码提交为 `69ed0745c5db9026a82e4a24438ced6ab2df2859`。交接文档所在提交为本轮最终 HEAD，可用 `git log -1 --format=%H -- docs/SIXTEEN_PACK_P2_V4_HANDOFF.md` 查询。

当前状态为**开发完成，待独立验收**。v3 的 56 条交付校验及 16 个产物的尺寸和 SHA256 已重核。工作区在提交后应为空。v4 使用现有扩展接线，三个策略模块需要进入后续候选构建。十份原生补丁、历史六包 ZIP、v3 交付目录、协调器、通用引擎、部署协议和 134 维契约沿用基线。未推送、未发布、未构建 v4 ZIP。

## 1. 奇制 `qizhi` · 宿主结算问题，另行处理

- **证据。** 宿主 `character/sp.js:38429` 的 filter 和 cost 以非用牌目标且 `countCards("he") > 0` 放行。文案 `qizhi_info` 写明「若如此做，其摸一张牌」。content 记录一次奇制历史，等待 `discardPlayerCard(target, true, "he")`，随后无条件 `target.draw()`。原生弃牌权限见 `noname/library/index.js:11270`，该接口查询父事件的实际技能名。原生选择层按权限列牌，强制选择也可能没有合法牌。
- **最小复现。** 自己回合用基本牌或锦囊指定第一目标，选一名未被用牌指定的角色作为奇制目标。此人仅有一件由 `canBeDiscarded` 禁弃的八卦阵。历史真实宿主证据显示 `discardable=[]`、实际弃置 0，八卦保留，目标仍摸 1。手动选择被原生界面允许，可以把该行为用作给友方补一张，并记录一次会影响进趋的奇制历史。宿主实现和文案存在差异，不能从界面可选推定这一收益是规则设计。
- **v4 处理。** 无运行改动。v3 已让全保护目标的 AI 评分归零，本轮 7 项断言重跑。历史对照见 [宿主原生边界](remaining-ten-packs-acceptance/phase2b/real-host-edge-report.md)和 [v3 记录](sixteen-packs-p2-v3/P2-RESOLUTION.md)。若宿主项目确认需要修复，建议单独在上游审核实际弃置结果，测试取消、弃牌改写、替代效果和进趋计数语义，再决定摸牌、历史记录的门禁。该规则改动不属于 v4 的 AI 补丁。
- **独立检查。** 正例给目标一张合法可弃置的桃，另一张装备受保护。手选和 AI 应保留原弃牌及摸牌。全保护时验证 AI 跳过，手动路径按 1.11.7 记录原生差异。

## 2. 雄乱 `drlt_xiongluan` · 已修复，待独立验收

- **提交与文件。** `1745671`，`score/decision/skills/packs/shenhuaLei.js`、`tools/test-shenhua-lei-xiongluan.mjs`。
- **根因。** 1.11.7 雄乱的 `ai.result.target` 为目标侧负分。旧通用扫描把给目标添加的 `_ban` 当作友方支援，`skillDirectionEffectModifier` 向使用者一侧注入友方 +1.5、敌方 −12。宿主再乘使用者自态度 10，覆盖本应按目标态度折算的收益。通用方向函数也供其他技能使用。
- **改动。** 延续 v3 的原版目标回调指纹和八卦 0.5、改八卦 0.25 权重。在原版仅有目标评分且无外部 effect 时，为雄乱自身的 `ai.effect.player` 增加精确技能 ID 的宿主 `zeroplayer` 哨兵。使用者方向偏置归零，目标侧仍受正效杀、护甲、救援量及目标关系约束。函数身份变化后停用哨兵。卸载只移除本包的 effect，已存在或后接管的第三方实现保留。此修复范围为宿主效果汇总；共享引擎的静态画像仍可能标成支援。
- **开发证据。** 使用两套实际宿主效果汇总函数的确定性测试，复现 v3 一杀敌方 `−120`，修复后为 `0`。1.11.7 Chrome 定点冒烟，未安装分包、引擎方向层启用时一杀 `敌 −116／友 +15`，v4 一杀 `0／0`，补到两杀 `+4／0`，对同一敌人的普通杀分数保持 `25.515`。卸载恢复原函数。早期探针未清零角色自带护甲而未达到正例阈值，最终夹具显式置零后通过。
- **独立检查。** 在完整引擎中以无护甲、无可见救援的 1HP 八卦敌人为目标，一张正效杀通用评分为零、两张为正。加入友方控制、四杀改八卦、额外护甲、免伤及救援、真实 `chooseToUse` 和限技结算。用普通杀或其他主动技核对方向分，验证重装、卸载和第三方 effect 保留。备选原生路线未同步。

## 3. 强袭 `qiangxix` · 已修复，待独立验收

- **提交与文件。** `64161da`，`score/decision/skills/packs/shenhuaHuo.js`、`tools/test-shenhua-huo-qiangxix.mjs`、火包的 `tools/skill-ai-pack-config.mjs` 与 `tools/pack-templates/shenhua_huo.test.mjs`。
- **根因与改动。** 宿主 `character/shenhua.js:6701` 允许可选武器 `[0,1]`，未提供 `check`；`ai/basic.js` 选择技能后默认按 `get.unuseful2` 选牌。扩展只在实际出牌阶段的强袭材料入口保护唯一装备区原版诸葛连弩。要求使用者至少 4HP，敌人可被强袭且未见手牌、防具、护甲或已知响应能力，并以宿主合法性和不含连弩的杀配额核对至少两次额外正收益攻击，收益需大于原有失去体力的效果估值。命中时把这张材料降为 0，宿主可选择空材料并走原有失去体力分支。丈八、手牌武器、多武器、低血、不可用杀及第三方已有 `check/ai1` 走原策略。
- **开发证据。** 原版 `Basic.chooseCard` 提取红绿测试。实际 Chrome 定点隔离强袭决策顺序，4HP、三张杀、距离 1 的 4HP 空手敌人：旧弃连弩，己 4HP，敌 3HP；新保留连弩，己 3HP，敌 3HP。距离 2 对照均弃武器。火包模板 9 项通过。
- **独立检查。** 复用该距离 1 正例，用实际自动出牌不加探针优先级观察是否合理安排后续。加距离 2、低血丈八、其他杀配额、敌人有闪或防具、并行其他技能和卸载。此扩展决策无需改动历史火包原生备选。

## 4. 罪论 `xinfu_zuilun` · 已修复，待独立验收

- **提交与文件。** `e8be6b3`，`score/decision/skills/packs/shenhuaLei.js`、雷包构建配置、`tools/test-shenhua-lei-zuilun.mjs`。
- **根因。** 宿主 `character/shenhua.js:1312` 在结算已将三张牌移入 ordering 并交给当前角色后，`processAI` 对外层牌堆分组 `list` 排序，随后却从未排序的 `cards3` 取牌。原打分的 `next.getUseValue` 又可能间接读取未公开信息。
- **改动。** 通过 1.11.7 的 `game.globalEventHandlers` 给罪论父事件注册 `onNextChooseToMove`。宿主在子事件入队时继承回调，编译器在 begin 调用。仅在实际父技能、触发阶段、选择者及旧回调指纹全部吻合时包装该子事件的 AI。评分只读已提供的三张牌、下一角色公开判定区、态度及牌定义静态数值。乐、兵粮、闪电使用宿主固定判定语义和原始花色点数。动态牌价值及未知判定按无额外分处理。返回固定数量、无重复的原牌引用，保留获取牌相对顺序。实际插回、获取、零收益双失血、人工确认路径由宿主执行。
- **开发证据。** 敌方下一角色有乐不思蜀、可置顶一张，输入 `桃♥4／杀♠7／闪♣2`。真实 Chrome 原版置顶桃，取得杀和闪。v4 置顶杀，取得桃和闪。提取测试另覆盖友方、无判定、两次公开判定、全放回、其它父事件、第三方回调及已入队事件的卸载降级。夹具固定弃牌历史以选择一张置顶，使用真实宿主移动和结算。
- **独立检查。** 对相同公开局面替换对手暗牌，决策应不变。覆盖牌堆顶部顺序、下一角色为友方、无判定、乐/兵/闪电、三种放回数量、无需选择的全取分支、零收益目标与失血、手动移动、并发和卸载。备选原生路线仍用宿主排序；历史雷原生路线与扩展互斥。

## 5. 踞襄 `twjuxiang` · 已修复窄场景，待独立验收

- **提交与文件。** `69ed074`，`score/decision/skills/packs/shenhuaLei.js`、雷包构建配置、`tools/test-shenhua-lei-juxiang-v4.mjs`。
- **根因与改动。** 宿主 `character/tw.js:13026` 的 `twjuxiang_global.check` 直接以给方牌值给正分，昂贵装备反而更容易送出。实际结算先走空装备栏直接装备，否则尝试复栏并获牌。新策略只保护一血、空手、无护甲、无已知失装备收益、处于敌方攻击范围的群势力给方的唯一物理八卦阵或仁王盾。要求恰有一名健康友方主公、空防具栏且宿主 `canEquip` 确认可装备。纯 AI 材料评分归零。低血主公、复栏、多候选、坐骑与武器、虚拟防具、失装联动、未知状态均保留原评估，未读收方暗牌。
- **开发证据。** 用 1.11.7 原 `check` 与静态装备值测试，八卦由 7.5 变为 0；事件作用域、正向送装、复栏、第三方和卸载均有确定性对照。尚无该项 Chrome 开发证据。
- **独立检查。** 用可发动的群势力 AI、一血空手且只有八卦、友方张绣至少三血且空防具栏、敌人在攻击范围内的身份局。比较原版送装和 v4 保留，检查低血主公、复栏、无威胁、多受赠者、武器/坐骑。手动选择仍应可进入原转移，完整结算按宿主。该技能没有 v4 原生对应实现。

## 6. 界奇谋 `reqimou` · 已修复确定的射程漏判，待独立验收

- **提交与文件。** `d45f2b5`，`score/decision/skills/packs/refreshFeng.js`、`tools/test-refresh-feng-reqimou-v4.mjs`。
- **根因与改动。** 宿主 `character/refresh.js:11274` 的发动评分只用体力作距离上限，忽略武器范围。v3 的真实范围及支付计划只在宿主评分为正时评估。v4 限定旧评分指纹且返回 0 的路径，要求宿主攻击距离、实际物理杀可用性、目标合法性、正效与既有计划一致。只对空手、无护甲、无已知响应、普通射程修正且明确可解锁攻击的敌人补判，支付后至少保留 2HP。现有支付钳制继续生效。
- **开发证据。** 确定性专项和旧规则 9 项通过。定点 Chrome 对照，己方 4HP、丈八范围 3、两张杀，唯一 2HP 空手敌人因 +1 马距离为 5。原版评分 0，不发动。显式安装 v4 界风策略后评分 1，实际付 2、摸 2、用两张杀将敌人打至 0，己方保留 2HP。历史 3HP 敌人、两张杀而无明确击杀的保守决策继续保留。正收益估计仍受救援及其他后续事件影响。
- **独立检查。** 用完整引擎及双风既定顺序复现上例，并核对三血目标、护甲、已知响应、敌友关系、负剩余次数和特殊距离修正。确认人工和远端选择、低血体力支付门禁、其他主动技及双风卸载。界奇谋为扩展路线，旧双风原生补丁未同步。

## 源码哈希与后续构建

以下为 v4 运行 Git blob 的 SHA256。原生补丁 SHA256 与 [v3 清单](sixteen-packs-p2-v3/ARTIFACTS.json) 相同。正式顺序仍为 `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope`。同技能原生和扩展路线互斥。

- `refreshFeng.js`，`5ee2bac6f5454db7670c564aa98b3565c5ab6c3ba54fb7881a6e2d17a674288c`。
- `shenhuaHuo.js`，`94addbdee96533c44cf02be12c0fc4586e9bf7c185396bb20c59597c2990d388`。
- `shenhuaLei.js`，`8ae698e2523a90183b8406f2473ca60ebb801111275e27943acf519cb8116e0a`。

构建和最终验收请在新目录完成。建议以 v3 已核哈希的归档为封版输入，只重建界风、神话火、神话雷。新档须重算各清单与 `pack_files`，并按新证据更新候选标签及技能登记。旧雷 v3 派生脚本限定原 v2 输入和固定技能数，不能直接生成 v4。历史通用构建器的雷包候选文案仍写旧三项接线，火包通用路径还会写入交付台账。后续构建应使用隔离副本并核对这些元数据，旧归档及台账保持历史含义。v4 本轮未运行通用构建器或安装回滚矩阵。

## 可复算检查

将下列命令的 `<宿主>` 指向干净 1.11.7 `resources/app`。六个入口本轮全部通过，改动 JS 的 `node --check`、`git diff --check` 及 v3 校验也通过。定点开发浏览器证据与全量对局、独立验收分别记录。

```text
node tools/test-native-qizhi-p2.mjs <宿主>
node tools/test-shenhua-lei-xiongluan.mjs <宿主>
node tools/test-shenhua-huo-qiangxix.mjs <宿主>
node tools/test-shenhua-lei-zuilun.mjs <宿主>
node tools/test-shenhua-lei-juxiang-v4.mjs <宿主>
node tools/test-refresh-feng-reqimou-v4.mjs <宿主>
```

临时开发冒烟原始结果位于 `%TEMP%/feisheng-v4-lei-focus-5f984b7e/{stock,candidate,xiongluan-engine-clean}.json`、`%TEMP%/feisheng-v4-qiangxix-dplh7r0v/{near-result,result}.json`、`%TEMP%/feisheng-v4-qimou-8a08aa06/{policy,policy-with-pack}.json`。以上仅覆盖所列固定局面。未开展完整八人对局、Android、联机或腾讯同步。
