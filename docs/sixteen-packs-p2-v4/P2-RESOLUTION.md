# v4 P2 整改与残余

本表只记录 v4 五项修复、奇制残项和仍适用的 v3 残余；不追求形式上的零 P2。v3 的 27 项完整台账继续有效，未因 v4 命名自动关闭。

## v4 本轮

| ID | 分包/技能 | 结论 | 证据 | 仍保留的边界 |
| --- | --- | --- | --- | --- |
| V4-01 | `shenhua_lei` / 雄乱 `drlt_xiongluan` | 已修复并验收（方向偏置与小数权重） | `evidence/v4-xiongluan-auto.json` | 共享引擎泛用静态画像仍可能标成支援；实际出牌阶段未复现友方目标 |
| V4-02 | `shenhua_huo` / 强袭 `qiangxix` | 已修复并验收（窄场景保留连弩） | `evidence/v4-qiangxix-zuilun-juxiang.json` | 只覆盖 4HP、唯一诸葛连弩、至少两次额外有效攻击；其他武器/低血/无目标保持原生 |
| V4-03 | `shenhua_lei` / 罪论 `xinfu_zuilun` | 已修复并验收（排序对象与公开信息） | `evidence/v4-qiangxix-zuilun-juxiang.json`、`unit-tests.log` | 动态牌值/未知判定按 0；v3 在同一公开 fixture 结果相同，隐藏信息差异未由真实宿主复现 |
| V4-04 | `shenhua_lei` / 踞襄 `twjuxiang` | 已修复并验收（窄场景保留防具） | `evidence/v4-qiangxix-zuilun-juxiang.json` | 只保护一血空手唯一八卦/仁王、健康主公空防具栏、有敌方威胁；其他赠送保持原生 |
| V4-05 | `refresh_feng` / 界奇谋 `reqimou` | 已修复并验收（长兵器射程漏判） | `evidence/v4-reqimou.json` | 3HP 无明确击杀保守阈值、救援/后续事件估计保留；原生补丁未同步 |
| V4-06 | `qizhi` / 奇制 | 规则残项保留 | `qizhi-regression.log` | AI 全保护目标跳过修复保持；玩家手选后“不弃牌仍摸牌”仍是宿主结算残项，本轮不改 |

## v3 继续适用的残余

- 界标/界风/神话其它包的历史 P2 与覆盖差异继续适用，见 v3 交付目录 `P2-RESOLUTION.md`/`P2-RESOLUTION.json`。
- 原生路线独有技能、仅原生优化、旧核心手工迁移、第三方钩子抢占/替换、`out_of_scope` 仅扩展等部署约束不变。
- 国战/2v2/斗地主仅有历史少量冒烟；Android、真实联机、其他完整模式未覆盖。
- 十份原生补丁本轮字节未变，v4 五项修复不在原生补丁中；不得宣传原生路线包含 v4 五项优化。
- 奇制手动结算、第三方 AI 回调异常、历史完整矩阵未重跑等限制继续保留。

## 结论

v4 关闭的是五项具名扩展 AI 缺陷和双风对包哈希失配，不关闭同技能下的全部策略局限，也不把 v3 全部 P2 清零。
