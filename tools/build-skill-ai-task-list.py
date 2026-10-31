#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把测试包原始清单整理成带复核状态的 142 将任务清单。

输入：docs/skill-ai-20261030/source/AI更新候选清单.json
      docs/skill-ai-20261030/source/测试任务清单.json
输出：docs/skill-ai-20261030/142-task-list.json / .csv
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
}

OVERRIDES = {
    're_sunquan': {
        'priority_revised': 'P1',
        'review_status': '已复现',
        'implementation_status': '已实施',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['rezhiheng'],
        'evidence': '完整 phaseUse：3血持桃+两杀时原生弃桃+杀并摸3，优化后保留桃、只弃非防御牌摸1；1/2血、只桃/只闪、含回复、防具场景均保留防御；4血负向对照仍走原生全手换牌。',
        'notes': '共享低血防御保留策略；标准制衡已验证无需改动；rejiuyuan 未审查。',
    },
    'zhoufei': {
        'priority_revised': 'P1',
        'review_status': '已复现',
        'implementation_status': '已实施',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['olkongsheng'],
        'evidence': 'olkongsheng.cost 中 getExpansions() 返回数组却直接加数字，阈值比较失真；原生成本AI选3张，修正后选1张；重复调用均为1张，异常后补丁作用域恢复，数组语义（索引/长度/迭代/JSON）保持不变。',
        'notes': 'olliangyin 未审查；kongsheng（新版）未改动；已加宿主成本指纹，表达式变化时跳过。',
    },
    're_zhangliao': {
        'priority_revised': 'P1',
        'review_status': '已复现',
        'implementation_status': '已实施',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['new_retuxi'],
        'evidence': '三名敌人手牌1/4/2时，原生选1+2并跳过4；优化后选4+2；屯田目标不叠加手牌奖励；只有友方、单目标、零目标原生均正常放弃/正常摸牌。',
        'notes': '共享目标策略只对敌人按公开手牌数加0~2分，不改变合法目标集合；没有添加无证据的发动护栏。',
    },
    'sunquan': {
        'priority_revised': 'P3',
        'review_status': '验证无问题',
        'implementation_status': '无需改动',
        'test_status': '真实宿主完整回合通过',
        'reviewed_skills': ['zhiheng'],
        'evidence': '完整 phaseUse 七种局面：3血会弃两杀保留桃；3血/4上限会先用桃回血；1血会先用桃；1血混合牌不发动；击杀/防具场景正常。未复现“弃闪/桃”缺陷。',
        'notes': '上一轮隔离 chooseToUse 的“选闪”是夹具假象；已移除标准制衡策略，只保留界制衡。jiuyuan 未审查。',
    },
    'huanggai': {
        'priority_revised': 'P2',
        'review_status': '尚待验证',
        'implementation_status': '未改动',
        'test_status': '部分通过',
        'reviewed_skills': ['kurou'],
        'evidence': '3血1手牌时原生会发动苦肉，降到2血摸2；未发现明确越权或非法决策，按“验证后决定”保留。',
        'notes': '低血生存与桃/救援的联合估值仍需更多真实回合样本。',
    },
    'zhangliao': {
        'priority_revised': 'P3',
        'review_status': '验证无问题',
        'implementation_status': '无需改动',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['tuxi'],
        'evidence': '仅友方有手牌时原生突袭放弃并正常摸2；两敌人1/4手牌时偷1+1，符合跳过摸牌的成本。',
        'notes': '不叠加重复优化。',
    },
    'liubei': {
        'priority_revised': 'P3',
        'review_status': '验证无问题',
        'implementation_status': '无需改动',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['rende'],
        'evidence': '3血2无懈、敌人空手、队友3手牌时，原生仁德把牌交给队友并回复1血；未把牌交给敌人。',
        'notes': 'jijiang 未审查。',
    },
    're_lusu': {
        'priority_revised': 'P3',
        'review_status': '验证无问题',
        'implementation_status': '无需改动',
        'test_status': '真实宿主通过',
        'reviewed_skills': ['dimeng'],
        'evidence': '标准缔盟只读公开手牌数量；队友1手/敌人3手时正确交换，未读取隐藏牌面。',
        'notes': 'haoshi 未审查；隐藏手牌读取实际出现在活动武将的 redimeng（清单外），已单独修复。',
    },
    're_weiyan': {
        'priority_revised': 'P2',
        'review_status': '尚未验证',
        'implementation_status': '未改动',
        'test_status': '未测试',
        'evidence': '代码复核显示奇谋在1血返回0、只在低血敌人且在解锁距离内考虑；未取得真实回合复现。',
        'notes': '保留原实现。',
    },
    'dianwei': {
        'priority_revised': 'P2',
        'review_status': '尚未验证',
        'implementation_status': '未改动',
        'test_status': '未测试',
        'evidence': '代码复核显示强袭在2血及以下对体力支付返回-10，优先用装备；未取得真实回合复现。',
        'notes': '保留原实现。',
    },
    're_liubei': {
        'priority_revised': 'P2',
        'review_status': '尚未验证',
        'implementation_status': '未改动',
        'test_status': '未测试',
        'evidence': 'rerende 未建立固定局面场景。',
        'notes': '保留原实现。',
    },
    're_huanggai': {
        'priority_revised': 'P2',
        'review_status': '尚未验证',
        'implementation_status': '未改动',
        'test_status': '未测试',
        'evidence': '界苦肉依赖诈降摸3，不能套用标准苦肉的停止条件；未建立真实场景。',
        'notes': '保留原实现，避免误伤既有爆发路线。',
    },
}

OUT_OF_SCOPE = [{
    'skill_id': 'redimeng',
    'skill_name': '缔盟',
    'character': '活动武将/界鲁肃（非142清单ID）',
    'priority_revised': 'P0',
    'review_status': '已复现',
    'implementation_status': '已实施',
    'test_status': '真实宿主通过',
    'evidence': '混合后的暗牌选择中，原生AI用 get.value(button.link) 直接挑最高价值牌；真实验证第一个选择者拿走桃+无中生有，人类同界面为暗牌。公平钩子改为按位置/玩家id的稳定分数；同一局面置换暗牌牌面后，两次选择的索引一致（2,0 / 1,3）。',
    'notes': '只对AI选择者生效；人类路径不变；卸载还原；选择器异常不调用原生看牌评分。',
}]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def main():
    candidates = json.load(open(os.path.join(SRC, 'AI更新候选清单.json'), encoding='utf-8'))
    tasks = json.load(open(os.path.join(SRC, '测试任务清单.json'), encoding='utf-8'))
    task_by_char = {t['character_id']: t for t in tasks['tasks']}
    records = []
    for c in candidates['records']:
        task = task_by_char.get(c['character_id'], {})
        override = OVERRIDES.get(c['character_id'], {})
        original_priority = task.get('priority', 'P1' if c['classification'] == '优先更新候选' else 'P3')
        priority = override.get('priority_revised', 'P2' if original_priority == 'P1' else 'P3')
        skills = []
        for s in c['skills_for_location']:
            info = dict(s)
            info['host_line_1117'] = HOST_LINES_1117.get(s['id'])
            skills.append(info)
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
            'review_status': override.get('review_status', '尚未验证'),
            'reviewed_skills': override.get('reviewed_skills', []),
            'implementation_status': override.get('implementation_status', '未改动'),
            'test_status': override.get('test_status', '未测试'),
            'evidence': override.get('evidence', ''),
            'notes': override.get('notes', '保留原实现；未取得复现证据。'),
        })
    counts = {
        'total': len(records),
        'priority_revised': {p: sum(1 for r in records if r['priority_revised'] == p) for p in ('P0', 'P1', 'P2', 'P3')},
        'review_status': {},
        'implementation_status': {},
        'test_status': {},
    }
    for key in ('review_status', 'implementation_status', 'test_status'):
        for r in records:
            counts[key][r[key]] = counts[key].get(r[key], 0) + 1
    doc = {
        'schema_version': '2.0',
        'record_kind': 'reviewed_inventory_not_confirmed_defects',
        'generated_at': '2026-10-30',
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
        writer.writerow(['task_id', 'character_id', 'character_name', 'category', 'skills', 'priority_original', 'priority_revised', 'review_status', 'implementation_status', 'test_status', 'evidence', 'notes'])
        for r in records:
            writer.writerow([
                r['task_id'], r['character_id'], r['character_name'], r['category'],
                '|'.join(s['id'] for s in r['skills']), r['priority_original'], r['priority_revised'],
                r['review_status'], r['implementation_status'], r['test_status'], r['evidence'], r['notes'],
            ])
    print(json.dumps(counts, ensure_ascii=False, indent=2))
    print('written', out_json, out_csv)


if __name__ == '__main__':
    main()
