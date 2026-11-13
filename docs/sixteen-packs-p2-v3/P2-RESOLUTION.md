# 十六包遗留事项与关闭门禁

工作表的 25 个原 ID 完整保留，与历史 P2 和交付报告去重。同条目发现不同根因时另加子 ID。总计 27 项。
状态统计为 5 项已修复并验收、3 项已证明无缺陷、1 项经验证不可达、10 项接受的部署约束、2 项未覆盖/未通过、6 项仍待修复。整体验收状态见 [ACCEPTANCE.md](ACCEPTANCE.md)。
线上台账以 [腾讯同步记录](TENCENT-SYNC.md) 为准。

## P2-01 qizhi

**已修复并验收** · P2 · `shenhua_yin`。可达。旧版手牌全受保护仍把该目标评为正收益，强制弃牌找不到合法牌后实际会摸牌。

- 位置 `无名杀 character/sp.js，qizhi.cost 的选择评分`。
- 处置 AI 使用 canBeDiscarded 与真实 qizhi 上下文。宿主手选、弃牌和摸牌结算沿用原行为。
- 兼容 原生 AI 专项，仅修改选目标评分；无共享依赖。
- 验证 旧全保护分 1 并摸牌；新分 0、AI 拒绝、无摸牌。合法桃可弃场景选择并结算，保护八卦保留。Node 7/7。
- 证据 identity-stock.json, identity-final.json。
- 提交及产物 `500d5e7`；`native/shenhua_yin.patch` `1db10db4b940a0d92970dc7b445fc1e21d44e794dd9b50264ba5aa2aa8a5c760`。

## P2-02 reqiaobian

**已修复并验收** · P2 · `refresh_shan`。可达。摸牌、出牌和弃牌阶段把判定阶段权限当作准入条件。

- 位置 `无名杀 character/refresh.js，reqiaobian.filter`。
- 处置 将三处准入检查使用实际阶段名，与 chooseToDiscard 一致。
- 兼容 原生准入范围变化，标记与阶段跳过结算保留。
- 验证 四阶段弃牌权限 4×4，旧 draw-only 无提示；新 phaseDrawBefore 真弃牌、跳过、向两敌获得牌。Node 24/24 还覆盖标记与禁弃反例。
- 证据 identity-stock.json, identity-final.json。
- 提交及产物 `cf69734`；`native/refresh_shan.patch` `1ab04891fe444a7302e2db6e33756f00e2bb1418b100958122e9744c9bf8a599`。

## P2-03 nzry_feijun

**已修复并验收** · P2 · `shenhua_yin`。可达。支付一张牌可能打开比较牌数的合法目标；旧 AI 没有提前识别。

- 位置 `无名杀 character/shenhua.js，nzry_feijun.ai`。
- 处置 按实际候选费用投影装备和手牌数量，比较目标收益，保留选项与兵略结算。
- 兼容 原生费用选择和发动评分；检查事件上下文、误弃及空目标。
- 验证 真实同手或同装备，旧发动分为空，新分 1。价值 0 五谷和价值 2 青釭实际支付，交付/敌八卦弃置及兵略+2 正常。保护装备和无目标均取消且不支付。Node 16/16。
- 证据 identity-refined.json, identity-feijun-old.json。
- 提交及产物 `47228bd`；`native/shenhua_yin.patch` `1db10db4b940a0d92970dc7b445fc1e21d44e794dd9b50264ba5aa2aa8a5c760`。

## P2-04 reqimou

**仍待修复** · P2 · `refresh_feng`。可达。敌人三体力、两张杀且公开信息没有确定击杀时策略保守。

- 位置 `score/decision/skills/packs/refreshFeng.js，奇谋规则及六包 P2`。
- 处置 保留现有阈值。合法目标、射程和确定杀收益优先，后续摸牌存在不确定性。
- 兼容 改阈值会改变已验收奇谋攻击与体力决策。
- 验证 历史 3HP/两杀弃用已复现。未证实存在确定收益且当前必然错误的状态。
- 证据 历史六包 P2、界风奇谋验收。

## P2-05 qiangxix

**仍待修复** · P2 · `shenhua_huo`。历史实际观察到弃用后续攻击所需武器。

- 位置 `无名杀 character/shenhua.js 的 qiangxix 与 ai/basic.js:142`。
- 处置 宿主可选 check 在定目标前逐牌打分，先前改动影响丈八；缺少稳健的目标相关估值方案。
- 兼容 现有火包和备选原生路线保留。
- 验证 历史强袭武器机会成本观察仍有效。旧方案改变其他武器使用，保留基线。
- 证据 历史火包验收；宿主 check 入口审查。

## P2-06 xinfu_zuilun

**仍待修复** · P2 · `shenhua_lei`。原生可达。旧回调排序外层列表并从原列表取牌，无法按预期调整牌序。

- 位置 `无名杀 character/shenhua.js:1312 与 noname/library/element/content.js 的 chooseToMove`。
- 处置 保留缺陷。宿主直接调用 event.processAI，当前扩展没有精确的选牌入口；修复需验证公开信息、牌序和触发链。
- 兼容 避免全局接管或复制整个结算。
- 验证 已定位原排序列表问题。正式扩展安全入口缺失，未触碰结算。
- 证据 源码审查、神话雷验收侧枝。

## P2-07 drlt_xiongluan

**已修复并验收** · P2 · `shenhua_lei`。可达。countCards 把 0.5/0.25 当真值，普通和改八卦杀权重均被放大。

- 位置 `无名杀 character/shenhua.js:1817；score/decision/skills/{packs,rules}/shenhuaLei.js`。
- 处置 用仅命中 1.11.7 原回调指纹的分包包装器求和。异常走原回调，卸载按函数身份恢复。
- 兼容 仅正式扩展路线更新。包内历史原生备选保留旧行为。
- 验证 实际阶段 chooseToUse 同引擎 A/B：一杀对 1HP 八卦原评分 -1→0，两杀 -2→-1，两杀照常对敌人发动并施加封锁。一杀两边均不发动，六场均未选择友方。
- 证据 identity-xiongluan-actual.json, identity-refined.json。
- 提交及产物 `ce04040`；`packs/feisheng-ai-shenhua-lei.zip` `40d9ef55299319e9337c2b767e6220536ba32c3de0d0f05e8681611a0db9a6f4`。

## P2-08 twjuxiang

**仍待修复** · P2 · `shenhua_lei`。可达。送出装备评分难以同时体现给方损失、收方装备或复栏收益。

- 位置 `无名杀 character/tw.js:13026–13062`。
- 处置 保留。定目标前的单牌估值缺少可靠的目标条件。
- 兼容 避免误开已受限装备栏或改变送装/复栏规则。
- 验证 真实送装有多方后续收益，未确认可独立安全调整的代价公式。
- 证据 宿主源码及神话雷历史 P2。

## P2-09 drlt_zhengu 第三方

**接受的部署约束** · P2 · `shenhua_lei`。第三方先占或后覆盖时可达，扩展镇骨修复可能失效。

- 位置 `score/decision/skills/packs/shenhuaLei.js 的 onChooseTarget 钩子`。
- 处置 保持现有安全跳过与身份恢复，排查时核对第三方钩子及安装次序。
- 兼容 不会为争夺钩子而覆盖或删除第三方实现。
- 验证 钩子冲突时安全降级。代码身份校验及旧镇骨 19 场景证据继承；本版人工点击另行实测。
- 证据 历史 phase3/zhengu-combined.json, identity-zhengu-manual.json。

## P2-10 retianxiang

**经验证不可达** · P2 · `shenhua_feng / refresh_feng`。受支持 6+10 路线无替换后的 aiOptions 调用链。备选历史原生的三个未捕获调用可受第三方影响。

- 位置 `历史 dual-feng-native-candidate.patch；两风扩展入口`。
- 处置 不改正式策略；历史备选路线的第三方异常仍有风险。
- 兼容 备选原生与对应扩展互斥。
- 验证 在正式 6+10 输入路径中无相关 aiOptions 调用；历史备选原生与第三方叠加仍不支持。
- 证据 正式 ZIP 入口、宿主与历史原生补丁静态核对。

## P2-11 rehuashen

**已修复并验收** · P0 · `refresh_shan`。正常入场通常抽三张。真实禁将配置可令合法池为空，初始 cost 仍进入。

- 位置 `无名杀 character/refresh.js:12350、12430；game.initCharacterList`。
- 处置 仅在初始真实添加化身后仍无候选时退出，发生在设置倒计时与创建强制对话框之前。
- 兼容 正常牌池、时机、换将、技能池与联动需要保留。
- 验证 同一真实禁将条件，旧强制空选择外部 watchdog 中止；新正常退出且无倒计时。正常池 3 张、合法切换，阶段循环和人工清空防御用例通过。
- 证据 identity-stock-empty-timeout.log, identity-stock-legal-initial.json, identity-refined.json。
- 提交及产物 `235aea0`；`native/refresh_shan.patch` `1ab04891fe444a7302e2db6e33756f00e2bb1418b100958122e9744c9bf8a599`。

## P2-12 tuntian-viewer

**已证明无缺陷** · P2 · `shenhua_shan`。固定 RNG 时有同公开状态的暗牌替换对照；跨进程随机结果可变。

- 位置 `docs/remaining-ten-packs/native/shenhua_shan.patch；宿主 mayHaveShan`。
- 处置 保留评分逻辑，使用真实宿主同 RNG/同公开状态检查。
- 兼容 不固定正式对局 RNG，不读取他人暗牌。
- 验证 固定 0.37，公开手牌数 2、已知 0，三种暗牌组合下同一事件沙/决斗评分、实际 get.effect 与 RNG 缓存一致。继承公开已知牌对照。
- 证据 identity-initial-native.json, identity-final.json。

## P2-13 skillPlanHints.js

**接受的部署约束** · P2 · `refresh_standard`。上游 1fe5292 引擎没有调用点。接入层按实际能力做探测，分包策略独立执行。

- 位置 `score/decision/engine/engine.js；tools/pack-templates/apply-pack.mjs:99`。
- 处置 保留 1fe5292 的可选模块状态；当前接线版本安装前检查 applyOwnedUtility 等依赖。
- 兼容 避免向旧引擎新增全局评分；安装/回滚保留兼容共享模块。
- 验证 1fe5292 源码无调用点。完整扩展已安装模块并加载六 owner，分包策略独立；新版能力探测与回滚保留模块均通过。
- 证据 install-exact-runtime.json, installer-battery.json。

## P2-14 wind_compatibility

**接受的部署约束** · P2 · `refresh_feng / shenhua_feng`。反序曾在真实交付 ZIP 上安全拒绝，固定顺序通过。

- 位置 `六包安装器 order-skillPlanHints；旧部署报告`。
- 处置 继续先界风后神话风；回滚逆序。
- 兼容 不声明任意安装顺序。
- 验证 本次正式顺序安装通过；旧归档的界风与神话风 SHA 均不变，旧反序零写入证据可继承。
- 证据 installer-battery.json；历史 phase4/inherited-six-pack/install-order-reject.json。

## P2-15 policyCore.js

**接受的部署约束** · P2 · `six-pack`。旧核心哈希冲突可达，安装器拒绝并回退。

- 位置 `tools/pack-templates/apply-pack.mjs；六包安装器事务`。
- 处置 使用原版本安装器回滚后在干净基线上按正式次序安装；手工保留第三方改动。
- 兼容 不自动覆盖、合并或删除旧核心。
- 验证 冲突核心拒绝、故障注入零残留；兼容基线回滚和重装通过。手工迁移按升级说明。
- 证据 installer-battery.json, UPGRADE.md。

## P2-16 manifest

**接受的部署约束** · P2 · `refresh_standard`。旧封版归档生成时写入封包待验收，外部验收凭据之后绑定同一 SHA。

- 位置 `历史 ZIP manifest/checklist；tools/build-skill-ai-pack.mjs`。
- 处置 保留冻结原件，由外层哈希绑定报告描述验收。新版仅重打实际修改的包。
- 兼容 不以追补元数据理由制造未验收的新标准包 ZIP。
- 验证 冻结界标 ZIP 与旧 SHA 一致，继续由哈希绑定独立报告提供验收权威。
- 证据 ARTIFACTS.json；0fa2c07 界标验收。

## P2-17 native-only

**接受的部署约束** · P2 · `refresh_standard / refresh_feng`。真实覆盖差异为界标 7 项、界风 5 项。

- 位置 `docs/sixteen-packs-acceptance/skill-takeover-matrix.md`。
- 处置 见支持矩阵，保持对应原生和扩展互斥。
- 兼容 没有新增扩展策略或接管。
- 验证 七项与五项的 ID 均在支持矩阵，旧路线上下文与扩展覆盖分开。
- 证据 COMPATIBILITY.md；历史 skill-takeover-matrix.md。

## P2-18 native-patches

**接受的部署约束** · P2 · `all`。同技能双路线并行会重复接管。安装器不能识别所有已应用原生补丁。

- 位置 `docs/sixteen-packs-acceptance/DEPLOYMENT.md 与六包 UPGRADE`。
- 处置 安装前人工确认，正式组合排除六份历史原生备选。
- 兼容 避免重复叠加。
- 验证 十补丁和六扩展正式组合复验；六包历史原生路线未加入。文档要求人工识别所有已应用补丁。
- 证据 native-roundtrip.json, installer-battery.json, COMPATIBILITY.md。

## P2-19 drlt_zhengu 人工

**已证明无缺陷** · P2 · `shenhua_lei`。历史自动事件与评分证据已有。人工选择、取消、复选需独立浏览器证据。

- 位置 `旧 phase3/zhengu-combined.json；无名杀 chooseTarget 对话框`。
- 处置 保留人工结算，单列真实点击验证。
- 兼容 结构级验证不能替代点击。
- 验证 真实浏览器点击：取消后无存储，复选第二人后生效，两次 sync 结算结束，零页错误。
- 证据 identity-zhengu-manual.json。

## P2-20 Android / 联机 / 斗地主 / 国战 / 2v2

**未覆盖/未通过** · P2 · `all`。支持范围外的各模式不能由身份局数据推断。

- 位置 `旧 Windows 身份局报告与跨模式工具`。
- 处置 按实际设备、宿主、部署组合和场景报告。
- 兼容 未测模式与平台保留。
- 验证 Windows 1.11.7 Chrome 国战 8 人、2v2 4 人各 5 项宿主/响应模块检查；斗地主 3 人启动与响应窗口观察。完整六加十组合、Android、联机仍未覆盖。
- 证据 guozhan-smoke.json, versus-two-smoke.json, doudizhu-observation.json。

## P2-21 LF / CRLF

**接受的部署约束** · P2 · `all / 历史火雷原生`。原生补丁要求精确 LF 上下文；CRLF 场景需安全拒绝。

- 位置 `十份补丁；旧六包 DEPLOYMENT`。
- 处置 按 SHA 检查原宿主五文件与 LF 基线；失败先备份，改用干净 LF 副本。
- 兼容 不原地自动转换旧用户文件。
- 验证 十补丁在真实五文件 LF 副本累计应用、逆序撤销、字节恢复。每份 CRLF 实际应用拒绝，哈希未变；重复应用也拒绝。
- 证据 native-roundtrip.json。

## P2-22 xinkuanggu

**已证明无缺陷** · P2 · `shenhua_feng`。可达。真实八人双将身份局的 re_weiyan + dc_jsp_guanyu，3/4 体力空手，未觉醒的单骑把宿主摸牌评分提高到 24，回复仍为 22.5。

- 位置 `tools/kuanggu-rule-matrix.mjs:39–49`。
- 处置 真实 damage 触发狂骨，选择和结算均为 draw_card，手牌 0→1，体力保持 3。现有策略无需改。
- 兼容 不重开狂骨既有 P1，也不把规则级覆盖写成真实宿主。
- 验证 未替换宿主 get 估值，真实 damage→狂骨在摸牌大于正回复时确实摸牌，且已核对风包运行字节。
- 证据 kuanggu-draw-over-recovery.json。

## P2-23 builder

**接受的部署约束** · P2 · `all`。不同历史构建器、生成注册表、测试输入和归档元数据无法由同一当前 HEAD 推出。

- 位置 `docs/SIXTEEN_PACK_DELIVERY_LEDGER.md；六包源清单`。
- 处置 旧输入按历史 HEAD 和 SHA 追溯。雷 v3 按密封 ZIP 与精确 Git blobs 复现。
- 兼容 保留已验收归档，避免为齐头改变哈希。
- 验证 历史 ZIP 不统一重打。六包 Git blob 与生成注册表已核对，新雷 ZIP 可按旧 SHA 与指定提交复现。
- 证据 PROVENANCE.md, ARTIFACTS.json。
- 提交及产物 `11232f8`、`77234ac`。

## P2-24 history tests

**未覆盖/未通过** · P2 · `all`。完整历史矩阵未全量重跑。

- 位置 `历史 phase3 证据及独立十包/六包报告`。
- 处置 区分未变字节的历史证据与 v3 专项；受影响的路径单独重验。
- 兼容 既有日志保留来源和适用范围。
- 验证 实际只跑受影响路径和关键同宿主冒烟。历史 93 默认场景、89 技能检查和独立十包固定场景继续按范围引用。
- 证据 ACCEPTANCE.md；历史 phase3 证据。

## P2-25 redimeng

**接受的部署约束** · P2 · `out_of_scope`。宿主原生第二目标查找可抛异常；正式仅扩展处理。

- 位置 `宿主 redimeng.find(2)；扩展 score/decision/skills/packs/outOfScope.js`。
- 处置 保留扩展独占部署和 `dimeng` / `redimeng` 分开的验证。
- 兼容 不将未开发的原生支持误当成扩展回归。
- 验证 原生 find(2) 不支持。正式扩展二目标合法路径和隐藏牌不变量重新核对，原生 dimeng 独立真实事件通过。
- 证据 identity-final.json, identity-critical.json, COMPATIBILITY.md。

## P2-01b qizhi 人工强制选择

**仍待修复** · P2 · `shenhua_yin`。真实宿主即使强制选中的目标所有牌都受保护、弃置没有结果，仍继续摸牌。

- 位置 `无名杀 character/sp.js 的 qizhi.content`。
- 处置 保留宿主技能结算。AI 已能避开，是否调整规则需独立确认官方技能语义与人工结算。
- 兼容 触及实际规则或手动玩法，超出本次 AI 修复。
- 验证 旧真实事件证明保护装备留存却摸牌。AI 防止此收益进入决策，手选规则维持。
- 证据 identity-stock.json, P2-01。

## P2-07b drlt_xiongluan 通用 get.effect

**仍待修复** · P2 · `shenhua_lei / 完整引擎`。旧扫描把 target.addTempSkill(..._ban) 识别为给友方支援。泛用评分 A/B 都出现同样敌友偏置。真实 phaseUse 使用实际自动选择链，六场未复现友方目标。

- 位置 `score/decision/safety/aiOverride.js:907–943；score/decision/skills/skillScanner.js；无名杀 get.effect`。
- 处置 保留为通用引擎策略限制。未为非标准泛用选目标路径调整共享推断或覆写技能效果。
- 兼容 若后续有真实影响，先确认评分入口并专项复验共享安全层。
- 验证 同一完整引擎换旧/新技能评分，泛用 get.effect 均存在友方 +15、敌方惩罚。实际出牌阶段 AI 目标未复现，未提升为 P1。
- 证据 identity-refined.json, identity-xiongluan-actual.json。
