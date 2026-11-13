# 【狂骨】回复分支验收不一致：最小复现与交接

## 结论

`shenhua_feng` 封版 ZIP（`7a45c323…`）的【狂骨 xinkuanggu】扩展策略在“已受伤、体力>1、用掉最后一张可用杀后”的状态下选择**摸牌**；宿主原生与风包自身验收期望是**回复体力**。六包统一集成验收因此在该场景失败。

- 分类：**P1（验收证据不一致；仅 AI 选择，无崩溃、无非法结算、无安装/注册表问题）**。
- 范围：单风包即可复现，**不是六包交互回归**。
- 处理：本轮未修改封版 ZIP/技能源码；按约定交接给风包维护者。六包正式 PASS 暂不宣布。

## 最小复现（规则层）

输入：

```json
{ "hp": 3, "isDamaged": true, "recoverEffect": 1, "shaReady": 1, "shaUsable": 0 }
```

- 原生 `xinkuanggu.cost` 条件：`isDamaged && recoverEffect > 0 && shaReady >= shaUsable` → `true` → 回复。
- 扩展 `kuangguChoice`：额外要求 `shaUsable > 0`；此处 `shaUsable=0` → `draw_card`。
- 风包验收场景 `shenhua-kuanggu-recover` 期望 `recover_hp`。

复现日志：`evidence/kuanggu-recover-repro.log`（`result: MISMATCH`）。

## 最小复现（真实宿主）

1. 干净 `1fe5292` 目标，只安装 `feisheng-ai-shenhua-feng.zip`（单风包）。
2. 真实无名杀 1.11.7，seed `20261030`，运行 `shenhua-kuanggu-recover`。
3. 实际：`choices: ["draw_card"]`，摸 1 张；未回复体力。
4. 六包同装目标同样为 `draw_card`；给场景补连弩后仍为 `draw_card`（说明不是缺武器/夹具单点问题，而是规则中的 `shaUsable > 0` 前置条件）。

证据：

- `evidence/kuanggu-recover-feng-only-draw.json`（单风包）
- `evidence/kuanggu-recover-six-pack-draw.json`（六包）
- `evidence/kuanggu-recover-crossbow-draw.json`（补连弩后）
- `evidence/combined-host/host-combined-installed-shenhua_feng-review.json`（组合宿主原始场景）

## 根因

`source/score/decision/skills/rules/shenhuaFeng.js`：

```js
const ready = Number(shaReady);
const usable = Number(shaUsable);
if (Number.isFinite(usable) && usable > 0 && Number.isFinite(ready) && ready >= usable) return 'recover_hp';
return 'draw_card';
```

宿主原生条件不要求 `usable > 0`。用掉最后一张可用杀后 `usable=0`，原生会回复，扩展改为摸牌。风包注释写“杀充足回复（原生保留）”，但该额外条件使其不再等价。

## 建议修复（未在本轮应用）

方案 A（推荐，恢复原生等价）：删除 `usable > 0`，改为 `ready >= usable`（保留 `Number.isFinite` 守卫）。

方案 B（若“无可用杀时摸牌”是新策略意图）：保留代码，更新风包验收场景/报告，把 `shenhua-kuanggu-recover` 的期望改为 `draw_card`，并明确这是相对原生的策略变更；不得再声称“原生保留”。

无论 A/B，都需要：

1. 修改 `shenhua_feng` 源码并重建 `feisheng-ai-shenhua-feng.zip`（本轮未做，避免覆盖封版 ZIP）。
2. 重跑风包 `shenhua-kuanggu-draw` / `shenhua-kuanggu-recover` 与 `quality-kuanggu-*` 场景。
3. 重新生成风包 manifest/SHA256 与双风兼容性证据（若共享核心/对包哈希变化）。
4. 更新六包统一交付的 ZIP 哈希与验收结论。

## 不影响的项

- 六包安装/注册表/共享核心/回滚/故障注入/共享核心冲突（`evidence/install-battery.json`）。
- 镇骨六包专项（`evidence/zhengu-combined.json`）。
- 缔盟公平与 `find(2)`（`evidence/current-head-minimal.json`）。
- 其余风包场景与五包关键修复；本轮组合宿主分组均无 `errors`。
- 该问题不改变任何技能结算/规则，只改变该状态下的 AI 摸牌/回复选择。
