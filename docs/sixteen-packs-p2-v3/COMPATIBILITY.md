# 支持与互斥范围

当前形态为十份原生补丁加六份扩展。旧版组合口径和完整覆盖明细见 [历史十六包正式台账](evidence/historical-ledger.md)。本版的实际验收等级见 [验收报告](ACCEPTANCE.md)。

- **原生补丁顺序** `standard_2008 → standard_2013 → standard_2019 → standard_2023 → shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan`。独立补丁采用无名杀 1.11.7 LF 宿主。撤销按反向顺序。
- **扩展顺序** `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope`。使用完整扩展 `1fe5292eb3022dd8d1db494617b21a12be912e61`，引擎接线仅应用一次。回滚按反向顺序，使用各版本包自带脚本。
- **界标历史原生路线独有** `new_reyiji`、`new_reluoyi`、`new_qingjian`、`new_liyu`、`relianying`、`olyajiao`、`zhaxiang`。
- **界风历史原生路线独有** `xinshensu`、`xinkuanggu`、`piaoling`、`xinjushou`、`buqu`。此处归属界风路线，神话风扩展覆盖按其清单核对。
- **神话雷** v3 雄乱由正式扩展路线接管。雷 ZIP 内旧备选原生补丁未纳入此变化。历史雷原生路线、其他六包备选原生路线均排除于正式组合之外。部署前人工核对同技能互斥。
- **清单外** `redimeng` 仅支持扩展。神话林原生 `dimeng` 为不同技能。
- **平台和玩法** Windows x64、Chrome、身份局 8 人为组合验证基线。其他模式和设备以验收报告的实际记录为准。
