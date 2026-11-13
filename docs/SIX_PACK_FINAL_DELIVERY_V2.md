# 六包统一交付 V2 最终收口

日期：2026-11-13  
状态：**内部验收 PASS（限定已验证安装顺序）**；未公开发布、未 push、未创建 Release。

## 正式支持安装顺序

本次六包统一交付正式采用方案 A，唯一支持顺序为：

```text
refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope
```

- 本顺序是正式交付约束；内部验收 PASS 仅适用于该顺序，**不保证任意安装顺序**。
- 新版神话风依赖当前已验收界风先行安装（新神话风声明 `refreshFeng.js d5519b7d…`）。
- 旧顺序 `refresh_standard → shenhua_feng → refresh_feng → …` 会触发双风版本校验拒绝，但为**安全拒绝、零写入**，不会造成半安装状态。
- 本轮未重建 `refresh_feng`，其余五个 ZIP 保持原 SHA256。

## 狂骨 P1

原始【狂骨】P1 已修复并关闭：

- 原场景（3 血/4 上限、赤兔、2 张杀，首次伤害后 `shaReady=1`、`shaUsable=0`）真实宿主收益：`recoverEffect=19.5`、`drawEffect=13`。
- 未修复原生 A、正式双风原生补丁 B、新扩展 D 均选择回复；封版扩展 C 选择摸牌。
- 新扩展规则与正式原生补丁 `xinkuanggu.cost` 公式一致；8 个真实场景逐项一致，19 个规则输入 `new === native_patch` 全部成立。
- 修复提交 `ede9966`，开发 HEAD `25b950356627b9c236c4faf3be82e3481ad09111`。
- 证据：`evidence/kuanggu-four-config.json`、`evidence/kuanggu-rule-matrix.json` 及 A/B/C/D 四配置报告；交付目录内见 `KUANGGU-P1-REPORT.md`。

## 交付物

交付目录：`C:/Users/32360/Desktop/feisheng-ai-six-packs-final-v2-kuanggu-20261113/`

| 分包 | SHA256 |
| --- | --- |
| `shenhua_feng` | `dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c` |
| `refresh_feng` | `193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef` |
| `shenhua_huo` | `68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d` |
| `shenhua_lei` | `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277` |
| `refresh_standard` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` |
| `out_of_scope` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` |

原神话风封版 ZIP 保持 `7a45c323876f8b1af9408c9c4bb86388e839c13c51ef31e28aded0a2076e8ac9`，保留在上一版交付目录，未覆盖。

## 验证摘要

- 六包组合验收（正式支持顺序）：`pass=true`；六包加载、双风共存、关键修复、逆序全量回滚、回滚后宿主加载通过。
- 安装事务电池（最终神话风 ZIP）：9/9 PASS。
- 镇骨六包安装态专项：`errors=[]`、`benignErrors=[]`、`zhenguScoreCalls=136`、`zhenguFallbacks=0`、`zhenguHookConflict=0`。
- 旧双风顺序拒绝：`zero_write=true`、`reject_reason_matched=true`。
- 最终神话风 ZIP：`verify.py` 29/29；`source/` 与开发 HEAD `25b9503` 的 Git blob 一致。

## 限定

- 不支持原生补丁与对应扩展重复接管（同一分包/同一技能二选一）。
- 六个原生补丁同时叠加不是受支持配置。
- 不代表 Android、联机、斗地主/国战/2v2 及其他未测模式全部通过。
- 尚未公开发布。
