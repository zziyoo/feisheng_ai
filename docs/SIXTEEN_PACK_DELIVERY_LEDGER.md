# 无名 AI 十六分包正式交付台账

集成验收锁定提交 `640b736a9e1872fdd63eac443b2596ca7bb8b1b5`。目标为无名杀 1.11.7 Windows x64、Chrome 157、身份局 8 人、seed `20261030`。限定配置为十个原生 AI 补丁加六个封版扩展 ZIP。十六个逻辑分包在该配置下内部验收 PASS。外部集成回执尚未取得，公开发布状态为未发布。

登记数取自 [142-task-list.json](skill-ai-20261030/142-task-list.json) 的分包汇总。主清单 142 个武将记录、280 条武将技能关联，另计清单外活动鲁肃 1 将、1 技能，合计 **143/281**。十包为 **81/164**，六包为 **62/117**（含清单外）。共用技能按各包的武将归属分别登记，因此登记数与去重技能数、实际修复数、真实宿主场景数各有不同口径。原验收说明中的「245 项」无可复算口径，本台账采用可复算的 281 条登记关联。

## 十六包源码覆盖与验收等级

「十包专项」指逐技能源码审查、原生补丁静态往返、独立真实宿主固定场景和组合对照。结论以实际验证的修复和边界为准。「六包封版」指独立封版验收继承，加本次组合真实宿主安装、加载、回滚及分包签名对照。以下 P2 一栏记录交付验收列出的分包限制，普通策略取舍仍在开发台账。

| 分包 | 武将 | 技能登记 | 实际修复或接管范围 | 源码审查与验收 | 部署 | 遗留 P2 或限制 |
| --- | ---: | ---: | --- | --- | --- | --- |
| `standard_2008` | 25 | 40 | `tieji` 移除读顶牌的必中提示；`yiji` 按获牌限制评估 | 40/40；十包专项 PASS；`qingguo/jijiu/lijian` 共用基类另有组合证据 | 原生补丁；共用基类由界标扩展接管 | 铁骑改判、遗计多次分配等局面未全量复验 |
| `standard_2013` | 3 | 5 | `retongji` 只根据原目标已知的闪估计转移 | 5/5；十包专项 PASS | 原生补丁 | `wangxi` 与界标派生结算的收益差异保留；虚拟闪与不同模式待扩大覆盖 |
| `standard_2019` | 2 | 3 | `xinfu_jijie` 区分普通牌与毒；`xinfu_jiyuan` 避开日常获牌受限、保留濒死机会 | 3/3；十包专项 PASS | 原生补丁 | 临时获牌可救援和不同交牌事件待扩大覆盖 |
| `standard_2023` | 3 | 4 | `stdshushen` 按实际摸牌数；`stdxiaoguo` 按已知可弃装备；`shenzhi` 满血不弃整手 | 4/4；十包专项 PASS | 原生补丁 | 狂斧首杀失血与多次命中等策略边界保留 |
| `shenhua_lin` | 8 | 20 | `dimeng` 空候选保护；`roulin` 去除错误必中；`luanwu` 无主公安全并排除自身和非正体力角色 | 20/20；十包专项和缔盟真实事件边界 PASS | 原生补丁；界林共用或继承相关评分 | 合法双目标交换已验证；其他座次和限定技收益未全量复验 |
| `shenhua_shan` | 8 | 17 | `tuntian` 按观察者估计响应；`zhiba` 只读已知牌点 | 17/17；十包专项及隐藏牌不变量 PASS | 原生补丁；`oltuntian` 继承估值 | `mayHaveShan` 跨进程随机值可变 |
| `shenhua_yin` | 8 | 18 | `nzry_kuizhu` 选择恰好匹配弃牌数的敌人；`nzry_mingren` 统计换后留下的同色响应 | 18/18；十包专项 PASS；原生边界另有证据 | 原生补丁 | `qizhi` 全保护仍摸牌；`nzry_feijun` 支付前估值遗漏支付后机会 |
| `refresh_huo` | 8 | 17 | `oljieming` 用体力上限估计补牌收益 | 17/17；十包专项 PASS | 原生补丁 | 共用八阵、马术等宿主规则沿用；部分伤害与死亡联动待扩大覆盖 |
| `refresh_lin` | 8 | 23 | `olhaoshi` 并列最少和真实受援方；`oldimeng` 用公开手牌差 | 23/23；十包专项和好施实际选择 PASS | 原生补丁；肉林共用神话林定义，界乱武继承该评分 | 界乱武额外杀收益、好施牌权取舍待扩大覆盖 |
| `refresh_shan` | 8 | 17 | `rehuashen` 合法技能与时点评分；`olzhiba2` 只读已知点数 | 17/17；十包专项及化身合法池两周期 PASS | 原生补丁 | 合法化身池真正耗尽未覆盖；`reqiaobian` draw 上下文漏触发 |
| `refresh_standard` | 29 | 57 | 扩展 14 项登记，含 `rezhiheng/rerende/new_retuxi/new_yijue/refanjian/new_reqingnang/rejieyin/retieji/reganglie/reqianxun/refankui/qingguo/jijiu/lijian` | 57/57；六包封版 PASS；三个共享基类六场景 PASS | 扩展 ZIP，第一位 | 7 项仅历史原生路线支持；`skillPlanHints.js` 完整引擎接线未确认；冻结 ZIP 仍标封包待验收 |
| `refresh_feng` | 8 | 17 | 扩展 `reqimou/fenji/reguhuo/oltianxiang/xinliegong` | 17/17；六包封版 PASS；双风共存 | 扩展 ZIP，第二位 | 奇谋保守放弃，5 项仅历史原生路线支持，须先于神话风 |
| `shenhua_feng` | 8 | 12 | 扩展 10 项实际接管 `qimou/xinkuanggu/jushou/xinshensu/xinfu_guhuo/huangtian/guidao/releiji/xinliegong/gzbuqu`；`retianxiang` 为原生路线，红颜为被动关联 | 12/12；狂骨 P1 已关闭；六包封版 PASS；双风共存 | 扩展 ZIP，第三位 | 第三方替换天香估值；摸牌收益高于回复仅规则级覆盖；双风顺序约束 |
| `shenhua_huo` | 8 | 14 | `luanji` 群体净收益与友军致死、`tianyi` 拼点风险、`jianchu` 可弃置装备 | 14/14；六包封版 PASS；关键签名一致 | 扩展 ZIP，第四位 | 强袭武器机会成本；历史原生副本的 LF 要求 |
| `shenhua_lei` | 8 | 16 | `olkongsheng/xinfu_fuyin/drlt_qianjie/drlt_zhengu` | 16/16；六包封版 PASS；镇骨组合专项 19 场景 | 扩展 ZIP，第五位 | 罪论排序、雄乱权重、踞襄装备成本、第三方镇骨钩子和人工点击 |
| `out_of_scope` | 1 | 1 | `redimeng` 暗牌公平和第二目标 `find(2)` 修复 | 1/1；六包封版 PASS；5 个相关场景 | 扩展 ZIP，第六位 | 仅扩展路线，宿主原生 `find(2)` 仍可抛错 |

十包详见 [逐技能开发台账](REMAINING_TEN_PACKS_PROGRESS.md) 和 [独立验收](remaining-ten-packs-acceptance/DELIVERY.md)。六包原有包级证据和版本记录见 [六包最终台账](SIX_PACK_FINAL_DELIVERY_V2.md)。组合证据见 [验收报告](sixteen-packs-acceptance/ACCEPTANCE.md)、[接管矩阵](sixteen-packs-acceptance/skill-takeover-matrix.md)、[P2 记录](sixteen-packs-acceptance/P2.md) 和 [本次推送前审查](SIXTEEN_PACK_PUSH_REVIEW.md)。

## 归档与构建来源

权威交付目录为桌面 `feisheng-ai-sixteen-packs-final`。校验以该目录 `SHA256SUMS.txt` 为准。下表 HEAD 为实际构建 HEAD 或引入原生补丁的提交。六包历史构建依赖及神话风验收后收口见六包台账，当前集成 HEAD 不用于重建原六个 ZIP。

| 文件 | 字节 | 构建或源码提交 | SHA256 |
| --- | ---: | --- | --- |
| `native/standard_2008.patch` | 828 | `404e305dc58f8ad964a9764ecc433320af17f6e4` | `d0e233259a1db09c9bfa3e4c686ea4a361bff6956edbadaca1c5341bcea410db` |
| `native/standard_2013.patch` | 803 | `eba7ded6c925da6b0f8f5ed1812d81d340f0a7e6` | `a70a185ecebb78f2e30afeeea3009b665914fa59f169857081500e9860f8558f` |
| `native/standard_2019.patch` | 666 | `959661831683211f3266f8efa4a05a4c91e4e4fa` | `bf843e22e9c7085019bb87f94865d29a6873a1b95c4390a24b576f949a931521` |
| `native/standard_2023.patch` | 1554 | `64df8e6dfb09a56430c487b4edd378edd973fef7` | `d1b7fa5430b9050e7fbf7b405702c45e4883848619ac7c4633508414940e8074` |
| `native/shenhua_lin.patch` | 1953 | `22e19db1a82c8555a5fa22332a1a409d48be90fe` | `ae017875df282cc852cf3a11d4530fb15d906b6c7cdbf87b44a5ea9d09f0bc67` |
| `native/shenhua_shan.patch` | 2240 | `f091f79ecdd1cd0a4c527a81936f41e1cafba2e7` | `b74fd8d3eec392e7fa9b4e491ad86646705b3b072aea08f5f44d14b19c6abf15` |
| `native/shenhua_yin.patch` | 914 | `b79ce0ce3db1d136ec8d8e2e78017d31454b2527` | `f83fb96114f9b2aa20672f14f6f901c40e71fbcbb4e9a6f620eb4ac9b86b3747` |
| `native/refresh_huo.patch` | 596 | `dcf0dd3d2d9b031c60521ce50ed98cb32e9bef52` | `7d7cf2c6b83623deb2e9b7ec10e60d17d26ca949efd1f849a996254f7c707d88` |
| `native/refresh_lin.patch` | 4031 | `92214435d6e98410808eb75613d9028ec91f51fc` | `8c3e6c8c138460bb7ef920934a526cf47a7d0029414cce0e3a460abe820ef26c` |
| `native/refresh_shan.patch` | 4570 | `a9031aade343ef3e219e733297708ada59a8383b` | `306431fa8e7246d2eb3225fc49fbda7a1071cc7940b7ce25708f7549bad54a6e` |
| `packs/feisheng-ai-shenhua-feng.zip` | 92235 | `25b950356627b9c236c4faf3be82e3481ad09111` | `dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c` |
| `packs/feisheng-ai-refresh-feng.zip` | 90676 | `7d79d8ce218f4ed37eed0dffa2c2c1ac81cfe93e` | `193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef` |
| `packs/feisheng-ai-shenhua-huo.zip` | 253547 | `4fb57e10dd4077cf2cfa39f5ad2783e61ce69cd3` | `68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d` |
| `packs/feisheng-ai-shenhua-lei.zip` | 257628 | `ca9d2d221a02920f34aef99614245f2e20a4a8c1` | `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277` |
| `packs/feisheng-ai-refresh-standard.zip` | 114963 | `0fa2c075aa9bcb86c9c6c34f65d8c62b0b3845ea` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` |
| `packs/feisheng-ai-out-of-scope.zip` | 200828 | `56735aea155040c70ee621e232ed96dce021b57a` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` |

部署按 [正式说明](sixteen-packs-acceptance/DEPLOYMENT.md) 进行。先累计应用十份原生补丁，再对完整扩展根按 `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope` 安装，回滚按相反顺序。同一技能的原生和扩展路线二选一，六包历史原生补丁不加入此组合。Android、联机、其他未测模式和完整历史技能矩阵仍在验收覆盖范围之外。
