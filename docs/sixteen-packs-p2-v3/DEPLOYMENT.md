# 十六包 v3 部署

部署前先确认 [验收门禁](ACCEPTANCE.md) 和 [产物 SHA256](SHA256SUMS.txt)。v3 内部结论仅适用于该报告绑定的哈希和已验证配置。ZIP 内的阶段性字段记录打包时的候选状态。

1. 退出宿主，备份宿主五文件及整个扩展根，保留旧版回滚文件。宿主为无名杀 1.11.7 Windows x64、LF。按 [产物清单](PROVENANCE.md) 核验 ZIP 与补丁，按 `evidence/native-roundtrip.json` 核对宿主五文件原始哈希。
2. 从干净的 `resources/app` 执行下列命令。按 [支持矩阵](COMPATIBILITY.md) 的十份顺序逐份应用。每次检查成功后才执行实际应用。

```sh
git -c core.autocrlf=false apply --check "<补丁绝对路径>"
git -c core.autocrlf=false apply "<补丁绝对路径>"
```

3. 使用完整无名 AI 扩展 `1fe5292eb3022dd8d1db494617b21a12be912e61` 的干净 LF 根目录。未接线时应用一次任一 ZIP 的 `patches/score-index.diff`。检查 `score/index.js` 包含 `installSkillAIPolicies` 和 `uninstallSkillAIPolicies`。
4. 从各解压目录执行其自带安装器。按 `refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope` 安装。检查注册表六条唯一导入。共享核心由安装器依据清单验签。

```sh
node integration/apply-pack.mjs --extension-root "<扩展根>" --dry-run
node integration/apply-pack.mjs --extension-root "<扩展根>"
```

5. 回滚时，先用各 ZIP 的 `integration/rollback-pack.mjs --extension-root "<扩展根>"` 逆序卸载扩展，再逆序撤销十补丁。旧核心或第三方修改导致拒绝时，参见 [升级和恢复](UPGRADE.md)。

```sh
git -c core.autocrlf=false apply -R --check "<补丁绝对路径>"
git -c core.autocrlf=false apply -R "<补丁绝对路径>"
```

回滚后宿主五文件应恢复原始哈希，扩展注册表不再包含六个包，兼容共享核心和提示模块保留。同技能原生和扩展二选一。安装前须人工确认原生补丁状态。
