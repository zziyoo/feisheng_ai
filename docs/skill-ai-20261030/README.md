# 无名AI 技能AI复核资料（2026-10-30）

先读：

1. [REPORT.md](REPORT.md)：总报告、结论、第一批优化、风险。
2. [branch-report.md](branch-report.md)：分支逐条处理与待确认的远端操作。
3. [test-report.md](test-report.md)：可复现命令、回归计数、三模式性能。
4. [next-batches.md](next-batches.md)：按机制的后续计划。
5. [142-task-list.json](142-task-list.json) / [142-task-list.csv](142-task-list.csv)：全部 142 个武将 ID 的复核状态。
6. [baseline.json](baseline.json)：v4.4.4、安装目录、宿主版本与哈希。
7. [source/](source/)：原始测试包资料归档。

关键事实：

- 基线：v4.4.4 = `1fe5292eb3022dd8d1db494617b21a12be912e61`，本机宿主 1.11.7。
- 142 将：P1 3、P2 50、P3 89；未验证 134，未把排期当缺陷。
- 已落地：界孙权制衡低血保留、周妃旧版箜声数量修正、界鲁肃 redimeng 暗牌公平选择（清单外）、界张辽突袭目标收益。
- 已验证无需改：标准突袭、标准仁德、标准缔盟、新版箜声。
- 回归：40 个入口 exit 0；三模式托管局无错误；Android 长时未验收。
- 远端 Fork 快进/删分支待用户确认，命令见分支报告第 5 节。
