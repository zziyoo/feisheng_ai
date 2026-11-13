# 剩余十包独立验收 - 真实宿主报告

生成时间：2026-11-13T09:44:18.220Z

## 1. 环境与对象

- 宿主：无名杀 1.11.7（本机 Windows x64），身份局，seed `20261030`，Chrome 真实宿主。
- 开发分支/HEAD：`codex/remaining-ten-packs` / `1598a41cb7fb1ca03607657da2e6550f72ebe0cb`。
- 验收分支：`codex/remaining-ten-packs-acceptance`（工作树 `C:/Users/32360/.codex/worktrees/remaining-ten-packs-acceptance`）。
- 干净宿主：`host-a`，五文件哈希与交接文档原始值一致。
- 补丁宿主：`host-ten`，累计应用十份补丁后的四文件哈希见下表。
- 方法：Playwright 加载真实宿主；不替换 Player/GameEvent/技能 content 和结算；同一场景在干净/补丁宿主各跑一次。

## 2. 宿主文件哈希

| 文件 | 干净 host-a | 累计补丁 host-ten |
| --- | --- | --- |
| `character/standard.js` | `2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63` | `614be8c1ee9bcf82e37477ab9a09f1e781dbe2f32c77aa9725446e1689bc9b48` |
| `character/shenhua.js` | `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e` | `7b7bb42574cbe06283505e7417217af8e6691aee4f1d824ae61ca6cd28d3a3ed` |
| `character/refresh.js` | `25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0` | `73fd1f6c1ee90bb6a6e35591249415dd4f23f51fd38864c9d01c9471735e3e01` |
| `character/sp.js` | `f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea` | `8386e05b611762321acf1730e1387231bb947fae32884335acbd975c8a654e2f` |
| `character/tw.js` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` |

## 3. 真实宿主探针结果

| 分包 | 技能 | 场景 | 干净宿主 | 补丁宿主 | 结论 |
| --- | --- | --- | --- | --- | --- |
| standard_2008 | tieji 铁骑 | tieji-roulin-tags | directHit_ai=true; skillTagFilter=function | directHit_ai=null; skillTagFilter=undefined | **PASS** |
| standard_2008 | yiji 遗计 | yiji-nogain | 目标选择为自身（nogain 未生效） | 目标选择为正常可获牌友方 | **PASS** |
| standard_2013 | retongji 同疾 | retongji-hidden | check=true（读取同疾拥有者真实手牌） | check=false（仅按目标已知牌判断） | **PASS** |
| standard_2019 | xinfu_jijie 机捷 | xinfu-jijie-nogain | 目标选择为自身 | 目标选择为正常可获牌友方 | **PASS** |
| standard_2019 | xinfu_jiyuan 急援 | xinfu-jiyuan-check | recover=true | recover=false；dying=true 两侧相同 | **PASS** |
| standard_2023 | shenzhi 神智 | shenzhi-check | full=true; damaged=true | full=false; damaged=true | **PASS** |
| standard_2023 | stdshushen 淑慎 | stdshushen-nogain | 选择 nogain 友方 | 无合法正常目标时取消 | **PASS** |
| standard_2023 | stdxiaoguo 骁果 | stdxiaoguo-eff | eff=6 | eff=-12.15 | **PASS** |
| shenhua_lin | luanwu 乱武 | luanwu-no-zhu | TypeError: Cannot read properties of null (reading isZhu) | 返回 -2.6667，无异常 | **PASS** |
| shenhua_lin | roulin 肉林 | tieji-roulin-tags | directHit_ai=true; skillTagFilter=function; halfneg=true | directHit_ai=null; skillTagFilter=undefined; halfneg=true | **PASS** |
| shenhua_lin | dimeng 缔盟 | dimeng-friendly | result=-6（未进入空候选分支） | result=-6（未进入空候选分支） | **INCONCLUSIVE** |
| shenhua_shan | tuntian 屯田 | tuntian-viewer | [0.6,0.75]; mayActor=true; mayAlly=true | [0.6,0.75]; mayActor=true; mayAlly=true | **INCONCLUSIVE** |
| shenhua_shan | zhiba 制霸 | zhiba-hidden | olzhiba2=1; zhiba_global=1 | olzhiba2=0; zhiba_global=0 | **PASS** |
| shenhua_yin | nzry_kuizhu 溃诛 | kuizhu-target | 未选出合法伤害目标 | 选出 hp=2 的匹配目标 | **PASS** |
| shenhua_yin | nzry_mingren 明任 | mingren-samecolor | aiCandidate=87.27 | aiCandidate=0 | **PASS** |
| refresh_huo | oljieming 节命 | oljieming-maxhp | [1,2] | [0,4] | **PASS** |
| refresh_lin | oldimeng 缔盟 | oldimeng-public | 6.9205 | 2 | **PASS** |
| refresh_shan | olzhiba2 制霸 | zhiba-hidden | olzhiba2=1 | olzhiba2=0 | **PASS** |
| refresh_lin | olhaoshi 好施 | — | - | - | **NOT TESTED** |
| refresh_shan | rehuashen 化身 | — | - | - | **NOT TESTED** |

探针合计：**20**；PASS **16**；INCONCLUSIVE **2**；NOT TESTED **2**。

### 关键说明

- **shenhua_lin / dimeng 缔盟（INCONCLUSIVE）**：静态补丁含 !list.length guard；真实宿主中技能模块的 ui.selected 与测试页 lib.ui.selected 非同一实例，无法在不替换宿主实现的情况下强制空候选；P0 仍需手工选目标/完整对局确认
- **shenhua_shan / tuntian 屯田（INCONCLUSIVE）**：补丁改为按观察者 mayHaveSha/mayHaveShan 与 getKnownCards 估计；当前固定局两种视角同值，未能构造可观察差异；静态 diff 已核对
- **refresh_lin / olhaoshi 好施（NOT TESTED）**：补丁含 ai1 与援助 chooseCard AI 两处；本轮未构造真实交牌/援助固定局
- **refresh_shan / rehuashen 化身（NOT TESTED）**：补丁含阶段控制、制衡按钮、返回过滤三处；本轮未构造真实化身池固定局

## 4. 分包验收状态

| 分包 | 状态 | 依据 |
| --- | --- | --- |
| standard_2008 | **PASS** | tieji/yiji 两项修改技能均有真实宿主差异 |
| standard_2013 | **PASS** | retongji 修改技能有真实宿主差异 |
| standard_2019 | **PASS** | xinfu_jijie/xinfu_jiyuan 均有真实宿主差异 |
| standard_2023 | **PASS** | stdshushen/shenzhi/stdxiaoguo 均有真实宿主差异 |
| shenhua_lin | **PARTIAL / BLOCKED** | luanwu/roulin PASS；dimeng P0 真实空候选未直接确认 |
| shenhua_shan | **PARTIAL** | zhiba PASS；tuntian 隐藏信息差异未观察 |
| shenhua_yin | **PASS** | nzry_kuizhu/nzry_mingren 均有真实宿主差异 |
| refresh_huo | **PASS** | oljieming 有真实宿主差异 |
| refresh_lin | **PARTIAL** | oldimeng PASS；olhaoshi 未测 |
| refresh_shan | **PARTIAL** | olzhiba2 PASS；rehuashen 未测 |

## 5. P0/P1/P2 与覆盖边界

- **P0**：`luanwu` 无主公真实宿主已从 TypeError 修复为正常返回；`dimeng` 空候选静态 guard 已确认存在，但真实宿主空候选选择未被直接确认；`huashen` 空池异常仍为未解决/未覆盖。
- **P1**：`tieji`、`roulin`、`retongji`、`yiji`、`xinfu_jijie`、`xinfu_jiyuan`、`shenzhi`、`stdshushen`、`stdxiaoguo`、`zhiba`、`olzhiba2`、`nzry_kuizhu`、`nzry_mingren`、`oljieming`、`oldimeng` 均有真实宿主差异；`tuntian` 未观察到差异；`olhaoshi`、`rehuashen` 未测。
- **未覆盖宿主边界**：`qizhi` 受保护牌、`reqiaobian` 弃牌上下文、`feijun` 支付后目标、`huashen` 空池、完整 81 将/164 技能矩阵、Android/联机/斗地主/国战/2v2、旧六包扩展与十包原生叠加。
- **P2**：沿用开发台账；本轮未清零，也未把 P2 改写成 PASS。

## 6. 覆盖数量

- 开发台账登记：81 名武将 / 164 项技能关联；十包补丁修改 20 项登记技能条目（开发报告称 24 个回调检查，其中 1 项为不变对照）。
- 本轮真实宿主探针覆盖 16 个技能场景；20 项登记技能条目中 18 项有测试（16 项 PASS、2 项 INCONCLUSIVE：dimeng、tuntian），2 项 NOT TESTED（olhaoshi、rehuashen）。
- 其余未修改技能沿用开发台账的审查/历史证据，未在本轮逐项真实对局。

## 7. 十包补丁 SHA256 与 Git

| 分包 | SHA256 | 开发提交 | 工作树=HEAD |
| --- | --- | --- | --- |
| standard_2008 | `d0e233259a1db09c9bfa3e4c686ea4a361bff6956edbadaca1c5341bcea410db` | 404e305dc58f8ad964a9764ecc433320af17f6e4	fix(ai): review standard 2008 and correct tieji and yiji | PASS |
| standard_2013 | `a70a185ecebb78f2e30afeeea3009b665914fa59f169857081500e9860f8558f` | eba7ded6c925da6b0f8f5ed1812d81d340f0a7e6	fix(ai): review standard 2013 and protect hidden shan in retongji | PASS |
| standard_2019 | `bf843e22e9c7085019bb87f94865d29a6873a1b95c4390a24b576f949a931521` | 959661831683211f3266f8efa4a05a4c91e4e4fa	fix(ai): review standard 2019 and improve jijie and jiyuan scoring | PASS |
| standard_2023 | `d1b7fa5430b9050e7fbf7b405702c45e4883848619ac7c4633508414940e8074` | 64df8e6dfb09a56430c487b4edd378edd973fef7	fix(ai): review standard 2023 and correct xiaoguo and recovery choices | PASS |
| shenhua_lin | `ae017875df282cc852cf3a11d4530fb15d906b6c7cdbf87b44a5ea9d09f0bc67` | 22e19db1a82c8555a5fa22332a1a409d48be90fe	fix(ai): review shenhua lin and correct dimeng roulin and luanwu | PASS |
| shenhua_shan | `b74fd8d3eec392e7fa9b4e491ad86646705b3b072aea08f5f44d14b19c6abf15` | f091f79ecdd1cd0a4c527a81936f41e1cafba2e7	fix(ai): review shenhua shan and protect hidden response and compare cards | PASS |
| shenhua_yin | `f83fb96114f9b2aa20672f14f6f901c40e71fbcbb4e9a6f620eb4ac9b86b3747` | b79ce0ce3db1d136ec8d8e2e78017d31454b2527	fix(ai): review shenhua yin and correct kuizhu and mingren choices | PASS |
| refresh_huo | `7d7cf2c6b83623deb2e9b7ec10e60d17d26ca949efd1f849a996254f7c707d88` | dcf0dd3d2d9b031c60521ce50ed98cb32e9bef52	fix(ai): review refresh huo and score oljieming by max hp | PASS |
| refresh_lin | `8c3e6c8c138460bb7ef920934a526cf47a7d0029414cce0e3a460abe820ef26c` | 92214435d6e98410808eb75613d9028ec91f51fc	fix(ai): review refresh lin and correct olhaoshi and oldimeng | PASS |
| refresh_shan | `306431fa8e7246d2eb3225fc49fbda7a1071cc7940b7ce25708f7549bad54a6e` | a9031aade343ef3e219e733297708ada59a8383b	fix(ai): review refresh shan and correct huashen and zhiba scoring | PASS |

- 十份补丁独立/累计应用、语法、逆向撤销、原始字节恢复见 `../phase1/phase1-report.md`。
- 验收分支未 push、未合并、未创建 Release/Tag；开发分支未被修改。

## 8. 结论

**第一阶段十份原生补丁交付门禁 PASS；真实宿主导入门禁为部分通过。**

按分包：standard_2008、standard_2013、standard_2019、standard_2023、shenhua_yin、refresh_huo 的修改技能均取得真实宿主差异；shenhua_lin（dimeng P0）、shenhua_shan（tuntian）、refresh_lin（olhaoshi）、refresh_shan（rehuashen）仍存在未确认/未覆盖项。

因此本轮 **不宣布“剩余10个分包最终内部交付 PASS”**。只有在 dimeng 空候选、tuntian 隐藏视角、olhaoshi、rehuashen 以及未覆盖宿主边界取得可复现证据后，才能进行最终十六包兼容性评估。

**未公开发布；未 push；P2 未关闭；本报告为内部验收记录。**
