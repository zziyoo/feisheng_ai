# 双风原生组合覆盖

基于独立预验收 `1d1ffad` 的 22 个 hunk 及其覆盖映射；当前正式候选另增加天香 fixB 回调并调整烈弓异常回退，均待独立复验。具体场景及原始结果见 `C:/Users/32360/AppData/Local/Temp/djsc-native/` 的 `coverage-map.md`、`TIANXIANG-AI-HANDOFF.md` 和 `evidence/`。

| 范围 | 技能 | 当前候选 |
| --- | --- | --- |
| 两包重叠 | `xinkuanggu`, `xinliegong`, `shensu1` | 单一合并入口；烈弓次数查询异常时回落原评分。 |
| 神话风 | `qimou`, `releiji`, `jushou`, `retianxiang`, `gzbuqu`, `guidao`, `huangtian2`, `xinfu_guhuo` | 保留原候选评分；天香二选一使用父事件的 fixB，不添加事件字段。 |
| 界风 | `xinjushou`, `buqu`, `fenji`, `oltianxiang`, `piaoling`, `reguhuo` | 保留候选评分，包括不屈上限及飘零 `nogain`。 |

天香 fixB 的正常场景与原神话风二选一优化在隔离试验中对照通过；正式候选另加缺目标与缺父事件护栏，尚未复验，无来源、联机及其他异常回退仍待检查。组合入口是语义合并，不应称为两份历史补丁逐字节原样保留。组合原生与同技能扩展接管不支持同时部署。
