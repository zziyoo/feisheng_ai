# 十六包技能接管矩阵与冲突审查

日期：2026-11-13  
范围：十份剩余分包原生 AI 补丁（`docs/remaining-ten-packs/native/`）与六份既有扩展分包（正式 ZIP，官方安装顺序）。  
宿主：无名杀 1.11.7；扩展基线：上游 `1fe5292eb3022dd8d1db494617b21a12be912e61`。

## 1. 十份原生补丁的修改面

十份补丁只改宿主 `character/*.js` 的 AI 回调或 AI 标签，不注册扩展分包，不修改 `score/` 扩展运行源码。

| 分包 | 文件 | 技能 ID | 修改的 AI 回调/标签 | 行为要点 |
| --- | --- | --- | --- | --- |
| `standard_2008` | `character/standard.js` | `tieji` 铁骑 | 删除 `ai.directHit_ai` 与 `ai.skillTagFilter` | 不再读取牌堆顶未公开牌并把猜顶传播为必中 |
| `standard_2008` | `character/standard.js` | `yiji` 遗计 | `ai.result.target` | 普通牌不再优先给 `nogain` 目标；毒牌分支保留 |
| `standard_2013` | `character/standard.js` | `retongji` 同疾 | 原目标 `check` 内的隐藏闪分支 | 改用目标已知牌判断，保留 1/2 血转移窗口 |
| `standard_2019` | `character/standard.js` | `xinfu_jijie` 机捷 | `ai.result.target` | 普通牌跳过 `nogain` 目标 |
| `standard_2019` | `character/standard.js` | `xinfu_jiyuan` 急援 | `check` | 非濒死 `nogain` 目标不再自动发动；濒死窗口保留 |
| `standard_2023` | `character/standard.js` | `stdshushen` 淑慎 | `ai.result.target` | 按实得牌张数计分，`nogain` 目标归零 |
| `standard_2023` | `character/standard.js` | `stdxiaoguo` 骁果 | `cost` 的 `eff` 评分 | 仅在可弃装备/已知手牌装备时给 `noe` 正收益 |
| `standard_2023` | `character/sp.js` | `shenzhi` 神智 | `check` | 满血不再弃整手；受伤分支保留 |
| `shenhua_lin` | `character/shenhua.js` | `dimeng` 缔盟 | `ai.result.target` | 空候选列表返回 0，不再访问 `list[0]` |
| `shenhua_lin` | `character/shenhua.js` | `roulin` 肉林 | `ai` 标签 | 删除错误 `directHit_ai`/`skillTagFilter`，保留 `halfneg` |
| `shenhua_lin` | `character/shenhua.js` | `luanwu` 乱武 | `ai.result.player` | 无主公安全；排除施放者与非正体力角色 |
| `shenhua_shan` | `character/shenhua.js` | `tuntian` 屯田 | `ai.effect.target` | 按当前决策者 `mayHaveSha/mayHaveShan` 与已知牌估计 |
| `shenhua_shan` | `character/shenhua.js` | `zhiba` 制霸 | `zhiba`/`olzhiba2` 子技评分 | 只读已知牌与公开手牌数，不再读主公整手点数 |
| `shenhua_yin` | `character/shenhua.js` | `nzry_kuizhu` 溃诛 | 伤害目标 `chooseTarget` AI | 单目标优先恰好匹配弃牌数的敌人 |
| `shenhua_yin` | `character/shenhua.js` | `nzry_mingren` 明任 | 换“任”候选评分 | 统计换后仍留手的同色响应 |
| `refresh_huo` | `character/refresh.js` | `oljieming` 节命 | `ai.effect.target` | 按 `maxHp` 而非当前体力计算补牌收益 |
| `refresh_lin` | `character/refresh.js` | `olhaoshi` 好施 | `ai1`、援助 `chooseCard.ai`、`oldimeng.ai.result.target` | 并列最低检查全部合法收牌人；援助按当前来牌目标与已知牌；缔盟按公开手牌差 |
| `refresh_shan` | `character/refresh.js` | `rehuashen` 化身、`olzhiba2` 制霸 | 阶段控制、选将、选技、制霸评分 | 只从合法化身技能表排序；`in/out` 上下文；空候选安全退出；制霸只读已知牌 |

补丁 SHA256、提交号与宿主原始/补丁后哈希见 `phase1/artifacts-baseline.json`。

## 2. 六份扩展分包的运行时接管面

六个 ZIP 的共享核心一致：`policyCore.js` `545ee71d…`、`skillAIPolicies.js` `46b47ef9…`、`skillVetoRegistry.js` `ed8f6022…`。所有包装都在扩展运行时的 `score/decision/skills/` 内，通过 `host.wrap`/`wrapShared`/`wrapPrototype` 安装；安装器不写宿主 `character/`。

| 分包 | 运行时包装 | 精确位置 |
| --- | --- | --- |
| `refresh_standard` | `qingguo.mod.aiValue`、`jijiu.mod.aiValue`、`lijian.ai.result.target`、`refankui.ai.effect.target`、`reqianxun.ai.effect.target`、`reganglie.check`、`retieji.ai.skillTagFilter`、`rejieyin.check`、`new_reqingnang.check`、`refanjian.ai.result.target`、`new_yijue.ai.result.target`、`rerende.ai.order/check/result.target`、`rezhiheng.check/ai.order/result.player`、`Player.prototype.chooseTarget`（仅 `new_retuxi`） | `score/decision/skills/packs/refreshStandard.js:51,68,84,97,112,122,137,148,165,180,195,268,273,281,311,335,354,374` |
| `refresh_feng` | `xinliegong.mod.aiOrder`（共享入口）、`oltianxiang.ai.effect.target`、`reguhuo.chooseButton.backup`、`fenji.check`、`reqimou.ai.result.player`、`reqimou.content` | `score/decision/skills/packs/refreshFeng.js:100,113,122,143,153,177` |
| `shenhua_feng` | `qimou.ai.result.player`、`xinkuanggu.cost`、`jushou.check`、`shensu1.cost`、`xinfu_guhuo.chooseButton.check/backup`、`huangtian.ai.result.target`、`guidao.cost`、`releiji.cost`、`xinliegong.mod.aiOrder`（共享入口）、`gzbuqu.ai.effect.target` | `score/decision/skills/packs/shenhuaFeng.js:46,76,115,132,159,189,238,266,309,331,351` |
| `shenhua_huo` | `luanji.check`、`tianyi.ai.order/result.player/result.target`、`jianchu.check` | `score/decision/skills/packs/shenhuaHuo.js:57,118,126,137,191` |
| `shenhua_lei` | `olkongsheng.cost`、`xinfu_fuyin.ai.effect.target`、`drlt_qianjie.ai.effect.target`、`drlt_zhengu` 的 `chooseTarget` 内容 `onChooseTarget` | `score/decision/skills/packs/shenhuaLei.js:32,65,89,100-151` |
| `out_of_scope` | `redimeng.find`、`Player.prototype.chooseButton`（仅活动技能包含 `redimeng`） | `score/decision/skills/packs/outOfScope.js:26,87` |

## 3. 直接技能 ID 交集

**结论：没有同一技能 ID 被十份原生补丁与六份扩展同时接管。**

十份补丁修改的 20 个技能 ID：
`tieji`、`yiji`、`retongji`、`xinfu_jijie`、`xinfu_jiyuan`、`stdshushen`、`shenzhi`、`stdxiaoguo`、`dimeng`、`roulin`、`luanwu`、`tuntian`、`zhiba`、`nzry_kuizhu`、`nzry_mingren`、`oljieming`、`olhaoshi`、`oldimeng`、`rehuashen`、`olzhiba2`。

六份扩展的运行时包装技能 ID（上表）与上述集合的交集为空。`refresh_standard` 的 `skills` 清单中的 `retieji`、`new_retuxi`、`new_reyiji` 等是界限突破变体 ID，不是上述原生 ID；`shenhua_huo` 的 `jieming` 是神话火荀彧定义，与 `oljieming` 不同。

## 4. 共享/派生技能与跨包读取

| 关系 | 结论 | 证据 |
| --- | --- | --- |
| `tieji`（标准马超）vs `retieji`（界马超） | 两个独立技能对象；扩展只包装 `retieji.ai.skillTagFilter`，原生补丁只改 `tieji.ai`；不重复 | `character/standard.js:1656`、`character/refresh.js:16209`；`refreshStandard.js:135-143` |
| `yiji`（标准郭嘉）vs `new_reyiji`（界郭嘉） | 扩展未实现/包装 `yiji`；原生补丁只改 `yiji`；不重复 | `standard_2008.patch`；`refresh_standard` `skills` 清单无 `new_reyiji` |
| `qingguo`/`jijiu`/`lijian`（标准与界限突破共用基类技能） | `refresh_standard` 主动包装这三个基类技能；十份原生补丁**未**修改它们；只有扩展一处接管，属于共享基类覆盖，不是重复接管 | `refreshStandard.js:51,68,84`；组合真实宿主场景 `standard-qingguo-*`、`standard-jijiu-*`、`standard-lijian-*` PASS |
| `dimeng`（神话林鲁肃）vs `redimeng`（清单外活动鲁肃） | 不同技能 ID；`out_of_scope` 的 `chooseButton` 钩子只在活动技能包含 `redimeng` 时启用；`shouldMaskHiddenButtonChoice` 对 `dimeng` 返回 false；`redimeng.find` 也只改 `lib.skill.redimeng.find` | `rules/outOfScope.js:11-14`、`packs/outOfScope.js:26-78,87-93`；组合宿主 `edge-dimeng-*` 与六包 `redimeng-*` 场景均 PASS |
| `luanwu`（神话林）vs `reluanwu`（界林） | 界林不在六包范围；原生补丁改 `luanwu.ai.result.player`，界林继承该评分；没有扩展同时接管 | `shenhua_lin.patch`；六包 `skills` 清单无 `luanwu/reluanwu` |
| `tuntian`（神话山）vs `oltuntian`（界山） | 界山不在六包范围；扩展 `new_retuxi` 目标策略只读 `target.hasSkill('tuntian')` 作为“失牌收益”提示，不包装 `tuntian.ai.effect.target` | `refreshStandard.js:386`；`shenhua_shan.patch` |
| `zhiba`/`olzhiba2`（神话山/界山） | 界山不在六包范围；无扩展包装 | `shenhua_shan.patch`、`refresh_shan.patch` |
| `olhaoshi`/`oldimeng`（界林） | 界林不在六包范围；无扩展包装 | `refresh_lin.patch` |
| `rehuashen`（界山） | 界山不在六包范围；无扩展包装 | `refresh_shan.patch` |
| `nzry_kuizhu`/`nzry_mingren`（神话阴） | 神话阴不在六包范围；无扩展包装 | `shenhua_yin.patch` |
| `oljieming`（界火）vs `jieming`（神话火） | 两个独立定义；`shenhua_huo` 的实现技能清单只有 `luanji/tianyi/jianchu`，未包装 `jieming`；不重复 | `character/refresh.js:3658`、`character/shenhua.js:6642`；`shenhua_huo/pack.json` |

## 5. 通用钩子与引擎层

1. `refresh_standard` 包装 `Player.prototype.chooseTarget`，但只在 `TARGET_POLICIES` 含当前技能时介入；集合只有 `new_retuxi`（`refreshStandard.js:19,374-397`）。
2. `shenhua_lei` 只在父事件技能为 `drlt_zhengu` 时替换本次 `chooseTarget` 的评分（`shenhuaLei.js:95-151`）。
3. `out_of_scope` 只在活动技能包含 `redimeng` 时替换 `chooseButton` 的 AI（`outOfScope.js:26-78`）。
4. 完整无名AI引擎自身有通用决策桥（`chooseCard`、`chooseTarget`、`chooseCardTarget`、`chooseButtonTarget`、`chooseButton`、`chooseControl`、`chooseToUse`、`chooseToRespond`）和技能认知表；这些不是六包分包的“同技能接管”。本轮用同一真实宿主、同一组固定场景分别在**仅十补丁**与**十补丁+完整引擎+六包**下运行：
   - 十包 16 项确定性场景签名全部一致（`phase3/native-scene-compare.json`）；
   - 六包 96 个默认场景的六项签名与六包封版基线全部一致（`phase3/six-pack-signature-compare.json`）；
   - `tuntian-viewer` 的 `mayHaveShan` 是宿主随机估计，跨进程 RNG 状态不同会变化；受控隐藏牌场景 `edge-tuntian-hidden` 的 `juedou` 目标收益与 known 计数完全一致（`phase3/edge-scene-compare.json` 的 `stochastic` 说明）。
5. 没有发现需要“禁用已有防护”或“强制覆盖”的冲突。

## 6. 安装/卸载路径隔离

- 十补丁只写宿主 `character/standard.js`、`shenhua.js`、`refresh.js`、`sp.js`；六包安装器只写扩展根 `score/decision/skills/`、`score/index.js` 接线和 `.djsc-pack-backups/`。
- 原生补丁累计应用后，扩展目录清单哈希前后不变（`phase4/patch-roundtrip.json` 的 `extensionUntouched=true`）。
- 六包逆序回滚/重装前后，宿主五文件哈希完全不变（`phase4/extension-rollback-reinstall.json` 的 `rollbackHostUntouched`/`reinstallHostUntouched=true`）。
- 六包回滚后共享核心与 `skillPlanHints.js` 保留；重装后注册表恢复六条唯一导入。
- 原生补丁重复应用被 `git apply --check` 拒绝，文件哈希不变（`phase4/patch-roundtrip.json` 的 `duplicateApplyRejected`/`duplicateLeftFileUnchanged=true`）。

## 7. 不受支持的混装

以下组合**不在**本轮受支持范围，未作为验收配置：

1. 六包自己的原生补丁（`dual-feng-native-candidate.patch`、`feisheng-ai-refresh-standard-native-ai.patch`、`feisheng-ai-shenhua-huo-native-ai.patch`、`feisheng-ai-shenhua-lei-native-ai.patch`）与对应六包扩展同宿主叠加。六包封版文档明确为二选一。
2. 同一逻辑分包同时使用原生补丁与扩展策略；本组合的十包与六包在技能 ID 上不重叠，但“原生 + 同包扩展”仍按六包封版规则禁止。
3. 旧双风顺序 `refresh_standard → shenhua_feng → refresh_feng`；六包封版已证明为安全拒绝、零写入；本组合继续只支持官方顺序。
4. 旧六包 ZIP/旧共享核心与当前六包 ZIP 混装；安装器按哈希拒绝，不做原地覆盖。
5. 任意安装顺序；只支持 `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope`。
6. 把十份原生补丁包装成扩展 ZIP，或宣称十六个扩展安装包；本轮只有十个原生补丁 + 六个扩展 ZIP。

## 8. 矩阵结论

- 十份原生补丁与六份扩展分包**没有同一技能 ID 的重复接管**。
- 唯一有意的共享基类覆盖是 `qingguo`/`jijiu`/`lijian`：由 `refresh_standard` 扩展接管，十包原生补丁未改这些 ID；组合宿主场景已通过。
- `dimeng` 与 `redimeng`、`tieji` 与 `retieji`、`oljieming` 与 `jieming` 均按独立技能处理，没有混淆。
- 受支持配置为：十份剩余分包原生补丁 + 六份既有扩展分包（官方顺序），不叠加六包原生补丁路线。
