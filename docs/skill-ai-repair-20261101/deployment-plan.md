# 无名AI 分包化后的部署计划（审查补修包）

- 目标：说明当前 HEAD 与已安装扩展目录的差异、文件清单、备份、校验与回滚。
- 本轮**不执行**安装目录覆盖；本文件是部署计划，不是已部署声明。
- 版本保持 4.4.4；不修改发布公告、不新增发布标签。

## 一、与已安装目录的差异

已安装目录（本机当前）仍为拆包前的单文件策略层：

- `score/index.js`：已与 HEAD 一致（含 `installSkillAIPolicies`/`uninstallSkillAIPolicies` 接线）。
- `score/decision/skills/skillAIPolicies.js`：旧单文件实现（HEAD 已改为 facade）。
- `score/decision/skills/skillAIPolicyRules.js`：旧单文件规则（HEAD 已改为聚合出口）。
- 以下 HEAD 新增、安装目录不存在：
  - `score/decision/skills/policyCore.js`
  - `score/decision/skills/skillAIPolicyPacks.js`
  - `score/decision/skills/packs/outOfScope.js`
  - `score/decision/skills/packs/refreshStandard.js`
  - `score/decision/skills/packs/shenhuaLei.js`
  - `score/decision/skills/packs/shenhuaFeng.js`
  - `score/decision/skills/packs/refreshFeng.js`
  - `score/decision/skills/rules/outOfScope.js`
  - `score/decision/skills/rules/refreshStandard.js`
  - `score/decision/skills/rules/shenhuaLei.js`
  - `score/decision/skills/rules/shenhuaFeng.js`
  - `score/decision/skills/rules/refreshFeng.js`

`score/decision/skills/skillAIPolicyRules.js` 仍保留给测试/旧工具统一 import，但运行时不再被策略模块引用。`score/index.js` 无需改动。

## 二、部署步骤（整包）

1. 关闭游戏；备份安装目录：
   - `score/decision/skills/skillAIPolicies.js`
   - `score/decision/skills/skillAIPolicyRules.js`
   - 记录 `score/index.js` SHA256。
2. 从 HEAD（或补修包 `source/`）复制上述 14 个文件到安装目录对应路径；`score/index.js` 仅在 SHA 一致时保留。
3. 校验：逐文件 SHA256 与 `manifest.json` 一致；启动游戏，确认策略层 installed、无 pageerror。
4. 若只集成某个分包，使用该分包 ZIP 的 `integration/apply-pack.mjs`，不要手工覆盖共享核心；两包共存时后装包只追加注册行。
5. 回滚：还原备份文件并删除新增文件；或使用分包 ZIP 的 `integration/rollback-pack.mjs` 按安装记录回滚。整包回滚到 `3bb2434`：还原 `skillAIPolicies.js`/`skillAIPolicyRules.js`，删除新增核心/分包文件。

## 三、安装后验证

- `score/index.js` 未变化（与 HEAD blob 一致）。
- `score/decision/skills/policyCore.js` 等新增文件存在且 SHA256 与 manifest 一致。
- 策略统计 `policyStats.installed === true`；卸载后为 false；重装后重新为 true。
- 至少跑一遍 `split-suite-policy.json` 对应命令或分包 ZIP 内的宿主场景命令。
- 134 维契约测试、`info.json` 版本 4.4.4 不变。

## 四、回滚

- 分包级：`node integration/rollback-pack.mjs --extension-root <扩展>`；只删本包文件与注册行，保留共享核心和其他包。
- 整包级：还原备份的 `skillAIPolicies.js`/`skillAIPolicyRules.js`，删除 `policyCore.js`、`skillAIPolicyPacks.js`、`packs/`、`rules/` 新增文件；`score/index.js` 若已一致则无需改动。
- 任何回滚前先记录安装目录当前 SHA256；不要删除用户未提交的配置文件或其他扩展。

## 五、限制

- 本轮未在正式安装目录执行部署；Android 真机长跑/多局验收仍是公开发版前置条件。
- 阶段包不是可直接安装的完整扩展；不要把源码补丁 ZIP 当扩展包导入。
