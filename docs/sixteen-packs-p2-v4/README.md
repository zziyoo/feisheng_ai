# 无名 AI 十六包 v4 内部交付

状态：**内部集成 PASS（限定实际验证的宿主、引擎、部署顺序及模式）**。未公开发布，未 push，未创建 PR/Release/标签。

- 最终验收：`ACCEPTANCE.md`
- 支持/互斥：`COMPATIBILITY.md`
- 部署：`DEPLOYMENT.md`
- v3→v4 升级：`UPGRADE.md`
- P2/残余：`P2-RESOLUTION.md`
- 来源与哈希：`PROVENANCE.md`
- 证据索引：`evidence/`
- 离线腾讯台账增量：`TENCENT-UPDATE.csv`

快速核验：

```bash
sha256sum -c SHA256SUMS.txt
```

六个扩展 ZIP 与十份原生补丁的最终 SHA256 以 `SHA256SUMS.txt` 和 `PROVENANCE.md` 为准。v3 交付目录原样保留，不在本目录内覆盖。
