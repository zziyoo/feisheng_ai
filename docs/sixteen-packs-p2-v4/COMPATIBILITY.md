# 支持矩阵与互斥范围

## 扩展组合（本轮正式路线）

顺序固定：

```text
refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope
```

- 目标：无名杀 1.11.7 Windows x64，LF 宿主，完整无名 AI 扩展引擎 `1fe5292`；身份局 8 人已验证。
- 六包共用同一共享核心；`skillPlanHints.js` 由标准包提供，回滚时保留。
- 双风对包哈希：
  - 界风 `packs/refreshFeng.js`：`5ee2bac6f5454db7670c564aa98b3565c5ab6c3ba54fb7881a6e2d17a674288c`
  - 神话风 `packs/shenhuaFeng.js`：`deb67719192d27dcf057d670d822f31e734cb53490a44d197f5ad9cdb7577ffd`
  - 界风 `wind_compatibility.peer_sha256` = 神话风 pack 文件哈希；神话风 peer = 界风 v4 pack 文件哈希。
- 正式顺序安装事务 9/9 PASS；隔离反序 `refresh_standard → shenhua_feng → refresh_feng` 也通过，但正式支持顺序仍为先界风后神话风。对包哈希不匹配时安装器安全拒绝、零写入（`evidence/double-wind.json`）。

## v4 五项修复的路线

| 技能 | 扩展 | 原生补丁 |
| --- | --- | --- |
| 雄乱 `drlt_xiongluan` | v4 已修复 | 未同步；沿用旧行为 |
| 强袭 `qiangxix` | v4 已修复窄场景 | 未同步；沿用旧行为 |
| 罪论 `xinfu_zuilun` | v4 已修复 | 未同步；沿用宿主排序 |
| 踞襄 `twjuxiang` | v4 已修复窄场景 | 无 v4 原生对应实现 |
| 界奇谋 `reqimou` | v4 已修复射程漏判 | 未同步；沿用旧评分 |
| 奇制 `qizhi` | v3 原生/扩展已有修复 | 已验收；手动结算残项未改 |

原生与扩展同技能二选一，不得同宿主重复接管。十份原生补丁顺序：

```text
standard_2008 → standard_2013 → standard_2019 → standard_2023 → shenhua_lin → shenhua_shan → shenhua_yin → refresh_huo → refresh_lin → refresh_shan
```

十份补丁 SHA256 见 `evidence/native-patches.txt`，与 v3 字节完全一致。

## 其它范围

- `out_of_scope` 仅扩展路线；`redimeng` 原生 1.11.7 仍不支持。
- 标准包部分优化仅原生；界风部分技能仅原生；不宣称扩展等价。
- 国战/2v2/斗地主既有少量冒烟不升级为完整模式 PASS；Android、真实联机、其他模式未测。
- 旧核心/旧包不能直接覆盖升级；必须先回滚并按 `UPGRADE.md` 迁移。
