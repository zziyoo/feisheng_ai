import json
from pathlib import Path

root = Path(__file__).parent
def read(name):
    return json.loads((root/name).read_text(encoding="utf-8-sig"))

def cases(name):
    report = read(name)
    assert report["status"] == "passed" and not report["errors"], name
    assert report["hostVersion"] == "1.11.7" and report["browserVersion"] == "157.0.8103.78", name
    assert all(not case.get("sceneError") for case in report["scenes"]), name
    return {case["name"]: case for case in report["scenes"]}

stock = cases("identity-stock.json")
final = cases("identity-final.json")
assert final["edge-preflight"]["count"] == 8
final_report = read("identity-final.json")
assert set(final_report["extension"]["policyStats"]["packs"]) == {
    "refresh_standard","refresh_feng","shenhua_feng","shenhua_huo","shenhua_lei","out_of_scope"
}
assert final_report["extension"]["engineEnabled"]

protected = "v3-qizhi-protected-real"
mixed = "v3-qizhi-mixed-real"
assert stock[protected]["choice"]["bool"] and stock[protected]["scores"][0][1] == 1
assert len(stock[protected]["enemyHand"]) == 1 and stock[protected]["enemyEquip"] == ["bagua"]
assert not final[protected]["choice"]["bool"] and final[protected]["scores"][0][1] == 0
assert final[protected]["history"] == 0 and final[protected]["enemyHand"] == []
assert final[protected]["enemyEquip"] == ["bagua"]
assert final[mixed]["choice"]["bool"] and final[mixed]["history"] == 1
assert len(final[mixed]["enemyHand"]) == 1 and final[mixed]["enemyEquip"] == ["bagua"]
print("P2-01: stock protected AI selected and granted one draw; final AI declined; legal mixed continued.")

qiaobian = "v3-reqiaobian-real"
assert stock[qiaobian]["gates"]["judge"] == [True]*4
assert not stock[qiaobian]["gates"]["draw"][1] and not stock[qiaobian].get("payment")
assert list(final[qiaobian]["gates"].values()) == [[i == j for i in range(4)] for j in range(4)]
assert final[qiaobian]["payment"]["parent"] == "reqiaobian_draw"
assert final[qiaobian]["payment"]["expectedContextAllowed"] and final[qiaobian]["payment"]["result"]
assert final[qiaobian]["triggerCancelled"] and final[qiaobian]["afterHands"] == [["shan","tao"],[],[]]
print("P2-02: all four permission rows correct; phaseDrawBefore paid and skipped and gained two enemy cards.")

refined = cases("identity-refined.json")
old_feijun = cases("identity-feijun-old.json")
actor = "75027863590"
enemy = "74695553592"
for key, card, value, score, zone in [
    ("v3-feijun-cheap-hand","wugu",0,5,"h"),
    ("v3-feijun-equal-equip","qinggang",2,3,"e"),
]:
    assert old_feijun[key]["prePay"]["ai"] is None and refined[key]["prePay"]["ai"] == 1
    assert refined[key]["prePay"]["cards"] == [{
        "name":card,"value":value,"score":score,"position":zone,"ownDiscardable":True
    }]
    assert refined[key]["choice"] == {"bool":True,"cards":[card]}
hand_case = refined["v3-feijun-cheap-hand"]
assert hand_case["before"]["hand"][actor] == ["wugu"] and hand_case["before"]["hand"][enemy] == ["tao"]
assert len(hand_case["after"]["hand"][actor]) == 3 and "tao" in hand_case["after"]["hand"][actor]
assert hand_case["after"]["hand"][enemy] == []
equip_case = refined["v3-feijun-equal-equip"]
assert equip_case["before"]["equip"][actor] == ["qinggang"] and equip_case["before"]["equip"][enemy] == ["bagua"]
assert equip_case["after"]["equip"][actor] == equip_case["after"]["equip"][enemy] == []
assert len(equip_case["after"]["hand"][actor]) == 2
for key in ("v3-feijun-protected-equip","v3-feijun-no-target"):
    assert refined[key]["prePay"]["ai"] == 0 and not refined[key]["choice"]["bool"]
    assert refined[key]["before"]["hand"] == refined[key]["after"]["hand"]
    assert refined[key]["before"]["equip"] == refined[key]["after"]["equip"]
assert final["edge-feijun-postpay"]["binglveMarker"]
print("P2-03: hand/equipment payment opens target, choices and real transfer/discard + Binglve; protected/no target decline.")

tuntian = final["edge-tuntian-hidden"]
signatures = []
for label in ("caseShaTao","caseShaSha","caseShanTao"):
    hand = tuntian[label]
    assert hand["publicCount"] == 2 and hand["knownByActor"] == hand["knownByViewer"] == 0 and hand["fixedRng"] == .37
    assert list(hand["randCache"].values()) == [.37]
    signatures.append((hand["juedou"],hand["sha"],hand["effectJuedou"]))
assert signatures[0] == signatures[1] == signatures[2]
print("屯田: fixed event RNG 0.37 and three different hidden hands return identical scores.")

normal = final["edge-rehuashen-initial-real"]["initialResult"]
assert len(normal["names"]) == 3 and normal["current"] in normal["names"]
assert normal["current2"] in normal["owned"] and not normal["countdown"]
exhausted = refined["edge-rehuashen-exhausted-real"]
assert exhausted["pool"] == [] and exhausted["triggerCompleted"]
assert "timeout" not in exhausted and not exhausted["afterTrigger"]["countdown"] and exhausted["afterTrigger"]["count"] == 0
assert final["edge-rehuashen-empty"]["result"] == {"bool":False,"cost_data":"cancel2"}
old_hang = (root/"identity-stock-empty-timeout.log").read_text(encoding="utf-8")
assert "real exhaustion pool []" in old_hang and "finish edge-rehuashen-exhausted-real" not in old_hang
print("P2-11: real empty phaseBefore hang resolved; ordinary avatar/skill path and synthetic cancelled case checked.")

auto = cases("identity-xiongluan-actual.json")
assert len(auto) == 6
for s in auto.values():
    assert s["choiceContext"] == {"isMine":False,"isAuto":True,"actorHasSkill":True,"enabled":True}
    assert all(entry[2] == 0 for entry in s["ai2"] if entry[0] == "drlt_xiongluan" and entry[1] != s["enemy"])
    assert all(target[1] == "fan" for target in s["choice"]["targets"])
assert auto["v3-xiongluan-auto-stock-one"]["raw"] == -1 and auto["v3-xiongluan-auto-fixed-one"]["raw"] == 0
assert not auto["v3-xiongluan-auto-stock-one"]["choice"]["bool"] and not auto["v3-xiongluan-auto-fixed-one"]["choice"]["bool"]
for name in ("v3-xiongluan-auto-stock-two","v3-xiongluan-auto-fixed-two","v3-xiongluan-auto-fixed-bare"):
    assert auto[name]["choice"]["skill"] == "drlt_xiongluan" and auto[name]["banned"] == [auto[name]["enemy"]]
print("雄乱: weighted scorer changes in real host; actual phaseUse targets only enemies and preserves positive controls.")

zhengu = read("identity-zhengu-manual.json")
assert zhengu["status"] == "passed" and not zhengu["errors"] and zhengu["prompt"]["hook"]
assert zhengu["cancelled"]["stored"] == zhengu["unselected"]["selected"] == zhengu["settled"]["stored"] == []
assert zhengu["first"]["selected"] == ["first"] and zhengu["reselected"]["selected"] == zhengu["confirmed"]["stored"] == ["second"]
assert zhengu["settled"]["secondCount"] == 3
print("镇骨: real browser cancellation, select/unselect/reselect, and settlement pass.")

roundtrip = read("native-roundtrip.json")
assert roundtrip["status"] == "passed" and roundtrip["crlfSha256Unchanged"]
assert len(roundtrip["applyOrder"]) == len(roundtrip["duplicatesRejected"]) == len(roundtrip["crlfRejected"]) == 10
assert roundtrip["reverseOrder"] == roundtrip["applyOrder"][::-1]
assert len(roundtrip["syntax"]) == 5 and roundtrip["restoredSha256"] == roundtrip["cleanSha256"]
print("Native patches: 10 LF check/apply, duplicate/CRLF reject, 10 reverse, 5 syntax and exact restores.")
