# 第二批源码交付前审查记录（2026-10-31）

审查对象：`skillAIPolicyRules.js` / `skillAIPolicies.js` @ HEAD `54cef8f`（含本轮审查修复）。
逐项对应任务书第四节的 10 项检查。发现的 3 处缺陷已在提交 `54cef8f` 以最小修复落地，并同步更新测试。

## 逐项结论

### 1. `qimouTargetX` 的档位计算是否符合实际规则
符合。逐行对照宿主 `character/shenhua.js` qimou content：`hp>=4 && sha>=3 → 3`；`hp>=3 && sha>=2 → 2`；否则 1。
距离/出杀次数/目标体力不在档位函数里，而是作为“是否放宽”的目标条件分别校验（attackDistance≤X+1、目标 hp≤X、hp≤min(手杀数, 1+X)），与原生 gate 的 `mindist` 口径一致（mindist=X+1）。
非整数输入返回 0（等价不放宽）；档位只取整数。

### 2. `shouldBypassQimouCountBlock` 是否可能错误允许发动
七重条件全部满足才返回 true：原生结果≤0；`cardEnabled && cardUsable`（恰好是唯一阻塞）；hp>1 且 hp>X（支付不致死）；目标当前不可达（`canUse` 含距离为假）；`canUseIgnoringDistance` 为真（合法性成立）；原生其余条件（effect>0、attackDistance≤X+1、目标 hp≤X）；**支付必须兑换成击杀**（目标 hp≤min(手杀数,1+X)）。
反向场景已在真实宿主验证：目标 hp4 不放宽、射程内不放宽、杀次数耗尽走原生、1 血不放宽。残余风险：AI 随后的选目标由宿主决定，可能选中另一目标——策略只放宽“发动”，不指定目标，属可接受范围。

### 3. `reqimouOptimalX` 是否低付/过付/越界/非整数
- 非整数：输入全部 floor 取整，输出为整数。✅
- 越界：上限 `min(best, hp-1)`；**审查修复**：hp<2 时返回 null（原实现 hp=1 会给出 1 → 致死支付，虽然原生 gate 在 hp<3 已拦截，仍加防御性守卫）。
- 低付：best 取“最优目标的最低充分支付”，付该值即可对该目标达成可达+击杀；若 AI 攻击更远目标则可能距离不足——与第 2 项同源，属残余风险，记录不遮蔽。
- 过付：candidate 为 max(1, 达距, 击杀)，不再固定 hp-1；near1/near2 从 3 降为 1 并完成击杀（真实宿主验证）。

### 4. `reqimouNeedsPayment` 原生回退是否可靠
两层回退：① 找不到可击杀目标时 `reqimouOptimalX` 返回 null，chooseNumbers 包装不改动 → 原生档位；② gate **审查修复**：目标枚举为空（读局失败）时保留原生，不误拦。
far4-手杀不足、far4-八卦+闪两个场景实测均保留原生档位（付 3），回退可靠。

### 5. `chooseNumbers` 包装的泄漏/重复包装/异常恢复
**审查发现缺陷并修复**：原实现的作用域在 reqimou content 全程有效，若结算窗口内其他触发技对同一玩家调用 `chooseNumbers`，其结果也会被 clamp；且人类玩家手动的支付选择同样会被改写。
修复后：① **一次性作用域**——包装函数进入即还原 `player.chooseNumbers`，只有 reqimou 自己的第一次调用被接管；② **人类路径守卫**——`player === game.me && !_status.auto` 时不挂 clamp；③ content 的 `finally` 仍兜底还原；④ 卸载时恢复 `lib.skill.reqimou.content` 本体（`_reqimouContentBackup` + 身份校验）。

### 6. 包装是否只作用于指定技能与 AI 决策
- qimou/reqimou 的 `ai.result.player` 只被宿主 AI 评分链（`get.effect_use`/`chooseTarget` 校验）消费，人类出牌 UI（`game.check`）不读取。
- reqimou content 包装只在 content 执行窗口内替换该玩家的 `chooseNumbers`，且已加人类守卫。
- 第一批策略保持不变：rezhiheng check/order/result、retuxi target、olkongsheng cost、redimeng chooseButton（人类路径原有 `isMine` 判断）。
- 无目标型策略不会影响手动操作路径。

### 7. 关闭/联机禁用/卸载重装是否恢复原生
- 卸载：三个新备份（qimou result、reqimou result、reqimou content）与其他备份一起按“当前值===包装值”身份校验后还原；`policy-lifecycle` 场景 true→false→true 通过。
- 完整引擎卸载/重装（连带策略层）通过（`full-engine-lifecycle`）。
- 联机：策略只影响本地 AI 评分；远端玩家选择来自网络，不经本地 `lib.skill`。人类托管开关由 `!_status.auto` 守卫覆盖。
- 策略关闭：策略层随 `installScoreEngine`/`uninstallScoreEngine` 安装与卸载，无独立常驻状态。

### 8. 第一批三个在册技能与 redimeng 修复是否保留
保留。架构契约测试断言 `TARGET_POLICIES === ['new_retuxi']`、`DEFENSE_RULES` 仅 rezhiheng、redimeng 不调用 `get.value(button)`、olkongsheng 指纹存在。
完整套件 policy 运行 stats：keptTao 18 / keptShan 3 / fairRedimeng 9 / retuxiTargetBonus 14 / olkongshengCostCalls 4(compatible) —— 与第一批收尾值一致。

### 9. 是否改动 134 维模型契约/训练数据/无关文件
第二批 diff（`skill-ai-20261030.6..HEAD`）仅触及 2 个运行时文件 + 测试工具 + 文档；`FEATURE_DIM=134`、`CURRENT_DIM=134`、`info.json version=4.4.4` 有契约测试锁定；模型/训练/后端零改动。

### 10. 是否存在“算了分但没被消费”的死代码
消费链已逐一验证：
- qimou 放宽值 → 宿主 `chooseTarget` 校验消费 → 真实宿主出现 `useSkill qimou` + 3 杀击杀（batch2-policy/batch2-extension）。
- reqimou clamp → content 的 `result.numbers[0]` 消费 → 真实宿主 `loseHp:[1]`（原 3）。
- stats 计数（qimouBypass/reqimouClamp/reqimouClampCalls）在宿主运行中非零，可作为接线证据。
- 无“计算后丢弃”的评分路径。

## 审查修复清单（提交 54cef8f）

| # | 缺陷 | 修复 | 测试 |
|---|---|---|---|
| 1 | chooseNumbers 作用域覆盖整个 content，可能改写窗口内其他事件的询问 | 一次性作用域（进入即还原） | 架构断言 `player.chooseNumbers = originalChooseNumbers;\n const next` |
| 2 | 人类玩家的手动支付选择会被 clamp 覆盖 | `isHuman = player === game.me && !_status.auto` 时不挂 clamp | 架构断言 isHuman 表达式 |
| 3 | hp=1 时 `hp-1=0` 仍可能返回 1（致死支付）；gate 在枚举为空时可能误拦 | `life<2 → null`；gate 空枚举保留原生 | 纯规则用例 hp1/hp0 → null；架构断言 `targets.length && !reqimouNeedsPayment` |

---

# 独立审查补修记录（2026-11-01，提交 356d487 起）

外部审查发现两处确定缺陷，均已在 `356d487` 以最小修复落地，并补测试与真实宿主证据。

## P1-a：`reqimouOptimalX` 对不可承受支付的错误截断

- **缺陷**：旧实现 `candidate = max(1, xReach, xKill)` 之后统一 `min(best, hp-1)`。审查复现：体力3、3杀、距离4、攻击范围1、目标2血 → 需要支付3才能打到，但函数返回2；支付2后距离仍为2，无法攻击，属“付了也白付”。
- **修复**：候选先与 `maxPayment = hp-1` 比较，**不可承受的候选直接跳过**，绝不截断；返回 null 表示没有可行候选。
- **宿主决策链选择**（明确，不是隐式回退）：
  - 手杀数足以击杀（`reqimouKillableByHand`）、但不存在任何 ≤hp-1 的可行支付 → **gate 返回 0，阻止这次无收益发动**；
  - 手杀数不足以击杀 → 保留原生档位（原生 burst/摸牌路线，静态手牌无法判定收益，策略不越界）。
- **真实宿主证据**（`evidence/batch2-range-native.json` / `batch2-range-policy.json`）：
  - 满血4、3杀+桃、目标距离5（+1马）、范围1：原生 **支付4（全部体力）+桃自救**并击杀；策略 gate 阻断（`reqimouInfeasible=3`），0 支付、目标未受伤、桃保留。
  - 体力3+桃、距离4：体力3时 gate 阻断（`reqimouInfeasible=3`）；随后 AI 先吃桃回到4血，才在“4→付3”合法可行时发动——说明 gate 随状态动态生效，而不是一次性静态判断。

## P1-b：攻击范围读取了不存在的属性

- **缺陷**：旧代码读 `player.attackRange` 数值属性，否则默认1。本机 1.11.7 的真实 API 是 `player.getAttackRange()`（`getEquipRange()` + `attackRangeBase/attackRange/attackRangeFinal` 修正）；`get.distance(from,to)` 已含马匹 globalFrom/globalTo 与全局修正，`get.distance(...,'attack')` 仅额外叠加 attackFrom/attackTo（原生 qimou 使用的口径）。
- **修复**：`_reqimouTargets` 改用 `player.getAttackRange()`；距离用 `get.distance`。
- **真实宿主证据**：距离4、丈八蛇矛（范围3）、目标2血、2杀——
  - 原生：支付3；策略：**支付1**（`reqimouClamp=1`），目标被击杀；`before.attackRange=3` 被运行器记录。
  - 目标+1马距离5、范围3：策略支付2；
  - 赤兔-1马距离3、范围1：策略支付2；
  - 无武器距离4、范围1：策略支付3（可达且可承受，与原生一致）；
  - 目标空城（无手牌不可成为杀目标）：双方均不发动，策略无副作用。

## 测试与清单

- 纯规则 30 条（新增不可承受截断回归、长武器、坐骑距离、killableByHand 用例）；架构契约 10 条（新增 `getAttackRange()` 使用与禁止 `player.attackRange` 的断言）。
- `verify.py --zip` 修复：只认包根 `manifest.json`，新增 `tests/test-verify-zip.py` 覆盖“多个同名 manifest”和“根清单缺失必须失败”两个回归。
- 新增包内可执行入口 `tests/run-package-tests.mjs`：自动组装临时仓库形状并运行纯规则与契约两组测试；其余 39 个 Node 入口与宿主场景明确依赖完整仓库/宿主机，见 COMMANDS.md。
- 未改动：134 维模型契约、训练数据、安装目录、版本号、更新公告；未推送、未发版。

---

## 2026-11-01 分包化补充审查

1. 共享核心 `policyCore.js` 只包含安装/卸载/备份/统计与通用宿主只读助手；架构测试断言其中没有具体技能名。
2. 各分包只 import `../policyCore.js`、自己的 `../rules/<pack>.js` 与安全适配；不 import 其他分包或规则聚合出口。
3. `skillAIPolicyPacks.js` 是唯一合并点，带 `@djsc-pack-imports-*` / `@djsc-pack-registry-*` marker；集成脚本只追加自己的行。
4. 技能归属唯一：当前注册表为 `rezhiheng`、`new_retuxi`、`qimou`、`reqimou`、`olkongsheng`、`redimeng`；架构测试检查无重复。
5. 安装/卸载：核心 `install()` 幂等，卸载按逆序恢复且仅当当前值仍是本层包装时恢复；注册表 import 与条目一一对应、无重复。分包卸载后重装已在宿主生命周期场景与 `test-pack-install` 验证。
6. `apply-pack.mjs` 预检共享核心版本与注册表所有 `./packs/*.js` 导入，备份将被修改文件，失败（含 `DJSC_PACK_TEST_FAIL_AFTER` 注入）自动恢复；回滚仅撤销本包，回滚最后一个包保留空注册表以免 facade 卸载后加载失败。A/B 共存、乱序回滚、重复安装、共享核心冲突、预存注册行缺模块共 13 条回归全 PASS。预存本包注册行但分包文件缺失时安装前拒绝；旧记录同类状态回滚硬性阻止删除，避免悬空导入。
7. 134 维模型、`info.json` 4.4.4、v2 未接线契约不变；分包 ZIP 内含只读契约测试。
8. `hardcoded` 检查：`refresh_feng` 禁止 `player.attackRange` / `getCardUsable('sha') || 1`；`out_of_scope` 禁止 `get.value(button`；`shenhua_feng` 禁止 `reqimou` 混入。
9. 证据：补修 21×3 场景最终未解决 0；历史超时与末次尝试失败在 ledger 中保留，未改断言。新增逐包技能场景、上游 1fe5292 接线验收、单包/组合契约分列与不抑制 `game.over` 的有界完整对局；矩阵见交付目录。
10. 交付边界：三个未完成包保持 `阶段性`、`complete_delivery=false`；`out_of_scope` 与 `shenhua_feng` 在逐包/共存/上游验收通过后按 `可交付` 生成（最终 ZIP 生成并登记前不标 `已交付`）。`shenhua_feng` 12 项登记技能全部审查：`qimou` 已修复，其余 11 项为 `已验证无问题`；新增固定局面证据与原生/扩展对照，未改 134 维契约、未推送、未发版、未覆盖正式安装目录。
