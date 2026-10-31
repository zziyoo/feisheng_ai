# 分支整理报告（2026-10-30）

## 1. 结论

- 上游 `xuejianbing/feisheng_ai` 的正式主线是 `upstream/master`，当前等于标签 `v4.4.4`，提交 `1fe5292eb3022dd8d1db494617b21a12be912e61`。
- 本地 15 条临时分支已确认被 v4.4.4 语义吸收或本身就是 v4.4.4 祖先，已建立 `refs/archive/*` 归档引用后删除。
- 本地 `master` 不是上游 master：它停在 `466317e`，相对 v4.4.4 独有 22 个提交、缺少 56 个上游提交，属于旧线 QA 集成，**保留不动**。
- 当前主工作树分支 `codex/final-client-stability`（`3edbc6e`）保留；工作区有上一轮未提交审计资料，本次未覆盖、未清理。
- 本次开发落在既有分支 `codex/release-v4.4.4`（从 `v4.4.4` 起 8 个提交），没有新建分支。
- Fork 分支收尾**已执行**：`origin/master` 从 `78c141f` 非强制快进到 `1fe5292`；`origin/feature/manual-full-package-20261017`（`ceef378`，独有 0）已删除；`origin/fix/model-lifecycle` 按要求保留。执行使用 `gh auth git-credential` 临时凭据助手，没有 force push、没有删除标签。
- `origin/fix/model-lifecycle` 的独有提交 `976d7eb` 已复核：`modeModelStore` 动态维度、dataset/export 关键修改已存在于 v4.4.4；未发现值得单独移植的独有功能，暂保留远端分支。

## 2. 判定方法

1. 祖先关系：`git merge-base --is-ancestor <branch> v4.4.4`。
2. 独有提交：`git rev-list --count v4.4.4..<branch>`。
3. `git cherry`/patch-id：v4.4.4 对旧修复做过重写/压缩，patch-id 不能单独定论，仅作为辅助。
4. 语义核对：抽取每条独有提交新增代码中的稀有标识符，在 v4.4.4 文件树中检索；再对关键修复做定点核对。
5. PR 记录：`gh pr list -R xuejianbing/feisheng_ai --state all`；PR #12/#13/#11/#10/#9/#8/#7/#6/#5/#4/#3 均为 MERGED。
6. 工作树：删除前检查 `git -C <worktree> status --porcelain`，只移除干净工作树。

关键定点证据：

- `fix/model-lifecycle` 的 `modeModelStore` 动态维度代码（`const fields={W1:input*hidden1,...}`）在 v4.4.4 中逐字存在。
- `codex/*` 的 `__djscChoiceTrace`、`E_REWARD_STATE_CONFLICT`、`E_DATASET_SCOPE`、`E_AUTOFEATURE_NOT_APPLIED`、`backend/v6/server/source_auth.py` 在 v4.4.4 中存在；独有提交新增标识符在 v4.4.4 的命中率为 76%–95%（缺失项多为测试夹具名、说明文字或后续重命名）。
- `codex/mobile-performance-443`、`fix/mobile-performance-4.4.3`、`codex/release-v4.4.4` 是 v4.4.4 的**直接祖先或自身**，0 个独有提交。
- `upstream/fix/client-align-142` 的 2 个提交**没有**进入 v4.4.4：`18f7204` 把 `CURRENT_DIM/FEATURE_DIM` 从 134 提到 142；v4.4.4 仍是 `CURRENT_DIM = 134`、`FEATURE_DIM = 134`。`25cae88` 新增 `score/foundation/cloud/cloudInference.js`，v4.4.4 无此文件。该分支不能直接合并，否则会覆盖 v4.4.4 的模型/特征契约。

## 3. 本地分支处理

| 分支 | 原 HEAD | 比较基线 | 独有提交 | 核对结论 | 处理 | 最终状态 |
|---|---|---:|---:|---|---|---|
| codex/backend-source-auth | `73a3d00` | 372cc9b | 13 | 核心修复在 v4.4.4（source_auth、回执/训练边界） | 归档后删除 | `archive/codex-backend-source-auth` |
| codex/final-client-stability | `3edbc6e` | 372cc9b | 20 | 当前主工作树；运行时代码等于 v4.4.4，15 条 codex 修复语义覆盖 | 保留 | 主工作树 HEAD，未改动 |
| codex/host-execution-ownership | `a6f8642` | 372cc9b | 3 | `__djscChoiceTrace` 等已存在 | 归档后删除 | `archive/codex-host-execution-ownership` |
| codex/ingest-confirmation-boundaries | `8b0e5d6` | 372cc9b | 6 | `E_REWARD_STATE_CONFLICT`/回执修订已存在 | 归档后删除 | `archive/codex-ingest-confirmation-boundaries` |
| codex/ingest-durability | `750d912` | 372cc9b | 4 | 训练/回执持久化已在 v4.4.4 | 归档后删除 | `archive/codex-ingest-durability` |
| codex/ingest-durability-followup | `a3001cf` | 372cc9b | 5 | 同上 | 归档后删除 | `archive/codex-ingest-durability-followup` |
| codex/model-training-release | `6ee99a0` | 372cc9b | 14 | 模型生命周期/自动特征修复已在 v4.4.4 | 归档后删除 | `archive/codex-model-training-release` |
| codex/panel-closeout | `5a9c769` | 372cc9b | 9 | 面板生命周期修复已在 v4.4.4 | 归档后删除 | `archive/codex-panel-closeout` |
| codex/panel-runtime | `05863a1` | 372cc9b | 7 | 面板服务统一已在 v4.4.4 | 归档后删除 | `archive/codex-panel-runtime` |
| codex/panel-runtime-followup | `a2c25ed` | 372cc9b | 8 | 同上 | 归档后删除 | `archive/codex-panel-runtime-followup` |
| codex/training-lineage | `aa238e5` | 372cc9b | 10 | `E_DATASET_SCOPE` 等已在 v4.4.4 | 归档后删除 | `archive/codex-training-lineage` |
| codex/training-lineage-final | `9b5e50a` | 372cc9b | 12 | 同上 | 归档后删除 | `archive/codex-training-lineage-final` |
| codex/training-lineage-review | `a3c39cf` | 372cc9b | 11 | 同上 | 归档后删除 | `archive/codex-training-lineage-review` |
| fix/model-lifecycle | `976d7eb` | 372cc9b | 1 | `modeModelStore` 动态维度逐字在 v4.4.4 | 归档后删除 | `archive/fix-model-lifecycle` |
| codex/mobile-performance-443 | `4d3aae7` | v4.4.4 祖先 | 0 | 直接祖先 | 删除分支并移除干净工作树 | 已删除 |
| fix/mobile-performance-4.4.3 | `636b636` | v4.4.4 祖先 | 0 | 直接祖先 | 删除分支并移除干净工作树 | 已删除 |
| codex/release-v4.4.4 | `1fe5292` | v4.4.4 自身 | 0 | 既有发布分支 | 保留并作为本次开发分支 | 11 个新提交（首批 4 + 二次补修/文档 7，见 git log） |
| master | `466317e` | d3dbad6 | 22 | 旧线 QA 集成，缺 56 个上游提交；不是上游 master | 保留，不 reset/不强推 | 未改动 |

恢复方式（任选一条归档）：

```bash
git switch -c recover/<原名> refs/archive/<原名>
# 或用 git branch <原名> refs/archive/<原名>
```

## 4. 远端与上游

| 引用 | HEAD | 状态 | 建议 | 本次动作 |
|---|---|---|---|---|
| upstream/master | `1fe5292` | = v4.4.4 | 正式主线 | 无 |
| upstream/codex/response-lifecycle | `e487fa3` | PR #12 MERGED，v4.4.4 祖先 | 可删 | 无权限，不操作 |
| upstream/feat/weique-2v2-complete | `36a9c2f` | PR #13 MERGED，v4.4.4 祖先 | 可删 | 无权限，不操作 |
| upstream/release/4.4.0 | `00468cc` | v4.4.4 祖先，发布历史 | 保留 | 无 |
| upstream/fix/client-align-142 | `25cae88` | 2 个独有提交，未合并 | **保留**；142 维与 v4.4.4 的 134 维契约冲突，待模型/特征契约升级后再评估 | 无 |
| origin/master | `78c141f` → `1fe5292` | v4.4.4 祖先，落后 121、独有 0 | 非强制快进 | **已执行**（`78c141f..1fe5292`） |
| origin/feature/manual-full-package-20261017 | `ceef378` | PR #3 MERGED，v4.4.4 祖先，独有 0 | 删除 | **已执行**（远端已删） |
| origin/fix/model-lifecycle | `976d7eb` | 相对 v4.4.4 独有 1；核心修改已在 v4.4.4 | 暂保留，复核后再决定 | **保留** |

## 5. 已执行的远端操作

下列命令在用户明确授权后执行；使用 `GIT_TERMINAL_PROMPT=0` + `gh auth git-credential` 临时凭据助手，没有 force push、没有删除标签：

```bash
# 执行前：origin/master = 78c141f95058e0660680615760d819c785b98057
#          origin/feature/... = ceef378ca2031944315dd0097172cbff32097aa2
GIT_TERMINAL_PROMPT=0 git -c credential.helper='!gh auth git-credential' \
  push origin 1fe5292eb3022dd8d1db494617b21a12be912e61:refs/heads/master
# 结果：78c141f..1fe5292（fast-forward）

GIT_TERMINAL_PROMPT=0 git -c credential.helper='!gh auth git-credential' \
  push origin --delete feature/manual-full-package-20261017
# 结果：deleted feature/manual-full-package-20261017

# 按要求保留 origin/fix/model-lifecycle（976d7eb），未删除。
```

复核 `fix/model-lifecycle` 的独有提交 `976d7eb`：

- 代码文件 5 个：`dimensionAdapter.js`、`modeDataset.js`、`modeTraining.js`、`trainExport.js`、`modeModelStore.js`。
- 新增行在 v4.4.4 的命中：12/12、32/32、10/12、21/21、39/39；缺失的两行是长表达式，已被 v4.4.4 的等价重写覆盖。
- 旧实现 `const fields={W1:16640,...}` 已不在 v4.4.4；v4.4.4 使用 `MODEL_SCHEMA.dims` 动态维度。
- 结论：没有发现值得单独移植的独有功能；保持远端分支，待用户决定是否在后续删除。

## 6. 未处理的本地状态

- 主工作树 `codex/final-client-stability` 仍有上一轮的未提交审计资料（99 个 staged 文件、53 个内容修改、若干未跟踪文件）。本次没有 commit、reset、clean 或覆盖这些内容。
- 安装目录运行时代码：384 个运行文件中 383 个与 v4.4.4 一致，1 个已知缺失（`client_policy_model_v2.js`，见 `baseline.json`）；本地试验安装已额外部署 3 个策略文件，详见 `live-install/`。
- 本地 `master` 与 `codex/final-client-stability` 都保留，避免丢失上一轮审计/QA 资料。
