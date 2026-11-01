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
- 142 将（2026-10-31 起为**技能级**状态，280 个技能）：P1 3、P2 49、P3 90；武将级——已修复 1、验证无问题 4、部分通过 8、尚未验证 129；技能级——已修复 5、验证无问题 9、尚未验证 266。单技能通过不再抬高整个武将的状态。
- 已落地（6 项）：界孙权制衡低血保留、周妃旧版箜声数量修正、界鲁肃 redimeng 暗牌公平选择（清单外）、界张辽突袭目标收益、界魏延奇谋 cardUsable 阻塞放宽、OL界魏延奇谋支付档位收紧。
- 分包化（2026-11-01）：策略拆为 `policyCore.js` + 分包 `packs/`/`rules/` + 注册表；`142-task-list.json` schema 4.0 按 16 个真实分包汇总状态；5 个阶段性分包 ZIP 见 `../feisheng-ai-packs`（桌面），均未标记完整交付。
- 已验证无需改（9 技能）：标准制衡（完整回合）、标准突袭、标准仁德、标准缔盟、新版箜声、界突袭只有友方目标、标准苦肉、界苦肉+诈降、典韦/界典韦强袭。
- 回归：41 个 Node 入口全部 exit 0；宿主套件 68–70 场景三组对照 0 错误；三模式托管局含停滞诊断；第二批新增独立页面运行器 `tools/skill-ai-hp-real-host.mjs`。
- Fork master 已快进到 `1fe5292`，已删除独有 0 的 feature 分支；fix/model-lifecycle 保留复核。本地试验安装见 `live-install/`（第二批代码尚未重新部署到安装目录）。
