# 无名 AI 十六分包最终集成验收报告

日期：2026-11-13  
宿主：无名杀 1.11.7（Windows x64）  
浏览器：Chrome 157.0.8103.78 + Playwright，本地隔离服务器  
模式：身份局 8 人，seed `20261030`  
交付性质：内部开发者交付；不是公开发布、Release、Android/联机验证或全模式验证。

## 结论

**无名 AI 十六分包最终内部集成 PASS（限定已验证部署配置）。**

限定配置：

- 十份剩余分包原生 AI 补丁，按 `standard_2008 → standard_2013 → standard_2019 → standard_2023 → shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan` 累计应用到干净 1.11.7 宿主；
- 六份既有扩展分包，按 `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope` 安装到上游 `1fe5292` 完整扩展根；
- 不叠加六包自己的原生补丁路线；不生成新的扩展 ZIP。

结论不覆盖：任意安装顺序、任意版本混装、Android、联机、斗地主/国战/2v2 等未测模式，以及全部 245 项登记技能的历史完整矩阵。

## 1. 基线锁定

| 项 | 值 |
| --- | --- |
| 六包封版分支 | `codex/six-pack-final-integration-v2` @ `75eb630fd259def3f42afea8f9bbb823a9eb71af` |
| 十包开发分支 | `codex/remaining-ten-packs` @ `1598a41cb7fb1ca03607657da2e6550f72ebe0cb` |
| 十包独立验收分支 | `codex/remaining-ten-packs-acceptance` @ `d6fffc7fb2b4ae34e4bd49fd60d18e270cdc2a94` |
| 本集成分支 | `codex/sixteen-packs-final-integration`（从 `d6fffc7` 建立） |
| 祖先关系 | 六包封版 → 十包开发 → 十包验收 → 本集成分支，均为真 |
| 六包扩展基线 | 上游 `1fe5292eb3022dd8d1db494617b21a12be912e61` |
| 宿主 | 无名杀 1.11.7，五文件干净哈希见 `phase1/artifacts-baseline.json` |

六 ZIP 与十补丁 SHA256 全部与封版/交接记录一致；详见 `phase1/artifacts-baseline.json`。六包交付 ZIP 未修改、未重建。

## 2. 技能接管冲突审查

完整矩阵见 `skill-takeover-matrix.md`。核心结论：

- 十份原生补丁修改的 20 个技能 ID 与六份扩展的运行时包装技能 ID **交集为空**；没有同一技能 ID 的重复接管。
- `dimeng` 与 `redimeng`、`tieji` 与 `retieji`、`oljieming` 与 `jieming` 均按独立技能处理；`out_of_scope` 的 `chooseButton` 钩子只在活动技能包含 `redimeng` 时启用，对 `dimeng` 返回 false。
- 唯一有意的共享基类覆盖是 `qingguo`/`jijiu`/`lijian`：由 `refresh_standard` 扩展接管，十份原生补丁未修改这些 ID；组合真实宿主场景通过。
- 六包共享核心一致，注册表六条唯一导入；不存在第二套协调器。
- 完整引擎的通用选择桥不是同技能接管；在组合宿主中，十包 16/16 确定性场景签名与仅十补丁一致，六包 96 个默认场景签名与六包封版基线全部一致。

## 3. 十份原生补丁累计应用与撤销

真实宿主文件副本（五文件）执行：

- 十补丁按交付顺序 `git apply --check` + `apply` 全部通过；
- 应用后 `node --check` 四文件通过；
- 补丁后五文件哈希与交接记录一致；
- 逆序 `apply -R --check` + `apply -R` 全部通过；
- 撤销后五文件恢复干净基线字节；
- 重复应用 `--check` 被拒绝，文件哈希不变；
- 扩展目录清单哈希前后不变。

证据：`phase4/patch-roundtrip.json`。  
补丁 SHA256 与提交号：`phase1/artifacts-baseline.json`。

## 4. 六包扩展按正式顺序安装

在真实 1.11.7 补丁宿主（十补丁已应用）上，用六份正式 ZIP 对 `1fe5292` 干净扩展目标执行：

- 解压、`verify.py --zip/--dir`、共享核心哈希预检全部通过；
- 按正式顺序安装六包，注册表六条唯一导入；
- 六包全部加载，`policyStats.packs` 同时出现六个包；
- 93 个默认宿主场景全部 PASS，`errors=[]`；
- 六项技能签名与六包封版基线逐项一致（`phase3/six-pack-signature-compare.json`）；
- 逆序回滚、重装、再回滚通过；回滚后注册表空、共享核心与 `skillPlanHints.js` 保留；
- 双风共存（`refresh_feng` + `shenhua_feng`）通过；
- 神话雷镇骨专项 19 场景 PASS，`zhenguScoreCalls=136`、`zhenguFallbacks=0`、`zhenguHookConflict=0`（`phase3/zhengu-combined.json`）。

证据：`phase3/six-pack-combined.json`、`phase3/zhengu-combined.json`。

## 5. 关键 AI 修复在组合宿主中仍生效

同一补丁宿主、同一 seed，分别在“仅十补丁”和“十补丁 + 完整扩展引擎 + 六包”下运行十包固定场景（18 个场景）：

- 16 项确定性签名全部一致（`phase3/native-scene-compare.json`）：铁骑/肉林标签、遗计、同疾、机捷、急援、淑慎、骁果、神智、缔盟、乱武、节命、明任、溃诛、旧缔盟、制霸等。
- 边界 14 场景（`phase3/edge-scene-compare.json`）的 12 项关键不变量全部一致：`dimeng` 空候选/合法双目标/结算；`tuntian` 隐藏牌 known 计数与 juedou 目标收益；`olhaoshi` 交牌与援助；`rehuashen` 合法两周期与空池安全退出；`qizhi`、`reqiaobian`、`feijun` 的宿主边界。
- 共享基类 `qingguo`/`jijiu`/`lijian` 在组合宿主中 6 场景 PASS（`phase3/shared-base-skills-extension.json`）。
- `tuntian-viewer` 的 `mayHaveShan` 是宿主随机估计；跨进程 RNG 状态不同会产生不同估计值（`phase3/native-scene-compare.json` 的 `stochastic`），但受控隐藏牌场景的 known 计数与 juedou 目标收益一致。不构成隐藏牌面读取。
- `skillPlanHints.js` 由标准扩展提供；本组合未确认 `1fe5292` 完整引擎对它的接线。分包策略独立工作，六包封版验收也不依赖该接线（P2）。

## 6. 安装、卸载、回滚与隔离

- 十补丁只改宿主 `character/*.js`；六包安装器只改扩展根 `score/` 与 `.djsc-pack-backups/`。
- 六包逆序回滚/重装前后，宿主五文件哈希完全不变。
- 十补丁撤销前后，扩展目录清单哈希完全不变。
- 原生补丁重复应用安全拒绝；扩展安装器的故障注入、共享核心冲突拒绝、旧顺序拒绝继承六包封版事务电池。
- 六包旧顺序（神话风先于界风）为安全拒绝、零写入；本组合只支持正式顺序。证据继承 `phase4/inherited-six-pack/install-order-reject.json` 与 `install-battery-final.json`。

证据：`phase4/patch-roundtrip.json`、`phase4/extension-rollback-reinstall.json`、`phase4/inherited-six-pack/`。

## 7. 分包状态

| 逻辑分包 | 路线 | 本轮状态 | 说明 |
| --- | --- | --- | --- |
| `standard_2008` | 原生补丁 | PASS | 铁骑/遗计真实宿主场景通过；组合下签名一致 |
| `standard_2013` | 原生补丁 | PASS | 同疾隐藏牌场景通过 |
| `standard_2019` | 原生补丁 | PASS | 机捷/急援通过 |
| `standard_2023` | 原生补丁 | PASS | 淑慎/骁果/神智通过 |
| `shenhua_lin` | 原生补丁 | PASS | 缔盟空候选、乱武无主公、肉林标签通过 |
| `shenhua_shan` | 原生补丁 | PASS | 屯田隐藏信息、制霸通过 |
| `shenhua_yin` | 原生补丁 | PASS | 溃诛/明任通过 |
| `refresh_huo` | 原生补丁 | PASS | 节命按 maxHp 评分通过 |
| `refresh_lin` | 原生补丁 | PASS | 好施/旧缔盟通过 |
| `refresh_shan` | 原生补丁 | PASS | 化身/制霸通过 |
| `refresh_standard` | 扩展 | PASS | 六包签名与封版一致；共享基类场景通过 |
| `refresh_feng` | 扩展 | PASS | 签名一致；双风共存 |
| `shenhua_feng` | 扩展 | PASS | 签名一致；双风共存 |
| `shenhua_huo` | 扩展 | PASS | 签名一致 |
| `shenhua_lei` | 扩展 | PASS | 签名一致；镇骨 19 场景通过 |
| `out_of_scope` | 扩展 | PASS | `redimeng` 公平评分/第二目标修复通过 |

所有 PASS 均限定于本报告第 4 节的部署配置与本轮执行场景，不代表全模式/全技能矩阵。

## 8. P0/P1 与 P2

### P0/P1

**组合范围内无未解决的 P0/P1。** 未发现新的组合回归；未发现同一技能重复接管。

### P2（继续保留，未在本轮修复）

1. `qizhi` 全部牌受保护时仍可能获得摸牌收益（宿主原生；组合宿主 `edge-qizhi-protected-only` 复现）。
2. `reqiaobian` draw 阶段上下文过滤可能遗漏合法发动机会（宿主原生；组合宿主 `edge-reqiaobian-context` 复现，content 被 filter 跳过）。
3. `feijun` 支付代价前的 AI 估值可能遗漏支付后目标机会（宿主原生；组合宿主 `edge-feijun-postpay` 复现，支付后结算与兵略正常）。
4. `rehuashen` 化身池真正耗尽的合法路径未完整验证；本轮空池为人工清空防御性场景，正常 init 抽 3 张。
5. `tuntian-viewer` 的 `mayHaveShan` 概率估计会随 RNG 状态变化；受控隐藏牌不变量通过。
6. `skillPlanHints.js` 在 `1fe5292` 完整引擎中的接线未确认；分包策略独立工作。
7. 六包封版既有 P2：双风安装顺序约束、界风 reqimou 保守放弃、强袭武器代价、罪论排序、雄乱 countCards、踞襄装备机会成本、镇骨第三方钩子冲突、天香 aiOptions 第三方替换、旧共享核心迁移、标准 ZIP 元数据、原生路线覆盖差异、Android/联机/其他模式未验证、镇骨人工点击级未验证、原生补丁 LF 要求、摸牌高于回复仅规则级覆盖、未重跑六包完整历史矩阵。
8. 未重跑十包全部 81 将/164 技能的真实宿主完整矩阵；本轮继承十包独立验收的固定场景与静态检查。

## 9. 不受支持的混装

见 `skill-takeover-matrix.md` 第 7 节。重点：

- 六包自己的四个原生补丁与对应扩展二选一，不得叠加；
- 同一逻辑分包的原生 + 扩展重复接管不支持；
- 旧双风顺序、旧六包 ZIP/旧共享核心、任意安装顺序不支持；
- 十份原生补丁不是扩展 ZIP；十六包是逻辑覆盖，不是十六个扩展安装包。

## 10. 证据索引

| 证据 | 内容 |
| --- | --- |
| `phase1/artifacts-baseline.json` | 分支/祖先、六 ZIP、十补丁、宿主哈希 |
| `skill-takeover-matrix.md` | 技能接管矩阵、共享/派生关系、通用钩子、混装限制 |
| `phase3/six-pack-combined.json` | 补丁宿主上的六包组合安装/加载/场景/回滚 |
| `phase3/six-pack-signature-compare.json` | 六包签名与封版基线逐项对照 |
| `phase3/native-scenes-patched.json` | 仅十补丁的十包固定场景 |
| `phase3/native-scenes-extension.json` | 组合宿主的十包固定场景 |
| `phase3/native-scene-compare.json` | 16 项确定性签名对照 + tuntian 随机说明 |
| `phase3/edge-patched.json` | 仅十补丁的四项未决技能与三项边界基线 |
| `phase3/native-edge-extension.json` | 组合宿主四项未决技能与三项边界 |
| `phase3/edge-scene-compare.json` | 组合与仅补丁的边界不变量对照 |
| `phase3/shared-base-skills-extension.json` | `qingguo`/`jijiu`/`lijian` 共享基类场景 |
| `phase3/zhengu-combined.json` | 镇骨 19 场景 |
| `phase4/patch-roundtrip.json` | 十补丁累计应用/逆序撤销/字节恢复/扩展目录不变 |
| `phase4/extension-rollback-reinstall.json` | 六包逆序回滚/重装/宿主哈希不变 |
| `phase4/inherited-six-pack/` | 六包封版事务电池与旧顺序拒绝证据（继承） |

## 11. Git 与交付

- 集成分支：`codex/sixteen-packs-final-integration`；
- 开发/验收分支未被修改；
- 未 push、未合并、未创建 PR/Release/Tag；
- 最终交付目录：`feisheng-ai-sixteen-packs-final/`（本轮生成，包含六份未变 ZIP、十份原生补丁、本报告、接管矩阵、部署/升级说明、关键证据与 `SHA256SUMS.txt`）；
- 最终 HEAD 与文件 SHA256 以交付目录 `SHA256SUMS.txt` 和最终工作报告为准。

## 12. 十问回答

1. **十六个逻辑分包是否可以共存？** 可以，限于本报告第 4 节的已验证部署配置。
2. **是否存在相同技能重复接管？** 没有；十包 20 个技能 ID 与六包运行时包装交集为空；共享基类 `qingguo/jijiu/lijian` 仅由扩展接管。
3. **十份原生补丁累计应用与撤销是否通过？** 通过；应用/语法/逆向/字节恢复/重复拒绝均通过。
4. **六包扩展按正式顺序安装是否通过？** 通过；六包加载、93 场景、签名一致、逆序回滚/重装通过。
5. **关键 AI 修复是否仍生效？** 是；十包 16/16 确定性签名一致，边界 12/12 不变量一致，六包签名全部一致，镇骨通过。
6. **是否出现新的 P0/P1？** 没有；P2 保留。
7. **安装、卸载、回滚是否完整？** 完整；扩展回滚不触碰宿主补丁文件，补丁撤销不触碰扩展目录；故障/冲突安全路径继承六包事务电池。
8. **哪些混装组合不受支持？** 六包原生补丁与扩展同装、同分包原生+扩展重复、旧双风顺序、旧 ZIP/旧核心混装、任意顺序、把原生补丁包装成扩展。
9. **哪些 P2 继续保留？** 见第 8 节；包括 qizhi、reqiaobian、feijun、rehuashen 空池、tuntian 随机估计、skillPlanHints 接线及六包封版既有 P2。
10. **最终交付目录、Git HEAD 和 SHA256 是什么？** 交付目录 `feisheng-ai-sixteen-packs-final/`；Git/哈希见 `SHA256SUMS.txt` 与最终工作报告。
