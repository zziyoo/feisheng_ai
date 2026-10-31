# 本地试验安装记录

- 部署自提交：`116af5f660803f68fc4fc439d544ec683b52266f`
- 基线：`1fe5292eb3022dd8d1db494617b21a12be912e61`（v4.4.4）
- 安装目录：`C:/Users/32360/Desktop/无名杀-win32-x64/resources/app/extension/无名AI`
- 部署文件（仅 3 个运行时文件）：
  1. `score/index.js`
  2. `score/decision/skills/skillAIPolicies.js`（新增）
  3. `score/decision/skills/skillAIPolicyRules.js`（新增）
- 安装前 `score/index.js` 归一化 SHA256：`a2fa58e4b122a04a34559479ece7052eb6d200dd3b078cd668ade80ccfcc80cc`（与 v4.4.4 一致）。
- 备份：`backup/score__index.js.v444`；两个新增文件安装前不存在。
- 安装后/验证：[`manifest.json`](manifest.json) + [`verification.json`](verification.json)。
- 验证：安装目录本身作为 extension-root，40 个真实宿主场景 `passed`、`errors=[]`；策略/完整引擎卸载重装 true→false→true，均无错误。
- 未修改版本号、更新公告、发布标签；不是公开发行。

## 回滚

```bash
python tools/rollback-skill-ai-live.py          # 只打印计划
python tools/rollback-skill-ai-live.py --apply  # 校验哈希后恢复/删除
```

回滚会恢复 `score/index.js` 的 v4.4.4 备份，并删除两个新增策略文件；当前文件哈希不匹配或备份哈希不匹配时会拒绝执行。

## 重新安装

```bash
python tools/build-skill-ai-baseline.py   # 如需重新核对 v4.4.4 运行文件
# 从目标提交取 3 个 blob 写入安装目录；本轮使用 116af5f，见 manifest。
```
