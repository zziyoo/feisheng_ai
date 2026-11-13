# 剩余十包独立验收 - 交付产物与兼容性说明

生成时间：2026-11-13T09:44:18.226Z

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
| `docs/remaining-ten-packs-acceptance/phase2/real-host-report.md` | 10456 | `46c6bec70ed4f356ba83c4198b92f7fd5e90e1b7a8098a6b51d1de97aa4750ac` |
| `docs/remaining-ten-packs-acceptance/phase2/real-host-summary.json` | 11476 | `d49f9d5b82bb8b8ebe822f314df9f1fc97b577cee706633204fcbe05fbd790b6` |
| `docs/remaining-ten-packs-acceptance/host/evidence/real-host-clean.json` | 50350 | `d0fc87472e65b69a56b64a80a021048816f37ae05628b1923f648f3b060845c3` |
| `docs/remaining-ten-packs-acceptance/host/evidence/real-host-patched.json` | 49961 | `83548fca5c267cd38225b61fb8c9a38eaaa3137fd477aa86ff0ff55822b99c25` |
| `docs/remaining-ten-packs-acceptance/host/run-host.mjs` | 23225 | `399dcb8adecc47f65eefca91bf8b43c487ee5ca45cac34dcb2d4254d62952842` |
| `docs/remaining-ten-packs-acceptance/host/ten-pack-scenes.mjs` | 23452 | `26d0eb6912a3044098a98b0722bf1c756ccf1ebecba2d6253b1c412b485f7ce0` |

## 状态与限制

- Phase 1：十份补丁独立/累计应用、四文件语法、逆向恢复、原始字节恢复、HEAD 一致性、LF 检查全部 PASS。
- 真实宿主：16 项 PASS、2 项 INCONCLUSIVE（dimeng、tuntian）、2 项 NOT TESTED（olhaoshi、rehuashen）；按分包 6 PASS / 4 PARTIAL。
- **不宣布“剩余10个分包最终内部交付 PASS”**；P0/P1 阻塞项与未覆盖边界见 `phase2/real-host-report.md`。
- 未 push、未合并、未创建 Release/Tag；P2 未关闭；P2 沿用开发台账。

开发 HEAD：`1598a41cb7fb1ca03607657da2e6550f72ebe0cb`；验收分支：`codex/remaining-ten-packs-acceptance`。
