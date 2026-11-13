// Independent v4 real-host scenes. Loads the unmodified host and the installed
// extension; never replaces Player, GameEvent, skill content or settlement.
export async function runEdgeScenes(page, options = {}) {
  return await page.evaluate(async opts => {
    const { game, lib, get, _status } = realHost;
    const roster = game.players.slice();
    const rosterGroups = roster.map(p => p.group);
    const [actor, ally, enemy1, enemy2] = roster;
    const errors = [];
    const run = async (name, player, content) => {
      const event = game.createEvent(name, false);
      event.player = player;
      event.setContent(content);
      await game.loop(event);
      return event;
    };
    const card = (name, suit = 'spade', number = 1) => game.createCard(name, suit, number);
    const hand = player => player.getCards('h').map(c => c.name);
    const equip = player => player.getCards('e').map(c => c.name);
    const identity = (player, id) => {
      player.identity = id;
      player.identityShown = true;
      try { player.setIdentity(id); } catch (_) {}
      player.update();
    };
    const clearHand = async player => {
      const cards = player.getCards('h');
      if (cards.length) await player.discard(cards);
    };
    const hideHand = player => {
      for (const c of player.getCards('h')) { try { c.clearKnowers(); } catch (_) {} }
    };
    const give = async (player, list) => {
      const cards = list.map(([name, suit, number]) => card(name, suit, number));
      if (cards.length) await player.gain(cards, 'gain2');
    };
    const give2 = async (player, list) => {
      const cards = list.map(([name, suit, number]) => game.createCard2(name, suit, number));
      if (cards.length) await player.gain(cards, 'gain2');
    };
    const reset = async () => {
      try { if (game.players.length !== roster.length || roster.some(p => !game.players.includes(p))) game.players.splice(0, game.players.length, ...roster); } catch (_) {}
      for (const p of roster) {
        try { const ex = p.getCards('x'); if (ex.length) await p.loseToDiscardpile(ex); } catch (_) {}
        try { for (const skill of Object.keys(p.tempSkills || {})) { try { p.removeSkill(skill); } catch (_) {} } } catch (_) {}
        p.clearSkills(true);
        try { p.dead = false; p.removed = false; p.classList.remove('dead'); p.classList.remove('out'); } catch (_) {}
        try {
          if (Array.isArray(game.dead)) {
            for (let i = game.dead.length - 1; i >= 0; i--) if (game.dead[i] === p || game.dead[i] === p.playerid) game.dead.splice(i, 1);
          }
        } catch (_) {}
        const cards = p.getCards('hej');
        if (cards.length) await p.discard(cards);
        p.hp = p.maxHp = 4;
        try { p.group = rosterGroups[roster.indexOf(p)] || p.group; } catch (_) {}
        try { p.classList.remove('turnedover'); } catch (_) {}
        try { if (p.isLinked && p.isLinked()) await p.link(false); } catch (_) {}
        for (const key of Object.keys(p.storage || {})) delete p.storage[key];
        try { p.stat = [{ card: {}, skill: {}, triggerSkill: {} }]; } catch (_) {}
        try { p.awakenedSkills = []; } catch (_) {}
        p.identity = p === actor ? 'zhu' : (p === ally ? 'zhong' : 'fan');
        p.identityShown = true;
        try { p.setIdentity(p.identity); } catch (_) {}
        p.update();
      }
      game.zhu = actor;
      actor.update();
      _status.currentPhase = actor;
      _status.auto = true;
      try { for (const key of ['cards', 'targets', 'buttons']) { const list = realHost.ui.selected[key]; if (Array.isArray(list)) list.length = 0; } } catch (_) {}
    };
    const snapshot = () => ({
      hp: Object.fromEntries(game.players.map(p => [p.playerid, p.hp])),
      hand: Object.fromEntries(game.players.map(p => [p.playerid, hand(p)])),
      equip: Object.fromEntries(game.players.map(p => [p.playerid, equip(p)])),
      skills: Object.fromEntries(game.players.slice(0, 5).map(p => [p.playerid, p.getSkills().filter(s => lib.skill[s] && !lib.skill[s].charlotte)])),
    });
    const scenes = [];
    const wanted = Array.isArray(opts.scenes) && opts.scenes.length ? new Set(opts.scenes) : null;
    const scene = async (name, setup, action) => {
      if (wanted && !wanted.has(name)) return;
      const rec = { name };
      console.log('[v4-probe] start ' + name);
      const startedAt = performance.now();
      try {
        await run('edgeScene', actor, async () => {
          await reset();
          await setup(rec);
          rec.before = snapshot();
          await action(rec);
          rec.after = snapshot();
        });
      } catch (e) {
        rec.sceneOk = false;
        rec.sceneError = e.name + ': ' + e.message;
        rec.sceneStack = String(e.stack || '').split('\n').slice(0, 8);
      }
      rec.durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
      console.log('[v4-probe] finish ' + name + ' ' + JSON.stringify({ error: rec.sceneError, choice: rec.choice, result: rec.result }));
      scenes.push(rec);
    };

    await scene('v4-preflight', async rec => {
      rec.hostVersion = lib.version;
      rec.mode = get.mode();
      rec.submode = _status.mode;
      rec.auto = _status.auto;
      rec.count = game.players.length;
      rec.skills = Object.fromEntries(['drlt_xiongluan', 'qiangxix', 'xinfu_zuilun', 'twjuxiang', 'twjuxiang_global', 'reqimou', 'qimou'].map(id => [id, !!lib.skill[id]]));
      rec.packSkills = ['refreshFeng', 'shenhuaHuo', 'shenhuaLei'].map(name => [name, !!lib.skill[name]]);
    }, async rec => {});

    const xiongluanAuto = async (name, armor, count, forceSkill = false) => {
      await scene(name, async rec => {
        actor.addSkill('drlt_xiongluan');
        identity(actor, 'zhu');
        identity(enemy1, 'fan');
        identity(ally, 'zhong');
        enemy1.hp = 1;
        enemy1.hujia = 0;
        enemy1.update();
        if (armor) await enemy1.equip(card(armor, 'spade', 2));
        for (let i = 0; i < count; i++) await give(actor, [['sha', 'heart', 5 + i]]);
        rec.enemy = enemy1.playerid;
        rec.armor = equip(enemy1);
        rec.one = actor.getCards('h').map(c => [get.name(c), get.effect(enemy1, c, actor, actor)]);
      }, async rec => {
        const info = lib.skill.drlt_xiongluan;
        rec.marker = !!info?.ai?.effect?.player;
        try { rec.effectHook = info?.ai?.effect?.player?.('drlt_xiongluan') || null; } catch (_) {}
        const original = info.ai.result.target;
        info.ai.result.target = function (player, target) {
          const value = original.apply(this, arguments);
          (rec.callbacks ||= []).push({ target: target.playerid, value });
          return value;
        };
        try {
          await run('phaseUse', actor, async () => {
            const choice = actor.chooseToUse({ type: 'phase' });
            const ai1 = choice.ai1;
            const ai2 = choice.ai2;
            choice.ai1 = function (candidate, ...rest) {
              const value = forceSkill && candidate === 'drlt_xiongluan' ? 1000 : ai1.call(this, candidate, ...rest);
              (rec.ai1 ||= []).push([candidate?.name || String(candidate), value]);
              return value;
            };
            choice.ai2 = function (candidate, ...rest) {
              const value = ai2.call(this, candidate, ...rest);
              (rec.ai2 ||= []).push([choice.skill || null, candidate?.playerid || null, value]);
              return value;
            };
            rec.context = { isMine: choice.isMine(), auto: _status.auto, enabled: lib.filter.filterEnable(choice, actor, 'drlt_xiongluan') };
            const result = await choice.forResult();
            rec.choice = { bool: !!result.bool, skill: result.skill || null, card: result.card?.name || null, targets: (result.targets || []).map(p => [p.playerid, p.identity]) };
            rec.awakened = actor.awakenedSkills.includes('drlt_xiongluan');
            rec.banned = roster.filter(p => p.hasSkill('drlt_xiongluan_ban')).map(p => p.playerid);
          });
        } finally {
          info.ai.result.target = original;
        }
      });
    };
    await xiongluanAuto('v4-xiongluan-one', 'bagua', 1);
    await xiongluanAuto('v4-xiongluan-two', 'bagua', 2);
    await xiongluanAuto('v4-xiongluan-bare', '', 1);
    await xiongluanAuto('v4-xiongluan-skill-one', 'bagua', 1, true);
    await xiongluanAuto('v4-xiongluan-skill-two', 'bagua', 2, true);

    await scene('v4-qiangxix', async rec => {
      actor.addSkill('qiangxix');
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      identity(ally, 'zhong');
      await actor.equip(card('zhuge', 'club', 3));
      await give2(actor, [['sha', 'spade', 5], ['sha', 'club', 6], ['sha', 'heart', 7]]);
      await clearHand(enemy1);
      enemy1.hp = 4;
      enemy1.update();
      rec.enemy = enemy1.playerid;
      rec.distance = get.distance(actor, enemy1);
      rec.actorHp = actor.hp;
    }, async rec => {
      const info = lib.skill.qiangxix;
      rec.checkInstalled = typeof info.check === 'function';
      const originalCheck = info.check;
      if (originalCheck) {
        info.check = function (weapon) {
          const score = originalCheck.apply(this, arguments);
          (rec.checks ||= []).push([get.name(weapon, false), score]);
          return score;
        };
      }
      try {
        await run('phaseUse', actor, async () => {
          const choice = actor.chooseToUse({ type: 'phase' });
          const ai1 = choice.ai1;
          choice.ai1 = function (candidate, ...rest) {
            if (candidate === 'qiangxix') return 1000;
            return ai1.call(this, candidate, ...rest);
          };
          rec.context = { isMine: choice.isMine(), auto: _status.auto, enabled: lib.filter.filterEnable(choice, actor, 'qiangxix') };
          const result = await choice.forResult();
          await new Promise(resolve => setTimeout(resolve, 100));
          rec.result = { bool: !!result.bool, skill: result.skill || null, cards: (result.cards || []).map(c => c.name), targets: (result.targets || []).map(p => p.playerid) };
          await new Promise(resolve => setTimeout(resolve, 100));
          const followTarget = result.targets?.[0] || enemy1;
          rec.followTarget = followTarget.playerid;
          rec.followDistance = get.distance(actor, followTarget);
          rec.afterSkill = { actorHp: actor.hp, actorEquip: equip(actor), actorHand: hand(actor), targetHp: followTarget.hp, usable: actor.getCardUsable('sha') };
          const shas = actor.getCards('h', c => get.name(c, actor) === 'sha');
          let used = 0;
          for (const sha of shas.slice(0, 2)) {
            if (!actor.canUse(sha, followTarget)) continue;
            try { await actor.useCard(sha, followTarget); await new Promise(resolve => setTimeout(resolve, 20)); used++; } catch (e) { rec.followupError = e.name + ': ' + e.message; break; }
          }
          rec.followup = { used, actorHp: actor.hp, actorEquip: equip(actor), actorHand: hand(actor), targetHp: followTarget.hp };
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        let extra = 0;
        _status.currentPhase = actor;
        _status.auto = true;
        const followTarget = rec.followTarget ? game.players.find(p => p.playerid === rec.followTarget) : enemy1;
        await run('phaseUse', actor, async () => {
          rec.followupUsable = actor.getCardUsable('sha');
          const shas = actor.getCards('h', c => get.name(c, actor) === 'sha');
          rec.followupCanUse = shas.slice(0, 2).map(c => !!actor.canUse(c, followTarget));
          for (const sha of shas.slice(0, 2)) {
            if (!actor.canUse(sha, followTarget)) continue;
            try { await actor.useCard(sha, followTarget); extra++; } catch (e) { rec.followupError = e.name + ': ' + e.message; break; }
          }
        });
        rec.followupPhase = { used: extra, actorHp: actor.hp, actorEquip: equip(actor), actorHand: hand(actor), targetHp: followTarget.hp, usable: rec.followupUsable };
      } finally {
        if (originalCheck) info.check = originalCheck;
      }
    });

    await scene('v4-qiangxix-poststate', async rec => {
      actor.addSkill('qiangxix');
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      identity(ally, 'zhong');
      await actor.equip(card('zhuge', 'club', 4));
      await give2(actor, [['sha', 'spade', 8], ['sha', 'club', 9], ['sha', 'heart', 10]]);
      actor.hp = 3;
      actor.update();
      const postTarget = actor.next;
      await clearHand(postTarget);
      postTarget.hp = 3;
      postTarget.update();
      identity(postTarget, 'fan');
      rec.targetId = postTarget.playerid;
      rec.targetDistance = get.distance(actor, postTarget);
      _status.currentPhase = actor;
      _status.auto = true;
    }, async rec => {
      const target = game.players.find(p => p.playerid === rec.targetId) || actor.next;
      await run('phaseUse', actor, async () => {
        const shas = actor.getCards('h', c => get.name(c, actor) === 'sha');
        const probe = shas[0];
        rec.debug = {
          distance: get.distance(actor, target),
          cardEnabled: lib.filter.cardEnabled(probe, actor),
          inRange: lib.filter.targetInRange(probe, actor, target),
          targetEnabled: lib.filter.targetEnabled(probe, actor, target),
          position: get.position(probe),
          phase: actor.isPhaseUsing(),
          event: _status.event?.name || null,
        };
        rec.usable = actor.getCardUsable('sha');
        rec.canUse = shas.slice(0, 2).map(c => !!actor.canUse(c, target));
        let used = 0;
        for (const sha of shas.slice(0, 2)) {
          if (!actor.canUse(sha, target)) continue;
          try { await actor.useCard(sha, target); used++; } catch (e) { rec.useError = e.name + ': ' + e.message; break; }
        }
        rec.used = used;
        rec.targetHp = target?.hp ?? null;
      });
      rec.afterPost = { actorHp: actor.hp, actorEquip: equip(actor), actorHand: hand(actor), targetHp: target.hp };
    });

    const zuilunScene = async (name, hidden, withJudge = true) => {
      await scene(name, async rec => {
        actor.addSkill('xinfu_zuilun');
        identity(actor, 'zhu');
        identity(enemy1, 'fan');
        identity(ally, 'zhong');
        if (withJudge) enemy1.addJudge(card('lebu', 'spade', 1));
        await give(actor, [['shan', 'club', 10], ['shan', 'diamond', 11], ['shan', 'heart', 12]]);
        for (const p of [ally, enemy2, ...game.players.slice(4)]) await clearHand(p);
        actor.stat[0].damage = 1;
        const deck = [game.createCard2('tao', 'heart', 4), game.createCard2('sha', 'spade', 7), game.createCard2('shan', 'club', 2)];
        for (const c of deck.slice().reverse()) realHost.ui.cardPile.insertBefore(c, realHost.ui.cardPile.firstChild);
        rec.pileTop = Array.from(realHost.ui.cardPile.childNodes).slice(0, 5).map(c => c.name);
        await give(enemy1, hidden);
        hideHand(enemy1);
        rec.enemy = enemy1.playerid;
        rec.judge = enemy1.getCards('j').map(c => c.name);
        rec.hidden = hand(enemy1);
        rec.actorHand = hand(actor);
      }, async rec => {
        const originalChoose = actor.chooseToMove;
        actor.chooseToMove = function (...args) {
          const event = originalChoose.apply(this, args);
          rec.chooseEvent = event;
          return event;
        };
        try {
          await run('phaseJieshu', actor, async event => { await event.trigger('phaseJieshuBegin'); });
        } finally {
          actor.chooseToMove = originalChoose;
        }
        const chooseEvent = rec.chooseEvent;
        delete rec.chooseEvent;
        rec.num = chooseEvent?.num ?? null;
        rec.list = (chooseEvent?.list || []).map(row => [row[0], (row[1] || []).map(c => c.name)]);
        rec.result = chooseEvent?.result ? { bool: chooseEvent.result.bool, moved: (chooseEvent.result.moved || []).map(row => (row || []).map(c => c.name)) } : null;
        rec.afterHand = hand(actor);
        rec.afterJudge = enemy1.getCards('j').map(c => c.name);
        rec.deckTop = Array.from(realHost.ui.cardPile.childNodes).slice(0, 5).map(c => c.name);
      });
    };
    await zuilunScene('v4-zuilun-public-a', [['tao', 'club', 21], ['sha', 'diamond', 22]]);
    await zuilunScene('v4-zuilun-public-b', [['wuxie', 'spade', 23], ['jiu', 'club', 24]]);
    await zuilunScene('v4-zuilun-nojudge-a', [['tao', 'club', 25], ['sha', 'diamond', 26]], false);
    await zuilunScene('v4-zuilun-nojudge-b', [['wuxie', 'spade', 27], ['jiu', 'club', 28]], false);

    const juxiangScene = async (name, options = {}) => {
      await scene(name, async rec => {
        actor.addSkill('twjuxiang_global');
        ally.addSkill('twjuxiang');
        actor.group = 'qun';
        actor.hp = 1;
        actor.hujia = 0;
        await clearHand(actor);
        await actor.equip(card(options.weapon ? 'zhangba' : 'bagua', 'spade', 31));
        identity(actor, 'zhong');
        identity(ally, 'zhu');
        identity(enemy1, 'fan');
        identity(enemy2, 'fan');
        game.zhu = ally;
        ally.hp = options.lordHp || 3;
        ally.update();
        await clearHand(ally);
        for (const c of ally.getCards('e')) await ally.discard(c);
        if (options.disabled) { try { ally.disableEquip('equip2'); } catch (_) {} }
        enemy2.hp = 1;
        enemy2.update();
        _status.currentPhase = actor;
        _status.auto = true;
        rec.actor = actor.playerid;
        rec.lord = ally.playerid;
        rec.distance = get.distance(actor, enemy1);
        rec.enemyInRange = enemy1.inRange(actor);
        rec.actorEquip = equip(actor);
        rec.lordEquip = equip(ally);
        rec.hasGlobal = actor.hasSkill('twjuxiang_global');
        rec.lordHasZhu = ally.hasZhuSkill('twjuxiang', actor);
      }, async rec => {
        await run('phaseUse', actor, async () => {
          const choice = actor.chooseToUse({ type: 'phase' });
          rec.context = { isMine: choice.isMine(), auto: _status.auto, enabled: lib.filter.filterEnable(choice, actor, 'twjuxiang_global') };
          const ai1 = choice.ai1;
          choice.ai1 = function (candidate, ...rest) {
            if (candidate === 'twjuxiang_global') return 1000;
            return ai1.call(this, candidate, ...rest);
          };
          const result = await choice.forResult();
          rec.result = { bool: !!result.bool, skill: result.skill || null, cards: (result.cards || []).map(c => c.name), targets: (result.targets || []).map(p => p.playerid) };
        });
        rec.after = { actorHp: actor.hp, actorEquip: equip(actor), lordHp: ally.hp, lordEquip: equip(ally) };
      });
    };
    await juxiangScene('v4-juxiang-keep', {});
    await juxiangScene('v4-juxiang-weapon', { weapon: true });
    await juxiangScene('v4-juxiang-low-lord', { lordHp: 1 });
    await juxiangScene('v4-juxiang-disabled', { disabled: true });

    return { hostVersion: lib.version, mode: get.mode(), scenes, errors };
  }, options);
}
