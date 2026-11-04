# 神话再临·火 第二轮 — 交接文档

> 日期：2026-11-04。工作树：`C:\Users\32360\.codex\worktrees\release-444\无名AI`（分支 `codex/release-v4.4.4`）。
> 本文回答三件事：接手什么、还差什么成果、怎么验证。所有路径相对工作树根。

---

## 一、一句话现状

三项原生 AI 修正（乱击/天义/鞬出）在**原生补丁**与**策略层（policyOnly/分包集成）**已全部生效并有三组真实宿主证据；**唯一未关闭的问题**是：完整扩展引擎下天义仍会发动（`tianyiEngineVeto` 计数已证明新否决逻辑被调用，但宿主自动出牌流程仍把天义用了出去）。另外交付 ZIP 尚未用第二轮修订重建。

---

## 二、接手什么：一个待关闭的缺陷 + 一批打包收尾

### 2.1 核心缺陷：完整引擎下天义绕过（P1，最高优先）

**现象**（`docs/skill-ai-quality-20261103/huo-quality-extension.json`，第二轮）：
- `policyStats.shenhua_huo.tianyiEngineVeto = 1` —— 新注册的引擎否决**确实被调用了**；
- 但 `quality-huo-tianyi-lowcompare` 场景 `usedTianyi=true`，手牌少了一张（拼点牌被弃）——技能仍然发动。

**已确认的调用链**（诊断栈，`huo-diag-tianyi-engine.json`）：
发动来自**宿主自己的 chooseToUse 自动流程**，不是引擎的 staged 提交：
```
content.js:4818 (chooseToUse content) ← player.js:7539 useResult
```
宿主自动决策循环在 `content.js:4641-4689`：
```js
const ok = game.check();
if (ok) { ui.click.ok(); }
else if (ai.basic.chooseCard(event.ai1) || forced) {     // ai1 = get.cacheOrder
  if ((ai.basic.chooseTarget(event.ai2) || forced) ...) { ui.click.ok(); }  // ai2 = get.cacheEffectUse
  else { /* 取消 + _aiexclude */ }
}
```
关键事实：
1. **技能是否被点击只看 `get.order(skill)`**（`event.ai1 = get.cacheOrder`，get/index.js:6481）。天义 `ai.order` 有杀时返回 `get.order(sha)-1 ≈ 2.5 > 0` → 被点击。`result.player` 不参与点击决策。
2. 点击后由 `ai.basic.chooseTarget(event.ai2)` 决定目标；`ai2 = get.cacheEffectUse` → `get.effect_use`（get/index.js:6536 起）。若无正分目标 → 取消并 `_aiexclude` → 不发动。**理论上 wrap 后的 `result.player=-0.9`（×attitude(self)=10 = -9）应让 chooseTarget 失败**，但实际没拦住。
3. 首要怀疑：`get.effect_use` 的文档写明"随后**叠加**发动者和目标的技能修正、目标威胁度、血量、手牌数"——如果这些情境加成直接加在 result 上，-9 + 加成可能翻正。**未验证**。

**下一步诊断（已完成 80%，最后一步被中断）**：
- 我在 `tools/skill-ai-host-scenes.mjs` 的 `quality-huo-tianyi-lowcompare` 场景里加了临时探针：`resultPlayerCalls`（记录每次 wrap 被调用时的返回值与当时 mx）和 `tianyiStacks`（useSkill 调用栈）。
- **已完成的诊断结论（2026-11-04，huo-diag-tianyi-engine.json）**：
  - `tianyiStacks`：发动来自宿主 chooseToUse 流程（content.js:4818 useResult），非引擎 staged 提交；
  - `resultPlayerCalls`：**wrap 在决策期间被调用 3 次、全部返回 -0.9（mx=5）** —— wrap 本身工作正常；
  - `tianyiEngineVeto=1`：注册表否决也在同页触发；
  - 结论：**三层信号（order 点击后的 chooseTarget 校验、wrap、引擎否决）全部在场，技能仍被宿主自动流程用了出去**。剩余唯一合理解释：`get.effect_use`（ai2）在 result1×att(self)=-9 之上叠加了足够大的情境加成（威胁/血量/手牌修正，其文档明言"随后叠加…"），或 chooseTarget 的校验路径没有走到 effect_use 的 result.player 分支。
- **决定性一步探针（约 5 分钟）**：在 lowcompare 场景 phaseUse 之前加一行记录：
```js
const eu = get.effect_use(enemy1, 'tianyi', actor, actor);
const ef = get.effect(enemy1, 'tianyi', actor, actor);
rec.result.effectUse = eu; rec.result.effect = ef;
```
  - 若 `effectUse > 0` 而 `effect ≈ -8.3` → 打开 `get/index.js` 的 `effect_use`（6536 起至 ~6700）找加成来源；**最简修复：把原生补丁与扩展 wrap 的 player 侧否决值从 -0.9 加大到 -30**（×10=-300，任何加成都翻不动；纯量级修正，不改语义），三层同步（原生 0002 补丁、shenhuaHuo wrap、rules 数值无变化）。
  - 若 `effectUse` 也是负的 → 说明 chooseTarget 校验没走 effect_use/result.player，转查 `event.backup('tianyi_backup')` 克隆时机与 `CacheContext` 缓存复用（basic.js:25/97）。
  - 重跑同一命令即可（场景探针已就位，resultPlayerCalls/tianyiStacks 仍在）。
- 修复后验证：同命令重跑，期望 `usedTianyi=false`、`tianyiEngineVeto≥1`、`resultPlayerCalls` 出现新否决值。
- **修完后删掉场景里的临时探针**（resultPlayerCalls/tianyiStacks），或保留但注释说明仅诊断用。

**备选方案**（若 effect_use 路径实在无法干净拦截，且时间紧）：接受"完整引擎下天义按引擎自身模型发动"为已知限制（第一轮文档写法），把 FIRE-NATIVE-AI.md 的「完整引擎接线」改回限制说明。但这等于放弃 P1 目标，**不推荐**——skillVetoRegistry 已经打通了 decideSkill 层（计数为证），只差宿主自动流程这最后一层。

### 2.2 打包收尾（P3，代码已就绪，差重建与提交）

已完成（都在工作树，**未提交**）：
- `tools/skill-ai-pack-config.mjs`：implementedSkills=3 项、`optimizationTypes`（luanji=缺陷修复，tianyi/jianchu=质量提升）、evidence 清单已换血（**删除了旧的 `native-ai-quality.patch`**，加入 `huo-native/*` 四补丁+SHA256、FIRE-NATIVE-AI.md、huo-rules-unit.json、三组 huo-quality-*.json、huo-regression-policy.json）。
- `tools/build-skill-ai-pack.mjs`：pack.json 输出 `optimization_types`；README 原生补丁说明识别 `huo-native/`。
- `tools/pack-templates/shenhua_huo.test.mjs`：包内自测改为 3 技能 + 新规则断言（含 knownwin 例外、护甲例外）。
- `tools/build-skill-ai-task-list.py`：天义/鞬出记录改为 已修复/已实施（validation_level 标注"质量提升"），乱击证据更新；已重跑生成 `docs/skill-ai-20261030/142-task-list.json`（**fixed_skills=3** ✓）→ checklist.md 由构建器从记录自动再生，无需手改。
- `docs/skill-ai-quality-20261103/huo-native/`：四份补丁 + SHA256.json（patched=34c057eb…）已同步。
- `FIRE-NATIVE-AI.md` 已重写为第二轮版本（含完整引擎接线一节）。

待做：
1. 关闭 2.1 的天义引擎缺陷（或按备选方案降级为文档化限制）。
2. **修正 FIRE-NATIVE-AI.md**：现在文中写"完整引擎经 skillVetoRegistry 接线后同样否决（tianyiEngineVeto 计数）"——按 2.1 的最终结果改写为"三层一致"或"宿主自动流程限制"。
3. 全部提交（工作树当前有大量未提交修改：pack/rules/registry/skillPlayBrain/scenes/config/builder/task-list/docs）。
4. 重建 ZIP + 原生补丁拷贝：
```bash
node tools/build-skill-ai-pack.mjs --pack shenhua_huo \
  --git "C:\Users\32360\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe" \
  --evidence "C:\Users\32360\.codex\worktrees\release-444\无名AI\docs\skill-ai-quality-20261103" \
  --out "C:\Users\32360\Desktop\feisheng-ai-huo-pack"
```
   产出 `feisheng-ai-shenhua-huo.zip`（构建器自动更新 pack-delivery.json 簿记并打印 zip_sha256）。把 `huo-native.patch` 拷为 `feisheng-ai-shenhua-huo-native-ai.patch` 放同一目录。
5. 验收：`tools/accept-skill-ai-pack.mjs --zip <zip> --out docs/skill-ai-quality-20261103/accept-shenhua-huo-final.json --host-root … --browser … --playwright … --expected-sha <zip_sha256> --init-timeout-ms 180000`（全 10 步应 passed；曾出现一次宿主启动超时假失败，加长 init 超时重试即过）。

### 2.3 已明确不做（防止接手人跑偏）

- 不重做 14 项技能审查；不扩建测试框架；不跑全量 42 套 Node 回归。
- 不改 134 维模型（`score/model/**` 零改动，`FEATURE_DIM=134` 未动）。
- 不动强袭/双雄/火计/看破/连环/涅槃/驱虎/节命——复核结论见 FIRE-NATIVE-AI.md「复核后不纳入补丁的技能」，其中驱虎/节命是被真实宿主证据否决后撤销的，别再加回去。
- 不推送、不发版、不覆盖主安装目录。

---

## 三、已完善并验证的成果（接手前先读，避免重复劳动）

### 3.1 三项修正的最终形态

| 技能 | 性质 | 原生入口 | 逻辑 |
|---|---|---|---|
| 乱击 | **缺陷修复**+质量提升 | `luanji.check` | ① 1血空手无防具且**无护甲(hujia≤0)、无 freeShan 标签**的队友在场 → 0（复用宿主真实减伤/响应判断）；② 目标面<5 时净收益 `num<1 → 0`（≥5/≥7 原门槛保持） |
| 天义 | 质量提升 | `tianyi.ai.result.player` | 手里最大点数<10 且**无已知必胜拼点** → -0.9；已知必胜例外=对手 `getKnownCards` 覆盖全部手牌且已知最大点数 < 己方最大点数（不读隐藏牌面）；点数≥10 或例外命中 → 原生 0.6 |
| 鞬出 | 质量提升 | `jianchu.check` | 敌对且（有装备可拆 ∥ 手牌≤1 ∥ (hp≤1 且无护甲)）才触发 |

原生补丁：`build/huo-native`（git 仓库，分支 `huo-final2`，基线 commit 070c96b = shenhua.js 1.11.7 原字节 62f789e3…，三提交后文件 34c057eb…）。四份 patch 已归档 `docs/skill-ai-quality-20261103/huo-native/`，各自独立过 `git apply --check` + `node --check`。

### 3.2 三层架构（引擎接线）

- 原生补丁：直接改宿主 AI 函数（方式 B，给其他开发者）。
- 扩展分包：`score/decision/skills/packs/shenhuaHuo.js` 三个 `host.wrap`（luanji:check / tianyi:result:player / jianchu:check）+ 天义引擎否决注册（方式 A）。
- **引擎接线（本轮新增）**：新文件 `score/decision/skills/skillVetoRegistry.js`（注册表，tag 清理，fail-open）；`skillPlayBrain.vetoSkill` 规则⑤查询 `dynamicSkillVeto`；分包 install 时 `registerSkillVeto('tianyi', fn, 'shenhua_huo')`，unregister 挂 `host.addCleanup`。引擎 `decideSkill` 命中后走既有 `vetoCandidate(a, d.vetoReason)` + 理由留痕（`a.reason += '（[技能否决] …）'`）+ `policyStats.shenhua_huo.tianyiEngineVeto` 计数。**decideSkill 层已打通（计数为证）；剩宿主自动流程一层，见 2.1。**

### 3.3 已有验证结果（2026-11-04，真实宿主 1.11.7）

| 场景 | native | policy | extension(完整引擎) | 期望 |
|---|---|---|---|---|
| quality-huo-luanji-net（check级，canUse限3目标，净收益0.5） | check=6 | check=0 | check=0 | 修正生效 ✓ |
| quality-huo-luanji-net-positive（净收益1） | 6 | 6 | 6 | 守卫 ✓ |
| quality-luanji-ally-lethal | 6 | 0 | 0 | ✓ |
| quality-luanji-enemy-lethal（全敌方） | 发动 | 发动 | 发动 | ✓ |
| quality-huo-tianyi-lowcompare（mx=5，敌方牌未知） | 发动 | **不发动** | **发动（缺陷，见2.1）** | 三层应一致 |
| quality-huo-tianyi-highcompare（mx=13） | 发动 | 发动 | 发动 | ✓ |
| quality-huo-tianyi-knownwin（mx=5，敌方唯一拼点牌已公开点数2） | 发动 | 发动 | 发动 | 例外三层放行 ✓ |
| quality-huo-jianchu-noequip（3手牌无装备） | 送杀 | 拒绝 | 拒绝 | ✓ |
| quality-huo-jianchu-armor（带八卦） | 拆甲 | 拆甲 | 拆甲 | ✓ |
| quality-huo-jieming-self（节命基线，未接管） | 自补 | 自补 | 自补 | ✓ |

规则单测：`node -e "import('./score/decision/skills/rules/shenhuaHuo.js')…"`（命令见 huorules-unit 记录，当前 `ALL_NEW_RULE_TESTS_PASSED`，含 knownwin 部分已知/平点/非敌反例、护甲反例）。
包内自测模板（`tools/pack-templates/shenhua_huo.test.mjs`）已同步新规则，重建 ZIP 后 `node tests/run-pack-tests.mjs` 应 7/7。

---

## 四、怎么验证（完整命令清单）

环境常量（记忆里也有：[[weimingai-test-env-paths]]）：
```bash
# 以下 $REPO=C:\Users\32360\.codex\worktrees\release-444\无名AI
# $HOST=C:\Users\32360\Desktop\无名杀-win32-x64\resources\app
# $CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
# $PW=C:\Users\32360\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright
# $GIT=C:\Users\32360\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe
```

1) **纯规则单测**（秒级）：
```bash
cd $REPO && node -e "import('./score/decision/skills/rules/shenhuaHuo.js').then(m=>{const r=m.SHENHUA_HUO_POLICY_RULES;console.log(Object.keys(r));console.log(r.tianyiKnownWinAvailable({maxNumber:5,candidates:[{hostile:true,comparable:true,handCount:1,knownCount:1,knownMax:2}]}));})"
```

2) **三组宿主场景**（每组约 2.5 分钟；场景清单 10 个）：
```bash
# native 基线 / policy / extension 三选一（--skill-ai 必带，--skill-ai-policy / --skill-ai-extension 二选一）
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy \
  --scenes "quality-huo-tianyi-knownwin,quality-huo-tianyi-lowcompare,quality-huo-tianyi-highcompare,quality-huo-luanji-net,quality-huo-luanji-net-positive,quality-luanji-ally-lethal,quality-luanji-enemy-lethal,quality-huo-jianchu-noequip,quality-huo-jianchu-armor,quality-huo-jieming-self" \
  --host-root $HOST --extension-root $REPO --browser $CHROME --playwright $PW \
  --output docs/skill-ai-quality-20261103/huo-quality-policy.json
```
   判定标准：native 全部呈现缺陷行为；policy 全部修正；extension 期望= policy（当前仅天义 lowcompare 未达，其余已达标）。

3) **原生补丁**（独立基线副本）：
```bash
cd $REPO/build/huo-native && $GIT checkout -q clean-baseline && $GIT apply --check huo-native.patch && echo APPLY_OK
$GIT apply huo-native.patch && node --check character/shenhua.js   # 应输出 patched=34c057eb…
```

4) **构建与验收**：见 2.2 第 4、5 步。验收 10 步全 passed 即可交付。

5) **若要跑火包旧场景回归**（只在运行时策略有实质修改后做一次，当前策略层行为与第一轮一致，可不跑）：
```bash
node tools/trick-real-host-smoke.mjs --mode identity --skill-ai --skill-ai-policy \
  --scenes "shenhua-huo-tianyi-compare,shenhua-huo-tianyi-win-sha,shenhua-huo-tianyi-lose-sha,shenhua-huo-jianchu-sha,shenhua-huo-jianchu-no-equip,shenhua-huo-passive-rules" \
  --host-root $HOST --extension-root $REPO --browser $CHROME --playwright $PW \
  --output docs/skill-ai-quality-20261103/huo-regression-policy.json
```
   注意 `shenhua-huo-tianyi-lose-sha` 的策略层新行为=拒绝 mx=9 拼点（sha 正常打出），这是预期修正不是回归。

---

## 五、关键环境事实（避坑，全部真实宿主实验证实）

1. `get.attitude(player, player)` 在身份局 = **10**（不是 0）。result.player × 10 是使用决策主导项；只改 result.target 拦不住（第一轮实验证明）。
2. 宿主自动流程点击技能只看 `get.order(skill)`；目标合法性由 `chooseTarget(event.ai2=effect_use)` 把关，全负 → 取消+_aiexclude。
3. 完整引擎：`chooseToUse` 被 override 后**先跑宿主原生流程，再 staged 覆盖**；引擎候选层经 `applyBasicSkillRules → decideSkill → vetoSkill`（已接注册表）。
4. 场景夹具是 **8 人身份局**：`[actor,ally,enemy1,enemy2]=game.players` 只覆盖前 4 席；万箭目标面恒为 7，小规模分支用 `canUse` 探针；`give()` 第三参是牌面点数，**点数敏感测试必须用 1~13**；对手手牌公开标记 `card._knowers=['everyone']`。
5. `instrument()` 记录的 op：discard/lose/draw/useSkill/useCard/gain/loseHp/damage/recover/recast（没有 logSkill/compare）。
6. 验收偶发"宿主启动超时"假失败（`[smoke] browser ready` 后卡住），`--init-timeout-ms 180000` 重试即过，不是逻辑问题。
7. git 不在 PATH，用 `$GIT`；cmd 环境，没有 head/ls，用 PowerShell。

---

## 六、最终交付前必须能回答的五问（当前答案）

1. **三项优化在哪个真实生效的 AI 入口？** 乱击=`luanji.check`（原生+wrap 双通道，check 参与卡牌价值路径）；鞬出=`jianchu.check`（触发器 check，引擎不拦截，三层天然一致）；天义=`tianyi.ai.result.player`（原生+wrap）+ `skillVetoRegistry`→`skillPlayBrain.vetoSkill`（引擎候选层）——**但宿主自动流程一层尚未拦住（2.1）**。
2. **完整引擎是否实际采用这些判断？** 乱击/鞬出：是（extension 场景证据）。天义：decideSkill 层已采用（tianyiEngineVeto 计数），宿主自动流程层未生效——**待 2.1 关闭**。
3. **是否仍存在已确认的决策退化？** 无已知退化；policy 层全部守卫通过。天义引擎层是"未拦住"而非"拦错"。
4. **原生补丁与扩展是否等价？** 乱击/鞬出等价；天义在完整引擎下不等价（见 2.1），策略层/分包集成与原生补丁等价。修复后需同步原生补丁的否决量级（若走 -30 方案）。
5. **当前 ZIP 能否交付？** **不能**——需按 2.1 收口 + 2.2 重建并重新验收后才能给其他开发者。
