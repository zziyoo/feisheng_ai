# out_of_scope（活动武将/界鲁肃）独立审查与修复

日期：2026-11-12。宿主：无名杀 1.11.7；扩展版本：无名AI 4.4.4。

## 1. 实际范围

- `142-task-list.json` 的 `out_of_scope` 只登记 1 名武将：`activity_lusu`；真实宿主 ID 为 `lusu`（`extension/活动武将/js/content.js:1077`，DIY 组）。
- 只登记 1 个技能：`redimeng`（`character/shenhua.js:3356`）。角色同时拥有 `haoshi`，但未列入本包目标技能，本轮不改。
- 生成器 `tools/build-skill-ai-pack.mjs` 的 `recordsFor('out_of_scope')` 也只取 `redimeng`；未发现第二项被遗漏的清单外条目。活动武将扩展中的其他角色不在 142 清单/本包登记范围。
- 本包没有原生补丁，只有扩展策略模块。

## 2. 历史修复与继承

- 历史修复：`redimeng` 混合手牌后的 AI 选择使用宿主 `get.value(button.link)`，能看到暗牌牌面；扩展用 `fairButtonScore(playerid, index)` 替换按钮 AI 分数，并保留人类路径。
- 该实现自 `12c8b6f` 到 `0fa2c07` 未变化（两个源文件 blob 分别为 `f7fbac…`、`8a76b0…`）。旧验收 ZIP `908a54…` 不在本机，无法做 ZIP 文件级对照；本轮按源 blob 继承，并重新跑固定局面。
- 历史场景只强制指定 `[ally, enemy1]` 两个目标，绕过了 AI 的第二目标评估，因此没有覆盖下面新增的 P1。

## 3. 本轮新增 P1：find(2) 抛 ReferenceError

宿主 `redimeng.find` 在评估第二目标时：

```js
for (let i2 = 0; i2 < list.length; i2++) { ... }
...
return list[i];
```

`i` 是前一个循环的块级变量（源码则是 `let i` 的块级变量），循环外不存在。真实 AI `chooseToUse` 调用 `find(2)` 时抛：

```
ReferenceError: i is not defined
  at redimeng.find (character/shenhua.js:3524)
  at redimeng.ai.result.player (character/shenhua.js:3548)
```

复现：`evidence/native-target-crash.log`。这不是本轮策略回归，而是宿主 1.11.7 既有缺陷；原生路线未修复，扩展路线必须绕过。

## 4. 最小修复

`score/decision/skills/packs/outOfScope.js` 新增 `installFindFix`：

- 只对已知形态 `redimengFindNeedsFix(String(info.find))` 生效；宿主修复后自动跳过。
- 只接管 `find(2)`；`find(1)`、`find(3)`、技能 `content`/结算完全保持宿主原实现。
- 修正逻辑与宿主原意一致：先取手牌最少的友方 `nh`，再按手牌从多到少找第一个满足 `target.hand - nh <= player.countCards('he', value<7)` 的敌方；差值为负时返回 `null`。
- 异常时返回 `null` 并计数，不调用原生错误函数、不让 AI 崩。
- `host.wrap` 负责安装/卸载/重装恢复；`policy-lifecycle` 已验证 `redimengFind` 标记 true→false→true。

## 5. 真实宿主固定局面

三配置：原生（无扩展）、仅策略层、完整扩展。场景：暗牌、同位置置换、合法 2 费、合法 0 费、不可行目标。

| 场景 | 原生 | 仅策略 | 完整扩展 |
| --- | --- | --- | --- |
| 暗牌选择 | 第一选择者拿无中生有+桃（看牌） | 位置分数，遮蔽命中 | 同策略 |
| 同位置置换 | 两轮索引不同 | 两轮索引一致 (2,3)/(0,1) | 同策略 |
| 合法 2 费目标 | `ReferenceError` | 完成，目标手牌守恒 | 完成 |
| 合法 0 费目标 | 未测（同一 find 路径） | 完成，目标手牌守恒 | 完成 |
| 不可行目标 | 未测 | 不发动、手牌不变、无异常 | 同策略 |

仅策略统计：`fairRedimeng=13`、`redimengMaskFailed=0`、`redimengFindCalls=4`、`redimengFindFixed=4`、`redimengFindFallbacks=0`。完整扩展统计相同，`errors=[]`。

## 6. 原生与扩展差异

- 扩展路线：暗牌公平 + 第二目标修复；本包唯一受支持路线。
- 原生 1.11.7：暗牌公平未覆盖、`find(2)` 仍抛错；本包不提供原生补丁，不能宣称两条路线等价。
- 不支持原生补丁与扩展同时接管；同一 AI 入口只允许一条路线。

## 7. 证据与限制

- `evidence/native-hidden.json`：原生暗牌/置换基线。
- `evidence/policy-all.json`：策略层五场景 + 生命周期。
- `evidence/extension-all.json`：完整扩展五场景 + 生命周期。
- `evidence/policy-target.json`：三项目标场景明细。
- `evidence/native-target-crash.log`：原生 P1 复现。
- `evidence/rules-test.log`：纯规则测试。
- 未跑完整 142 将矩阵、Android 真机、联机；不把固定局面通过等同于公开发版门槛。
- 原生路线若未来需要，必须另做宿主补丁并单独验收，不能与本扩展叠加。
