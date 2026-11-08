# 界限突破·风全量静态审查

范围依据隔离宿主 `character/refresh.js` 的角色定义：8名角色、17项登记技能；实现另涉及 `character/shenhua.js`。本轮只做源码和历史证据审查，未执行任何验证。历史候选的单个场景通过不代表整项技能已全面验收。

| 角色/技能 | 决策入口及处理 | 分类 |
| --- | --- | --- |
| `ol_xiahouyuan` / `xinshensu` | `xinshensu_1/2` 继承 `shensu1/2`，另有 `shensu4`；前者 `chooseTarget.ai` 比较杀与跳过判定、摸牌的机会，第二项 `chooseCardTarget.ai1/ai2` 支付可弃装备，第四项按弃牌、翻面及设变判断。历史候选只改第一项，原生嵌套回调；宿主观察未完整证明低手牌乐的行为。 | 历史优化，待验收 |
| `ol_xiahouyuan` / `shebian` | 翻面后 `check` 使用 `canMoveCard(true,true)`，宿主 `moveCard` 负责装备槽、目标与具体牌；保留，不能凭未公开材料判断。 | 保留原实现 |
| `ol_weiyan` / `xinkuanggu` | 伤害次数由 `getIndex` 给出，嵌套 `chooseDrawRecover` 的 `choice` 依可用杀次数及回复/摸牌效果计算；历史原生候选修正零剩余杀次数。扩展不重写该事件，实际选择仍待针对性验收。 | 历史优化，待验收 |
| `ol_weiyan` / `reqimou` | 主动 `ai.result.player` 及 `chooseNumbers.processAI`；扩展 gate、支付建议使用自身可用杀、公开目标血量护甲、距离及自救牌，不读敌人暗牌。隔离试验中无已知杀时扩展放弃、原生可能付体力摸牌，未知摸牌收益不足以证明哪方必然更优；这是已知保守策略限制，非已确认正确性缺陷，不阻塞源码收官。完整引擎与远端联机仍待验证。原生未同步此启发式。 | 历史优化，PARTIAL |
| `ol_xiaoqiao` / `oltianxiang` | `damageBegin4` 嵌套 `chooseCardTarget.ai1/ai2`、`chooseControlList`，另有 `ai.effect.target`；历史原生与扩展仅修无手牌时公开装备红桃判断，材料、目标及二选一仍为宿主旧 AI，不能宣称联合优化。 | 历史优化，待验收 |
| `ol_xiaoqiao` / `olhongyan` | `mod.suit` 将黑桃视为红桃、装备影响手牌上限；天香通过 `get.suit` 间接读取。无独立发动选择。 | 无独立入口 |
| `ol_xiaoqiao` / `piaoling` | 判定红桃并进入弃牌堆后 `chooseTarget.ai`；旧回调仅按态度选人，自取还须弃牌。新候选对 `nogain` 目标返回0，允许取消并置顶；只改嵌套原生 AI，扩展 N/A。未计算置顶对后续判定的收益。 | 本轮修复，待验收 |
| `re_zhangjiao` / `xinleiji` | 闪/闪电引发 `judgeCheck`，`xinleiji_misa` 按公开判定花色选择雷伤目标；`ai.effect.target_use` 考虑响应、改判及自身可见牌。不会将未知牌堆当作确定判定；保留宿主启发式。 | 保留原实现 |
| `re_zhangjiao` / `xinguidao` | `cost` 的 `chooseCard.ai` 比较实际判定差、态度和材料价值，黑牌由 filter 限制；`mod.aiValue/aiUseful` 保留资源。`mod.aiOrder` 空语句没有可推知的目标评分，未猜测新增数值；嵌套选牌不重写。 | 保留原实现 |
| `re_zhangjiao` / `xinhuangtian` | 主公技派生 `xinhuangtian2`，群势力交闪/黑桃，`filterCard/filterTarget` 限合法材料及每目标次数，目标固定得分；最后一闪机会成本与救主改判存在冲突，不能用绝对门槛可靠修复。 | 保留原实现 |
| `xin_yuji` / `reguhuo` | `chooseButton.check` 选声明，`backup.ai1` 选材料；历史原生/扩展只区分真实材料价值，诈牌、质疑及结算不变。历史宿主调用的是诈牌分支，真牌排序尚未观察。 | 历史优化，待验收 |
| `caoren` / `xinjushou` | `content` 中 `chooseCard.ai` 选摸牌后的弃牌或可用装备；原生候选仅对 `hasUseTarget` 的装备加使用偏好。不可用装备历史场景有观察，扩展不重写嵌套选择。 | 历史优化，待验收 |
| `caoren` / `xinjiewei` | 装备转无懈的 `check` 使用装备价值；`move.cost` 以 `canMoveCard(true)` 与 `chooseToDiscard.ai` 比较，实际目标由宿主移动事件选择。 | 保留原实现 |
| `zhoutai` / `buqu` | 强制 `chooseToUseBefore` 展示新创，重复点数才失败；`ai.effect.target` 历史线性系数在大量创时高估攻击收益。候选保留创数量优先、无创时取体力的来源，保护非有限和负数，并设置0.9保守上限；上限不是概率，且不区分零创与一创。隔离试验观察到八创场景改选普通目标并完成击杀；正式累计补丁尚待复验。扩展无新接线。 | 本轮修复，待正式复验 |
| `zhoutai` / `fenji` | 手牌被他人获得/弃置后 `getIndex` 逐受害者调用 `check`；历史原生与扩展使用受害者作为摸牌效果来源、周泰为视角，体力成本和真实结算不变。历史仅观察未发动分支。 | 历史优化，待验收 |
| `ol_huangzhong` / `xinliegong` | `mod.aiOrder` 对实体无中和合法实体杀作局部条件判断；结算另检查双方实际手牌及血量。原生和扩展均要求剩余杀次数，名义摸牌并不保证兑现；历史先无中再杀未证明命中预期目标。 | 历史优化，待验收 |
| `ol_huangzhong` / `remoshi` | 满足伤害、牌区、装备条件后强制置矢；`retrieve.getIndex` 随公开装备离区触发。无独立发动评分，不预支未来装备移动收益。 | 无独立入口 |

分类互斥：历史候选8项、飘零与不屈修复候选2项、保留5项、无独立入口2项；合计17。累计原生AI候选9项，扩展5项，原生专属5项，扩展专属1项。不屈P2已提交候选，尚待正式补丁复验；没有将历史局部场景当成本轮验收。

## 双风与边界

两包都可能包装 `xinliegong.mod.aiOrder`；`policyCore.js` 安装前使用互斥 lease，`apply-pack.mjs` 检查另一包导入。历史真实宿主曾复现包装残留及次序冲突，后续采用互斥和包装失效降级；旧神话风共享核心可能哈希冲突，安装器应拒绝覆盖。两包共存不支持；不能把拒绝安装称为共存成功。

`piaoling` 提交 `f4397ab`，本轮 `buqu` 提交 `8e17772`。累计补丁保留此前八项并新增不屈原生评分；原生与扩展对同一技能的接管是替代路线。无模型、共享核心、安装器、其他分包或技能结算修改。补丁hunk仅静态维护，适用性、行尾和完整引擎消费均待独立验证。
