# 界限突破·风进度（候选待验证）

8名武将、17项技能；逐项规则、入口、保留理由和风险见 REVIEW.md。

| 武将 | 技能 | 处理状态 | 入口和结果 | Commit |
| --- | --- | --- | --- | --- |
| 界夏侯渊 | xinshensu | 已审查保留原生 | shensu1/2/4 的 cost | — |
| 界夏侯渊 | shebian | 已审查保留原生 | check、moveCard | — |
| 界魏延 | xinkuanggu | 已审查保留原生 | cost 回复与摸牌 | — |
| 界魏延 | reqimou | 仅扩展修改·待验证 | 既有 gate/支付策略；本次保护联机真人和方法恢复 | 65ca37f、0711b26 |
| 界小乔 | oltianxiang | 已审查保留原生 | cost/content 选择 | — |
| 界小乔 | olhongyan | 已审查保留原生 | 花色与上限 mod | — |
| 界小乔 | piaoling | 已审查保留原生 | 判定后赠牌选择 | — |
| 界张角 | xinleiji | 已审查保留原生 | 判定与 target effect | — |
| 界张角 | xinguidao | 已审查保留原生 | 改判选牌 | — |
| 界张角 | xinhuangtian | 已审查保留原生 | 全局赠牌 | — |
| 界于吉 | reguhuo | 已审查保留原生 | 声明、材料、质疑 | — |
| 界曹仁 | xinjushou | 仅原生修改·待验证 | 不可使用的装备按弃牌评分；嵌套选择不重写 | 9aada37 |
| 界曹仁 | xinjiewei | 已审查保留原生 | 无懈材料及移动 | — |
| 界周泰 | buqu | 已审查保留原生 | forced、target effect | — |
| 界周泰 | fenji | 已修改原生与扩展·待验证 | check 中摸牌者视角 | 8c447bf |
| 界黄忠 | xinliegong | 已审查保留原生 | aiOrder、check、skillTagFilter | — |
| 界黄忠 | remoshi | 已审查保留原生 | forced及retrieve | — |

累计补丁 refresh-feng-native-candidate.patch 含奋激、据守；base/ 和 candidate/ 是隔离源码副本。已有其他包的共享技能接管不计入本包。所有候选待验证，未启动宿主。

继续深化：用户要求继续处理全部技能；上表其余“保留原生”是上一轮结论，尚未完成本轮再次处理。当前候选尚未重新打包；下一步从神速、设变依次核对安全可用的实际决策入口，勿改冻结分包。
