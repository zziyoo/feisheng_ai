# 六分包统一集成报告（2026-11-13）

## 状态

**未通过／待补齐。** 六包安装/共存/回滚、共享核心一致性、镇骨、缔盟、原生补丁适用性均通过；但 `shenhua_feng`【狂骨】回复分支存在 1 项经复现的 P1，正式六包 PASS 暂不宣布。

交付目录：`C:\Users\32360\Desktop\feisheng-ai-six-packs-final\`。

## 基线

| 分包 | ZIP SHA256 | 构建 HEAD |
| --- | --- | --- |
| `shenhua_feng` | `7a45c323876f8b1af9408c9c4bb86388e839c13c51ef31e28aded0a2076e8ac9` | `7d79d8c` |
| `refresh_feng` | `193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef` | `7d79d8c` |
| `shenhua_huo` | `68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d` | `4fb57e1` |
| `shenhua_lei` | `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277` | `ca9d2d2` |
| `refresh_standard` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` | `0fa2c07` |
| `out_of_scope` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` | `56735ae` |

共享核心三件六包一致：`policyCore.js 545ee71d…`、`skillAIPolicies.js 46b47ef9…`、`skillVetoRegistry.js ed8f6022…`；安装器 `c2c4ea3c…`、回滚器 `cb2e141c…` 一致。`skillPlanHints.js b6a0db92…` 仅标准包提供。

推荐安装顺序：`refresh_standard → shenhua_feng → refresh_feng → shenhua_huo → shenhua_lei → out_of_scope`。

## 实际测试

| 测试 | 结果 | 证据 |
| --- | --- | --- |
| 上游 `1fe5292` 干净目标六包组合验收（默认场景并集） | **FAIL**：`shenhua-kuanggu-recover` 实际摸牌、期望回复；九个宿主分组均 `errors=[]` | `evidence/accept-six-packs.json`、`evidence/combined-host/` |
| 当前完整引擎 `a863553` 六包安装态最小宿主（16 场景） | PASS，六包在位，其余关键修复符合预期 | `evidence/current-head-minimal.json` |
| 安装事务电池（9 步） | 9/9 PASS | `evidence/install-battery.json` |
| 镇骨六包安装态专项 | PASS，`zhenguScoreCalls=136`、`errors=[]` | `evidence/zhengu-combined.json` |
| 原生补丁预检/语法/应用后哈希 | 4/4 PASS；神话火 LF 版本 `7005c403…` | `evidence/native-patch-verify.txt` |
| 狂骨规则层最小复现 | MISMATCH（原生回复，扩展摸牌） | `evidence/kuanggu-recover-repro.log` |
| 狂骨单风包/六包真实宿主复现 | 均 `draw_card` | `evidence/kuanggu-recover-feng-only-draw.json`、`evidence/kuanggu-recover-six-pack-draw.json` |

## P1

`shenhua_feng` `rules/shenhuaFeng.js` 的 `kuangguChoice` 额外要求 `shaUsable > 0`；用掉最后一张可用杀后 `shaUsable=0`，扩展摸牌，原生/风包验收期望回复。单风包可复现，非六包交互；仅 AI 选择，无结算/崩溃。封版 ZIP 未改动；最小复现、根因、修复建议见 `KUANGGU-RECOVER-HANDOFF.md`。修复需风包维护者改规则并重建 ZIP，本轮未擅自重建。

## 原生/扩展矩阵

- 扩展：六包均支持；`out_of_scope` 仅扩展。
- 原生：双风组合补丁、神话火、神话雷、标准包；原生与扩展同技能二选一；六原生补丁全叠加不支持/未验收。
- 神话火旧独立补丁为 CRLF，统一交付已用源哈希 `7005c403…` 的 LF 版本替代。

## Git

- 分支 `codex/six-pack-integration`，基线 `a863553`。
- 本轮提交：验收工具缺失测试开关/回滚断言、事务电池、六包证据与报告。
- 未 push、未 Release、未覆盖旧 ZIP/目录。
