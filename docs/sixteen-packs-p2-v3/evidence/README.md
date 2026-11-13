# 独立复验材料

以下证据由独立验证 Agent 在隔离宿主副本或隔离 Chrome 上取得。开发者单元测试和封版历史证据另列。测试环境用受控牌面、身份和触发时机重现问题，使用真实 Player、GameEvent、选择与结算。未将固定局面解释为整局托管。

- `native-roundtrip.json` 是从 `235aea0` 导出十个补丁的 LF/CRLF、重复应用、语法、累计及逆序恢复证明。
- `install-exact-runtime.json` 使用干净 `1fe5292` 根安装六份 ZIP，列出实际归档和模块哈希。中间雷候选与最终归档仅 `pack.json` 和 `manifest.json` 的交付阶段枚举不同。六包完整安装事务在最终归档重跑，见 `installer-battery.json`。
- `identity-stock.json`、`identity-final.json`、`identity-refined.json`、`identity-feijun-old.json` 是旧/新真实身份局事件与受影响技能证据。首轮 `identity-final.json` 的空化身 `timeout:true` 为探针定时器在事件已返回后仍触发，后一轮清除计时器，记录实际 60.6 毫秒完成，无倒计时。
- `identity-stock-legal-initial.json` 与 `identity-stock-empty-timeout.log` 分别是同类入场真实正常池以及合法空池的原宿主对照。空池进程由 80 秒外部 watchdog 终止。
- `identity-initial-native.json` 提供固定 RNG 屯田、合法池和防御场景记录。 `identity-critical.json` 是双风、鞬出、界标基类、缔盟两个版本的关键冒烟补充，六 owner 生命周期仍以组合记录为准。
- `identity-zhengu-manual.json` 是浏览器实际点击取消、选中、反选、换选、确认与两次结算。
- `identity-xiongluan-actual.json` 和同名日志记录真正的自动 `chooseToUse`。对照只替换雄乱评分，使用同一完整引擎。泛用评分的对照保留在 `identity-refined.json`。
- `kuanggu-draw-over-recovery.json` 是真实双将身份局正回复收益低于摸牌的确定场景。
- `guozhan-smoke.json`、`versus-two-smoke.json` 为独立模式响应模块冒烟。 `doudizhu-observation.json` 为观察记录，模式模块载入并完成固定响应，未给出验收断言结果。三个测试不加载完整 v3 组合。
- `python evidence/verify-observations.py` 可从原始观测重核八组独立断言。
