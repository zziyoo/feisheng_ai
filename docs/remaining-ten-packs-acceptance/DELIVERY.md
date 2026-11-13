# 剩余十包独立验收 - 交付产物与兼容性说明

生成时间：2026-11-13（第二阶段专项验收后更新）

## 交付路线

- 本轮交付物为 **十份原生 AI 补丁 + 逐技能审查/验收记录**；现有构建器不支持十包扩展 ZIP，**未擅自生成扩展 ZIP**。
- 十份补丁可独立应用，也可按声明顺序累计应用；静态应用/语法/逆向恢复见 `phase1/phase1-report.md`。
- 与已封版六包的扩展策略混用时，同一技能只能二选一；本轮未完成十包原生与六包扩展的完整共存验收，**不得宣称双端全覆盖**。

## 十份补丁

| 分包 | 补丁 | 大小(B) | SHA256 | 开发提交 | 工作树=HEAD |
| --- | --- | ---: | --- | --- | --- |
| standard_2008 | `standard_2008.patch` | 828 | `d0e233259a1db09c9bfa3e4c686ea4a361bff6956edbadaca1c5341bcea410db` | 404e305dc58f8ad964a9764ecc433320af17f6e4	fix(ai): review standard 2008 and correct tieji and yiji | PASS |
| standard_2013 | `standard_2013.patch` | 803 | `a70a185ecebb78f2e30afeeea3009b665914fa59f169857081500e9860f8558f` | eba7ded6c925da6b0f8f5ed1812d81d340f0a7e6	fix(ai): review standard 2013 and protect hidden shan in retongji | PASS |
| standard_2019 | `standard_2019.patch` | 666 | `bf843e22e9c7085019bb87f94865d29a6873a1b95c4390a24b576f949a931521` | 959661831683211f3266f8efa4a05a4c91e4e4fa	fix(ai): review standard 2019 and improve jijie and jiyuan scoring | PASS |
| standard_2023 | `standard_2023.patch` | 1554 | `d1b7fa5430b9050e7fbf7b405702c45e4883848619ac7c4633508414940e8074` | 64df8e6dfb09a56430c487b4edd378edd973fef7	fix(ai): review standard 2023 and correct xiaoguo and recovery choices | PASS |
| shenhua_lin | `shenhua_lin.patch` | 1953 | `ae017875df282cc852cf3a11d4530fb15d906b6c7cdbf87b44a5ea9d09f0bc67` | 22e19db1a82c8555a5fa22332a1a409d48be90fe	fix(ai): review shenhua lin and correct dimeng roulin and luanwu | PASS |
| shenhua_shan | `shenhua_shan.patch` | 2240 | `b74fd8d3eec392e7fa9b4e491ad86646705b3b072aea08f5f44d14b19c6abf15` | f091f79ecdd1cd0a4c527a81936f41e1cafba2e7	fix(ai): review shenhua shan and protect hidden response and compare cards | PASS |
| shenhua_yin | `shenhua_yin.patch` | 914 | `f83fb96114f9b2aa20672f14f6f901c40e71fbcbb4e9a6f620eb4ac9b86b3747` | b79ce0ce3db1d136ec8d8e2e78017d31454b2527	fix(ai): review shenhua yin and correct kuizhu and mingren choices | PASS |
| refresh_huo | `refresh_huo.patch` | 596 | `7d7cf2c6b83623deb2e9b7ec10e60d17d26ca949efd1f849a996254f7c707d88` | dcf0dd3d2d9b031c60521ce50ed98cb32e9bef52	fix(ai): review refresh huo and score oljieming by max hp | PASS |
| refresh_lin | `refresh_lin.patch` | 4031 | `8c3e6c8c138460bb7ef920934a526cf47a7d0029414cce0e3a460abe820ef26c` | 92214435d6e98410808eb75613d9028ec91f51fc	fix(ai): review refresh lin and correct olhaoshi and oldimeng | PASS |
| refresh_shan | `refresh_shan.patch` | 4570 | `306431fa8e7246d2eb3225fc49fbda7a1071cc7940b7ce25708f7549bad54a6e` | a9031aade343ef3e219e733297708ada59a8383b	fix(ai): review refresh shan and correct huashen and zhiba scoring | PASS |

## 应用/撤销

```bash
git -c core.autocrlf=false apply --check <补丁>
git -c core.autocrlf=false apply <补丁>
node --check character/standard.js  # 按补丁触及文件
git -c core.autocrlf=false apply -R --check <补丁>
git -c core.autocrlf=false apply -R <补丁>
```

累计顺序：`standard_2008 → standard_2013 → standard_2019 → standard_2023 → shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan`。

## 验收证据

| 文件 | 大小(B) | SHA256 |
| --- | ---: | --- |
| `docs/remaining-ten-packs-acceptance/phase1/phase1-report.md` | 3383 | `caa502bd0a0326dcf805b202c1209cbe02a12be5bc68ba0a24f0e873bdf90284` |
| `docs/remaining-ten-packs-acceptance/phase1/phase1-results.json` | 61307 | `4ecc114142fe5fb44fd707bef1864160d082f6af83a1bfbb247040f64445526b` |
| `docs/remaining-ten-packs-acceptance/phase2/real-host-report.md` | 10886 | `2e814d815cac67202135c4a9fc4fcd1fac7c691e7a748649eb2a7ff40f16b67e` |
| `docs/remaining-ten-packs-acceptance/phase2/real-host-summary.json` | 11476 | `d49f9d5b82bb8b8ebe822f314df9f1fc97b577cee706633204fcbe05fbd790b6` |
| `docs/remaining-ten-packs-acceptance/host/evidence/real-host-clean.json` | 50350 | `d0fc87472e65b69a56b64a80a021048816f37ae05628b1923f648f3b060845c3` |
| `docs/remaining-ten-packs-acceptance/host/evidence/real-host-patched.json` | 49961 | `83548fca5c267cd38225b61fb8c9a38eaaa3137fd477aa86ff0ff55822b99c25` |
| `docs/remaining-ten-packs-acceptance/host/run-host.mjs` | 24050 | `19d2eccbc74bcdd91ac200a764213cc47837117c61945ec98342384ec56a299f` |
| `docs/remaining-ten-packs-acceptance/host/ten-pack-scenes.mjs` | 23452 | `26d0eb6912a3044098a98b0722bf1c756ccf1ebecba2d6253b1c412b485f7ce0` |
| `docs/remaining-ten-packs-acceptance/host/edge-scenes.mjs` | 38000 | `11dafe48607958a70551cfef366f28edce8991da426a6ed0ec38b1c0e7d42434` |
| `docs/remaining-ten-packs-acceptance/host/evidence/edge-clean.json` | 56362 | `0174f815389c1ece87e4a325c2f8836194917acb0993a671a3778c3d8b9ddcf1` |
| `docs/remaining-ten-packs-acceptance/host/evidence/edge-patched.json` | 53734 | `6fd065b1979b6af83a39aa61df165471d6069d75901497c70d7d8c7db470b810` |
| `docs/remaining-ten-packs-acceptance/phase2b/real-host-edge-report.md` | 15748 | `9d673a0cfb3d25e6e7be3a349d26128f826182149ba8342f5a07265cd01ba890` |
| `docs/remaining-ten-packs-acceptance/phase2b/real-host-edge-summary.json` | 25307 | `64a54ea3276fe9766b19e2361c27ae4f23128368ccfde76d1d29475ad460dc32` |
| `docs/remaining-ten-packs-acceptance/phase2b/build-edge-report.mjs` | 9248 | `b02c30fc8cc0bb996724e028d4898294414f0cb1787a45c1da31c959a08ed0a2` |

## 第二阶段专项验收（2026-11-13）

`phase2b/real-host-edge-report.md` 与 `phase2b/real-host-edge-summary.json` 覆盖 4 项未决技能和 3 个宿主边界：

- `dimeng`：真实 `chooseTarget` 空候选在干净宿主抛 `countCards` TypeError；补丁正常取消。合法非空候选选中双目标并完成手牌交换，结算不变。
- `tuntian`：公开信息相同、隐藏牌面不同（杀+桃 / 杀+杀 / 闪+桃）时，干净宿主 `juedou` 估值 1/2 随暗牌变化；补丁稳定为 0.9881。
- `olhaoshi`：并列最低目标首位为敌方时，干净宿主 `ai1=0.1667` 且漏掉友方；补丁 `ai1=2`。援助回调干净宿主不交闪，补丁交闪。
- `rehuashen`：合法池两轮 `phaseBegin/phaseEnd` 选择完成；干净 cond 为 `phaseBegin/phaseEnd`，补丁为 `in/out`，且只选 map 内合法技能；人工空池干净返回“制衡其他化身”，补丁 `cancel2`。
- `qizhi`：全部牌受保护时仍摸 1 张（宿主原生 P2）。
- `reqiaobian`：过滤器复用 `reqiaobian_judge` 上下文，draw 上下文可弃时漏触发；仅 judge 可弃时安全取消（宿主原生 P2）。
- `feijun`：支付前 AI 返回空、漏估；支付后实际取得 1 张并触发兵略摸 2；无目标安全结束（宿主原生 P2）。

`qizhi`、`reqiaobian`、`nzry_feijun` 均不出现在十份补丁中；三者为宿主原生边界，不作为补丁回归。

## 状态与限制

- Phase 1：十份补丁独立/累计应用、四文件语法、逆向恢复、原始字节恢复、HEAD 一致性、LF 检查全部 PASS。
- 真实宿主第一阶段：16 项 PASS、2 项 INCONCLUSIVE、2 项 NOT TESTED；第二阶段专项验收已解决四项阻塞。
- 十包原生 AI 补丁范围：**10/10 PASS**；无未关闭 P0/P1；`shenhua_lin`、`shenhua_shan`、`refresh_lin`、`refresh_shan` 已从 PARTIAL 更新为 PASS。
- **P2 未清零**：`qizhi`、`reqiaobian`、`feijun` 三项宿主原生 P2 保留；`rehuashen` 空池本轮仅人工构造、正常 init 抽 3 成功、角色池耗尽未验证；开发台账其他 P2 未逐项重审。
- **未执行十包原生 + 旧六包扩展的受支持组合测试；不宣布十六包全量兼容 PASS。**
- 未 push、未合并、未创建 Release/Tag；开发分支未被修改。

开发 HEAD：`1598a41cb7fb1ca03607657da2e6550f72ebe0cb`；验收分支：`codex/remaining-ten-packs-acceptance`。
