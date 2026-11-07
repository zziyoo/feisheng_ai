# 标准包封包与独立验收交接

状态：构建配置和交付说明已准备；构建、ZIP 校验、安装和回滚均由独立 Agent 执行。本工作树原有 `docs/skill-ai-20261030/pack-delivery.json` 未提交修改及其他包未跟踪目录必须保留；不要在该工作树使用 `--worktree-source` 生成正式候选。

用户称第一批公共集成和第二批技能已通过专项验收；本工作树没有随包附带可核查的第二批完整验收记录。验收者应取得原始记录并对照两批已验收源码字节，不得凭本交接将宿主或封包验收标记通过。

## 隔离构建（PowerShell，独立 Agent 执行）

在包含本交接提交的仓库中，指定**不存在的**隔离路径及空的专用输出目录。构建器会删除其 `--stage-root` 下本包目录，不得指向正式安装、现有交付或其他开发者目录；不要将 `--out` 指向旧四包目录。

```powershell
$deliveryHead = git rev-parse HEAD
$isolatedRepo = '<新的隔离工作树绝对路径>'
$outputDir = '<新的空交付目录绝对路径>'
$stageDir = '<新的专用暂存目录绝对路径>'
git worktree add --detach $isolatedRepo $deliveryHead
Set-Location $isolatedRepo
node tools/build-skill-ai-pack.mjs --pack refresh_standard --out $outputDir --stage-root $stageDir
```

构建器默认要求干净工作树，从该 HEAD 导出主要源码，并运行内置 ZIP 文件验证；它还从工作树读取构建脚本和模板，因此必须使用干净隔离副本。预期输出 `feisheng-ai-refresh-standard.zip`、`feisheng-ai-refresh-standard-native-ai.patch` 和 `SHA256SUMS.txt`；实际文件及哈希须由验收者读取确认。另在输出目录写独立验收记录，列出执行项目、证据及未验证项。

## 验收重点

1. 核对 `pack.json` 和 `manifest.json` 的完整 HEAD、两批七项原生、五项扩展和既有突袭；包内遗计与裸衣不得声称扩展接管，状态必须仍为封包待验收。核对全部 manifest 文件及 SHA256；包内和包外原生补丁应逐字节相同。
2. 对照 `074992e` 及第一批实际验收记录核对 AI 源码和补丁字节；检查补丁只改 AI，基线包含正确的酒修复，先在隔离宿主检查补丁适用性，不强制应用。
3. 查验导入图、所有依赖以及 `pack_files`/共享文件哈希。以隔离目标完成一次预检、安装、回滚和重装，确认注册无重复、失败事务恢复、共享依赖保留和外部修改不被覆盖。
4. 检查与神话风、火、雷已有安装的兼容及旧核心哈希冲突：不同版本必须安全拒绝，不能强制覆盖；神话风与界风互斥仍在。未能完成的组合标为未验证。
5. 检查新版完整引擎实际有软建议消费入口；旧引擎未接线时只声明宿主策略可用。原生及扩展采用替代路线，不应默认同时接管。
6. 记录最终 ZIP 和补丁 SHA256、独立验收结论及任何阻塞；不将 57 项技能、完整宿主回归或 Android 性能写成通过。
