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

构建器默认要求干净工作树，并以 `git show HEAD:<path>` 的原始 Buffer 导出归档中原样复制的 Git 文件，包括工具模板；任务清单和配置也从同一 HEAD 读取。外部证据仍从指定证据目录原样读取，生成文件不是 Git blob 副本。manifest 的 `source_kind`、`repo_path` 区分 Git blob、外部证据和生成文件。`--worktree-source` 是显式开发调试模式；`pack.json` 和 manifest 均记录来源模式，不得将该模式产物作为指定提交的精确交付。实际构建仍应在干净隔离副本执行。预期输出 `feisheng-ai-refresh-standard.zip`、`feisheng-ai-refresh-standard-native-ai.patch` 和 `SHA256SUMS.txt`；实际文件及哈希须由验收者读取确认。另在输出目录写独立验收记录，列出执行项目、证据及未验证项。

## Git 字节一致性 P1 复验

上一候选 `353b549a5f5cb68969fbc9db24e991a4d0bf768c28e612673e31feeadaf976c6` 的六个工具脚本因从 Windows 工作树复制而与 Git blob 字节不同，不得作为新包。此修复尚未执行任何构建或测试。独立 Agent 须从新 HEAD 构建，并对 manifest 中每个 `source_kind: git-blob` 文件逐一以 `repo_path` 对照该 HEAD 的原始 blob；重点检查三个安装工具、`verify.py`、构建器与配置。检查生成的注册表等文件不被误标为 blob、外部证据不虚构提交；复核包内外原生补丁及全部 manifest 哈希。另检查 `--worktree-source` 的来源标记、安装回滚和故障注入、旧共享核心冲突拒绝。最终 ZIP 的实际 AI 源码须与历史专项验收版本逐字节对应，不能仅依据旧结论；建议隔离宿主最小加载和策略注册冒烟。

## 验收重点

1. 核对 `pack.json` 和 `manifest.json` 的完整 HEAD、两批七项原生、五项扩展和既有突袭；包内遗计与裸衣不得声称扩展接管，状态必须仍为封包待验收。核对全部 manifest 文件及 SHA256；包内和包外原生补丁应逐字节相同。
2. 对照 `074992e` 及第一批实际验收记录核对 AI 源码和补丁字节；检查补丁只改 AI，基线包含正确的酒修复，先在隔离宿主检查补丁适用性，不强制应用。
3. 查验导入图、所有依赖以及 `pack_files`/共享文件哈希。以隔离目标完成一次预检、安装、回滚和重装，确认注册无重复、失败事务恢复、共享依赖保留和外部修改不被覆盖。
4. 检查与神话风、火、雷已有安装的兼容及旧核心哈希冲突：不同版本必须安全拒绝，不能强制覆盖；神话风与界风互斥仍在。未能完成的组合标为未验证。
5. 检查新版完整引擎实际有软建议消费入口；旧引擎未接线时只声明宿主策略可用。原生及扩展采用替代路线，不应默认同时接管。
6. 记录最终 ZIP 和补丁 SHA256、独立验收结论及任何阻塞；不将 57 项技能、完整宿主回归或 Android 性能写成通过。
