# 界限突破·标准全量审查候选封包与独立验收交接

状态：全量源码审查覆盖 29 名武将、57 项登记技能；构建配置与交付说明已准备。本轮增加 `lijian`、`jijiu`、`qingguo` 三项原生/扩展修复，代码待验收。构建、ZIP 校验、安装和回滚均由独立 Agent 执行。本工作树原有 `docs/skill-ai-20261030/pack-delivery.json` 未提交修改及其他包未跟踪目录必须保留；不要在该工作树使用 `--worktree-source` 生成正式候选。

完整逐技能入口、审查状态和限制见 `FULL-SKILL-AUDIT.md`；本轮三项新修复的场景和断言见 `FULL-SKILL-ACCEPTANCE-HANDOFF.md`。元数据的统计列表由 `tools/skill-ai-pack-config.mjs` 提供，构建器按列表计算数值。未执行的验证为 0 项；四批历史专项验收仅作为已提供基线，不替代本轮封包和三项新增修复验收。

用户称四批技能已通过专项验收，第四批验收 HEAD 为 `0857321b74e3bde8488e7593f9f07d84786d7d9c`，原生累计补丁 SHA256 为 `a37b315ac6eea9fa9d7a587e41c829fd2abd9f005ddf90752071a7054fce067c`；本轮未计算哈希或运行验证。验收者应取得原始记录并对照已验收源码字节；无法关联的历史证据如实标注，不得凭本交接将新 ZIP 的宿主或封包验收标记通过。

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

1. 核对 `pack.json` 和 `manifest.json` 的完整 HEAD、全量审查 57 项（未审查 0）、20 项原生优化（历史 17 + 本轮 3）、13 项方案 B 扩展接线、7 项仅原生、既有突袭 1 项及扩展注册共 14 项；状态必须仍为待最终验收。核对全部 manifest 文件及 SHA256；包内和包外原生补丁应逐字节相同。
2. 对照前四批提交、`074992e`、本轮 `df7e11b`、`bb9fade`、`907d485` 及历史验收记录核对 AI 源码和补丁字节；检查累计 20 项技能与第一至第四批既有功能，补丁只改 AI，基线包含正确的酒修复，先在隔离宿主检查补丁适用性，不强制应用。第四批的 18 个修改标记不等于 18 项技能。
3. 查验导入图、所有依赖以及 `pack_files`/共享文件哈希。以隔离目标完成一次预检、安装、回滚和重装，确认注册无重复、失败事务恢复、共享依赖保留和外部修改不被覆盖。
4. 检查与神话风、火、雷已有安装的兼容及旧核心哈希冲突：不同版本必须安全拒绝，不能强制覆盖；神话风与界风互斥仍在。未能完成的组合标为未验证。
5. 检查新版完整引擎实际有软建议消费入口；旧引擎未接线时只声明宿主策略可用。分别在隔离宿主对原生补丁及扩展做最小加载和策略注册冒烟；两条路线是替代方案，不默认同时接管。复核 `lijian` 决斗双方评分方向、`jijiu`/`qingguo` 资源索引修复，以及铁骑极端状态变化、反馈多装备、诈降真实 `loseHp` 牌载体与合成场景的验证差异、谦逊完整引擎消费路径，并明确仍未覆盖的边界。具体新修复场景见 `FULL-SKILL-ACCEPTANCE-HANDOFF.md`。
6. 核对源码与历史专项验收版本是否一致；不必重跑全部技能矩阵，但须验证最终归档实际加载。记录最终 ZIP 和补丁 SHA256、独立验收结论及任何阻塞；不将 57 项技能、完整宿主回归或 Android 性能写成通过。

## 候选字段与验收后处理

构建时 `delivery_stage` 为“封包待验收候选”、`delivery_status` 为“封包待验收”，`complete_delivery` 和 `can_mark_deliverable` 均为 false，表示自动化不得把未检查 ZIP 当作完整交付或正式发布。独立 Agent 如判定达到开发者审阅与集成测试条件，应先在外部验收报告中绑定确切 ZIP 和补丁哈希；候选标记仍不表示正式发布失败，也不抵消历史技能专项验收。

若自动化系统要求更改 ZIP 内字段才能识别已验收候选，必须在获授权的后续操作中修改元数据、重建并重新核查 manifest、Git blob、安装回滚及新哈希；旧 ZIP 的 PASS 不可自动转移到新 ZIP。不要为了状态显示而原地篡改归档。
