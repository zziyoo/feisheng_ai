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
- 142 将（2026-10-31 起为**技能级**状态，280 个技能）：P1 3、P2 49、P3 90；武将级——已修复 3、验证无问题 17、部分通过 7、尚未验证 115；技能级——已修复 7、验证无问题 31、部分验证 0、尚未验证 242。单技能通过不再抬高整个武将的状态。
- 已落地（8 项）：界孙权制衡低血保留、周妃旧版箜声数量修正、界鲁肃 redimeng 暗牌公平选择（清单外）、界张辽突袭目标收益、界魏延奇谋 cardUsable 阻塞放宽、OL界魏延奇谋支付档位收紧、界魏延狂骨 1 血优先回复、袁绍乱击队友致死否决。
- 分包化（2026-11-01）：策略拆为 `policyCore.js` + 分包 `packs/`/`rules/` + 注册表；`142-task-list.json` schema 4.0 按 16 个真实分包汇总状态。6 个分包 ZIP 中，`out_of_scope`、`shenhua_feng`、`shenhua_huo` 已完成逐包验收并按 `可交付` 生成，其余三个为阶段性包（仍有未审查技能）。`apply-pack.mjs`/`rollback-pack.mjs` 已事务化：预检注册表依赖、备份修改文件、失败恢复、重复安装幂等、回滚保留空注册表；13 条安装/回滚回归 PASS，含“预存注册行但模块缺失”拒绝安装与旧记录悬空导入阻止。
- 已验证无需改（31 技能）：标准制衡（完整回合）、标准突袭、标准仁德、标准缔盟、新版箜声、界突袭只有友方目标、标准苦肉、界苦肉+诈降、典韦/界典韦强袭；神话再临·风其余 10 项（张角雷击/鬼道/黄天、于吉蛊惑、夏侯渊神速、小乔天香/红颜、曹仁据守、周泰不屈、黄忠烈弓）均有真实宿主固定局面，并按 `规则结算验证通过`/`AI决策验证通过`/`正反向决策验证通过` 分级登记；火其余 13 项（强袭、驱虎、节命、连环、涅槃、天义、双雄、血裔、八阵、火计、看破、马术、鞬出）均有正向发动/负向不发动或被动规则证据。风包 acceptance 共 23 条技能级检查，不再只检查场景存在。
- 神话再临·风/火 AI 质量审查（2026-11-03）：新增运行时优化 `xinkuanggu`（1血可回复时优先回复）、`luanji`（1血空手无防具队友将被万箭打进濒死时拒绝发动）；`qiangxix`/`shuangxiong` 虽复现合法但次优的候选，未满足“有稳定AI入口且严格占优”，保留原生；`releiji` 的连环传导已由宿主 `get.effect` 计入，`guhuo` 真牌选择、`oldniepan` 桃优先均实测无退化。风 12 项、火 14 项逐项审查矩阵、两个固定种子原生/策略/扩展对照、第三种子夹具停滞日志及原生 AI 补丁见 `docs/skill-ai-quality-20261103/`。
- 神话再临·火最终验收（2026-11-02）：14 项登记技能全部审查；`lianhuan` 复核后确认原“已横置目标一律 -100”策略会造成真实退化（低血友方/自身解除横置被拦截、禁用重铸时空过），已删除覆盖并恢复宿主 `get.effect`；其余 13 项按 `正反向决策验证通过`/`AI决策验证通过`/`规则结算验证通过` 登记。火包主组 37 场景、乱击正向 1 场景、火计正向 1 场景分别通过 acceptance；合并后 39 场景、39 条技能级检查 PASS，原生/扩展 `semantic_all=true`；`exact_all` 会因重铸后的随机摸牌在复跑间变化（最终 acceptance 为 true），无策略差异，有界完整对局通过。证据见 `shenhua-huo-review*.json`、`shenhua-huo-lianhuan-boundary*.json`、`accept-shenhua_huo*.json`。
- 回归：41 个 Node 入口全部 exit 0；宿主套件 68–70 场景三组对照 0 错误；三模式托管局含停滞诊断；第二批新增独立页面运行器 `tools/skill-ai-hp-real-host.mjs`。
- Fork master 已快进到 `1fe5292`，已删除独有 0 的 feature 分支；fix/model-lifecycle 保留复核。本地试验安装见 `live-install/`（第二批代码尚未重新部署到安装目录）。
