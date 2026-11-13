# 版本来源与哈希

## 版本链

- v3 基线：`c5ec662359ca0aba9c3e01ff0b40ce9dbfa6c402`。
- v4 开发 HEAD：`b1719c3c82228ffbcf344a81f2bc109a398578a2`（docs-only 交接提交；运行源码为该分支累计结果，五项修复提交见“运行源码与五项修复提交”）。
- v4 构建提交（派生构建器）：`1dfac6ff0dbe5be9a5ff7a249ff34d9b86631a40`。
- 验收分支：`codex/sixteen-packs-v4-acceptance`；最终验收记录提交 `5206c5eb170f715432a7cbf259896a9fbf57670e`；本文件所在提交为 docs-only 来源澄清。

## v3 封版输入（字节源）

| 分包 | v3 ZIP SHA256 |
| --- | --- |
| `refresh_standard` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` |
| `refresh_feng` | `193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef` |
| `shenhua_feng` | `dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c` |
| `shenhua_huo` | `68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d` |
| `shenhua_lei` | `40d9ef55299319e9337c2b767e6220536ba32c3de0d0f05e8681611a0db9a6f4` |
| `out_of_scope` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` |

## v4 最终 ZIP

| 分包 | SHA256 |
| --- | --- |
| `refresh_standard` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` |
| `refresh_feng` | `1d12d8b6c37244b3d790eaaea003a0747728856e4d0ce61835c72846012956e3` |
| `shenhua_feng` | `3b0536f41c907942bcee8e99a6acdde6311f4601bd9e16f1ee118530ccc52ed8` |
| `shenhua_huo` | `5e1f2d0643b145c6aa76458a972a60ec579968be71813fbb7b4c08aa189af250` |
| `shenhua_lei` | `bdfca87fd1072c63302f13bb5cf4ebf8f244b010226800a14ceba76916494e72` |
| `out_of_scope` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` |

## 运行源码与五项修复提交

`b1719c3` 是 v4 开发分支的 docs-only 交接提交，不是五项修复的单一代码提交。最终 ZIP 的运行文件是该分支上的累计结果。各项修复的引入提交、最终 Git blob 和 ZIP 内文件 SHA256 如下；Git blob 是 SHA1 对象名，ZIP SHA256 是文件内容哈希，两者不可直接比较。

| 修复 | 修复提交 | 实际运行文件 | 修复提交时 blob | 最终 blob（b1719c3） | ZIP 内文件 SHA256 | 最终安装态证据 |
| --- | --- | --- | --- | --- | --- | --- |
| 雄乱 | `1745671` fix(ai): correct xiongluan target evaluation | `score/decision/skills/packs/shenhuaLei.js` | `265eae0f8c620f3ff004311612e5b04b6cd92a0d` | `0d81af6136456c85d153cff2ee8c1d5f1fdcc241` | `8ae698e2523a90183b8406f2473ca60ebb801111275e27943acf519cb8116e0a` | `evidence/v4-xiongluan-auto.json`、`evidence/v4-xiongluan-direction.json` |
| 强袭 | `64161da` fix(ai): preserve productive crossbow in qiangxix | `score/decision/skills/packs/shenhuaHuo.js` | `f7a8171c831bd09939e0b9ef1d551047a5daa541` | `f7a8171c831bd09939e0b9ef1d551047a5daa541` | `94addbdee96533c44cf02be12c0fc4586e9bf7c185396bb20c59597c2990d388` | `evidence/v4-qiangxix-zuilun-juxiang.json` |
| 罪论 | `e8be6b3` fix(ai): improve zuilun fair card selection | `score/decision/skills/packs/shenhuaLei.js` | `b2f827f6a138b19eece93976d58dbd6cf58fac7f` | `0d81af6136456c85d153cff2ee8c1d5f1fdcc241` | `8ae698e2523a90183b8406f2473ca60ebb801111275e27943acf519cb8116e0a` | `evidence/v4-qiangxix-zuilun-juxiang.json`、`unit-tests.log` |
| 踞襄 | `69ed074` fix(ai): retain critical armor in twjuxiang | `score/decision/skills/packs/shenhuaLei.js` | `0d81af6136456c85d153cff2ee8c1d5f1fdcc241` | `0d81af6136456c85d153cff2ee8c1d5f1fdcc241` | `8ae698e2523a90183b8406f2473ca60ebb801111275e27943acf519cb8116e0a` | `evidence/v4-qiangxix-zuilun-juxiang.json` |
| 界奇谋 | `d45f2b5` fix(ai): recognize reachable long-range reqimou attacks | `score/decision/skills/packs/refreshFeng.js` | `42fc7a1ec8be1341d2cab68073a24eb54267c9a1` | `42fc7a1ec8be1341d2cab68073a24eb54267c9a1` | `5ee2bac6f5454db7670c564aa98b3565c5ab6c3ba54fb7881a6e2d17a674288c` | `evidence/v4-reqimou.json` |

- `69ed074` 只是最后一笔运行源码（踞襄），不能代表雄乱、强袭、罪论、界奇谋，也不能用这一个简称代表全部运行代码。
- `b1719c3` 的三个运行文件 blob 与最终 ZIP 的 `source/` 逐字节一致：`refreshFeng.js` = `42fc7a1`、`shenhuaHuo.js` = `f7a8171`、`shenhuaLei.js` = `0d81af6`。
- 雄乱/罪论/踞襄共用 `shenhuaLei.js`，后两笔修复会推进同一文件 blob；最终 ZIP 以 `b1719c3` 的累计文件为准。
- 界奇谋 `d45f2b5` 的 `refreshFeng.js` blob `42fc7a1` 与最终 refresh_feng ZIP 的 `source/` 一致（SHA256 `5ee2bac6…`），修复完整进入最终 ZIP。
- 神话风运行 source 仍来自 `25b9503`；v4 ZIP 只更新双风 peer 元数据，未改运行代码。
- 标准/清单外 ZIP 字节沿用 v3。

## 原生补丁与证据

- 十份原生补丁字节与 v3 完全一致，来源提交见 v3 `ARTIFACTS.json`；本轮继承 `native-roundtrip.json` 的应用、语法、重复应用和逆序恢复证据。
- 新执行证据：`evidence/v4-xiongluan-auto.json`、`evidence/v4-qiangxix-zuilun-juxiang.json`、`evidence/v4-reqimou.json`、`evidence/v3-*.json`、`evidence/installer-battery-final-v4.json`、`evidence/install-exact-runtime.json`、`evidence/double-wind.json`、`evidence/zip-verify.json`、`evidence/source-consistency.json`、`unit-tests.log`。
- 构建器：`tools/build-v4-pack.py`；安装测试：`tools/install-six-v4.py`；宿主场景：`tools/v4-host-runner-debug.mjs`、`tools/v4-host-scenes.mjs`。
