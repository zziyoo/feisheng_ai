# 十六包受支持部署流程

本流程是本轮唯一实际执行并通过的组合配置。不是任意顺序、任意版本混装的通用说明。

## 0. 基线

- 宿主：无名杀 1.11.7（Windows x64，LF 检出）。
- 扩展目标：上游 `1fe5292eb3022dd8d1db494617b21a12be912e61` 的完整无名AI扩展根（含 `score/index.js`）。
- 十个原生补丁：`native/` 下十份，来自开发分支 `codex/remaining-ten-packs` HEAD `1598a41cb7fb1ca03607657da2e6550f72ebe0cb`。
- 六个扩展 ZIP：`packs/` 下六份，与六包封版 `feisheng-ai-six-packs-final-v2-kuanggu-20261113` 字节一致。
- 不包含六包自己的原生补丁路线；它们与对应扩展二选一，不得叠加。

## 1. 备份与安全前提

1. 退出无名杀；备份宿主 `character/` 五文件和扩展根、`.djsc-pack-backups/`。
2. 确认宿主五文件为干净 1.11.7 基线：
   - `character/standard.js` `2b033c6e…`
   - `character/shenhua.js` `62f789e3…`
   - `character/refresh.js` `25c573b2…`
   - `character/sp.js` `f533db6e…`
   - `character/tw.js` `356ab5d7…`
3. 确认扩展根是 LF 检出；安装器会按共享核心哈希拒绝 CRLF 或第三方修改，且零写入。

## 2. 应用十份原生补丁

从宿主的 `resources/app` 目录执行，顺序固定：

```text
standard_2008
standard_2013
standard_2019
standard_2023
shenhua_lin
shenhua_shan
shenhua_yin
refresh_huo
refresh_lin
refresh_shan
```

每份：

```bash
git -c core.autocrlf=false apply --check "<补丁绝对路径>"
git -c core.autocrlf=false apply "<补丁绝对路径>"
```

全部应用后：

```bash
node --check character/standard.js
node --check character/shenhua.js
node --check character/refresh.js
node --check character/sp.js
```

期望补丁后哈希：

| 文件 | SHA256 |
| --- | --- |
| `character/standard.js` | `614be8c1ee9bcf82e37477ab9a09f1e781dbe2f32c77aa9725446e1689bc9b48` |
| `character/shenhua.js` | `7b7bb42574cbe06283505e7417217af8e6691aee4f1d824ae61ca6cd28d3a3ed` |
| `character/refresh.js` | `73fd1f6c1ee90bb6a6e35591249415dd4f23f51fd38864c9d01c9471735e3e01` |
| `character/sp.js` | `8386e05b611762321acf1730e1387231bb947fae32884335acbd975c8a654e2f` |
| `character/tw.js` | `356ab5d74342073f891981fce7014e76d1c59a3ebf2da35315a1f222baf3cb20` |

## 3. 接线扩展目标

在干净扩展根应用一次接线补丁（六个 ZIP 内的 `patches/score-index.diff` 字节一致）：

```bash
git apply "<任一分包>/patches/score-index.diff"
```

接线后 `score/index.js` 应同时包含 `installSkillAIPolicies` 与 `uninstallSkillAIPolicies`。  
如果目标已有接线，跳过此步。

## 4. 按正式顺序安装六个扩展

把每个 ZIP 解压到独立目录，从该目录执行：

```bash
node integration/apply-pack.mjs --extension-root "<扩展根>" --dry-run
node integration/apply-pack.mjs --extension-root "<扩展根>"
```

顺序固定，不得调换界风与神话风：

```text
1. refresh_standard
2. refresh_feng
3. shenhua_feng
4. shenhua_huo
5. shenhua_lei
6. out_of_scope
```

安装后检查：

- `score/decision/skills/skillAIPolicyPacks.js` 有六条唯一导入；
- 共享核心哈希：
  - `policyCore.js` `545ee71d2b0affee2cbf561f16cd0ff30db07b170353ccc018db47e1fba49b19`
  - `skillAIPolicies.js` `46b47ef904eaf7ae56a818816ecc042c351747b5a69594f1ce4b938af4aa42ad`
  - `skillVetoRegistry.js` `ed8f6022db879b133447077cf712bad9e955fae2ebdf27fd14d38680c997aac2`
- `skillPlanHints.js` 由 `refresh_standard` 提供并保留；本组合未确认 1fe5292 完整引擎对它的接线，见 P2。

## 5. 启动与验收

宿主启动后加载扩展根；本轮真实宿主证据使用：

- 身份局 8 人，seed `20261030`；
- Chrome 157 + Playwright；
- 六包注册表六条导入，`policyStats.packs` 同时出现六个包；
- 十包固定场景与六包默认场景并集通过。

## 6. 回滚

### 6.1 六包逆序回滚

从各包解压目录执行，顺序：

```text
out_of_scope → shenhua_lei → shenhua_huo → shenhua_feng → refresh_feng → refresh_standard
```

```bash
node integration/rollback-pack.mjs --extension-root "<扩展根>"
```

每个 ZIP 的安装器和回滚器必须来自该 ZIP 自身目录；不要混用不同版本的回滚器。  
回滚后注册表应为空；共享核心与 `skillPlanHints.js` 保留。

### 6.2 十补丁逆序撤销

从宿主 `resources/app` 执行，顺序为应用顺序的逆序：

```text
refresh_shan → refresh_lin → refresh_huo → shenhua_yin → shenhua_shan → shenhua_lin → standard_2023 → standard_2019 → standard_2013 → standard_2008
```

```bash
git -c core.autocrlf=false apply -R --check "<补丁绝对路径>"
git -c core.autocrlf=false apply -R "<补丁绝对路径>"
```

撤销后五文件必须恢复第 1 节原始哈希。

## 7. 受支持与不受支持

**支持**：十份剩余分包原生补丁 + 六份扩展分包，按上述顺序；六包共享核心一致；同宿主不叠加六包原生补丁。

**不支持**：

- 六包原生补丁与对应扩展同装；
- 同一逻辑分包原生与扩展重复接管；
- 旧双风顺序（安全拒绝、零写入）；
- 旧六包 ZIP/旧共享核心与当前 ZIP 混装；
- 任意顺序；
- 把十份原生补丁包装成扩展 ZIP；
- Android、联机、斗地主/国战/2v2 等未测模式。

## 8. 故障与恢复原则

- 原生补丁：先 `--check`；失败停止，不要强行应用。重复应用会被上下文不匹配拒绝。
- 扩展安装：安装器按事务记录恢复；共享核心/注册表冲突会拒绝且零写入；重装幂等。
- 扩展回滚：若文件/注册表被第三方修改，回滚器保守拒绝；先核对差异，不要强删。
- 不提供新的自动安装器；使用各 ZIP 自带的 `apply-pack.mjs`/`rollback-pack.mjs`。
