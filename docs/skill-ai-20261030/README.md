# 无名AI 技能AI复核资料（2026-10-30）

先读：

1. [REPORT.md](REPORT.md)：总报告、结论、第一批优化、风险。
2. [branch-report.md](branch-report.md)：分支逐条处理、Fork 收尾与 fix/model-lifecycle 复核。
3. [test-report.md](test-report.md)：可复现命令、回归计数、三模式性能。
4. [next-batches.md](next-batches.md)：按机制的后续计划。
5. [142-task-list.json](142-task-list.json) / [142-task-list.csv](142-task-list.csv)：全部 142 个武将 ID 的复核状态。
6. [baseline.json](baseline.json)：v4.4.4、安装目录、宿主版本与哈希。
7. [source/](source/)：原始测试包资料归档。
8. [PACK-MECHANISM.md](PACK-MECHANISM.md)：分包任务结构、独立 ZIP、集成/回滚与验收流程。

关键事实：

- 基线：v4.4.4 标签对象 `22cf379`，真正提交 `1fe5292`；本机宿主 1.11.7。安装目录 384 个运行文件中 383 个与 v4.4.4 一致，1 个已知缺失 v2 模型包（`tools/test-policy-model-v2-reachability.mjs` 证明其全仓库无运行时 import，确认不可达）。
- 142 将（2026-10-31 起为**技能级**状态，280 个技能）：P1 3、P2 49、P3 90；武将级——已修复 1、验证无问题 4、部分通过 8、尚未验证 129；技能级——已修复 5、验证无问题 20、部分验证 13、尚未验证 242。单技能通过不再抬高整个武将的状态。
- 已落地（6 项）：界孙权制衡低血保留、周妃旧版箜声数量修正、界鲁肃 redimeng 暗牌公平选择（清单外）、界张辽突袭目标收益、界魏延奇谋 cardUsable 阻塞放宽、OL界魏延奇谋支付档位收紧。
- 分包化（2026-11-01）：策略拆为 `policyCore.js` + 分包 `packs/`/`rules/` + 注册表；`142-task-list.json` schema 4.0 按 16 个真实分包汇总状态。5 个分包 ZIP 中，`out_of_scope` 与 `shenhua_feng` 已完成逐包验收并按 `可交付` 生成，其余三个为阶段性包（仍有未审查技能）。`apply-pack.mjs`/`rollback-pack.mjs` 已事务化：预检注册表依赖、备份修改文件、失败恢复、重复安装幂等、回滚保留空注册表；13 条安装/回滚回归 PASS，含“预存注册行但模块缺失”拒绝安装与旧记录悬空导入阻止。
- 已验证无需改（20 技能）：标准制衡（完整回合）、标准突袭、标准仁德、标准缔盟、新版箜声、界突袭只有友方目标、标准苦肉、界苦肉+诈降、典韦/界典韦强袭；神话再临·风 11 项（张角雷击/鬼道/黄天、于吉蛊惑、夏侯渊神速、小乔天香/红颜、魏延狂骨、曹仁据守、周泰不屈、黄忠烈弓）均有真实宿主固定局面，并按 `规则结算验证通过`/`AI决策验证通过`/`正反向决策验证通过` 分级登记；原生/扩展决策语义一致（天香对称座位差异、蛊惑假声明+确定质疑的原生取消/扩展放弃单列），未复现需改缺陷。风包 acceptance 共 23 条技能级检查，不再只检查场景存在。
- 神话再临·火首轮（2026-11-02）：14 项登记技能已全部取得首轮结论；`qiangxix` 沿用完整回合验证，`quhu`/`jieming`/`oldniepan`/`tianyi`/`shuangxiong`/`jianchu`/`lianhuan` 已实际发动并有结算，`luanji`/`huoji` 在保守局面未发动、`bazhen`/`kanpo` 只验证前置、`mashu`/`xueyi` 只验证被动规则，统一记为 `部分验证`，不宣称无缺陷。证据见 `shenhua-huo-review-native-1.json`。
- 回归：41 个 Node 入口全部 exit 0；宿主套件 68–70 场景三组对照 0 错误；三模式托管局含停滞诊断；第二批新增独立页面运行器 `tools/skill-ai-hp-real-host.mjs`。
- Fork master 已快进到 `1fe5292`，已删除独有 0 的 feature 分支；fix/model-lifecycle 保留复核。本地试验安装见 `live-install/`（第二批代码尚未重新部署到安装目录）。
