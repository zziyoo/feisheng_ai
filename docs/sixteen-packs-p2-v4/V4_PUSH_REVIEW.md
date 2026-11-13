# v4 推送前审查

本文件只收口来源、产物和 Git 拓扑，不重新开发技能，不重建 ZIP。运行代码和 ZIP 与验收时一致；本次仅补充来源澄清文档和本审查记录。

## 1. 推荐推送

- 主推单个分支：`codex/sixteen-packs-v4-acceptance`。
  - 该分支包含完整 v4 开发链、构建/测试提交、验收记录提交和本 docs-only 审查提交。
  - 推送该分支即可保留 `codex/sixteen-packs-p2-final-v4` 的全部提交，但不会在远端创建同名开发分支引用。
- 可选补充推送：`codex/sixteen-packs-p2-final-v4` @ `b1719c3c82228ffbcf344a81f2bc109a398578a2`（仅开发分支，不含验收记录）。
- 远端当前不存在这两个同名分支（`git ls-remote --heads origin` 为空），可用普通 `git push`，不需要 force。
- 不合并 master；不创建 PR、Release 或标签。

## 2. 提交与祖先关系

v4 开发链（均在 `codex/sixteen-packs-v4-acceptance` 的祖先中）：

```text
c5ec662  v3 基线（codex/sixteen-packs-p2-hardening-v3）
  └─ 1745671  fix(ai): correct xiongluan target evaluation
      └─ 64161da  fix(ai): preserve productive crossbow in qiangxix
          └─ d45f2b5  fix(ai): recognize reachable long-range reqimou attacks
              └─ e8be6b3  fix(ai): improve zuilun fair card selection
                  └─ 69ed074  fix(ai): retain critical armor in twjuxiang
                      └─ b1719c3  docs(ai): hand off sixteen-pack v4 P2 fixes
                          └─ 1dfac6f  build(accept): derive v4 packs from sealed v3 archives
                              └─ 4745865  test(accept): add v4 real-host five-fix scenes
                                  └─ 5206c5e  test(accept): record sixteen-pack v4 independent acceptance
                                      └─ docs(accept): trace v4 source and push review（本文件所在提交）
```

本次 docs-only 审查提交的完整哈希以 `git rev-parse codex/sixteen-packs-v4-acceptance` 为准；为避免文件自引用，正文不重复自身哈希。交付报告同时给出该完整哈希。

- 验收对象开发 HEAD：`b1719c3c82228ffbcf344a81f2bc109a398578a2`。
- 构建提交：`1dfac6ff0dbe5be9a5ff7a249ff34d9b86631a40`（仅新增 `tools/build-v4-pack.py`、`tools/install-six-v4.py`）。
- 测试提交：`4745865`（仅新增 `tools/v4-host-runner-debug.mjs`、`tools/v4-host-scenes.mjs`）。
- 验收记录提交：`5206c5eb170f715432a7cbf259896a9fbf57670e`（仅新增 v4 报告、证据和四项测试工具；不改运行代码、原生补丁或 ZIP）。
- 本次审查提交只改文档并补入 `evidence/v4-xiongluan-direction.json`、`evidence/README.md`、`ARTIFACTS.*`、`SHA256SUMS.txt`，不改运行代码或 ZIP。
- 五项修复提交均只改对应运行文件和测试/测试配置；未改十份原生补丁、共享协调器或安装器。
- 25b9503（神话风运行源码）和 9699b92（镇骨接线）均为 c5ec662 的祖先，包含在 v4 开发链中。

## 3. 侧枝引用（不合并）

- `codex/zhengu-experiment` @ `3e7bc7c9f326daf0234da1959cdb7fa95034382c`：独立的镇骨真实宿主实验分支，改过 `shenhuaLei.js`。其 `installZhengu` 函数体与已合入主线的 `9699b92` 逐字一致；v4 已包含该实现，没有遗漏的 v4 修复。不要盲目合并该实验分支。
- `codex/shenhua-lei-acceptance` @ `8869f1dbdd4ea53969d1711455b4299515e81ade`：v3 神话雷验收侧枝，不是 v4 祖先；v4 通过 v3 封版 ZIP 引用其字节，不需要合并。
- `codex/release-v4.4.4` @ `3fefae2`：不屈候选的独立发布实验，和本次十六包 v4 五项修复无关，不合并。
- `codex/sixteen-packs-final-integration` @ `312adf3` 是 c5ec662 的祖先，六包共享机制和已验收字节未被 v4 回退。

## 4. 产物锁定

六个最终 ZIP：

| 分包 | 大小 | SHA256 | v4 状态 |
| --- | ---: | --- | --- |
| `refresh_standard` | 114,963 | `b148f29c94768347eaf24984b6e14c73174bf482fd96d72ce717b4e9afa4ccd0` | 沿用 v3 字节 |
| `refresh_feng` | 92,832 | `1d12d8b6c37244b3d790eaaea003a0747728856e4d0ce61835c72846012956e3` | v4 新产物（界奇谋 + 双风 peer） |
| `shenhua_feng` | 93,478 | `3b0536f41c907942bcee8e99a6acdde6311f4601bd9e16f1ee118530ccc52ed8` | v4 新产物（仅双风 peer） |
| `shenhua_huo` | 256,869 | `5e1f2d0643b145c6aa76458a972a60ec579968be71813fbb7b4c08aa189af250` | v4 新产物（强袭） |
| `shenhua_lei` | 265,344 | `bdfca87fd1072c63302f13bb5cf4ebf8f244b010226800a14ceba76916494e72` | v4 新产物（雄乱/罪论/踞襄） |
| `out_of_scope` | 200,828 | `f1d06169b53dd908205224e46f403ac97c2db0f6717d47fad1897e0fe1b7a79d` | 沿用 v3 字节 |

- 十份原生补丁逐字节等于 v3，不自动回退到 v2。相对 v2 真正变化的是 `shenhua_yin.patch`（`1db10db4…`）和 `refresh_shan.patch`（`1ab04891…`）；若出现 `f83fb961…` 或 `306431fa…` 即为旧 v2 回退，当前交付目录没有。
- 双风 peer 哈希：
  - `refreshFeng.js` = `5ee2bac6f5454db7670c564aa98b3565c5ab6c3ba54fb7881a6e2d17a674288c`
  - `shenhuaFeng.js` = `deb67719192d27dcf057d670d822f31e734cb53490a44d197f5ad9cdb7577ffd`
  - 两侧 `wind_compatibility.peer_sha256` 互指上述文件；不含旧界风 `19308555…` 或旧神话风 `dcfac0a3…`。
- `ARTIFACTS.csv` / `ARTIFACTS.json` 共 16 条（六 ZIP + 十原生补丁），全部与实际文件大小和 SHA256 一致。
- `SHA256SUMS.txt` 覆盖交付目录除自身外的全部文件，本次审查后重新生成并复核。

## 5. 工作区与保护

- 验收工作树：`C:/Users/32360/.codex/worktrees/sixteen-packs-v4-acceptance`；本次审查前为 clean，提交后复核。
- 未触碰主工作区未提交改动；未修改 v3 开发分支、v3 交付目录或 v4 交付 ZIP。
- v3 交付目录 `C:/Users/32360/Desktop/feisheng-ai-sixteen-packs-final-v3/` 原样保留；v4 交付目录为 `C:/Users/32360/Desktop/feisheng-ai-sixteen-packs-final-v4/`。

## 6. 剩余限制（继续保留）

- 雄乱：共享引擎泛用静态画像仍可能标成支援；未测环境不覆盖。
- 强袭：只保护 4HP、唯一诸葛连弩、至少两次额外有效攻击的窄场景；其他武器/低血/无目标保持原生。
- 罪论：真实公开选牌流程和暗手牌 A/B 不变量已验证；v3 在同一公开 fixture 结果相同，隐藏信息差异未由真实宿主复现，只由确定性隐藏 getter/静态路径测试覆盖；动态牌值/未知判定按 0。
- 踞襄：只保护一血空手唯一八卦/仁王、健康主公空防具栏、有敌方威胁的窄场景。
- 界奇谋：只关闭长兵器射程漏判；3HP 无明确击杀保守阈值、救援和后续事件估计保留；原生补丁未同步。
- 奇制：AI 全保护跳过保留；玩家手选后“不弃牌仍摸牌”仍是宿主结算残项。
- 未覆盖：Android 真机、真实联机、国战/2v2/斗地主完整组合、全部历史场景矩阵、手动点击级界面验证。
- 十份原生补丁不含 v4 五项扩展优化，不得宣传原生路线包含 v4 修复。
