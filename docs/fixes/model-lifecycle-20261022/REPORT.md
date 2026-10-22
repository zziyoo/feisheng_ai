# 第一批客户端正式修复：专项模型生命周期

日期：2026-10-22（Asia/Shanghai）
分支：`fix/model-lifecycle`
修复基准：`372cc9bf12b191dcdbe6369bb0c558e68ab862fe`

本批仅处理 P1-01、P1-02、P1-06。开始时无已修改的受跟踪业务文件；保留原有未跟踪 `docs/audit-20261021/`，未将整份审查目录纳入修复提交。没有操作服务器、真实用户存档、正式权重、正式训练或自动发布；没有合并142维实验分支，没有开启主动停用的模型接管或公共本地训练。

## 1. 根因与具体变化

### P1-01：专项快照存储契约

根因：专项参数表写死 W1/W_proj1=16640（130×128），而实际网络为134→128→64→6，合法长度为17152；同样影响Adam一阶/二阶矩。旧解码返回null后，部分会话构造还可能把null误作“从公共模型初始化”。

变化：

- 从 `MODEL_SCHEMA.dims` 派生全部参数表；编码格式和存储schema不变。
- 解码仍保持原有“合法快照对象/非法null”的API，保存和恢复增加具体字段诊断，例如 `W1：期望长度 17152，实际长度 16640`。
- IndexedDB和localStorage恢复均列出invalidKeys/invalidRecords及原因；不兼容原记录保留，不静默转换模型权重。
- 创建专项会话、写入活动版本、晋升和回滚使用结构门禁；损坏候选不会以公共权重伪装成专项会话。
- 保存失败不替换候选；事务失败不替换活动版本；公共模型参数保持不变。

### P1-02：整局留出元数据

根因：分局函数返回 `split.metadata.holdoutSessions`，训练报告却读取 `split.holdoutSessions`，持久化后留出局ID消失。

变化：

- 新报告持久化完整 `splitMetadata`：seed、holdoutRatio、方法、来源局数、训练/验证样本数及全部holdoutSessions；同时保留顶层holdoutSessions作为兼容别名。
- 验证和激活共用 `classicHoldoutDataset()`：检查ID、重复/缺失、别名冲突、metadata计数、原种子/比例的整局划分、来源局是否齐全、验证行数是否与原报告完全一致。
- 存在新metadata但其中ID缺失/null时直接拒绝，不能偷偷回退顶层字段；**仅整个splitMetadata缺失的旧报告**可以使用仍完整的顶层ID。
- 原始留出数据不完整、不满足质量检查或数据签名变化时返回失败，活动模型保持原样。不重抽验证集、不默认通过。
- 保留4500事务/150局、训练≥3000、验证≥450、玩法/角色组≥150、准确率不降与价值误差不升、当前公共/试用版比较和局间切换规则。

### P1-06：历史样本适配

根因：普通Array130先进入length分支而调用不存在的subarray；TypedArray虽可适配，前置资格门禁却只收Array。导入/启动清洗又在适配之前拒绝130维。

变化：

- 支持有限数值的130维Array和TypedArray；无损保留前130项，不再经Int8隐式截断历史浮点值。
- 缺少的目标身份四项仅作为输入占位0，并携带 `_dimAdapted:true`、`_originalDim:130`、`_missingFeatureIndices:[130,131,132,133]`，不推断或伪造身份。
- 正式134维数据保留已有身份特征；非法/非有限向量和142维实验数据拒绝。显式声明142却携带134向量也拒绝，避免实验数据伪装为正式输入。
- TypedArray在专项数据入口转成普通Array后，仍经过既有真实执行、收益、模式与去重资格门禁；pending样本不会因为维度适配而变为合格。
- **必要最小依赖修改**：`trainExport.js`的启动/导入清洗接入同一适配器，保留并持久化适配标记；适配触发保存。奖励修复计数和维度适配计数分开，已适配134行继续可识别。
- v5影子网络、其两份权重和独立130维契约完全未修改。

## 2. 修改文件与关键位置

五个生产文件：

- `score/model/weights/modeModelStore.js:5`：schema派生参数长度；`:8`快照诊断；`:32`记录门禁；`:71`恢复；`:97`写入前复核。
- `score/model/features/dimensionAdapter.js:38`：向量/声明维度检查及显式历史适配。
- `score/model/train/modeDataset.js:30`：TypedArray输入边界；`:57`适配状态计数；`:106`完整留出集校验。
- `score/model/train/modeTraining.js:52`：完整分局报告；`:64`重新验证；`:109`激活前再次核验。
- `score/model/train/trainExport.js:25,100,224,264,1070`：启动、清洗、导入与适配标记/计数，属于P1-06必需入口修复。

新增测试：

- `tools/test-model-lifecycle.mjs`：17项生产模块客户端生命周期测试。
- `tools/model-lifecycle-test-loader.mjs`：仅测试的宿主/优化器适配器。
- `tools/model-lifecycle-test-cold-start.mjs`：独立Node进程的历史样本启动恢复与回写。
- `tools/verify-model-lifecycle-browser.mjs`：真实Chromium IndexedDB与浏览器进程重启。

没有修改 `weights.js`、`defaultWeights.js`、`shadow/decodeV5.js`、v5模型JSON或配置默认值。与基准的blob哈希及最终差异检查记录见 `baseline.json` 和交付校验。

## 3. 测试命令与结果

### 本批专项测试

```powershell
node tools/test-model-lifecycle.mjs
```

**17通过、0失败。** 包括：134 float快照/Adam状态、保存/重载/两版激活/回滚、130形状和NaN/损坏矩拒绝、模拟配额失败、损坏缓存不回退公共权重、localStorage冷恢复诊断、历史Array/TypedArray、134保留/142拒绝、严格资格过滤、导入往返、独立进程启动回写、分局metadata序列化恢复、验证/激活、缺少局/行或metadata拒绝、训练局不能替换原留出局、旧顶层报告兼容。

训练报告流程测试使用4500条**合成**事务。为避免运行正式优化器，测试加载器只将 `modeTraining` 的trainBatch替换为不修改权重的函数；特征、分局、报告、模型前向、存储、验证、质量门禁和激活使用真实生产代码。这证明接缝与门禁，不证明优化器训练质量或胜率提升。

### 真实浏览器存储测试

```powershell
node tools/verify-model-lifecycle-browser.mjs `
  --browser 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  --playwright 'C:\Users\32360\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\playwright'
```

**通过，Chrome155.0.8059.86。** 使用独立临时profile，保存两版到真实IndexedDB→关闭浏览器进程→重启恢复→回滚；再次重启验证损坏候选拒绝、有效活动版本仍可恢复、原损坏记录仍在库内。模拟IDB写失败时未改动原记录。metadata随模型记录保留。所有页面请求由本地源码拦截，非预期网络请求为0；未运行完整游戏。

### 既有相关测试

实际执行所有 `tools/test-*.mjs`，**19个脚本均退出0**（原18个加本批1个）；其中权重637个断言、原回归94个断言通过。

```powershell
python -m unittest discover -s tests -v
```

**20项通过。** 未运行后端服务测试，未启动或操作服务端。

复用审查失败测试：

```powershell
node --test --test-name-pattern '134维|两版候选|IndexedDB|声称134' docs/audit-20261021/model-regression.test.mjs
node --test docs/audit-20261021/model-regression.test.mjs
```

- 本批对应的5项：**5通过、0失败**。
- 原完整8项：修复前1通过/7失败，现为**6通过/2失败**，退出1。剩余失败为“关闭训练模型时deepThink不应调用公共模型”和“智能面板模型就绪状态应与运行模型一致”，分别属于其它已审计问题，按用户边界不在本批修复；没有修改或跳过这两个断言来伪装全绿。
- 审查中“缺陷仍存在”的旧复现脚本在修复后可能按其旧预期失败，不能作为正确行为回归使用；本批采用期望正确行为的失败测试。

日志见同目录 `test-summary.json`、各脚本.log、`browser.log`、`before-lifecycle.log`、`additional-red.log`。原审查目录未覆盖。独立只读代码复核发现的新metadata漏验已补测试并修复，最终未报告阻断项。

## 4. 用户旧模型与存档兼容

- 公共稳定模型/正式内置或在线权重不改动，不转换模型权重；公共训练和模型接管的停用状态不改。
- 符合schema7/134形状和数值契约的专项快照可正常读写、恢复和回滚，存储键/schema仍兼容。
- 旧130形状模型、缺参数、损坏参数或不兼容版本拒绝加载；原存档保留供诊断，不自动迁移成134权重。
- 已有134候选若保留完整顶层holdoutSessions及原报告/数据，可走旧报告兼容路径。以前因层级错误已经丢失ID的候选不能可靠推导“原验证集”，必须重新训练候选；本批不会自动执行训练。
- 130历史样本只有在向量、标签及专项执行/收益等原资格条件满足时才进入正式训练集；缺失身份始终显式标记。142实验数据拒绝。
- 没有打开、清空或批量改写任何真实用户存档。浏览器测试清理的只有其自行创建的临时profile。

## 5. 尚需真实客户端验收

- 桌面客户端和手机WebView实际打开专项面板，核对错误字段/预期长度/实际长度的显示。
- 客户端完整退出、重新启动后，真实扩展上下文的IDB权限、版本和界面状态。
- 用户主动训练/验证/激活后下一局版本固定、规则/角色隔离、对局中不切换、回滚后下一局使用上一版。
- 完整GameEvent决策/执行、实际模型采纳、真实收益标签和胜率。
- 真实数据训练质量及性能；本轮没有执行正式训练，不能声称模型质量提升。

真实IndexedDB测试通过不等同完整对局验收。本批没有重新跑全仓库功能审查，也没有尝试修复上轮宿主启动环境或其它批次缺陷。

## 6. 提交与工作区

交付为一个独立修复Commit；完整SHA在本轮交付消息中提供，也可使用 `git rev-parse HEAD` 取得（本报告与修复同一提交，避免在文件中嵌入自引用提交哈希）。没有push、合并或发布。

提交后应仅保留开始时已有的未跟踪 `docs/audit-20261021/`。本批受跟踪源码、测试和报告已提交；未覆盖其它开发者改动。到此停止，等待人工复审，不启动第二批。
