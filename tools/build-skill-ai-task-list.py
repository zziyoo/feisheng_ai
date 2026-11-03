#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把测试包原始清单整理成带“逐技能”复核状态的 142 将任务清单。

输入：docs/skill-ai-20261030/source/AI更新候选清单.json
      docs/skill-ai-20261030/source/测试任务清单.json
输出：docs/skill-ai-20261030/142-task-list.json / .csv

武将整体状态只做汇总，不覆盖技能状态：
- 每个技能都必须有 已复现/已验证无问题/尚未验证/已修复/部分通过 之一。
- 单技能通过不会把同武将其他技能标成“验证无问题”。
"""
import csv
import json
import os
import hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOC = os.path.join(ROOT, 'docs', 'skill-ai-20261030')
SRC = os.path.join(DOC, 'source')

HOST_LINES_1117 = {
    'tuxi': 786, 'rende': 1121, 'zhiheng': 1727, 'kurou': 1837,
    'dimeng': 5713, 'kongsheng': 2120, 'olkongsheng': 787,
    'qimou': 3661, 'qiangxix': 6701, 'new_retuxi': 13861,
    'rezhiheng': 14842, 'redimeng': 3356, 'rerende': 15023, 'rekurou': 16350,
    'zhaxiang': 16375, 'reqimou': 11274, 'olqiangxi': 3374,
    'reqiangxi': 13389, 'xinkuanggu': 3745, 'qiangxi': 6782,
    'olninge': 3356,
}

# 武将级只保留优先级/排序依据；具体状态从技能级汇总。
CHARACTER_OVERRIDES = {
    're_sunquan': {'priority_revised': 'P1'},
    'zhoufei': {'priority_revised': 'P1'},
    're_zhangliao': {'priority_revised': 'P1'},
    'sunquan': {'priority_revised': 'P3'},
    'huanggai': {'priority_revised': 'P2'},
    'zhangliao': {'priority_revised': 'P3'},
    'liubei': {'priority_revised': 'P3'},
    're_lusu': {'priority_revised': 'P3'},
    're_weiyan': {'priority_revised': 'P2'},
    'dianwei': {'priority_revised': 'P2'},
    're_liubei': {'priority_revised': 'P2'},
    're_huanggai': {'priority_revised': 'P2'},
    'ol_weiyan': {'priority_revised': 'P2'},
    'ol_dianwei': {'priority_revised': 'P2'},
}

# 技能级复核结果。键为 character_id -> skill_id。
SKILL_OVERRIDES = {
    're_sunquan': {
        'rezhiheng': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主完整回合通过',
            'evidence': '完整 phaseUse：3血持桃+两杀时原生弃桃+杀并摸3，优化后保留桃、只弃非防御牌摸1；1/2血、只桃/只闪、含回复、防具场景均保留防御；4血负向对照仍走原生全手换牌。',
            'notes': '共享低血防御保留策略；策略只注册 rezhiheng，不注册标准制衡。',
        },
        'rejiuyuan': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '本轮未建立 rejiuyuan 的真实宿主固定局面。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
    'zhoufei': {
        'olkongsheng': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'evidence': 'olkongsheng.cost 中 getExpansions() 返回数组却直接加数字，阈值比较失真；原生成本AI选3张，修正后选1张；重复调用均为1张，异常后补丁作用域恢复，数组语义（索引/长度/迭代/JSON）保持不变。',
            'notes': '已加宿主成本指纹，表达式变化时跳过；不复制技能函数。',
        },
        'olliangyin': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '本轮未建立 olliangyin 的真实宿主固定局面。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
    're_zhangliao': {
        'new_retuxi': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'evidence': '三名敌人手牌1/4/2时，原生选1+2并跳过4；优化后选4+2；屯田目标不叠加手牌奖励；只有友方、单目标、零目标原生均正常放弃/正常摸牌。',
            'notes': '共享目标策略只对敌人按公开手牌数加0~2分，不改变合法目标集合；没有添加无证据的发动护栏。',
        },
    },
    'sunquan': {
        'zhiheng': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '完整 phaseUse 七种局面：3血会弃两杀保留桃；3血/4上限会先用桃回血；1血会先用桃；1血混合牌不发动；击杀/防具场景正常。未复现“弃闪/桃”缺陷。',
            'notes': '上一轮隔离 chooseToUse 的“选闪”是夹具假象；已移除标准制衡策略，只保留界制衡。',
        },
        'jiuyuan': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '本轮未建立 jiuyuan 的真实宿主固定局面。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
    'huanggai': {
        'kurou': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '独立页面完整 phaseUse：2血1牌不发动（原生 hp<3 停止条件成立）；3血1牌发动、3血2牌不发动（手牌>=体力-1）；4血发动；3血连发被中间回血终止；敌方反击后存活。未复现“无明确收益仍过度掉血”。',
            'notes': '摸2本身是防御/资源来源，不因“可能摸不到防御”而抬高停止阈值；保持原生 hp<3。',
        },
    },
    'zhangliao': {
        'tuxi': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'evidence': '仅友方有手牌时原生突袭放弃并正常摸2；两敌人1/4手牌时偷1+1，符合跳过摸牌的成本。',
            'notes': '不叠加重复优化。',
        },
    },
    'liubei': {
        'rende': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'evidence': '3血2无懈、敌人空手、队友3手牌时，原生仁德把牌交给队友并回复1血；未把牌交给敌人。',
            'notes': '本轮不重复修改。',
        },
        'jijiang': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '本轮未建立 jijiang 的真实宿主固定局面。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
    're_lusu': {
        'dimeng': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'evidence': '标准缔盟只读公开手牌数量；队友1手/敌人3手时正确交换，未读取隐藏牌面。',
            'notes': '隐藏手牌读取实际出现在活动武将的 redimeng（清单外），已单独修复。',
        },
        'haoshi': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '本轮未建立 haoshi 的真实宿主固定局面。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
    'sp_zhangjiao': {
        'releiji': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': 'AI决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': False, 'note': '目标选择与黑桃判定后的 2 点雷电伤害均有真实结算断言；未额外构造无目标负向场景。'},
            'evidence': 'shenhua-feng-review.json / shenhua-releiji-target：AI 选敌方 seat，黑桃判定后造成 2 点雷电伤害，目标体力 4→2；未选友方。',
            'notes': '目标选择符合敌我关系；未复现雷击目标缺陷。',
        },
        'guidao': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-feng-review.json / shenhua-guidao-replace、shenhua-guidao-decline：有利改判时 AI 用黑桃杀替换并获原判定牌；判定同为黑桃时放弃改判、保留手牌。',
            'notes': '只在有利方向改判；未复现误判或资敌。',
        },
        'huangtian': {
            'status': '已修复', 'implementation': '无名AI shenhua_feng：1血按 ui.selected.cards 的实际选牌判断；选中最后一张闪且无备用闪时不转交，选中闪电可转交并保留唯一闪；原生补丁 commit bd192a8/2971478/7dabb0b', 'test': 'quality-huangtian-last-shan / quality-huangtian-last-shan-with-shandian / quality-huangtian-forced-shan-with-shandian / quality-huangtian-midhp',
            'validation_level': '确认存在质量提升并已实现',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'note': '强制选闪、自然选闪电、只有闪、多闪四种局面均记录评分与实际交手牌结果。'},
            'evidence': 'shenhua-feng-review.json / quality-huangtian-last-shan、quality-huangtian-last-shan-with-shandian、quality-huangtian-forced-shan-with-shandian、quality-huangtian-midhp：1血只有闪时原生交出、补丁/扩展保留；1血闪+闪电自然选牌时双方只交闪电并保留闪；强制选闪时原生仍交最后闪，补丁/扩展评分为0并保留；3血双闪仍转交。',
            'notes': '原生 result.target 的 card 参数是技能名字符串，不是实体牌；按真实评分阶段的 ui.selected.cards 判断，不能凭手里有闪电推断交闪安全。已选牌但无法辨别时保守返回0，尚未选牌时保留原生评分。',
        },
    },
    're_yuji': {
        'xinfu_guhuo': {
            'status': '已修复', 'implementation': '无名AI shenhua_feng：1血无真牌时仅在有可弃低价值非防御牌（非闪/非桃且 get.value<6）时保留诈称；原生补丁 commit ce66ca0/751b29a', 'test': 'quality-guhuo-bluff-lowhp / quality-guhuo-bluff-midhp / quality-guhuo-full-lowhp-fake-lastshan / quality-guhuo-full-lowhp-true-sha-forced / quality-guhuo-full-lowhp-fake-expendable / quality-guhuo-full-midhp-fake-expendable',
            'validation_level': '确认存在质量提升并已实现',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'note': '四种完整出牌场景记录实际发动/扣牌/伤害/质疑结果；1血无可弃牌与3血可弃闪电形成正反向。'},
            'evidence': 'shenhua-feng-review.json / quality-guhuo-full-lowhp-fake-lastshan、quality-guhuo-full-lowhp-true-sha-forced、quality-guhuo-full-lowhp-fake-expendable、quality-guhuo-full-midhp-fake-expendable：1血无可弃牌时放弃并保留防御；1血真牌、1血闪电可弃、3血闪电可弃均实际发动并记录扣牌/伤害/质疑结果。',
            'notes': '宿主 1.11.7 假牌结算为“此牌作废”，不直接失去体力；守卫避免的是损失最后一张防御牌。旧守卫在1血一律拦截会误伤可弃闪电的合理诈称，本轮改为按可弃牌判断。',
        },
    },
    're_xiahouyuan': {
        'xinshensu': {
            'status': '已修复', 'implementation': '无名AI shenhua_feng：低手牌+不良判定时，仅当虚拟杀收益不低于一次摸牌价值才使用神速1；原生补丁 commit 0749a7e/e0f7148/27e46d3', 'test': 'quality-shensu1-lowhand-lebu / quality-shensu1-reverse-lowvalue / shenhua-shensu-skip / shenhua-shensu-negative',
            'validation_level': '确认存在质量提升并已实现',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'note': '正向跳过判定/摸牌并命中；反向目标收益不足时正常结算判定且不使用虚拟杀。'},
            'evidence': 'shenhua-feng-review.json / quality-shensu1-lowhand-lebu、quality-shensu1-reverse-lowvalue：正向手牌2+乐、目标无手牌时虚拟杀收益15.309>摸牌9.9，跳过判定并使用虚拟杀；反向所有敌方各两张闪时收益3.861<9.9，不发动，乐正常判定并移除。',
            'notes': '只放宽“低手牌+不良判定+收益足够”一条；高牌数分支保持原生；门槛使用宿主自身 get.effect(draw) 值，不新增固定评分常数。',
        },
    },
    'xiaoqiao': {
        'retianxiang': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-feng-review.json / shenhua-tianxiang-redirect、shenhua-tianxiang-negative：持红桃牌受 1 伤时 AI 转给敌方、选择“失去1体力并获得弃置桃”，小乔不掉血、目标 4→3 并获得桃；无红桃时不发动并正常受伤。',
            'notes': '未把伤害转给友方或错误结算；保留原生目标/选项评分。',
        },
        'hongyan': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '规则结算验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': False, 'positive_negative': False, 'passive': True, 'note': '纯被动规则，无独立 AI 决策入口。'},
            'evidence': 'shenhua-feng-review.json / shenhua-hongyan-suit：红颜被动下黑桃杀经 get.suit/get.color 变为红桃/红色。',
            'notes': '纯被动，无 AI 分支；未复现规则偏差。',
        },
    },
    're_weiyan': {
        'xinkuanggu': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'validation_level': '确认存在质量提升并已实现',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'branches': ['draw', 'recover'], 'note': '1血可回复时优先回复；3血反向场景仍摸牌。'},
            'evidence': 'quality-native.json / quality-extension.json：quality-kuanggu-lowhp 原生 hp=1、draw=1，扩展 recover=1、hp=2；quality-kuanggu-midhp 原生/扩展均摸牌且体力不变。另有既有 shenhua-kuanggu-draw/recover 回归。',
            'notes': '只改 cost 的回复/摸牌选择：1血且可回复时回复，其余沿用原生“有足够杀才回复”的条件；不改技能规则。',
        },
        'qimou': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'validation_level': '确认缺陷并已修复',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'fixed': True},
            'evidence': '独立页面复现：目标在3-4距离外、手上有杀且杀次数未用完时，原生 ai.result.player 因 cardUsable 直接返回0，奇谋永不发动（三个场景0动作）。策略只在“杀次数可用恰为唯一阻塞、且支付能兑换成击杀”时放宽：far4-3sha-hp3 修复后发动并3杀击杀，far3-2sha-hp2 同理；反向 far4-hp4、目标在射程内、杀次数耗尽均保持原生。',
            'notes': '只覆盖 ai.result.player 的否决分支；不复制技能主体、不改支付档位（档位由宿主 content 决定）。',
        },
    },
    'old_caoren': {
        'jushou': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-feng-review.json / shenhua-jushou-4hp-empty、shenhua-jushou-lowhp：4 血空手时 check 为 false，不摸牌不翻面；3 血空手时摸 3 张并翻面。',
            'notes': '未复现满血误发动或低血漏发。',
        },
    },
    'old_zhoutai': {
        'gzbuqu': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': 'AI决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True, 'forced_main': True, 'note': '主触发为锁定技；额外验证回复后移创的 chooseCardButton AI 选择。'},
            'evidence': 'shenhua-feng-review.json / shenhua-buqu-damage、shenhua-buqu-negative、shenhua-buqu-recover-choice：1 血受 1 伤后翻出“创”并留在 0 体力存活；2 血受伤不翻创；回复时 AI 从两张同点数“创”中选择移除 1 张，最后保留 1 张并回到 2 体力。',
            'notes': '主触发没有可选 AI 入口，属于锁定规则；后续移创分支存在 chooseCardButton AI，已单独验证。',
        },
    },
    're_huangzhong': {
        'xinliegong': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-feng-review.json / shenhua-liegong-hit、shenhua-liegong-negative：满足手牌/体力条件时记录 directHit 与 extraDamage=1，杀造成 2 点伤害；不满足时无直击/加伤，只造成 1 点。',
            'notes': '未复现条件误判或加伤丢失。',
        },
    },
    'dianwei': {
        'qiangxix': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '完成质量审查，保留原生',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / hp-qiangxix-2hp-target1、hp-qiangxix-2hp-weapon-target2；quality-qiangxix-crossbow 复现原生先弃连弩再自损，quality-qiangxix-zhangba 复现丈八被弃。',
            'notes': '候选改动：让高价值武器改付体力；实测 check/ai1 钩子会把低价值丈八也改成保留，属于过度优化，且宿主没有稳定“选哪张武器”的AI入口，故保留原生并列入原生AI补丁候选（未交付）。',
        },
    },
    'xunyu': {
        'quhu': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / shenhua-huo-quhu-compare、quhu-no-target、quhu-risky-decline：有更高体力敌方时发动并拼点，目标敌方体力 -1；无更高体力目标时不发动；1血低牌高失败风险时不发动。',
            'notes': '正向拼点/伤害与两类负向均取得真实宿主结果；未发现隐藏牌面读取。',
        },
        'jieming': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / shenhua-huo-jieming-damage、jieming-no-benefit：受伤后选空手友方补到4张；全员无补牌收益时未选择敌方、未产生摸牌。',
            'notes': '正向补牌对象与无收益负向均取得真实结算。',
        },
    },
    'pangtong': {
        'lianhuan': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-lianhuan-boundary-native.json / shenhua-huo-lianhuan-boundary.json：原策略对所有已横置目标返回 -100，复现出“低血友方+火计威胁不解除”“自己已横置不解除”“禁用重铸时空过”三类退化；删除覆盖后原生与扩展 10 个连环局面语义完全一致。另覆盖已横置敌方保持连环、重铸收益、未横置敌方建立连环、仅未横置友方重铸等分支。',
            'notes': '复核纠正：已横置友方/自身的解除横置是连锁属性伤害风险下的保护收益，不能仅按是否摸牌判断；删除原过度策略，保留宿主 get.effect。',
        },
        'oldniepan': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / shenhua-huo-oldniepan-dying、oldniepan-tao：1血受2伤后发动限定技，弃牌/重置/摸3并回到3血；有桃可自救时改用桃，未消耗限定技。',
            'notes': '濒死正向与“桃足够时不烧限定技”的负向均有真实结果。',
        },
    },
    'taishici': {
        'tianyi': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / tianyi-win-sha、tianyi-lose-sha、tianyi-lose-content：有高点数牌+杀时实际发动天义，拼点胜利获得天义2并出杀造成伤害；高失败风险局面改出普通杀、不发动天义；直接结算失败分支获得天义3且杀不可用。',
            'notes': '胜利收益、负向决策与失败临时技规则均覆盖。',
        },
    },
    'yanwen': {
        'shuangxiong': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '完成质量审查，保留原生',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / shuangxiong-judge、shuangxiong-duel、shuangxiong-no-judge；quality-shuangxiong-3cards 原生3张手牌摸两张，quality-shuangxiong-forced 强制改判只多一次可被响应的决斗。',
            'notes': '候选改动：3张两色手牌改判定；固定局面未证明严格优于摸两张，故保留原生。',
        },
    },
    're_yuanshao': {
        'luanji': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'validation_level': '确认存在质量提升并已实现',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'quality-luanji-ally-lethal：1血空手无防具队友时原生 check=6、扩展 check=0；probe-native-3 原始执行中原生 used=true、allyHp=0。shenhua-huo-luanji-wanjian-use 全敌方场景扩展仍实际发动万箭；luanji-no-pair、luanji-wanjian 负向保持。',
            'notes': '只在原生评分为正且存在1血空手无防具友方时返回0；不改目标合法性、万箭结算或材料价值。',
        },
        'xueyi': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '规则结算验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': False, 'positive_negative': False, 'passive': True},
            'evidence': 'shenhua-huo-review-native.json / shenhua-huo-passive-rules：主公袁绍且有其他群势力时，手牌上限为基础4+2×3=10。',
            'notes': '纯被动规则；无独立AI选择，不强行增加策略。',
        },
    },
    'sp_zhugeliang': {
        'bazhen': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '规则结算验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': False, 'positive_negative': True, 'passive': True},
            'evidence': 'shenhua-huo-review-native.json / bazhen-bagua、bazhen-armor-negative：空护甲槽时敌方红杀触发八卦判定（红）并抵消伤害；装备仁王盾后额外八阵失效，不判定且实际受到1点伤害。',
            'notes': '八卦为自动响应规则，无独立目标AI；正向判定与护甲槽失效均验证。',
        },
        'huoji': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': 'AI决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / huoji-use、huoji-no-red、huoji-red：红牌充分且目标有手牌时实际以红牌当火攻，弃同花色牌造成1点火焰伤害；无红牌时不发动；单红无懈保守局面不发动并保留手牌。',
            'notes': '合法转化、实际伤害、目标选择与两类不发动条件均覆盖。',
        },
        'kanpo': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '正反向决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / kanpo-response、kanpo-no-black：敌方南蛮指定诸葛亮时，AI 以黑桃闪当无懈响应，锦囊被取消且未受伤；无黑牌时不响应并实际受到1点伤害。',
            'notes': '真实响应路径与无黑牌负向均覆盖；passive-rules 另证 kanpo.viewAsFilter 前置。',
        },
    },
    're_pangde': {
        'mashu': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': '规则结算验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': False, 'positive_negative': False, 'passive': True},
            'evidence': 'shenhua-huo-review-native.json / shenhua-huo-passive-rules：获得马术后对同一敌方距离由2降为1。',
            'notes': '纯被动距离规则；无独立AI选择。',
        },
        'jianchu': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主通过',
            'validation_level': 'AI决策验证通过',
            'validation': {'rule_settlement': True, 'ai_decision': True, 'positive_negative': True},
            'evidence': 'shenhua-huo-review-native.json / jianchu-sha、jianchu-no-equip：目标持诸葛连弩时 AI 发动鞬出弃装备并记录不可闪避，杀造成1点伤害；目标无装备时按技能文本弃其一张手牌并令其获得此杀，杀仍造成1点伤害。',
            'notes': '装备直击与无装备交换分支均按技能文本真实结算；未发现非法目标或隐藏信息读取，不额外改写评分。',
        },
    },
    're_liubei': {
        'rerende': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': 'rerende 未建立固定局面场景。',
            'notes': '保留原实现。',
        },
        'rejijiang': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': 'rejijiang 未建立固定局面场景。',
            'notes': '保留原实现。',
        },
    },
    're_huanggai': {
        'rekurou': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '独立页面：4血/3血发动并兑现诈降（摸3、额外杀、红杀无距离限制）；2血仅在场上存在爆发目标时发动（主动纳入诈降收益，而非照抄标准苦肉阈值）；2血无目标不发动；敌方反击后存活。',
            'notes': '未复现“套用标准阈值导致漏发”；观察项：原生 check 8-价值会优先弃杀保无懈，属原生取舍，本轮不改。',
        },
        'zhaxiang': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '与 rekurou 同结算观察：loseHpEnd 摸3、isPhaseUsing 时加临时技、红色杀无距离限制与直击在真实回合兑现；额外出杀次数被实际使用。',
            'notes': '不因 rekurou 通过而自动标为通过——诈降的结算分支在同一回合内被单独确认。',
        },
    },
    'ol_weiyan': {
        'xinkuanggu': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '狂骨仅在 reqimou 修复场景的结算中被顺带观察到，未单独建立固定局面。',
            'notes': '不在 reqimou 通过后自动视为狂骨通过。',
        },
        'reqimou': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'evidence': '独立页面复现：原生 processAI 固定支付 hp-1——目标贴脸2血只需1点（1次额外出杀）也支付3点；gate 只要4距离内有效果>0的目标就放行。策略：无目标需要支付时 gate 拦截；支付收紧为 max(1, 达距所需, 击杀所需) 且上限 hp-1、只考虑手杀可击杀的目标。near1/near2 从付3降为付1并完成击杀；far4 手杀不足以击杀时保留原生档位（降级安全），far4-防守目标同样回退原生。',
            'notes': '通过包装 reqimou content 内的 chooseNumbers 作用域收紧档位，不复制技能主体；gate 只拦截“无需支付”，不引入固定血线。',
        },
    },
    'ol_dianwei': {
        'olqiangxi': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '独立页面：2血对1血用自伤完成击杀并存活；武器优先（2血/1血持武器0掉血）；2血对2血、1血无武器拒绝；3血对3血按原生自伤1伤。确认 olqiangxi 走“受到伤害”而非“失去体力”（actor damage nosource 被记录）。',
            'notes': '与标准 qiangxix 分开评估；未共用阈值。',
        },
        'olninge': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': 'olninge 未建立固定局面场景。',
            'notes': '保留原实现；未取得复现证据。',
        },
    },
}

OUT_OF_SCOPE = [{
    'skill_id': 'redimeng',
    'skill_name': '缔盟',
    'character': '活动武将/界鲁肃（非142清单ID）',
    'priority_revised': 'P0',
    'review_status': '已修复',
    'implementation_status': '已实施',
    'test_status': '真实宿主通过',
    'skill_statuses': [{
        'id': 'redimeng', 'name': '缔盟', 'status': '已修复',
        'implementation': '已实施', 'test': '真实宿主通过',
        'evidence': '混合后的暗牌选择中，原生AI用 get.value(button.link) 直接挑最高价值牌；真实验证第一个选择者拿走桃+无中生有，人类同界面为暗牌。公平钩子改为按位置/玩家id的稳定分数；同一局面置换暗牌牌面后，两次选择的索引一致。',
        'notes': '只对AI选择者生效；人类路径不变；卸载还原；选择器异常不调用原生看牌评分。',
    }],
    'evidence': '混合后的暗牌选择中，原生AI用 get.value(button.link) 直接挑最高价值牌；公平钩子改为按位置/玩家id的稳定分数；同一局面置换暗牌牌面后，两次选择的索引一致。',
    'notes': '只对AI选择者生效；人类路径不变；卸载还原；选择器异常不调用原生看牌评分。',
}]


PACK_GROUPS = {
    'standard': '标准包',
    'shenhua': '神话再临',
    'refresh': '界限突破',
    'out_of_scope': '清单外角色',
}
PACK_ORDER = [
    'standard_2008', 'standard_2013', 'standard_2019', 'standard_2023',
    'shenhua_feng', 'shenhua_huo', 'shenhua_lin', 'shenhua_shan', 'shenhua_yin', 'shenhua_lei',
    'refresh_standard', 'refresh_feng', 'refresh_huo', 'refresh_lin', 'refresh_shan',
    'out_of_scope',
]
CATEGORY_PACKS = {
    'standard_2008': ('standard', '标准包·2008版'),
    'standard_2013': ('standard', '标准包·2013版'),
    'standard_2019': ('standard', '标准包·2019版'),
    'standard_2023': ('standard', '标准包·2023版'),
    'shenhua_feng': ('shenhua', '神话再临·风'),
    'shenhua_huo': ('shenhua', '神话再临·火'),
    'shenhua_lin': ('shenhua', '神话再临·林'),
    'shenhua_shan': ('shenhua', '神话再临·山'),
    'shenhua_yin': ('shenhua', '神话再临·阴'),
    'shenhua_lei': ('shenhua', '神话再临·雷'),
    'refresh_standard': ('refresh', '界限突破·标准'),
    'refresh_feng': ('refresh', '界限突破·风'),
    'refresh_huo': ('refresh', '界限突破·火'),
    'refresh_lin': ('refresh', '界限突破·林'),
    'refresh_shan': ('refresh', '界限突破·山'),
    'out_of_scope': ('out_of_scope', '清单外角色'),
}
COMPLETE_SKILL_STATUSES = {'已验证无问题', '已修复'}
COMPLETE_TESTS = {'真实宿主通过', '真实宿主完整回合通过'}


def pack_status(skills, blockers):
    """分包审查状态；可交付/已交付由交付记录另行追加。"""
    if not skills:
        return '尚未开始'
    reviewed = [s for s in skills if s['status'] != '尚未验证']
    if not reviewed:
        return '尚未开始'
    resolved = [
        s for s in skills
        if s['status'] in COMPLETE_SKILL_STATUSES
        and s.get('implementation') in ('无需改动', '已实施')
        and s.get('test') in COMPLETE_TESTS
    ]
    if len(resolved) == len(skills) and not blockers:
        return '验证完成'
    if any(s['status'] == '已修复' for s in skills):
        return '部分修复'
    return '正在审查'


def apply_delivery(review_status, delivery):
    if review_status == '验证完成' and delivery.get('status') in ('可交付', '已交付'):
        return delivery['status']
    return review_status


def load_delivery():
    path = os.path.join(DOC, 'pack-delivery.json')
    if not os.path.exists(path):
        return {}
    try:
        data = json.load(open(path, encoding='utf-8'))
        return {item['pack_id']: item for item in data.get('packs', [])}
    except Exception:
        return {}


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def skill_record(skill, override):
    return {
        'id': skill['id'],
        'name': skill.get('name', ''),
        'source': skill.get('source'),
        'status': override.get('status', '尚未验证'),
        'implementation': override.get('implementation', '未改动'),
        'test': override.get('test', '未测试'),
        'evidence': override.get('evidence', ''),
        'notes': override.get('notes', '保留原实现；未取得复现证据。'),
        'validation_level': override.get('validation_level'),
        'validation': override.get('validation', {}),
        'host_line_1117': HOST_LINES_1117.get(skill['id']),
    }


def aggregate_review(statuses):
    if not statuses or all(s == '尚未验证' for s in statuses):
        return '尚未验证'
    if all(s == '已验证无问题' for s in statuses):
        return '已验证无问题'
    if all(s in ('已修复', '已验证无问题') for s in statuses) and any(s == '已修复' for s in statuses):
        return '已修复'
    if all(s == '已修复' for s in statuses):
        return '已修复'
    if any(s in ('已修复', '已复现') for s in statuses) and any(s == '尚未验证' for s in statuses):
        return '部分通过'
    if any(s == '已复现' for s in statuses):
        return '已复现'
    return '部分通过'


def aggregate_implementation(values):
    if all(v == '无需改动' for v in values):
        return '无需改动'
    if all(v == '未改动' for v in values):
        return '未改动'
    if all(v == '已实施' for v in values):
        return '已实施'
    return '部分实施'


def aggregate_test(values):
    if all(v == '未测试' for v in values):
        return '未测试'
    if all(v == '真实宿主完整回合通过' for v in values):
        return '真实宿主完整回合通过'
    if all(v in ('真实宿主通过', '真实宿主完整回合通过') for v in values):
        return '真实宿主通过'
    if any(v == '部分通过' for v in values):
        return '部分通过'
    if any(v == '未测试' for v in values):
        return '部分通过'
    return '真实宿主通过'


def main():
    candidates = json.load(open(os.path.join(SRC, 'AI更新候选清单.json'), encoding='utf-8'))
    tasks = json.load(open(os.path.join(SRC, '测试任务清单.json'), encoding='utf-8'))
    task_by_char = {t['character_id']: t for t in tasks['tasks']}
    records = []
    for c in candidates['records']:
        task = task_by_char.get(c['character_id'], {})
        char_override = CHARACTER_OVERRIDES.get(c['character_id'], {})
        skill_overrides = SKILL_OVERRIDES.get(c['character_id'], {})
        original_priority = task.get('priority', 'P1' if c['classification'] == '优先更新候选' else 'P3')
        priority = char_override.get('priority_revised', 'P2' if original_priority == 'P1' else 'P3')
        skills = [skill_record(s, skill_overrides.get(s['id'], {})) for s in c['skills_for_location']]
        pack_group, pack_name = CATEGORY_PACKS[c['category']]
        statuses = [s['status'] for s in skills]
        implementations = [s['implementation'] for s in skills]
        tests = [s['test'] for s in skills]
        reviewed = [s['id'] for s in skills if s['status'] != '尚未验证']
        records.append({
            'task_id': task.get('task_id') or ('AI-' + c['character_id']),
            'character_id': c['character_id'],
            'character_name': c['character_name'],
            'category': c['category'],
            'pack_id': c['category'],
            'pack_name': pack_name,
            'pack_group': pack_group,
            'classification_original': c['classification'],
            'mechanism': task.get('mechanism', ''),
            'skills': skills,
            'priority_original': original_priority,
            'priority_revised': priority,
            'review_status': aggregate_review(statuses),
            'reviewed_skills': reviewed,
            'implementation_status': aggregate_implementation(implementations),
            'test_status': aggregate_test(tests),
            'evidence': '；'.join(f"{s['name'] or s['id']}：{s['evidence']}" for s in skills if s['evidence']),
            'notes': '；'.join(f"{s['name'] or s['id']}：{s['notes']}" for s in skills if s['notes']),
        })
    all_skills = [skill for record in records for skill in record['skills']]
    delivery = load_delivery()
    packs = []
    for pack_id in PACK_ORDER:
        group, name = CATEGORY_PACKS[pack_id]
        if pack_id == 'out_of_scope':
            characters = [{'character_id': 'activity_lusu', 'character_name': '活动武将/界鲁肃（非142清单ID）'}]
            pack_skills = [dict(skill) for skill in OUT_OF_SCOPE[0]['skill_statuses']]
        else:
            characters = [{'character_id': r['character_id'], 'character_name': r['character_name']} for r in records if r['pack_id'] == pack_id]
            pack_skills = [skill for r in records if r['pack_id'] == pack_id for skill in r['skills']]
        blockers = [s['id'] for s in pack_skills if s['status'] == '已复现']
        review = pack_status(pack_skills, blockers)
        delivery_entry = delivery.get(pack_id, {'pack_id': pack_id, 'status': '未打包'})
        status_counts = {}
        for skill in pack_skills:
            status_counts[skill['status']] = status_counts.get(skill['status'], 0) + 1
        packs.append({
            'pack_id': pack_id,
            'pack_name': name,
            'pack_group': PACK_GROUPS[group],
            'category': None if pack_id == 'out_of_scope' else pack_id,
            'target_characters': characters,
            'target_skills': [skill['id'] for skill in pack_skills],
            'counts': {
                'characters': len(characters),
                'skills': len(pack_skills),
                'reviewed_skills': sum(1 for skill in pack_skills if skill['status'] != '尚未验证'),
                'fixed_skills': sum(1 for skill in pack_skills if skill['status'] == '已修复'),
                'verified_skills': sum(1 for skill in pack_skills if skill['status'] == '已验证无问题'),
                'unreviewed_skills': sum(1 for skill in pack_skills if skill['status'] == '尚未验证'),
                'skill_status': status_counts,
            },
            'review_status': review,
            'status': apply_delivery(review, delivery_entry),
            'delivery_status': delivery_entry.get('status', '未打包'),
            'delivery': delivery_entry,
            'blocking_issues': blockers,
            'can_mark_deliverable': review == '验证完成' and not blockers,
            'criteria': '该分包全部目标武将的登记技能均已审查、已发现的缺陷已解决、无阻塞性问题，才能标记完整可交付；验证无问题也计入完成。',
        })
    pack_counts = {}
    for pack in packs:
        value = pack['status']
        pack_counts[value] = pack_counts.get(value, 0) + 1
    counts = {
        'total': len(records),
        'skills_total': len(all_skills),
        'priority_revised': {p: sum(1 for r in records if r['priority_revised'] == p) for p in ('P0', 'P1', 'P2', 'P3')},
        'review_status': {},
        'implementation_status': {},
        'test_status': {},
        'skill_status': {},
        'skill_implementation': {},
        'skill_test': {},
        'pack_status': pack_counts,
        'packs_total': len(packs),
    }
    for key, source in (
        ('review_status', records), ('implementation_status', records), ('test_status', records),
        ('skill_status', all_skills), ('skill_implementation', all_skills), ('skill_test', all_skills),
    ):
        field = {'skill_status': 'status', 'skill_implementation': 'implementation', 'skill_test': 'test'}.get(key, key)
        for item in source:
            value = item[field]
            counts[key][value] = counts[key].get(value, 0) + 1
    doc = {
        'schema_version': '4.0',
        'record_kind': 'packed_review_inventory_with_skill_level_status',
        'generated_at': '2026-11-02',
        'baseline': {
            'extension': '无名AI v4.4.4 (1fe5292eb3022dd8d1db494617b21a12be912e61)',
            'host': '无名杀 1.11.7 (lib.version; app package 1.11.0)',
            'proposal_reference': 'libnoname/noname b481b17552dd46e7d9ca805d5d7975b742168256',
        },
        'source_package': {
            'candidate_sha256': sha256(os.path.join(SRC, 'AI更新候选清单.json')),
            'task_sha256': sha256(os.path.join(SRC, '测试任务清单.json')),
        },
        'counts': counts,
        'packs': packs,
        'out_of_scope_findings': OUT_OF_SCOPE,
        'records': records,
    }
    out_json = os.path.join(DOC, '142-task-list.json')
    with open(out_json, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
        f.write('\n')
    out_csv = os.path.join(DOC, '142-task-list.csv')
    with open(out_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['task_id', 'character_id', 'character_name', 'category', 'pack_id', 'pack_name', 'skills', 'skill_statuses',
                         'priority_original', 'priority_revised', 'review_status', 'implementation_status',
                         'test_status', 'evidence', 'notes'])
        for r in records:
            skill_statuses = '|'.join(f"{s['id']}:{s['status']}/{s['implementation']}/{s['test']}" for s in r['skills'])
            writer.writerow([
                r['task_id'], r['character_id'], r['character_name'], r['category'], r['pack_id'], r['pack_name'],
                '|'.join(s['id'] for s in r['skills']), skill_statuses,
                r['priority_original'], r['priority_revised'], r['review_status'],
                r['implementation_status'], r['test_status'], r['evidence'], r['notes'],
            ])
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print('written', out_json, out_csv)


if __name__ == '__main__':
    main()
