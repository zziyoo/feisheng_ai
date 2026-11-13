# Phase 1 - 十份原生补丁独立与累计应用检查

生成时间：2026-11-13T09:11:07.941Z

## 宿主原始文件

| 文件 | 期望 SHA256 | 实际 SHA256 | 结果 |
| --- | --- | --- | --- |
| `character/standard.js` | `2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63` | `2b033c6e832fbfa72f477bf65739f63d5f9c986fe4b93c61c8d12b9a3b06bf63` | PASS |
| `character/shenhua.js` | `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e` | `62f789e336a11a0613c68f3309ebc81640f53b4baf6c07cacde99992284e813e` | PASS |
| `character/refresh.js` | `25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0` | `25c573b2c86baad3d3dc75cbb535794d4c27b6b22b52055a914bca1f2ddbd0e0` | PASS |
| `character/sp.js` | `f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea` | `f533db6e050937c406153b73deb51bd2b94ca5b1b868c3b0764956a0b66284ea` | PASS |
| `character/tw.js` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` | PASS |

## 单包检查

| 分包 | apply --check | apply | node --check | reverse --check | reverse | 原始字节恢复 | 工作区干净 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| standard_2008 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| standard_2013 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| standard_2019 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| standard_2023 | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| shenhua_lin | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| shenhua_shan | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| shenhua_yin | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| refresh_huo | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| refresh_lin | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| refresh_shan | PASS | PASS | PASS | PASS | PASS | PASS | PASS |

## 累计应用

| 步骤 | 包 | apply --check | apply |
| ---: | --- | --- | --- |
| 1 | standard_2008 | PASS | PASS |
| 2 | standard_2013 | PASS | PASS |
| 3 | standard_2019 | PASS | PASS |
| 4 | standard_2023 | PASS | PASS |
| 5 | shenhua_lin | PASS | PASS |
| 6 | shenhua_shan | PASS | PASS |
| 7 | shenhua_yin | PASS | PASS |
| 8 | refresh_huo | PASS | PASS |
| 9 | refresh_lin | PASS | PASS |
| 10 | refresh_shan | PASS | PASS |

- 四文件语法检查：PASS
- 逆向撤销：PASS
- 撤销后原始字节：PASS
- 撤销后工作区干净：PASS

## HEAD / 行尾 / 结算改动

- 十份补丁的工作树 blob 与 `HEAD:docs/remaining-ten-packs/native/*.patch` **10/10 一致**；每份补丁均有对应开发提交。
- 十份补丁与宿主五个文件均为 **LF**；`.gitattributes` 为 `*.patch text eol=lf`；无 CRLF 兼容问题。
- 逐包与累计 diff 均未发现新增/删除行触及 `content`、`useCard`、`useSkill`、`damage`、`recover`、`draw` 等结算入口；改动集中在 AI 评分、发动检查、目标评估和标签过滤。
- 累计应用统计：4 个文件，79 insertions / 82 deletions；十份补丁按声明顺序无同位置冲突。
- 注意：静态应用通过不等于真实宿主行为通过；第三阶段仍需验证实际技能调用链。

## 证据

- `phase1-results.json`：逐包 apply/reverse/node/diff 原始输出。
- 补丁 `.gitattributes` 为 `*.patch text eol=lf`；十份补丁与宿主五个文件均为 LF。
