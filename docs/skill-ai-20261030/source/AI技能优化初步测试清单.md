# AI技能优化初步测试清单

共整理142个武将版本，按优先检查、测试后再决定、暂时保留三类安排。列出的问题是检查方向，还需要结合实际对局确认。

| 分类 | 武将版本数 | 处理 |
|---|---:|---|
| 优先检查 | 56 | 先核对代码，再用具体场景测试 |
| 验证后决定 | 75 | 测出误判或效果变差再改 |
| 暂时保留 | 11 | 保留现有写法，检查是否受其他改动影响 |

基线：libnoname/noname，提交 `b481b17552dd46e7d9ca805d5d7975b742168256`。技能名称和ID用于查找代码，并不是每个技能都要改。本包只有说明和测试任务，不含可安装的扩展，也没有修改技能规则。

## 优先检查 56个版本

这56个版本先检查。表中写了要看的决策和测试场景，测出问题后再确定改法。

### 标准2008

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 张辽 `zhangliao` | [突袭 `tuxi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L607) | 比较少摸牌成本、目标失牌净收益及队友机制，不只按态度和屯田ID选人 | 友方临近觉醒；敌方空手受益；标准两目标与界可变目标 |
| 刘备 `liubei` | [仁德 `rende`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L961)、[激将 `jijiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1080) | 联合选择牌/接收者/数量，比较自身阈值奖励和后续行动，分别适配标准仁德与界仁德 | 交最后一张防御；两张阈值；接收者重复/获牌限制 |
| 孙权 `sunquan` | [制衡 `zhiheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1576)、[救援 `jiuyuan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1622) | 比较先用后换、部分换牌、全手换牌，避免固定高价值牌门槛破坏路线 | 唯一闪/桃；界全手额外摸牌；装备区保留 |
| 黄盖 `huanggai` | [苦肉 `kurou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1686) | 按可见生存资源、实际失去体力与补牌收益决定苦肉次数及顺序 | 一血无救援；已有过牌；界诈降后输出 |
| 大乔 `daqiao` | [国色 `guose`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1799)、[流离 `liuli`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1818) | 国色控制与支付牌比较，流离按可转移目标、损失和连锁收益联合判断 | 转移给友方；无合法新目标；界国色两种用途 |
| 貂蝉 `diaochan` | [离间 `lijian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2253)、[闭月 `biyue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2308) | 支付牌与两个目标联合评价，明确决斗实际发起者，不按两个独立负分选人 | 两敌强弱不同；友敌混合；响应/伤害收益变化 |

### 标准2013

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 袁术 `re_yuanshu` | [妄尊 `rewangzun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L142)、[同疾 `retongji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L188) | 标准望尊同疾、雷包庸肆伪帝分开建模，按实际技能ID判断资源与转移 | 不同版本分离；弃牌与分配阈值；主公技/势力 |

### 神话·风

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 张角 `sp_zhangjiao` | [雷击 `releiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7483)、[鬼道 `guidao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8701)、[黄天 `huangtian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8837) | 连同响应牌保留、鬼道支付和实际雷击版本评价，不盲目追求被杀 | 判定可改善；无雷击目标；界雷击触发差异 |
| 于吉 `re_yuji` | [蛊惑 `xinfu_guhuo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8901) | 按合法声明、公开信息和风险估值，禁止使用未知对手手牌当决策输入 | 真假声明；濒死急需；原界质疑规则不同 |
| 夏侯渊 `re_xiahouyuan` | [神速 `xinshensu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7601) | 分别比较跳判摸、弃装备跳出牌等代价与额外杀收益；界设变另审 | 可跳过负面判定；关键装备；没有有效攻击 |
| 小乔 `xiaoqiao` | [天香 `retianxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7913)、[红颜 `hongyan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8234) | 天香实际伤害/失血/获牌版本分开，按目标生存和结算后的收益判断 | 低血友方；敌方卖血；界飘零与红颜 |
| 魏延 `re_weiyan` | [狂骨 `xinkuanggu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3720)、[奇谋 `qimou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3630) | 奇谋失血量、距离/次数解锁和狂骨兑现联合评价，不只看可用杀数 | 低血无回复；距离不足；原界奇谋效果 |

### 神话·火

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 典韦 `dianwei` | [强袭 `qiangxix`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6858) | 比较支付分支、击杀收益及装备保留；界强袭与宁恶分别确认 | 一血支付；关键装备；本回合多次使用 |
| 荀彧 `xunyu` | [驱虎 `quhu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6696)、[节命 `jieming`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6796) | 驱虎选拼点目标与受伤目标联动，节命按真实补牌空间评价 | 无可伤第三人；低点高风险；队友补牌受限 |
| 庞统 `pangtong` | [连环 `lianhuan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6)、[涅槃 `oldniepan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6643) | 把实际使用/转化/合法重铸分开，连环收益与火雷后续比较；涅槃独立救命 | 重铸丢组件；友方连环；界涅槃分支 |
| 太史慈 `taishici` | [天义 `tianyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7073) | 天义/酣战比较拼点支付、失败代价与成功后可兑现的杀 | 无杀；高点关键牌；成功却无目标 |
| 颜良文丑 `yanwen` | [双雄 `shuangxiong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7166) | 按本版本双雄判定/颜色转换和剩余手牌规划，不无差别消耗关键牌 | 只有一种颜色；决斗响应不足；原界差异 |
| 袁绍 `re_yuanshao` | [乱击 `luanji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7318)、[血裔 `xueyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7371) | 联合选支付牌并计算全场敌友效果，区分真实可触发补牌/主公收益 | 多友少敌；支付最后防御；原界乱击规则 |

### 神话·林

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 鲁肃 `re_lusu` | [好施 `haoshi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5745)、[缔盟 `dimeng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5811) | 好施/缔盟按支付牌、两个接收角色和后续资源联合评价；禁止额外读未知手牌 | 标准界成本不同；友方不能获牌；交换后弃牌 |
| 董卓 `dongzhuo` | [酒池 `jiuchi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6143)、[肉林 `roulin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6168)、[崩坏 `benghuai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6210)、[暴虐 `baonue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6249) | 酒池转换与实际杀收益、崩坏分支成本、主公回复分别估计 | 低血/低上限；酒次数；原界酒池规则 |
| 贾诩 `jiaxu` | [乱武 `luanwu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6290)、[完杀 `wansha`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6388)、[帷幕 `weimu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6421) | 乱武按全场公开局面估计敌友损益，不假设他人选择；完杀帷幕核对标签 | 友方濒死；攻击距离变化；原界乱武分支 |

### 神话·山

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 张郃 `zhanghe` | [巧变 `qiaobian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4107) | 逐阶段比较跳过代价、支付牌和偷牌/移牌组合，不用单一发动阈值 | 跳摸与正常摸；移除友方判定；原界巧变成本 |
| 刘禅 `liushan` | [享乐 `xiangle`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3933)、[放权 `fangquan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3997)、[若愚 `ruoyu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4086) | 比较当前出牌价值、额外回合接收者能力和支付成本，不盲目放权 | 己方能斩杀；队友被控制；原界支付/觉醒 |
| 左慈 `zuoci` | [化身 `huashen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4901)、[新生 `xinsheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5348) | 只评估本次可选化身技能和当前阶段价值；限制搜索，不扫描全武将组合 | 空候选；响应阶段；原界化身可选规则 |

### 神话·阴

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 王基 `wangji` | [奇制 `qizhi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/sp/skill.js#L39873)、[进趋 `jinqu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/sp/skill.js#L39919) | 奇制的自换/拆敌/助友联动进趋最终手牌目标，不能只按2/1/0.5评分 | 关键装备；队友失牌受益；进趋弃牌上限 |
| 孙亮 `sunliang` | [溃诛 `nzry_kuizhu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2387)、[掣政 `nzry_zhizheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2494)、[立军 `nzry_lijun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2534) | 溃诛选择目标集合和分支，治政/立军按当前记录与资源联动 | 弃牌数变化；伤害与摸牌选择；主公技可用 |
| 许攸 `xuyou` | [成略 `nzry_chenglve`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2621)、[恃才 `nzry_shicai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2725)、[寸目 `nzry_cunmu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2846) | 保留现有成略花色规划，进一步比较先用/后用、恃才置顶和寸目实际摸牌 | 同花色多杀；首种类牌；装备保留与置顶 |

### 神话·雷

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 毌丘俭 `guanqiujian` | [征荣 `zhengrong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L640)、[鸿举 `hongju`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L692) | 征荣选择和鸿举换牌/觉醒收益联合评价，保留关键可兑现资源 | 临近觉醒；可交换牌质量；无有效目标 |
| 陈到 `chendao` | [往烈 `dcwanglie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L145) | 往烈比较不可响应/距离收益与本阶段不能再用牌的机会成本 | 首牌可斩杀；后续多张好牌；回合外触发 |
| 陆抗 `lukang` | [谦节 `drlt_qianjie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1204)、[决堰 `drlt_jueyan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1248)、[破势 `drlt_poshi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1398) | 决堰废栏代价、当前手牌解锁和破势收益联动，不固定优先废某栏 | 关键防具；无可兑现手牌；觉醒前后 |
| 周妃 `zhoufei` | [良姻 `olliangyin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L293)、[箜声 `olkongsheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L517) | 箜声选择数量/装备与良姻触发阈值联动，核对数组长度与数量表达式 | 暂存为空/非空；装备使用对象；同手牌数阈值 |
| 张绣 `zhangxiu` | [雄乱 `drlt_xiongluan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1592)、[从谏 `drlt_congjian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1719)、[踞襄 `twjuxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/tw/skill.js#L12789) | 雄乱按可兑现输出和失去资源代价择时，从谏/聚降另审 | 目标受伤无效；资源不足；主公技装备转移 |
| 新杀袁术 `yl_yuanshu` | [庸肆 `drlt_yongsi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1448)、[伪帝 `drlt_weidi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1507) | 标准望尊同疾、雷包庸肆伪帝分开建模，按实际技能ID判断资源与转移 | 不同版本分离；弃牌与分配阈值；主公技/势力 |

### 界限突破·标准

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界张辽 `re_zhangliao` | [突袭 `new_retuxi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14254) | 比较少摸牌成本、目标失牌净收益及队友机制，不只按态度和屯田ID选人 | 友方临近觉醒；敌方空手受益；标准两目标与界可变目标 |
| 界大乔 `re_daqiao` | [国色 `reguose`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17191)、[流离 `liuli`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1818) | 国色控制与支付牌比较，流离按可转移目标、损失和连锁收益联合判断 | 转移给友方；无合法新目标；界国色两种用途 |
| 界黄盖 `re_huanggai` | [苦肉 `rekurou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16949)、[诈降 `zhaxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16974) | 按可见生存资源、实际失去体力与补牌收益决定苦肉次数及顺序 | 一血无救援；已有过牌；界诈降后输出 |
| 界刘备 `re_liubei` | [仁德 `rerende`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15511)、[激将 `rejijiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5886) | 联合选择牌/接收者/数量，比较自身阈值奖励和后续行动，分别适配标准仁德与界仁德 | 交最后一张防御；两张阈值；接收者重复/获牌限制 |
| 界貂蝉 `re_diaochan` | [离间 `lijian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2253)、[闭月 `rebiyue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15502) | 支付牌与两个目标联合评价，明确决斗实际发起者，不按两个独立负分选人 | 两敌强弱不同；友敌混合；响应/伤害收益变化 |
| 界孙权 `re_sunquan` | [制衡 `rezhiheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15319)、[救援 `rejiuyuan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15291) | 比较先用后换、部分换牌、全手换牌，避免固定高价值牌门槛破坏路线 | 唯一闪/桃；界全手额外摸牌；装备区保留 |

### 界限突破·风

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界夏侯渊 `ol_xiahouyuan` | [神速 `xinshensu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7601)、[设变 `shebian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L11791) | 分别比较跳判摸、弃装备跳出牌等代价与额外杀收益；界设变另审 | 可跳过负面判定；关键装备；没有有效攻击 |
| 界魏延 `ol_weiyan` | [狂骨 `xinkuanggu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3720)、[奇谋 `reqimou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L11413) | 奇谋失血量、距离/次数解锁和狂骨兑现联合评价，不只看可用杀数 | 低血无回复；距离不足；原界奇谋效果 |
| 界小乔 `ol_xiaoqiao` | [天香 `oltianxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9607)、[红颜 `olhongyan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9729)、[飘零 `piaoling`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9748) | 天香实际伤害/失血/获牌版本分开，按目标生存和结算后的收益判断 | 低血友方；敌方卖血；界飘零与红颜 |
| 界张角 `re_zhangjiao` | [雷击 `xinleiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L13386)、[鬼道 `xinguidao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L13557)、[黄天 `xinhuangtian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5820) | 连同响应牌保留、鬼道支付和实际雷击版本评价，不盲目追求被杀 | 判定可改善；无雷击目标；界雷击触发差异 |
| 界于吉 `xin_yuji` | [蛊惑 `reguhuo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L13043) | 按合法声明、公开信息和风险估值，禁止使用未知对手手牌当决策输入 | 真假声明；濒死急需；原界质疑规则不同 |

### 界限突破·火

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界荀彧 `ol_xunyu` | [驱虎 `quhu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6696)、[节命 `oljieming`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L3009) | 驱虎选拼点目标与受伤目标联动，节命按真实补牌空间评价 | 无可伤第三人；低点高风险；队友补牌受限 |
| 界典韦 `ol_dianwei` | [强袭 `olqiangxi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L2718)、[狞恶 `olninge`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L2793) | 比较支付分支、击杀收益及装备保留；界强袭与宁恶分别确认 | 一血支付；关键装备；本回合多次使用 |
| 界颜良文丑 `ol_yanwen` | [双雄 `olshuangxiong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L1219) | 按本版本双雄判定/颜色转换和剩余手牌规划，不无差别消耗关键牌 | 只有一种颜色；决斗响应不足；原界差异 |
| 界庞统 `ol_pangtong` | [连环 `ollianhuan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5)、[涅槃 `olniepan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L11476) | 把实际使用/转化/合法重铸分开，连环收益与火雷后续比较；涅槃独立救命 | 重铸丢组件；友方连环；界涅槃分支 |
| 界袁绍 `ol_yuanshao` | [乱击 `olluanji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12278)、[血裔 `olxueyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12315) | 联合选支付牌并计算全场敌友效果，区分真实可触发补牌/主公收益 | 多友少敌；支付最后防御；原界乱击规则 |
| 界太史慈 `re_taishici` | [天义 `tianyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7073)、[酣战 `hanzhan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10114) | 天义/酣战比较拼点支付、失败代价与成功后可兑现的杀 | 无杀；高点关键牌；成功却无目标 |

### 界限突破·林

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界董卓 `ol_dongzhuo` | [酒池 `oljiuchi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17837)、[肉林 `roulin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6168)、[崩坏 `benghuai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6210)、[暴虐 `olbaonue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9831) | 酒池转换与实际杀收益、崩坏分支成本、主公回复分别估计 | 低血/低上限；酒次数；原界酒池规则 |
| 界贾诩 `re_jiaxu` | [完杀 `rewansha`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L6257)、[乱武 `reluanwu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L6316)、[帷幕 `reweimu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L6323) | 乱武按全场公开局面估计敌友损益，不假设他人选择；完杀帷幕核对标签 | 友方濒死；攻击距离变化；原界乱武分支 |
| 界鲁肃 `ol_lusu` | [好施 `olhaoshi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L6003)、[缔盟 `oldimeng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L6171) | 好施/缔盟按支付牌、两个接收角色和后续资源联合评价；禁止额外读未知手牌 | 标准界成本不同；友方不能获牌；交换后弃牌 |

### 界限突破·山

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界刘禅 `ol_liushan` | [享乐 `xiangle`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3933)、[放权 `olfangquan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12180)、[若愚 `olruoyu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12153) | 比较当前出牌价值、额外回合接收者能力和支付成本，不盲目放权 | 己方能斩杀；队友被控制；原界支付/觉醒 |
| 界左慈 `re_zuoci` | [化身 `rehuashen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12571)、[新生 `rexinsheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L13036) | 只评估本次可选化身技能和当前阶段价值；限制搜索，不扫描全武将组合 | 空候选；响应阶段；原界化身可选规则 |
| 界张郃 `re_zhanghe` | [巧变 `reqiaobian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L4101) | 逐阶段比较跳过代价、支付牌和偷牌/移牌组合，不用单一发动阈值 | 跳摸与正常摸；移除友方判定；原界巧变成本 |

## 验证后决定 75个版本

有需要审查的选择或局面估值；先跑定向场景，无明确问题则保留。不是默认都更新。

### 标准2008

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 曹操 `caocao` | [奸雄 `jianxiong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L331)、[护驾 `hujia`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L246) | 分别估计受伤取得牌、回复与防御资源，不把卖血当固定正收益 | 低血无救援；伤害牌不可取得；主公协防响应 |
| 司马懿 `simayi` | [反馈 `fankui`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L360)、[鬼才 `guicai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L391) | 比较判定变化、敌友收益与支付牌机会成本；不假定未知判定后续 | 改判无实际收益；唯一关键牌；装备可用于界改判 |
| 夏侯惇 `xiahoudun` | [刚烈 `ganglie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L473) | 区分无来源、敌友来源及弃牌/掉血分支；界清俭独立联合分配 | 无伤害来源；敌方受伤有收益；队友获牌受限 |
| 许褚 `xuzhu` | [裸衣 `luoyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L649) | 评估实际可兑现的杀/决斗增伤，不只检查有无杀；界裸衣按实际版本处理 | 无合法攻击目标；跳出牌；有杀但增伤无效 |
| 郭嘉 `guojia` | [天妒 `tiandu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L685)、[遗计 `yiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L707) | 低血风险、取得牌用途、受赠者收益联合评价；标准界分配规则分开 | 唯一救命牌；友方不能获牌；多次伤害多次分配 |
| 诸葛亮 `zhugeliang` | [观星 `guanxing`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1329)、[空城 `kongcheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1347) | 观星按实际可见牌和近期判定/摸牌排序；空城价值随公开威胁变化 | 判定与摸牌冲突；清空手牌风险；不同观星张数 |
| 甘宁 `ganning` | [奇袭 `qixi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1643) | 黑牌支付成本与目标被弃牌收益联合评价；界奋威以受保护目标净收益决定 | 敌方失牌获益；友方负面装备；界多目标保护 |
| 吕蒙 `lvmeng` | [克己 `keji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1663) | 比较当前攻击收益与保牌价值，不为克己放弃明显进攻；界觉醒/博图分开核对 | 可斩杀却保牌；手牌上限变化；界觉醒阈值 |
| 周瑜 `zhouyu` | [英姿 `yingzi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1716)、[反间 `fanjian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1731) | 比较赠出牌机会成本、对方可选择分支和自身额外收益，不假定敌方配合 | 高价值支付牌；敌方最佳分支；界反间不同效果 |
| 孙尚香 `sunshangxiang` | [枭姬 `xiaoji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1967)、[结姻 `jieyin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1997) | 比较装备保留、失装备触发和结姻支付收益，不能为触发而拆掉关键装备 | 装备移除；队友无需回复；界结姻装备交换 |
| 华佗 `huatuo` | [青囊 `qingnang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2049)、[急救 `jijiu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2082) | 区分回合内青囊、回合外急救和濒死，按实际可救目标保留资源 | 唯一红牌；自救/救队友冲突；界青囊限制 |
| 吕布 `lvbu` | [无双 `wushuang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2124) | 无双主要回归通用响应估值；界利驭联合估计获牌和追加决斗风险 | 强制响应不足；利驭帮助敌方；后续决斗目标 |

### 标准2013

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 李典 `old_re_lidian` | [恂恂 `xunxun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17339)、[忘隙 `wangxi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17378) | 旬旬保留有用牌组合；忘隙按双方各自获得牌的边际收益决定 | 敌方补牌更有利；友方不能获牌；界忘隙差异 |

### 标准2019

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 伊籍 `xf_yiji` | [机捷 `xinfu_jijie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2421)、[急援 `xinfu_jiyuan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2470) | 仅依据技能实际揭示的信息评价给牌与援助，不读取额外牌堆信息 | 队友缺牌；不能获牌；可见底牌用途 |

### 标准2023

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 标潘凤 `std_panfeng` | [狂斧 `stdkuangfu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L115) | 比较狂斧的合法装备选择、后续使用和支付后风险 | 负面装备；无用杀目标；装备位置限制 |
| 标甘夫人 `ganfuren` | [淑慎 `stdshushen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L92)、[神智 `shenzhi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/sp/skill.js#L44698) | 神智比较整手资源与回复，淑慎按实际受益队友和选择分支评价 | 高价值整手；不够回复条件；受赠者状态 |
| 标乐进 `std_yuejin` | [骁果 `stdxiaoguo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L21) | 骁果按弃基本牌成本及对方弃装备/受伤的最佳回应估计 | 对方负面装备；敌方受伤收益；支付唯一救援牌 |

### 神话·风

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 曹仁 `old_caoren` | [据守 `jushou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L7735) | 比较据守补牌和失去下次回合的成本；界解围操作按实际牌位合法性 | 翻面期间局势；防御不足；装备/判定移动 |

### 神话·火

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 卧龙 `sp_zhugeliang` | [八阵 `bazhen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6474)、[火计 `huoji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6449)、[看破 `kanpo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6539) | 火计的目标/展示成本、看破的回合外资源分别估值，界藏拙按规则处理 | 火计无收益；唯一无懈来源；界火计新增用途 |
| 庞德 `re_pangde` | [马术 `mashu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1489)、[鞬出 `jianchu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3257) | 按杀本身收益、装备移除/失牌收益及不能响应条件评价 | 负面装备；敌方失装补牌；原界鞬出 |

### 神话·林

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 曹丕 `caopi` | [行殇 `xingshang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5524)、[放逐 `fangzhu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5538)、[颂威 `songwei`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5637) | 放逐比较翻面前后和摸牌收益，已翻面目标不按敌友机械选择 | 敌方已翻面；队友缺牌；界放逐选择 |
| 徐晃 `re_xuhuang` | [断粮 `duanliang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5691)、[截辎 `jiezi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5672) | 断粮支付成本、兵粮实际命中/可用性及截辎兑现联动 | 目标跳摸无影响；已有同判定；原界距离条件 |
| 孟获 `menghuo` | [祸首 `huoshou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5362)、[再起 `zaiqixx`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5406)、[酋首 `twqiushou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/tw/skill.js#L12876) | 再起与正常摸牌比较，南蛮来源和求首共享触发单独核对 | 受伤数量；恢复/摸牌需求；南蛮主公收益 |
| 祝融 `zhurong` | [巨象 `juxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5459)、[烈刃 `lieren`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5503) | 烈刃拼点成本和夺牌净收益比较，界长标另审额外目标 | 对手低手牌；高点关键牌；伤害后拿牌受限 |
| 孙坚 `sunjian` | [英魂 `gzyinghun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6049) | 英魂按目标可摸/可弃的真实收益选项；界武烈破虏单独预算 | 空手敌方；缺牌队友；限定技时机 |

### 神话·山

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 邓艾 `dengai` | [屯田 `tuntian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4215)、[凿险 `zaoxian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4357) | 计算失牌触发条件、田数量和觉醒后价值，不把任何失牌都算正收益 | 回合内外区别；临近觉醒；界屯田判定差异 |
| 姜维 `jiangwei` | [挑衅 `tiaoxin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3851)、[志继 `zhiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3911) | 评估对方可能出杀、拿牌/弃牌收益与自身防御，空城不作硬目标 | 无防御挑衅；对方攻击收益；界多目标/觉醒 |
| 张昭张纮 `zhangzhang` | [直谏 `zhijian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4622)、[固政 `guzheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4669) | 比较装备给谁和移除成本，固政考虑被返还角色及余牌取得 | 有害装备；多个弃牌者；原界返还数量 |
| 孙策 `sunce` | [激昂 `jiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4426)、[魂姿 `hunzi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4467)、[制霸 `zhiba`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4507) | 普通/界孙策按江/魂姿/制霸各版本独立，不套神孙策逻辑 | 觉醒阈值；拼点支付；主公技协作 |
| 蔡琰 `caiwenji` | [悲歌 `beige`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4814)、[断肠 `duanchang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4861) | 悲歌支付成本、判定分支与断肠威慑分开估计 | 救队友；敌方获益判定；界悲歌选择 |

### 神话·阴

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 蒯良蒯越 `kuailiangkuaiyue` | [荐降 `nzry_jianxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3054)、[审时 `nzry_shenshi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3074) | 荐降/审时分支按目标资源和延后收益评价，区分当前与未来不确定性 | 目标选择约束；死亡前后；受赠牌可用性 |
| 严颜 `yanyan` | [拒战 `nzry_juzhan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2033) | 据战按当前状态、摸牌和后续指定限制比较 | 状态切换；同回合多次目标；队友牌不能指定 |
| 王平 `wangping` | [飞军 `nzry_feijun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2101)、[兵略 `nzry_binglve`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2246) | 飞军联合支付、目标与手牌/装备比较，并考虑兵略既有记录 | 新旧飞军目标；手牌/装备阈值；无合法分支 |
| 陆绩 `luji` | [怀橘 `nzry_huaiju`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2281)、[遗礼 `nzry_yili`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2325)、[整论 `nzry_zhenglun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2368) | 怀橘/遗礼/整论按剩余橘和保护/补牌价值比较 | 橘耗尽；队友缺资源；跳摸是否划算 |
| 卢植 `yl_luzhi` | [明任 `nzry_mingren`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2865)、[贞良 `nzry_zhenliang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L2964) | 明任换牌和贞良分支按颜色资源/阶段状态联动，避免换掉唯一可用牌 | 颜色不匹配；状态切换；回合外响应 |

### 神话·雷

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 郝昭 `haozhao` | [镇骨 `drlt_zhengu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L936) | 镇骨考虑目标当前手牌、后续时点和双方关系，不只追求数量差 | 敌方将大量过牌；友方获牌受限；标记失效 |
| 诸葛瞻 `zhugezhan` | [罪论 `xinfu_zuilun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1009)、[父荫 `xinfu_fuyin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L1136) | 按罪论实际条件、牌序和失血风险选牌，父荫标签回归 | 达成条件数；低血取牌；父荫失效 |

### 界限突破·标准

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界曹操 `re_caocao` | [奸雄 `new_rejianxiong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14453)、[护驾 `rehujia`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5475) | 分别估计受伤取得牌、回复与防御资源，不把卖血当固定正收益 | 低血无救援；伤害牌不可取得；主公协防响应 |
| 界司马懿 `re_simayi` | [反馈 `refankui`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15824)、[鬼才 `reguicai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15751) | 比较判定变化、敌友收益与支付牌机会成本；不假定未知判定后续 | 改判无实际收益；唯一关键牌；装备可用于界改判 |
| 界郭嘉 `re_guojia` | [天妒 `tiandu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L685)、[遗计 `new_reyiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14311) | 低血风险、取得牌用途、受赠者收益联合评价；标准界分配规则分开 | 唯一救命牌；友方不能获牌；多次伤害多次分配 |
| 界许褚 `re_xuzhu` | [裸衣 `new_reluoyi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14499) | 评估实际可兑现的杀/决斗增伤，不只检查有无杀；界裸衣按实际版本处理 | 无合法攻击目标；跳出牌；有杀但增伤无效 |
| 界夏侯惇 `re_xiahoudun` | [刚烈 `reganglie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15919)、[清俭 `new_qingjian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14852) | 区分无来源、敌友来源及弃牌/掉血分支；界清俭独立联合分配 | 无伤害来源；敌方受伤有收益；队友获牌受限 |
| 界张飞 `re_zhangfei` | [咆哮 `olpaoxiao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10706)、[替身 `oltishen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10742) | 保留次数规则，审查通用目标估值与连续攻击风险；界新增技能单独评估；界版本新增技能独立审查，不直接沿用原版保留结论 | 无效伤害目标；最后防御；界替身收益 |
| 界赵云 `re_zhaoyun` | [龙胆 `ollongdan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10460)、[涯角 `olyajiao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10618) | 保留龙胆合法性与通用牌效，界涯角的获得/弃置与接收目标单独审；界版本新增技能独立审查，不直接沿用原版保留结论 | 唯一闪转换杀；响应被禁止；界获得牌分支 |
| 界关羽 `re_guanyu` | [武圣 `new_rewusheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14538)、[义绝 `new_yijue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14605) | 保留通用杀效，只审支付牌机会成本和响应标签；界义绝另作目标策略；界版本新增技能独立审查，不直接沿用原版保留结论 | 红桃救援牌转换；杀次数不足；技能/目标被禁用 |
| 界马超 `re_machao` | [马术 `mashu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1489)、[铁骑 `retieji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16796) | 保留距离规则，核对铁骑实际版本的响应/技能封锁估值；界版本新增技能独立审查，不直接沿用原版保留结论 | 装备/距离变化；封锁无效果；不可响应标记一致性 |
| 界周瑜 `re_zhouyu` | [英姿 `reyingzi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16078)、[反间 `refanjian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16106) | 比较赠出牌机会成本、对方可选择分支和自身额外收益，不假定敌方配合 | 高价值支付牌；敌方最佳分支；界反间不同效果 |
| 界吕蒙 `re_lvmeng` | [克己 `keji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1663)、[勤学 `qinxue`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15980)、[博图 `rebotu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L4835) | 比较当前攻击收益与保牌价值，不为克己放弃明显进攻；界觉醒/博图分开核对 | 可斩杀却保牌；手牌上限变化；界觉醒阈值 |
| 界甘宁 `re_ganning` | [奇袭 `qixi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1643)、[奋威 `fenwei`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17240) | 黑牌支付成本与目标被弃牌收益联合评价；界奋威以受保护目标净收益决定 | 敌方失牌获益；友方负面装备；界多目标保护 |
| 界陆逊 `re_luxun` | [谦逊 `reqianxun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16195)、[连营 `relianying`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16277) | 保留标准被动规则，重点验证空手/防护效果标签；界谦逊连营需独立分支；界版本新增技能独立审查，不直接沿用原版保留结论 | 清空手牌后风险；暂存后恢复；界多目标分牌 |
| 界吕布 `re_lvbu` | [无双 `wushuang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2124)、[利驭 `new_liyu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14167) | 无双主要回归通用响应估值；界利驭联合估计获牌和追加决斗风险 | 强制响应不足；利驭帮助敌方；后续决斗目标 |
| 界华佗 `re_huatuo` | [急救 `jijiu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2082)、[青囊 `new_reqingnang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14936) | 区分回合内青囊、回合外急救和濒死，按实际可救目标保留资源 | 唯一红牌；自救/救队友冲突；界青囊限制 |
| 界黄月英 `re_huangyueying` | [集智 `rejizhi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15440)、[奇才 `reqicai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15424) | 保留强制补牌与距离规则，检查通用用牌是否遗漏即时过牌价值；界版本新增技能独立审查，不直接沿用原版保留结论 | 无效锦囊；手牌过量；界集智弃牌分支 |
| 界孙尚香 `re_sunshangxiang` | [枭姬 `xiaoji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1967)、[结姻 `rejieyin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15159) | 比较装备保留、失装备触发和结姻支付收益，不能为触发而拆掉关键装备 | 装备移除；队友无需回复；界结姻装备交换 |
| 界甄宓 `re_zhenji` | [洛神 `reluoshen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15082)、[倾国 `qingguo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L898) | 保留自动判定和通用闪AI，先核验停止条件、转化合法性及能力标签；界版本新增技能独立审查，不直接沿用原版保留结论 | 连续判定；黑牌不可使用；濒死与回合外响应 |
| 界诸葛亮 `re_zhugeliang` | [观星 `reguanxing`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L15054)、[空城 `kongcheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1347) | 观星按实际可见牌和近期判定/摸牌排序；空城价值随公开威胁变化 | 判定与摸牌冲突；清空手牌风险；不同观星张数 |
| 界华雄 `re_huaxiong` | [耀武 `reyaowu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L14988)、[势斩 `shizhan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L3099) | 不添加无意义主动规划，核对耀武/界耀武及施战实际触发的目标估值；界版本新增技能独立审查，不直接沿用原版保留结论 | 不同颜色伤害；触发不成立；界施战另审 |
| 界公孙瓒 `re_gongsunzan` | [趫猛 `reqiaomeng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16894)、[义从 `reyicong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16869) | 保留义从距离规则，界趫猛在命中后审查弃牌选择和触发收益；界版本新增技能独立审查，不直接沿用原版保留结论 | 血量跨阈值；装备目标；不满足触发 |
| 界李典 `re_lidian` | [恂恂 `xunxun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17339)、[忘隙 `xinwangxi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L1346) | 旬旬保留有用牌组合；忘隙按双方各自获得牌的边际收益决定 | 敌方补牌更有利；友方不能获牌；界忘隙差异 |
| 界徐庶 `re_xushu` | [诛害 `zhuhai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17053)、[潜心 `qianxin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17085) | 诛害按实际响应资源和目标收益选择，潜心觉醒前后分别估价 | 敌方造成伤害；唯一响应牌；觉醒技能变化 |

### 界限突破·风

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界曹仁 `caoren` | [据守 `xinjushou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3188)、[解围 `xinjiewei`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3214) | 比较据守补牌和失去下次回合的成本；界解围操作按实际牌位合法性 | 翻面期间局势；防御不足；装备/判定移动 |
| 界周泰 `zhoutai` | [不屈 `buqu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8428)、[奋激 `fenji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8493) | 不重写不屈存活规则，回归风险估值；界奋激另审支付和支援；界版本新增技能独立审查，不直接沿用原版保留结论 | 高不屈张数；失牌触发；濒死与界分支 |
| 界黄忠 `ol_huangzhong` | [烈弓 `xinliegong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3759)、[没矢 `remoshi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L1593) | 保留烈弓触发规则，检查当前能否不可响应及界殁示的后续选择；界版本新增技能独立审查，不直接沿用原版保留结论 | 手牌/血量阈值；免伤目标；界新增分支 |

### 界限突破·火

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界卧龙 `ol_sp_zhugeliang` | [八阵 `bazhen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6474)、[火计 `olhuoji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L1358)、[看破 `olkanpo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L1413)、[藏拙 `cangzhuo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L11762) | 火计的目标/展示成本、看破的回合外资源分别估值，界藏拙按规则处理 | 火计无收益；唯一无懈来源；界火计新增用途 |
| 界庞德 `ol_pangde` | [马术 `mashu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1489)、[鞬出 `rejianchu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10264) | 按杀本身收益、装备移除/失牌收益及不能响应条件评价 | 负面装备；敌方失装补牌；原界鞬出 |

### 界限突破·林

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界孟获 `re_menghuo` | [祸首 `huoshou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5362)、[再起 `rezaiqi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17924)、[酋首 `twqiushou`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/tw/skill.js#L12876) | 再起与正常摸牌比较，南蛮来源和求首共享触发单独核对 | 受伤数量；恢复/摸牌需求；南蛮主公收益 |
| 界孙坚 `ol_sunjian` | [英魂 `gzyinghun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L6049)、[武烈 `wulie`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L10339)、[破虏 `twpolu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/tw/skill.js#L12838) | 英魂按目标可摸/可弃的真实收益选项；界武烈破虏单独预算 | 空手敌方；缺牌队友；限定技时机 |
| 界曹丕 `re_caopi` | [行殇 `rexingshang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17635)、[放逐 `refangzhu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L17683)、[颂威 `songwei`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5637) | 放逐比较翻面前后和摸牌收益，已翻面目标不按敌友机械选择 | 敌方已翻面；队友缺牌；界放逐选择 |
| 界徐晃 `ol_xuhuang` | [断粮 `olduanliang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5396)、[截辎 `oljiezi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L5423) | 断粮支付成本、兵粮实际命中/可用性及截辎兑现联动 | 目标跳摸无影响；已有同判定；原界距离条件 |
| 界祝融 `ol_zhurong` | [巨象 `juxiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5459)、[烈刃 `lieren`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L5503)、[长标 `changbiao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L7727) | 烈刃拼点成本和夺牌净收益比较，界长标另审额外目标 | 对手低手牌；高点关键牌；伤害后拿牌受限 |

### 界限突破·山

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 界姜维 `ol_jiangwei` | [挑衅 `oltiaoxin`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L7163)、[志继 `olzhiji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L7236) | 评估对方可能出杀、拿牌/弃牌收益与自身防御，空城不作硬目标 | 无防御挑衅；对方攻击收益；界多目标/觉醒 |
| 界蔡琰 `ol_caiwenji` | [悲歌 `olbeige`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L3957)、[断肠 `duanchang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L4861) | 悲歌支付成本、判定分支与断肠威慑分开估计 | 救队友；敌方获益判定；界悲歌选择 |
| 界张昭张纮 `ol_zhangzhang` | [直谏 `olzhijian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L739)、[固政 `olguzheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L787) | 比较装备给谁和移除成本，固政考虑被返还角色及余牌取得 | 有害装备；多个弃牌者；原界返还数量 |
| 界孙策 `re_sunce` | [激昂 `oljiang`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L2368)、[魂姿 `olhunzi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12360)、[制霸 `olzhiba`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L12383) | 普通/界孙策按江/魂姿/制霸各版本独立，不套神孙策逻辑 | 觉醒阈值；拼点支付；主公技协作 |
| 界邓艾 `ol_dengai` | [屯田 `oltuntian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9263)、[凿险 `olzaoxian`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L9286) | 计算失牌触发条件、田数量和觉醒后价值，不把任何失牌都算正收益 | 回合内外区别；临近觉醒；界屯田判定差异 |

## 暂时保留 11个版本

当前优先保留；检查被动效果、能力标签和版本兼容，有证据再升级。

### 标准2008

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 甄宓 `zhenji` | [洛神 `luoshen`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L839)、[倾国 `qingguo`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L898) | 保留自动判定和通用闪AI，先核验停止条件、转化合法性及能力标签 | 连续判定；黑牌不可使用；濒死与回合外响应 |
| 关羽 `guanyu` | [武圣 `wusheng`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1194) | 保留通用杀效，只审支付牌机会成本和响应标签；界义绝另作目标策略 | 红桃救援牌转换；杀次数不足；技能/目标被禁用 |
| 张飞 `zhangfei` | [咆哮 `paoxiao`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1291) | 保留次数规则，审查通用目标估值与连续攻击风险；界新增技能单独评估 | 无效伤害目标；最后防御；界替身收益 |
| 赵云 `zhaoyun` | [龙胆 `longdan`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1391) | 保留龙胆合法性与通用牌效，界涯角的获得/弃置与接收目标单独审 | 唯一闪转换杀；响应被禁止；界获得牌分支 |
| 马超 `machao` | [马术 `mashu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1489)、[铁骑 `tieji`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1503) | 保留距离规则，核对铁骑实际版本的响应/技能封锁估值 | 装备/距离变化；封锁无效果；不可响应标记一致性 |
| 黄月英 `huangyueying` | [集智 `jizhi`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1547)、[奇才 `qicai`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1567) | 保留强制补牌与距离规则，检查通用用牌是否遗漏即时过牌价值 | 无效锦囊；手牌过量；界集智弃牌分支 |
| 陆逊 `luxun` | [谦逊 `qianxun`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1916)、[连营 `lianying`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L1926) | 保留标准被动规则，重点验证空手/防护效果标签；界谦逊连营需独立分支 | 清空手牌后风险；暂存后恢复；界多目标分牌 |

### 标准2013

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 华雄 `huaxiong` | [耀武 `yaowu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/standard/skill.js#L2317) | 不添加无意义主动规划，核对耀武/界耀武及施战实际触发的目标估值 | 不同颜色伤害；触发不成立；界施战另审 |

### 标准2019

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 公孙瓒 `gongsunzan` | [义从 `reyicong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/refresh/skill.js#L16869) | 保留义从距离规则，界趫猛在命中后审查弃牌选择和触发收益 | 血量跨阈值；装备目标；不满足触发 |

### 神话·风

| 武将与版本ID | 关注技能及上游源码 | 准备检查或调整的地方 | 重点测试场景 |
|---|---|---|---|
| 周泰 `old_zhoutai` | [不屈 `gzbuqu`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L8313) | 不重写不屈存活规则，回归风险估值；界奋激另审支付和支援 | 高不屈张数；失牌触发；濒死与界分支 |
| 黄忠 `re_huangzhong` | [烈弓 `xinliegong`](https://github.com/libnoname/noname/blob/b481b17552dd46e7d9ca805d5d7975b742168256/apps/core/character/shenhua/skill.js#L3759) | 保留烈弓触发规则，检查当前能否不可响应及界殁示的后续选择 | 手牌/血量阈值；免伤目标；界新增分支 |

## 如何从候选变成正式更新项

每项至少补齐：准确版本/技能ID、实际AI入口、当前错误或不足的证据、可复现初态、候选策略、反向场景及对照数据。通过后才把它标成“确认更新”。

优先复核：张辽的失牌收益与摸牌取舍；孙权的换牌集合和顺序；刘备的赠牌阈值；鲁肃/貂蝉的联合目标；张郃的阶段替代；王基的奇制进趋；周妃的暂存数量边界。

当前没有宣称这142个版本已逐项实战确诊。共享技能及借用技能的影响需要另外展开，不能为了凑清单把所有技能都改一遍。