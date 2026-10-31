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
    're_weiyan': {
        'xinkuanggu': {
            'status': '尚未验证', 'implementation': '未改动', 'test': '未测试',
            'evidence': '狂骨仅在 qimou 修复场景的结算中被顺带观察到（伤害后回血），未单独建立固定局面。',
            'notes': '不在 qimou 通过后自动视为狂骨通过。',
        },
        'qimou': {
            'status': '已修复', 'implementation': '已实施', 'test': '真实宿主通过',
            'evidence': '独立页面复现：目标在3-4距离外、手上有杀且杀次数未用完时，原生 ai.result.player 因 cardUsable 直接返回0，奇谋永不发动（三个场景0动作）。策略只在“杀次数可用恰为唯一阻塞、且支付能兑换成击杀”时放宽：far4-3sha-hp3 修复后发动并3杀击杀，far3-2sha-hp2 同理；反向 far4-hp4、目标在射程内、杀次数耗尽均保持原生。',
            'notes': '只覆盖 ai.result.player 的否决分支；不复制技能主体、不改支付档位（档位由宿主 content 决定）。',
        },
    },
    'dianwei': {
        'qiangxix': {
            'status': '已验证无问题', 'implementation': '无需改动', 'test': '真实宿主完整回合通过',
            'evidence': '独立页面：2血对1血执行体力支付并完成击杀（目标有桃/无桃两种）；2血对2血、1血无武器拒绝支付（不自尽）；2血/1血持武器时改用武器0掉血；3血对3血按原生支付1伤。失去体力与弃装备的触发差异也已记录。',
            'notes': '原生评分已实现“低血不付体力、优先装备、能击杀才付”的分层，不叠加策略。',
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
        statuses = [s['status'] for s in skills]
        implementations = [s['implementation'] for s in skills]
        tests = [s['test'] for s in skills]
        reviewed = [s['id'] for s in skills if s['status'] != '尚未验证']
        records.append({
            'task_id': task.get('task_id') or ('AI-' + c['character_id']),
            'character_id': c['character_id'],
            'character_name': c['character_name'],
            'category': c['category'],
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
        'schema_version': '3.0',
        'record_kind': 'reviewed_inventory_with_skill_level_status',
        'generated_at': '2026-10-31',
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
        writer.writerow(['task_id', 'character_id', 'character_name', 'category', 'skills', 'skill_statuses',
                         'priority_original', 'priority_revised', 'review_status', 'implementation_status',
                         'test_status', 'evidence', 'notes'])
        for r in records:
            skill_statuses = '|'.join(f"{s['id']}:{s['status']}/{s['implementation']}/{s['test']}" for s in r['skills'])
            writer.writerow([
                r['task_id'], r['character_id'], r['character_name'], r['category'],
                '|'.join(s['id'] for s in r['skills']), skill_statuses,
                r['priority_original'], r['priority_revised'], r['review_status'],
                r['implementation_status'], r['test_status'], r['evidence'], r['notes'],
            ])
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print('written', out_json, out_csv)


if __name__ == '__main__':
    main()
