# 交付产物与构建来源

稳定基线 `312adf3cc56421708cc46a5566d9b41fd1236783`，历史组合运行验收 `640b736a9e1872fdd63eac443b2596ca7bb8b1b5`。六包封版 `75eb630`、十包开发 `1598a41`、十包独立验收 `d6fffc7` 均为祖先。独立神话雷历史证据保留于 `codex/shenhua-lei-acceptance@8869f1d`。

见 [ARTIFACTS.json](ARTIFACTS.json) 和 [ARTIFACTS.csv](ARTIFACTS.csv) 的 16 个条目。每个条目包含相对路径、新旧 SHA256、字节数、源码提交、ZIP 构建提交和验收提交。原生补丁直接导出 Git blob，构建提交字段为空。变更项记录本次独立复验使用的完整运行提交。整体验收未通过时，变更项组合验收提交为空。

## 变更的三个产物

- `native/shenhua_yin.patch`，914 → 3910 字节。旧 `f83fb96114f9b2aa20672f14f6f901c40e71fbcbb4e9a6f620eb4ac9b86b3747`，v3 `1db10db4b940a0d92970dc7b445fc1e21d44e794dd9b50264ba5aa2aa8a5c760`。源码 `47228bd31e1f11dd698d64609a5750527fe04219`。
- `native/refresh_shan.patch`，4570 → 6380 字节。旧 `306431fa8e7246d2eb3225fc49fbda7a1071cc7940b7ce25708f7549bad54a6e`，v3 `1ab04891fe444a7302e2db6e33756f00e2bb1418b100958122e9744c9bf8a599`。源码 `235aea098d8c957ea4ccf6b318288c784011b188`。
- `packs/feisheng-ai-shenhua-lei.zip`，257628 → 260363 字节。旧 `c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277`，v3 `40d9ef55299319e9337c2b767e6220536ba32c3de0d0f05e8681611a0db9a6f4`。源码 `ce04040726e23e02fd4903eed5158f2ee72da395`。

## 复现方式

其余五份 ZIP 和八份补丁沿用历史封版原字节。六 ZIP 的 source/ 直接 Git blob 已逐条比较；各含一份生成注册表，按清单和安装验签核对。历史构建器、配置、测试快照和归档元数据仍分别绑定各自构建提交。当前 HEAD 不能一键字节重建所有历史 ZIP。

雷 ZIP 以历史密封 ZIP 为输入，按下列命令构建。需使用 Python 3 和相同压缩运行环境。构建器提交 `77234ac782d492f6a851792fa5af38f06231c825`。两份运行文件、辅助源码补丁两段、安装所需 pack_files 哈希及候选元数据为新归档内容，其他成员字节沿用封版。候选内层保留阶段性元数据，外部回执继续 pending。

```sh
python tools/build-shenhua-lei-v3.py --sealed <稳定版雷ZIP> --source-head ce04040726e23e02fd4903eed5158f2ee72da395 --output <新雷ZIP>
python tools/verify.py --zip <新雷ZIP>
```

## 证据定位

- 十包独立报告 `d6fffc7:docs/remaining-ten-packs-acceptance/DELIVERY.md`。
- 六包构建、包级报告和独立分支见 `312adf3:docs/SIX_PACK_FINAL_DELIVERY_V2.md`。
- 组合和回滚证据见 `640b736:docs/sixteen-packs-acceptance/`。历史交付目录的 45 项校验全部重核通过。
- 本次实测日志在 [evidence](evidence/README.md)。已修改行为的旧记录仅作对照。
