# 无名 AI 十六分包最终集成（限定部署配置）

内部开发者交付，不是公开发布、Release、Android/联机验证或全模式验证。

## 状态

**无名 AI 十六分包最终内部集成 PASS（限定已验证部署配置）。**

已验证配置：

- 十份剩余分包原生 AI 补丁，累计应用到干净无名杀 1.11.7；
- 六份既有扩展分包，按正式顺序安装到上游 `1fe5292` 完整无名AI扩展根；
- 不叠加六包自己的原生补丁路线；不生成新的扩展 ZIP。

详见 `ACCEPTANCE.md`、`DEPLOYMENT.md`、`skill-takeover-matrix.md`。

## 目录

```text
feisheng-ai-sixteen-packs-final/
├─ packs/                 六份既有扩展 ZIP（字节与六包封版一致）
├─ native/                十份剩余分包原生 AI 补丁
├─ phase1/                基线、ZIP/补丁/宿主哈希
├─ phase3/                组合真实宿主证据与对照
├─ phase4/                补丁往返、扩展回滚、继承事务电池
├─ README.md              本文件
├─ ACCEPTANCE.md          统一验收报告与十问回答
├─ UPGRADE.md             从六包/十包单独部署迁移
├─ DEPLOYMENT.md          受支持安装/回滚流程
├─ skill-takeover-matrix.md 技能接管矩阵与不支持混装
├─ PROVENANCE.md          Git 版本、来源与产物对应
├─ P2.md                  保留的 P2 清单
├─ GIT-HEAD.txt           最终集成分支 HEAD
└─ SHA256SUMS.txt         全部交付文件哈希
```

## 快速安装

1. 备份宿主与扩展根；确认宿主五文件为干净 1.11.7。
2. 按 `DEPLOYMENT.md` 第 2 节累计应用十份原生补丁，执行语法检查。
3. 在干净扩展根应用一次 `patches/score-index.diff` 接线。
4. 按正式顺序安装六份扩展：

```text
refresh_standard → refresh_feng → shenhua_feng → shenhua_huo → shenhua_lei → out_of_scope
```

5. 回滚按 `DEPLOYMENT.md` 第 6 节：先逆序回滚六包，再逆序撤销十补丁。

## 不支持

- 六包原生补丁与对应扩展同装；
- 同一逻辑分包原生 + 扩展重复接管；
- 旧双风顺序、旧 ZIP/旧共享核心混装、任意安装顺序；
- 把十份原生补丁包装成扩展 ZIP；
- Android、联机、斗地主/国战/2v2 等未测模式。

## P2

qizhi 全保护摸牌、reqiaobian draw 上下文、feijun 支付前估值、rehuashen 空池合法路径、tuntian 随机估计、skillPlanHints 接线，以及六包封版既有 P2。详见 `ACCEPTANCE.md` 第 8 节；本轮未修改这些宿主规则。
