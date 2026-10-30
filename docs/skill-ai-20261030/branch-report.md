# 分支整理报告（2026-10-30）

## 1. 结论

- 上游 `xuejianbing/feisheng_ai` 的正式主线是 `upstream/master`，当前等于标签 `v4.4.4`，提交 `1fe5292eb3022dd8d1db494617b21a12be912e61`。
- 本地 15 条临时分支已确认被 v4.4.4 语义吸收或本身就是 v4.4.4 祖先，已建立 `refs/archive/*` 归档引用后删除。
- 本地 `master` 不是上游 master：它停在 `466317e`，相对 v4.4.4 独有 22 个提交、缺少 56 个上游提交，属于旧线 QA 集成，**保留不动**。
- 当前主工作树分支 `codex/final-client-stability`（`3edbc6e`）保留；工作区有上一轮未提交审计资料，本次未覆盖、未清理。
- 本次开发落在既有分支 `codex/release-v4.4.4`（从 `v4.4.4` 起 3 个提交），没有新建分支。
- Fork 主线同步和远端分支删除**未执行**：执行器把 `git push origin v4.4.4:refs/heads/master` 识别为需要显式确认的破坏性操作并拦截。命令与目标已列在文末，等待用户确认。

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
| codex/release-v4.4.4 | `1fe5292` | v4.4.4 自身 | 0 | 既有发布分支 | 保留并作为本次开发分支 | 4 个新提交（3 代码/测试 + 本报告） |
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
| origin/master | `78c141f` | v4.4.4 祖先，落后 | 快进到 v4.4.4 | **待确认**（被拦截） |
| origin/feature/manual-full-package-20261017 | `ceef378` | PR #3 MERGED，v4.4.4 祖先 | 可删 | **待确认** |
| origin/fix/model-lifecycle | `976d7eb` | 语义已吸收；本地已归档删除 | 可删 | **待确认** |

## 5. 待确认的远端命令

执行器要求显式确认以下目标；本次没有执行，也没有 force push：

```bash
git push origin v4.4.4:refs/heads/master          # 快进 origin/master 到 1fe5292
git push origin --delete feature/manual-full-package-20261017
git push origin --delete fix/model-lifecycle
```

`origin/master` 是 v4.4.4 的祖先，上述第一条是 fast-forward，不是重写；但当前权限门禁把它归为“写主分支”，需要用户明确确认。

## 6. 未处理的本地状态

- 主工作树 `codex/final-client-stability` 仍有上一轮的未提交审计资料（99 个 staged 文件、53 个内容修改、若干未跟踪文件）。本次没有 commit、reset、clean 或覆盖这些内容。
- 主工作树运行时代码按 CRLF 归一化后与 v4.4.4 逐文件一致；详见 `baseline.json`。
- 本地 `master` 与 `codex/final-client-stability` 都保留，避免丢失上一轮审计/QA 资料。
