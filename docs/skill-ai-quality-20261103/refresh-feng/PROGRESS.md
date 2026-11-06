# 界限突破·风进度（未完成）

依据 142-task-list.json：8名武将、17项技能。宿主源码主要位于 character/refresh.js 和 character/shenhua.js；部分技能由冻结的神话再临·风包也使用，须避免修改该包。所有修改待验证。

| 武将 | 技能 | 状态 | 原生入口或下一步 | 提交 |
| --- | --- | --- | --- | --- |
| 界夏侯渊 | xinshensu、shebian | 未审查 | shenhua.js / refresh.js，核对跳阶段和翻面移动 | — |
| 界魏延 | xinkuanggu | 未审查 | shenhua.js cost，核对摸牌与恢复 | — |
| 界魏延 | reqimou | 审查中 | refresh.js 的 result 与 content；扩展保护联机真人选择；仍需完整审查和原生候选 | 65ca37f |
| 界小乔 | oltianxiang、olhongyan、piaoling | 未审查 | refresh.js；联合评估天香与花色转换 | — |
| 界张角 | xinleiji、xinguidao、xinhuangtian | 未审查 | refresh.js；判断鬼道材料与雷击及赠牌联动 | — |
| 界于吉 | reguhuo | 未审查 | refresh.js；核对材料、质疑与对手信息边界 | — |
| 界曹仁 | xinjushou、xinjiewei | 未审查 | shenhua.js；核对翻面、装备与移动牌 | — |
| 界周泰 | buqu | 未审查 | shenhua.js；核对创与实际危险，不能假设牌堆分布 | — |
| 界周泰 | fenji | 已修改原生与扩展·待验证 | shenhua.js check，摸牌者作为 effect 第三参数；保留失去体力评分和结算 | 8c447bf |
| 界黄忠 | xinliegong、remoshi | 未审查 | shenhua.js / refresh.js；核对手牌比较、伤害与装备迁移 | — |

候选补丁 refresh-feng-native-candidate.patch 当前只含奋激；原始与候选副本在 base/ 和 candidate/，尚未提交，请勿删除。既有 reqimou 扩展还通过包裹 content 和 player.chooseNumbers 改AI选择，需要核对异步交叉、卸载和人类/联机语义；不可将静态修正当作宿主通过。未生成交付ZIP，未执行测试。
