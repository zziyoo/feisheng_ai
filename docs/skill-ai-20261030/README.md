# 无名AI 技能AI复核资料（2026-10-30）

先读：

1. [REPORT.md](REPORT.md)：总报告、结论、第一批优化、风险。
2. [branch-report.md](branch-report.md)：分支逐条处理、Fork 收尾与 fix/model-lifecycle 复核。
3. [test-report.md](test-report.md)：可复现命令、回归计数、三模式性能。
4. [next-batches.md](next-batches.md)：按机制的后续计划。
5. [142-task-list.json](142-task-list.json) / [142-task-list.csv](142-task-list.csv)：全部 142 个武将 ID 的复核状态。
6. [baseline.json](baseline.json)：v4.4.4、安装目录、宿主版本与哈希。
7. [source/](source/)：原始测试包资料归档。

关键事实：

- 基线：v4.4.4 标签对象 `22cf379`，真正提交 `1fe5292`；本机宿主 1.11.7。安装目录 384 个运行文件中 383 个与 v4.4.4 一致，1 个已知缺失 v2 模型包。
- 142 将：P1 3、P2 49、P3 90；已复现 3、验证无问题 4、尚待验证 1、尚未验证 134。
- 已落地：界孙权制衡低血保留、周妃旧版箜声数量修正、界鲁肃 redimeng 暗牌公平选择（清单外）、界张辽突袭目标收益。
- 已验证无需改：标准制衡（完整回合）、标准突袭、标准仁德、标准缔盟、新版箜声、界突袭只有友方目标。
- 回归：41 个入口全部 exit 0；三模式托管局含停滞诊断；Android 长时未验收。
- Fork master 已快进到 `1fe5292`，已删除独有 0 的 feature 分支；fix/model-lifecycle 保留复核。本地试验安装见 `live-install/`。
