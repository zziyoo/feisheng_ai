# 六包统一交付 V2 最终收口

日期：2026-11-13  
状态：**内部验收 PASS（限定已验证安装顺序）**；未公开发布、未 push、未创建 Release。

## 正式支持安装顺序

本次六包统一交付正式采用方案 A，唯一支持顺序为：

```text
refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope
```

- 本顺序是正式交付约束；内部验收 PASS 仅适用于该顺序，**不保证任意安装顺序**。
- 新版神话风依赖当前已验收界风先行安装（新神话风声明 `refreshFeng.js d5519b7d…`）。
- 旧顺序 `refresh_standard → shenhua_feng → refresh_feng → …` 会触发双风版本校验拒绝，但为**安全拒绝、零写入**，不会造成半安装状态。
- 本轮未重建 `refresh_feng`，其余五个 ZIP 保持原 SHA256。

## 狂骨 P1

原始【狂骨】P1 已修复并关闭：

- 原场景（3 血/4 上限、赤兔、2 张杀，首次伤害后 `shaReady=1`、`shaUsable=0`）真实宿主收益：`recoverEffect=19.5`、`drawEffect=13`。
- 未修复原生 A、正式双风原生补丁 B、新扩展 D 均选择回复；封版扩展 C 选择摸牌。
- 新扩展规则与正式原生补丁 `xinkuanggu.cost` 公式一致；8 个真实场景逐项一致，19 个规则输入 `new === native_patch` 全部成立。
- 修复提交 `ede9966`，开发 HEAD `25b950356627b9c236c4faf3be82e3481ad09111`。
- 证据：`evidence/kuanggu-four-config.json`、`evidence/kuanggu-rule-matrix.json` 及 A/B/C/D 四配置报告；交付目录内见 `KUANGGU-P1-REPORT.md`。

## 交付物

交付目录：`C:/Users/32360/Desktop/feisheng-ai-six-packs-final-v2-kuanggu-20261113/`

六个最终 ZIP 均为内部验收 PASS，验收范围以交付目录的 `ACCEPTANCE.md` 为准。外部集成回执尚未取得，公开发布状态为未发布。下表哈希以交付目录的 `SHA256SUMS.txt` 及实际 ZIP 字节为准，构建 HEAD 取自各 ZIP 的 `manifest.json`。报告路径相对交付目录，分支引用指向验收记录，可能晚于构建提交。

| 分包 | 最终 ZIP SHA256 | 构建 HEAD | 字节数 | 独立验收来源 |
| --- | --- | --- | ---: | --- |
| shenhua_feng | dcfac0a35ea231c3838912a1681e27006530e5b0d549e94f4a62376e555c658c | 25b950356627b9c236c4faf3be82e3481ad09111 | 92235 | KUANGGU-P1-REPORT.md · codex/kuanggu-acceptance@ac4c4b4 |
| refresh_feng | 193085553119f7cc56769b474994b4f1868439413de7e657811dc1e73b7f70ef | 7d79d8ce218f4ed37eed0dffa2c2c1ac81cfe93e | 90676 | provenance/refresh_feng/ACCEPTANCE-dual-feng.md · codex/dual-feng-compat@7d79d8c |
| shenhua_huo | 68a180f26cb47f33ffe6ff7af95ff3cb2767d1dfd0de829611f6380173e43f0d | 4fb57e10dd4077cf2cfa39f5ad2783e61ce69cd3 | 253547 | provenance/shenhua_huo/ACCEPTANCE.md · codex/shenhua-huo-acceptance@3087c02 |
| shenhua_lei | c8fc8befd55f03734e10429bb85785a977f4860afde1a6b4bc7d66f99783f277 | ca9d2d221a02920f34aef99614245f2e20a4a8c1 | 257628 | provenance/shenhua_lei/ACCEPTANCE.md · codex/shenhua-lei-acceptance@8869f1d |
| refresh_standard | b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0 | 0fa2c075aa9bcb86c9c6c34f65d8c62b0b3845ea | 114963 | provenance/refresh_standard/ACCEPTANCE.md · codex/refresh-standard-acceptance@0fa2c07 |
| out_of_scope | f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d | 56735aea155040c70ee621e232ed96dce021b57a | 200828 | provenance/out_of_scope/ACCEPTANCE.md · codex/out-of-scope-acceptance@a863553 |

原神话风封版 ZIP 保持 `7a45c323876f8b1af9408c9c4bb86388e839c13c51ef31e28aded0a2076e8ac9`，保留在上一版交付目录，未覆盖。

标准包归档保留 `can_mark_deliverable=false` 和「封包待验收」等构建时字段，最终内部 PASS 由其独立报告绑定到该 ZIP 的精确 SHA256。其他五包的归档标记为「可交付」或「内部验收通过」。神话风的行为验收使用 `50429c24…` 候选，最终 ZIP 保留运行字节，收口状态与证据元数据后另做 ZIP 和安装事务检查。

## 旧台账与生成器

`docs/skill-ai-20261030/pack-delivery.json` 和 `142-task-list.json` 保留历史构建状态，最终交付查询以本页为准。两份 JSON 的生成关系如下。

- `tools/build-skill-ai-task-list.py` 读取 `pack-delivery.json` 的交付条目，复制到任务清单，并据其状态生成分包状态。
- `tools/build-skill-ai-pack.mjs` 读取任务清单的技能记录和状态，生成包说明、清单和 manifest，且部分构建会写回 `pack-delivery.json`。
- `tools/build-repair-package.mjs` 将两份 JSON 原样收入修复总包，并读取 `pack-delivery.json` 的阶段包状态生成 manifest。
- 历史 Markdown、审查说明和范围记录中的引用用于定位原始快照。

原地替换旧状态会改变构建输入。即使只替换哈希，修复总包收录的 JSON 字节也会变化。因此本页集中记录最终交付状态，保留旧台账和历史验收记录。

## 验证摘要

- 六包组合验收（正式支持顺序）：`pass=true`；六包加载、双风共存、关键修复、逆序全量回滚、回滚后宿主加载通过。
- 安装事务电池（最终神话风 ZIP）：9/9 PASS。
- 镇骨六包安装态专项：`errors=[]`、`benignErrors=[]`、`zhenguScoreCalls=136`、`zhenguFallbacks=0`、`zhenguHookConflict=0`。
- 旧双风顺序拒绝：`zero_write=true`、`reject_reason_matched=true`。
- 最终神话风 ZIP：`verify.py` 29/29；`source/` 与开发 HEAD `25b9503` 的 Git blob 一致。

## 限定

- 不支持原生补丁与对应扩展重复接管（同一分包/同一技能二选一）。
- 六个原生补丁同时叠加不是受支持配置。
- 不代表 Android、联机、斗地主/国战/2v2 及其他未测模式全部通过。
- 尚未公开发布。
