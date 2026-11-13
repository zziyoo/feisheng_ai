# 十六包 v4 部署

## 1. 前置

1. 退出无名杀，备份 `resources/app` 五文件、完整无名 AI 扩展根和 `.djsc-pack-backups/`。
2. 宿主：无名杀 1.11.7，Windows x64，LF 文件；完整扩展基线 `1fe5292eb3022dd8d1db494617b21a12be912e61`。
3. 核对本目录 `SHA256SUMS.txt`；ZIP 内 `pack.json`/manifest 的候选标签是封包快照，最终以本目录报告和 ZIP SHA256 为准。
4. 原生路线与扩展路线二选一；安装前人工确认宿主同技能没有已应用的原生补丁。

## 2. 扩展安装（正式路线）

未接线时，先从任一 ZIP 的 `patches/score-index.diff` 应用一次引擎接线，确认 `score/index.js` 包含 `installSkillAIPolicies`/`uninstallSkillAIPolicies`。

从各 ZIP 解压目录按以下顺序执行（先 `--dry-run`）：

```bash
node integration/apply-pack.mjs --extension-root "<扩展根>" --dry-run
node integration/apply-pack.mjs --extension-root "<扩展根>"
```

```text
refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope
```

- 标准包提供 `skillPlanHints.js`；旧完整引擎缺该文件时，风/火/雷包会安全拒绝。
- 界风 v4 必须在神话风 v4 之前安装；对包哈希不匹配会安全拒绝、零写入。
- 安装后注册表应有六条 import + developer，`policyStats.packs` 为六包集合。

## 3. 原生补丁

按 `standard_2008 → … → refresh_shan` 顺序：

```bash
git -c core.autocrlf=false apply --check "<补丁绝对路径>"
git -c core.autocrlf=false apply "<补丁绝对路径>"
```

应用后对 `character/` 对应文件执行 `node --check`。十份补丁字节与 v3 相同；v4 五项修复不包含在原生补丁中。

## 4. 回滚

扩展逆序：

```text
out_of_scope → shenhua_lei → shenhua_huo → shenhua_feng → refresh_feng → refresh_standard
```

每包从安装它的同一目录运行：

```bash
node integration/rollback-pack.mjs --extension-root "<扩展根>"
```

共享核心和 `skillPlanHints.js` 保留。原生补丁按相反顺序 `git apply -R`，恢复宿主五文件原始哈希。

## 5. 验证边界

- 已验证：Windows x64、Chrome 157、身份局 8 人、完整扩展六包、十补丁字节继承。
- 未验证：Android、真实联机、斗地主/国战/2v2 完整组合、全部历史场景矩阵。
- 不建议把本报告的单模式结论外推到其它模式或设备。
