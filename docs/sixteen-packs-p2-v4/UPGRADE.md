# 从 v3 升级到 v4

## 1. 受影响的扩展 ZIP

| 分包 | v3 SHA256 | v4 SHA256 | 处理 |
| --- | --- | --- | --- |
| `refresh_standard` | `b148f29c…` | 同 v3 | 保持 |
| `refresh_feng` | `19308555…` | `1d12d8b6…` | 替换 |
| `shenhua_feng` | `dcfac0a3…` | `3b0536f4…` | 替换（仅双风 peer 元数据；运行源码未变） |
| `shenhua_huo` | `68a180f2…` | `5e1f2d06…` | 替换 |
| `shenhua_lei` | `40d9ef55…` | `bdfca87f…` | 替换 |
| `out_of_scope` | `f1d06169…` | 同 v3 | 保持 |

## 2. 安全步骤

1. 退出宿主，备份扩展根和 `.djsc-pack-backups/`。
2. 逆序回滚 v3 的 `out_of_scope → shenhua_lei → shenhua_huo → shenhua_feng → refresh_feng → refresh_standard`。
3. 如宿主有原生补丁，按相反顺序撤销十补丁；v4 补丁字节未变，可继续使用同一补丁文件。
4. 按 `DEPLOYMENT.md` 正式顺序安装 v4 六包（先界风后神话风）。
5. 检查注册表六条 import + developer、共享核心哈希、双风 peer 哈希和 `policyStats.packs`。
6. 重新安装原生补丁（如使用原生路线），并执行 `node --check`。

## 3. 版本关系

- v3 交付目录 `C:/Users/32360/Desktop/feisheng-ai-sixteen-packs-final-v3/` 原样保留，不覆盖。
- v4 只重建界风、神话风、神话火、神话雷；标准包和清单外包字节不变。
- 十份原生补丁字节不变；v4 五项修复仅在扩展路线。
- 在线腾讯台账本轮未访问、未修改；交付目录提供离线增量表 `TENCENT-UPDATE.csv`。
