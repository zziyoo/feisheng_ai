# 来源、版本与产物对应

## 仓库

- `origin`：`https://github.com/zziyoo/feisheng_ai.git`
- 六包封版：`codex/six-pack-final-integration-v2` @ `75eb630fd259def3f42afea8f9bbb823a9eb71af`
- 十包开发：`codex/remaining-ten-packs` @ `1598a41cb7fb1ca03607657da2e6550f72ebe0cb`
- 十包验收：`codex/remaining-ten-packs-acceptance` @ `d6fffc7fb2b4ae34e4bd49fd60d18e270cdc2a94`
- 本集成：`codex/sixteen-packs-final-integration`（从 `d6fffc7` 建立）

祖先关系：六包封版 → 十包开发 → 十包验收 → 本集成，均为真。

## 六份扩展 ZIP

来源目录：`C:/Users/32360/Desktop/feisheng-ai-six-packs-final-v2-kuanggu-20261113/packs/`。交付 ZIP 为原文件复制，未重建、未修改。

| 分包 | ZIP | SHA256 | 构建 HEAD |
| --- | --- | --- | --- |
| `shenhua_feng` | `feisheng-ai-shenhua-feng.zip` | `dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c` | `25b9503` |
| `refresh_feng` | `feisheng-ai-refresh-feng.zip` | `193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef` | `7d79d8c` |
| `shenhua_huo` | `feisheng-ai-shenhua-huo.zip` | `68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d` | `4fb57e1` |
| `shenhua_lei` | `feisheng-ai-shenhua-lei.zip` | `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277` | `ca9d2d2` |
| `refresh_standard` | `feisheng-ai-refresh-standard.zip` | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` | `0fa2c07` |
| `out_of_scope` | `feisheng-ai-out-of-scope.zip` | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` | `56735ae` |

六包共同基线：`1fe5292eb3022dd8d1db494617b21a12be912e61`。

## 十份原生补丁

来源：十包开发/验收分支 `docs/remaining-ten-packs/native/`。

| 分包 | 文件 | SHA256 | 开发提交 |
| --- | --- | --- | --- |
| `standard_2008` | `standard_2008.patch` | `d0e233259a1db09c9bfa3e4c686ea4a361bff6956edbadaca1c5341bcea410db` | `404e305dc58f8ad964a9764ecc433320af17f6e4` |
| `standard_2013` | `standard_2013.patch` | `a70a185ecebb78f2e30afeeea3009b665914fa59f169857081500e9860f8558f` | `eba7ded6c925da6b0f8f5ed1812d81d340f0a7e6` |
| `standard_2019` | `standard_2019.patch` | `bf843e22e9c7085019bb87f94865d29a6873a1b95c4390a24b576f949a931521` | `959661831683211f3266f8efa4a05a4c91e4e4fa` |
| `standard_2023` | `standard_2023.patch` | `d1b7fa5430b9050e7fbf7b405702c45e4883848619ac7c4633508414940e8074` | `64df8e6dfb09a56430c487b4edd378edd973fef7` |
| `shenhua_lin` | `shenhua_lin.patch` | `ae017875df282cc852cf3a11d4530fb15d906b6c7cdbf87b44a5ea9d09f0bc67` | `22e19db1a82c8555a5fa22332a1a409d48be90fe` |
| `shenhua_shan` | `shenhua_shan.patch` | `b74fd8d3eec392e7fa9b4e491ad86646705b3b072aea08f5f44d14b19c6abf15` | `f091f79ecdd1cd0a4c527a81936f41e1cafba2e7` |
| `shenhua_yin` | `shenhua_yin.patch` | `f83fb96114f9b2aa20672f14f6f901c40e71fbcbb4e9a6f620eb4ac9b86b3747` | `b79ce0ce3db1d136ec8d8e2e78017d31454b2527` |
| `refresh_huo` | `refresh_huo.patch` | `7d7cf2c6b83623deb2e9b7ec10e60d17d26ca949efd1f849a996254f7c707d88` | `dcf0dd3d2d9b031c60521ce50ed98cb32e9bef52` |
| `refresh_lin` | `refresh_lin.patch` | `8c3e6c8c138460bb7ef920934a526cf47a7d0029414cce0e3a460abe820ef26c` | `92214435d6e98410808eb75613d9028ec91f51fc` |
| `refresh_shan` | `refresh_shan.patch` | `306431fa8e7246d2eb3225fc49fbda7a1071cc7940b7ce25708f7549bad54a6e` | `a9031aade343ef3e219e733297708ada59a8383b` |

## 宿主

- 无名杀 1.11.7，Windows x64，LF 检出。
- 干净五文件哈希与补丁后哈希见 `phase1/artifacts-baseline.json`。

## 未做

- 未修改、未重建六包 ZIP；未修改六包已有提交；未修改十包开发/验收分支。
- 未 push、未合并、未创建 PR/Release/Tag。
- 未生成新的扩展 ZIP；未把十份原生补丁包装成扩展。
