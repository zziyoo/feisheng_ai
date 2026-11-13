# 升级、迁移与回滚

## 1. 从“仅六包扩展”升级

已有六包扩展（当前正式 ZIP）在位的目标：

1. 退出宿主，备份宿主 `character/` 五文件、扩展根和 `.djsc-pack-backups/`。
2. 保持六包扩展不动；确认六包共享核心与注册表六条导入正常。
3. 按 `DEPLOYMENT.md` 第 2 节把十份原生补丁累计应用到宿主。
4. 执行 `node --check` 与宿主固定场景；不需要重建或重新安装六包 ZIP。
5. 十份原生补丁不写 `score/`，不会覆盖六包策略；但必须先确认技能接管矩阵中没有同技能重复（本交付已确认无交集）。

## 2. 从“仅十包原生补丁”升级

已有十份原生补丁在位的目标：

1. 备份宿主与扩展根。
2. 确认扩展根是上游 `1fe5292` 完整引擎（或按 `UPGRADE` 迁移到该基线）。
3. 应用一次 `patches/score-index.diff` 接线。
4. 按正式顺序安装六份扩展 ZIP。
5. 不安装六包自己的原生补丁（`dual-feng`、`refresh-standard`、`shenhua-huo`、`shenhua-lei`），它们与扩展二选一。

## 3. 从旧六包版本迁移

- 旧双风单包/旧互斥版本、旧标准包、旧共享核心：先按六包封版 `UPGRADE.md` 回滚旧包，再按当前六包正式顺序安装；安装器按哈希拒绝旧核心，零写入。
- 旧神话风必须先回滚，再安装当前 `refresh_feng` + `shenhua_feng`，且先界风后神话风。
- 旧 `out_of_scope` 先回滚，再安装当前 ZIP。

## 4. 回滚顺序

```text
扩展：out_of_scope → shenhua_lei → shenhua_huo → shenhua_feng → refresh_feng → refresh_standard
原生：refresh_shan → refresh_lin → refresh_huo → shenhua_yin → shenhua_shan → shenhua_lin → standard_2023 → standard_2019 → standard_2013 → standard_2008
```

扩展回滚不触碰宿主 `character/`；原生撤销不触碰扩展 `score/`。两侧都完成后，宿主五文件应恢复干净 1.11.7 哈希。

## 5. 失败恢复

- 原生补丁：先 `--check`；失败停止，不强行应用。重复应用会被拒绝且文件不变。
- 扩展安装：安装器按事务记录恢复；共享核心/注册表冲突拒绝且零写入；重装幂等。
- 扩展回滚：第三方修改时保守拒绝；先核对差异，不要强删。
- 旧双风顺序：安全拒绝、零写入；按 `DEPLOYMENT.md` 的正式顺序重装。
- 不提供新的自动安装器；使用各 ZIP 自带的 `apply-pack.mjs` / `rollback-pack.mjs`。
