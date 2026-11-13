// Real-host probes for the ten remaining native AI packs.
// Runs inside the real 1.11.7 host; does not replace Player/GameEvent/skill settlement.
export async function runSkillAiScenes(page, options = {}) {
  return await page.evaluate(async opts => {
    const { game, lib, get, _status } = realHost;
    const [actor, ally, enemy1, enemy2] = game.players;
    const roster = game.players.slice();
    const rosterGroups = roster.map(p => p.group);
    const errors = [];
    const run = async (name, player, content) => {
      const event = game.createEvent(name, false);
      event.player = player;
      event.setContent(content);
      await game.loop(event);
    };
    const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
    const hand = player => player.getCards('h').map(c => c.name);
    const reset = async () => {
      try { if (game.players.length !== roster.length || roster.some(p => !game.players.includes(p))) game.players.splice(0, game.players.length, ...roster); } catch (e) {}
      for (const p of roster) {
        try { const ex = p.getCards('x'); if (ex.length) await p.loseToDiscardpile(ex); } catch (e) {}
        try { for (const skill of Object.keys(p.tempSkills || {})) { try { p.removeSkill(skill); } catch (e) {} } } catch (e) {}
        p.clearSkills(true);
        try { p.dead = false; p.removed = false; p.classList.remove('dead'); p.classList.remove('out'); } catch (e) {}
        try {
          if (Array.isArray(game.dead)) {
            for (let i = game.dead.length - 1; i >= 0; i--) if (game.dead[i] === p || game.dead[i] === p.playerid) game.dead.splice(i, 1);
          }
        } catch (e) {}
        const cards = p.getCards('hej');
        if (cards.length) await p.discard(cards);
        p.hp = p.maxHp = 4;
        try { p.group = rosterGroups[roster.indexOf(p)] || p.group; } catch (e) {}
        try { p.classList.remove('turnedover'); } catch (e) {}
        try { if (p.isLinked && p.isLinked()) await p.link(false); } catch (e) {}
        for (const key of Object.keys(p.storage || {})) delete p.storage[key];
        try { p.stat = [{ card: {}, skill: {}, triggerSkill: {} }]; } catch (e) {}
        try { p.awakenedSkills = []; } catch (e) {}
        p.identity = p === actor ? 'zhu' : (p === ally ? 'zhong' : 'fan');
        p.identityShown = true;
        try { p.setIdentity(p.identity); } catch (e) {}
        p.update();
      }
      game.zhu = actor;
      actor.update();
      _status.currentPhase = actor;
      try { for (const key of ['cards', 'targets', 'buttons']) { const list = realHost.ui.selected[key]; if (Array.isArray(list)) list.length = 0; } } catch (e) {}
    };
    const give = async (player, list) => {
      const cards = list.map(([name, suit, number]) => card(name, suit, number));
      if (cards.length) await player.gain(cards, 'gain2');
    };
    const clearHand = async player => {
      const cards = player.getCards('h');
      if (cards.length) await player.discard(cards);
    };
    const hideHand = player => {
      for (const c of player.getCards('h')) { try { c.clearKnowers(); } catch (e) {} }
    };
    const captureChooseTarget = player => {
      const log = [];
      const original = player.chooseTarget.bind(player);
      player.chooseTarget = function (...args) {
        const event = original(...args);
        const originalForResult = event.forResult.bind(event);
        event.forResult = async function (...a) {
          const result = await originalForResult(...a);
          log.push({
            bool: !!result.bool,
            targets: (result.targets || []).map(p => p.playerid + ':' + (p.name1 || p.name || '?')),
            check: event.check ?? null,
          });
          return result;
        };
        return event;
      };
      return { log, restore() { player.chooseTarget = original; } };
    };
    const captureChooseToDiscard = player => {
      const log = [];
      const original = player.chooseToDiscard.bind(player);
      player.chooseToDiscard = function (...args) {
        const event = original(...args);
        log.push({ event });
        return event;
      };
      return { log, restore() { player.chooseToDiscard = original; } };
    };
    const snapshot = () => ({
      hp: Object.fromEntries(game.players.map(p => [p.playerid, p.hp])),
      hand: Object.fromEntries(game.players.map(p => [p.playerid, hand(p)])),
      skills: Object.fromEntries(game.players.slice(0, 4).map(p => [p.playerid, p.getSkills().filter(s => lib.skill[s] && !lib.skill[s].charlotte)])),
    });
    const recordChoice = result => ({
      bool: !!result.bool,
      skill: result.skill || null,
      cards: (result.cards || []).map(c => c.name),
      targets: (result.targets || []).map(p => p.playerid + ':' + (p.name1 || p.name || '?')),
    });
    const scenes = [];
    const wanted = Array.isArray(opts.scenes) && opts.scenes.length ? new Set(opts.scenes) : null;
    const scene = async (name, setup, action) => {
      if (wanted && !wanted.has(name)) return;
      const rec = { name };
      const startedAt = performance.now();
      await run('tenPackScene', actor, async () => {
        await reset();
        await setup(rec);
        rec.before = snapshot();
        await action(rec);
        rec.after = snapshot();
      });
      rec.durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      scenes.push(rec);
    };
    const describeSkill = id => {
      const s = lib.skill[id];
      if (!s) return { id, exists: false };
      const ai = s.ai || {};
      const fn = x => typeof x === 'function' ? x.toString().slice(0, 240) : (x === undefined ? null : x);
      return {
        id,
        exists: true,
        keys: Object.keys(s),
        check: typeof s.check,
        filter: typeof s.filter,
        aiKeys: Object.keys(ai),
        directHit_ai: ai.directHit_ai ?? null,
        skillTagFilter: typeof ai.skillTagFilter,
        aiResultKeys: Object.keys(ai.result || {}),
        aiEffectKeys: Object.keys(ai.effect || {}),
        aiOrder: fn(ai.order),
        aiResultPlayer: fn(ai.result?.player),
        aiResultTarget: fn(ai.result?.target),
        aiEffectTarget: fn(ai.effect?.target),
      };
    };
    const skillIds = [
      'tieji', 'yiji', 'retongji', 'xinfu_jijie', 'xinfu_jiyuan',
      'stdshushen', 'shenzhi', 'stdxiaoguo', 'dimeng', 'roulin', 'luanwu',
      'tuntian', 'zhiba', 'nzry_kuizhu', 'nzry_mingren', 'oljieming',
      'olhaoshi', 'oldimeng', 'rehuashen', 'olzhiba2'
    ];
    await scene('inspect-skills', async rec => {
      rec.hostVersion = lib.version;
      rec.mode = get.mode();
      rec.skills = Object.fromEntries(skillIds.map(id => [id, describeSkill(id)]));
    }, async rec => {});

    await scene('ui-identity', async rec => {
      rec.realUi = !!realHost.ui;
      rec.windowUiExists = typeof window.ui !== 'undefined';
      rec.windowUiSame = typeof window.ui !== 'undefined' ? window.ui === realHost.ui : null;
      rec.libUiSame = realHost.lib?.ui ? realHost.lib.ui === realHost.ui : null;
      rec.gameUiSame = realHost.game?.ui ? realHost.game.ui === realHost.ui : null;
      rec.selectedDesc = Object.getOwnPropertyDescriptor(realHost.ui, 'selected') || null;
      rec.targetsDesc = Object.getOwnPropertyDescriptor(realHost.ui.selected, 'targets') || null;
      rec.beforeLen = realHost.ui.selected.targets.length;
      realHost.ui.selected.targets = [ally];
      rec.afterLen = realHost.ui.selected.targets.length;
      rec.windowAfter = typeof window.ui !== 'undefined' ? window.ui.selected.targets.length : null;
      rec.windowSelectedSame = typeof window.ui !== 'undefined' ? window.ui.selected === realHost.ui.selected : null;
    }, async rec => {});

    await scene('dimeng-friendly', async rec => {
      actor.addSkill('dimeng');
      for (const p of [ally, enemy1, enemy2]) {
        p.identity = 'zhong';
        p.identityShown = true;
        try { p.setIdentity('zhong'); } catch (e) {}
        p.update();
      }
      actor.identity = 'zhu';
      actor.identityShown = true;
      try { actor.setIdentity('zhu'); } catch (e) {}
      game.zhu = actor;
      actor.update();
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
      await give(ally, [['sha', 'club', 3]]);
      realHost.ui.selected.targets.length = 0;
      realHost.ui.selected.targets.push(ally);
      realHost.ui.selected.cards.length = 0;
      rec.attitudes = game.players.slice(0, 4).map(p => [p.playerid, get.attitude(actor, p)]);
    }, async rec => {
      try {
        realHost.ui.selected = { ...realHost.ui.selected, targets: [ally] };
        realHost.ui.selected.targets = [ally];
      } catch (e) { rec.assignError = String(e); }
      rec.selectedLen = realHost.ui.selected.targets.length;
      rec.selectedIds = realHost.ui.selected.targets.map(p => p.playerid);
      rec.source = lib.skill.dimeng.ai.result.target.toString().slice(0, 600);
      rec.uiSame = lib.ui === realHost.ui;
      try { rec.result = lib.skill.dimeng.ai.result.target(actor, enemy1); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
    });

    await scene('luanwu-no-zhu', async rec => {
      lib.config.mode = 'identity';
      game.zhu = null;
      actor.identity = 'fan';
      try { actor.setIdentity('fan'); } catch (e) {}
      rec.mode = lib.config.mode;
      rec.zhu = game.zhu;
    }, async rec => {
      try { rec.result = lib.skill.luanwu.ai.result.player(actor); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
    });

    await scene('tieji-roulin-tags', async rec => {
      const t = lib.skill.tieji.ai || {};
      const r = lib.skill.roulin.ai || {};
      rec.tieji = { directHit_ai: t.directHit_ai ?? null, skillTagFilter: typeof t.skillTagFilter };
      rec.roulin = { directHit_ai: r.directHit_ai ?? null, skillTagFilter: typeof r.skillTagFilter, halfneg: r.halfneg ?? null };
    }, async rec => {});

    await scene('oljieming-maxhp', async rec => {
      actor.hp = 2; actor.maxHp = 4; await clearHand(actor);
      ally.hp = 1; ally.maxHp = 4; await clearHand(ally);
      for (const p of [enemy1, enemy2]) { p.hp = 4; p.maxHp = 4; await clearHand(p); }
      rec.attitude = get.attitude(actor, ally);
    }, async rec => {
      try { rec.result = lib.skill.oljieming.ai.effect.target(card('sha', 'spade', 1), ally, actor, 0); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
    });

    await scene('shenzhi-check', async rec => {
      actor.hp = 2; actor.maxHp = 2; await clearHand(actor);
      await give(actor, [['wuxie', 'spade', 2], ['wuxie', 'heart', 3]]);
      rec.full = lib.skill.shenzhi.check({}, actor);
      actor.hp = 2; actor.maxHp = 4;
      rec.damaged = lib.skill.shenzhi.check({}, actor);
    }, async rec => {});

    await scene('xinfu-jiyuan-check', async rec => {
      const nogain = Object.keys(lib.skill).find(id => lib.skill[id]?.ai?.nogain);
      if (nogain) ally.addSkill(nogain);
      lib.skill.__nogain_probe = { charlotte: true, ai: { nogain: true } };
      ally.addSkill('__nogain_probe');
      rec.nogainSkill = nogain || null;
      rec.tag = ally.hasSkillTag('nogain');
      rec.attitude = get.attitude(actor, ally);
      rec.dying = lib.skill.xinfu_jiyuan.check({ name: 'dying' }, actor, 'x', ally);
      rec.recover = lib.skill.xinfu_jiyuan.check({ name: 'recover' }, actor, 'x', ally);
    }, async rec => {});

    await scene('oldimeng-public', async rec => {
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2], ['wuxie', 'club', 3]]);
      await give(ally, [['sha', 'club', 4], ['sha', 'club', 5], ['shan', 'diamond', 6]]);
      await give(enemy1, [['tao', 'heart', 7]]);
      realHost.ui.selected.targets.length = 0;
      realHost.ui.selected.targets.push(ally);
      rec.firstHand = ally.countCards('h');
      rec.targetHand = enemy1.countCards('h');
    }, async rec => {
      try { rec.result = lib.skill.oldimeng.ai.result.target(actor, enemy1); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
    });

    await scene('zhiba-hidden', async rec => {
      await give(actor, [['sha', 'spade', 5], ['sha', 'club', 6], ['sha', 'spade', 7], ['sha', 'club', 8], ['sha', 'spade', 9]]);
      await give(enemy1, [['tao', 'heart', 13], ['tao', 'heart', 12]]);
      hideHand(enemy1);
      rec.known = actor.getKnownCards(enemy1).length;
      rec.targetHand = enemy1.countCards('h');
      try { rec.olzhiba2 = lib.skill.olzhiba2.ai.result.target(actor, enemy1); rec.olzhiba2Ok = true; }
      catch (e) { rec.olzhiba2Ok = false; rec.olzhiba2Error = e.name + ': ' + e.message; }
      try {
        const zg = lib.skill.zhiba_global;
        rec.zhibaGlobal = zg?.ai?.result?.target ? zg.ai.result.target(actor, enemy1) : null;
        rec.zhibaGlobalOk = !!zg?.ai?.result?.target;
      } catch (e) { rec.zhibaGlobalOk = false; rec.zhibaGlobalError = e.name + ': ' + e.message; }
    }, async rec => {});

    await scene('tuntian-viewer', async rec => {
      await give(enemy1, [['shan', 'diamond', 8]]);
      hideHand(enemy1);
      const sha = card('sha', 'spade', 1);
      const oldEventPlayer = _status.event.player;
      rec.mayActor = enemy1.mayHaveShan(actor, 'use');
      rec.mayAlly = enemy1.mayHaveShan(ally, 'use');
      _status.event.player = ally;
      rec.viewer = ally.playerid;
      try { rec.score = lib.skill.tuntian.ai.effect.target(sha, actor, enemy1, 0); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { _status.event.player = oldEventPlayer; }
    }, async rec => {});

    await scene('retongji-hidden', async rec => {
      actor.addSkill('retongji');
      actor.hp = 4; actor.maxHp = 4; await clearHand(actor);
      await give(actor, [['wuxie', 'diamond', 3]]);
      ally.hp = 1; ally.maxHp = 4; await clearHand(ally);
      await give(ally, [['wuxie', 'spade', 2]]);
      await give(enemy1, [['sha', 'spade', 4]]);
      ally.identity = 'zhu'; ally.identityShown = true;
      try { ally.setIdentity('zhu'); } catch (e) {}
      actor.identity = 'zhong'; actor.identityShown = true;
      try { actor.setIdentity('zhong'); } catch (e) {}
      game.zhu = ally;
      ally.update(); actor.update();
      hideHand(actor); hideHand(ally);
      const trigger = { name: 'useCardToTarget', card: card('sha', 'spade', 4), player: enemy1, target: ally, targets: [ally] };
      let chooseEvent = null;
      const original = ally.chooseToDiscard.bind(ally);
      ally.chooseToDiscard = function (...args) { chooseEvent = original(...args); return chooseEvent; };
      try {
        rec.attitude = get.attitude(ally, actor);
        const costResult = await lib.skill.retongji.cost({ result: null }, trigger, actor);
        rec.check = chooseEvent?.check ?? null;
        rec.bool = costResult?.result?.bool ?? null;
        rec.discarded = (costResult?.result?.cards || []).map(c => c.name);
        rec.ok = true;
      } catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { ally.chooseToDiscard = original; }
    }, async rec => {});

    await scene('yiji-nogain', async rec => {
      actor.addSkill('yiji');
      actor.hp = 4; actor.maxHp = 4;
      lib.skill.__nogain_probe = { charlotte: true, ai: { nogain: true } };
      actor.addSkill('__nogain_probe');
      ally.addSkill('__nogain_probe');
      await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      enemy2.identity = 'zhong'; enemy2.identityShown = true;
      try { enemy2.setIdentity('zhong'); } catch (e) {}
      enemy2.update();
      await give(enemy2, [['wuxie', 'club', 4]]);
      hideHand(actor); hideHand(ally); hideHand(enemy1); hideHand(enemy2);
      rec.tag = ally.hasSkillTag('nogain');
      rec.attitudes = { self: get.attitude(actor, actor), ally: get.attitude(actor, ally), enemy1: get.attitude(actor, enemy1), enemy2: get.attitude(actor, enemy2) };
      rec.attitudes = { ally: get.attitude(actor, ally), enemy1: get.attitude(actor, enemy1) };
      const cap = captureChooseTarget(actor);
      try { await actor.damage(1); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { cap.restore(); }
      rec.choices = cap.log;
    }, async rec => {});

    await scene('xinfu-jijie-nogain', async rec => {
      actor.addSkill('xinfu_jijie');
      lib.skill.__nogain_probe = { charlotte: true, ai: { nogain: true } };
      actor.addSkill('__nogain_probe');
      ally.addSkill('__nogain_probe');
      await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      enemy2.identity = 'zhong'; enemy2.identityShown = true;
      try { enemy2.setIdentity('zhong'); } catch (e) {}
      enemy2.update();
      await give(enemy2, [['wuxie', 'club', 4]]);
      hideHand(actor); hideHand(ally); hideHand(enemy1); hideHand(enemy2);
      rec.tag = ally.hasSkillTag('nogain');
      rec.attitudes = { self: get.attitude(actor, actor), ally: get.attitude(actor, ally), enemy1: get.attitude(actor, enemy1), enemy2: get.attitude(actor, enemy2) };
      const cap = captureChooseTarget(actor);
      try { await lib.skill.xinfu_jijie.content({ result: null }, null, actor); rec.ok = true; }
      catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { cap.restore(); }
      rec.choices = cap.log;
    }, async rec => {});

    await scene('stdshushen-nogain', async rec => {
      actor.addSkill('stdshushen');
      lib.skill.__nogain_probe = { charlotte: true, ai: { nogain: true } };
      ally.addSkill('__nogain_probe');
      await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      hideHand(actor); hideHand(ally); hideHand(enemy1); hideHand(enemy2);
      rec.tag = ally.hasSkillTag('nogain');
      rec.attitudes = { self: get.attitude(actor, actor), ally: get.attitude(actor, ally), enemy1: get.attitude(actor, enemy1), enemy2: get.attitude(actor, enemy2) };
      const cap = captureChooseTarget(actor);
      try {
        const event = { result: null, skill: 'stdshushen' };
        await lib.skill.stdshushen.cost(event, {}, actor);
        rec.ok = true; rec.result = event.result;
      } catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { cap.restore(); }
      rec.choices = cap.log;
    }, async rec => {});

    await scene('stdxiaoguo-eff', async rec => {
      actor.addSkill('stdxiaoguo');
      await give(actor, [['sha', 'spade', 1]]);
      lib.skill.__noe_probe = { charlotte: true, ai: { noe: true } };
      ally.addSkill('__noe_probe');
      await clearHand(ally);
      rec.tag = ally.hasSkillTag('noe');
      const cap = captureChooseToDiscard(actor);
      try {
        const event = { result: null, skill: 'stdxiaoguo' };
        await lib.skill.stdxiaoguo.cost(event, { player: ally }, actor);
        rec.eff = cap.log[0]?.event?.eff ?? null;
        rec.ok = true;
      } catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { cap.restore(); }
    }, async rec => {});

    await scene('kuizhu-target', async rec => {
      actor.addSkill('nzry_kuizhu');
      await clearHand(actor);
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
      const trigger = game.createEvent('phaseDiscard', false);
      trigger.player = actor;
      trigger.setContent(async () => {
        await actor.discard(actor.getCards('h').slice(0, 2));
      });
      await game.loop(trigger);
      enemy1.hp = 2; enemy1.maxHp = 4; enemy1.identity = 'fan';
      try { enemy1.setIdentity('fan'); } catch (e) {}
      enemy2.hp = 1; enemy2.maxHp = 4; enemy2.identity = 'fan';
      try { enemy2.setIdentity('fan'); } catch (e) {}
      enemy1.update(); enemy2.update();
      rec.historyLose = actor.getHistory('lose').length;
      let chooseEvent = null;
      const original = actor.chooseTarget.bind(actor);
      const originalControl = actor.chooseControl.bind(actor);
      actor.chooseTarget = function (...args) {
        const ev = original(...args);
        chooseEvent = ev;
        const originalForResult = ev.forResult.bind(ev);
        ev.forResult = async function (...a) {
          const oldEvent = _status.event;
          const inStack = Array.isArray(_status.eventStack) && _status.eventStack.includes(ev);
          rec.inStack = inStack;
          try {
            if (inStack) _status.event = ev;
            const fn = typeof ev.ai === 'function' ? ev.ai : ev.ai?.target;
            rec.chooseNum = _status.event?.num ?? ev.num ?? null;
            rec.insideEventSame = _status.event === ev;
            rec.aiEnemyHp2 = fn ? fn(enemy1) : null;
            rec.aiEnemyHp1 = fn ? fn(enemy2) : null;
          } catch (e) { rec.aiError = e.name + ': ' + e.message; }
          finally { if (inStack) _status.event = oldEvent; }
          return await originalForResult(...a);
        };
        return ev;
      };
      actor.chooseControl = () => ({ set() { return this; }, forResult: async () => ({ control: 'damage', index: 1, bool: true }) });
      try {
        const event = { result: null, skill: 'nzry_kuizhu' };
        await lib.skill.nzry_kuizhu.cost(event, trigger, actor);
        rec.ok = true;
      } catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { actor.chooseTarget = original; actor.chooseControl = originalControl; }
      rec.chosen = (chooseEvent?.result?.targets || []).map(p => p.playerid + ':hp' + p.hp);
    }, async rec => {});

    await scene('mingren-samecolor', async rec => {
      actor.addSkill('nzry_mingren_1');
      const ren = card('sha', 'heart', 5);
      const add = actor.addToExpansion(ren, actor, 'give');
      if (add.gaintag) add.gaintag.add('nzry_mingren');
      await add;
      await give(actor, [['wuxie', 'spade', 2], ['sha', 'heart', 3]]);
      hideHand(actor);
      const candidate = actor.getCards('h').find(c => c.name === 'wuxie');
      let chooseEvent = null;
      const original = actor.chooseCard.bind(actor);
      actor.chooseCard = function (...args) { chooseEvent = original(...args); return chooseEvent; };
      try {
        const event = { result: null, skill: 'nzry_mingren_1' };
        await lib.skill.nzry_mingren_1.cost(event, {}, actor);
        rec.ok = true;
      } catch (e) { rec.ok = false; rec.error = e.name + ': ' + e.message; }
      finally { actor.chooseCard = original; }
      const ai = chooseEvent?.ai;
      rec.hasAi = typeof ai === 'function';
      try { rec.aiCandidate = ai && candidate ? ai(candidate) : null; } catch (e) { rec.aiCandidate = 'ERR ' + e.message; }
      rec.chosen = (chooseEvent?.result?.cards || []).map(c => c.name);
    }, async rec => {});

    return { hostVersion: lib.version, mode: get.mode(), scenes, errors };
  }, options);
}
