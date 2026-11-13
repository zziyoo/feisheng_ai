// Phase 2b real-host edge probes for the remaining ten packs.
// Loads the unmodified 1.11.7 host; never replaces Player/GameEvent/skill content.
// Every scene records what the host actually did, including expected clean-host failures.
export async function runEdgeScenes(page, options = {}) {
  return await page.evaluate(async opts => {
    const {game, lib, get, _status} = realHost;
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
    const equip = player => player.getCards('e').map(c => c.name);
    const identity = (player, id) => {
      player.identity = id;
      player.identityShown = true;
      try { player.setIdentity(id); } catch (e) {}
      player.update();
    };
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
        try { p.stat = [{card: {}, skill: {}, triggerSkill: {}}]; } catch (e) {}
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
    const snapshot = () => ({
      hp: Object.fromEntries(game.players.map(p => [p.playerid, p.hp])),
      hand: Object.fromEntries(game.players.map(p => [p.playerid, hand(p)])),
      equip: Object.fromEntries(game.players.map(p => [p.playerid, equip(p)])),
      skills: Object.fromEntries(game.players.slice(0, 4).map(p => [p.playerid, p.getSkills().filter(s => lib.skill[s] && !lib.skill[s].charlotte)])),
    });
    const scenes = [];
    const wanted = Array.isArray(opts.scenes) && opts.scenes.length ? new Set(opts.scenes) : null;
    const scene = async (name, setup, action) => {
      if (wanted && !wanted.has(name)) return;
      const rec = {name};
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
      scenes.push(rec);
    };
    const runContent = async (name, player, content, props = {}) => {
      const ev = game.createEvent(name, false);
      ev.player = player;
      Object.assign(ev, props);
      ev.setContent(content);
      await game.loop(ev);
      return ev;
    };
    // Plain trigger-shaped object: never start it as a child event of the probe,
    // otherwise the scene loop would try to execute a content-less event.
    const withEvent = (event, fn) => {
      const manager = _status.eventManager;
      const stack = manager.eventStack;
      const old = _status.event;
      const added = !stack.includes(event);
      if (added) stack.push(event);
      try {
        _status.event = event;
        return fn();
      } finally {
        try { _status.event = old; } catch (e) {}
        if (added) {
          const index = stack.indexOf(event);
          if (index >= 0) stack.splice(index, 1);
        }
      }
    };
    const baseEvent = (name, player, props = {}) => ({
      name,
      player,
      cancelled: false,
      cancel() {
        this.cancelled = true;
      },
      ...props,
    });

    await scene('edge-preflight', async rec => {
      rec.hostVersion = lib.version;
      rec.mode = get.mode();
      rec.submode = _status.mode;
      rec.auto = _status.auto;
      rec.gameMe = game.me?.playerid || null;
      rec.players = game.players.map(p => p.playerid);
      rec.count = game.players.length;
      rec.skills = Object.fromEntries([
        'dimeng', 'olhaoshi', 'olhaoshi_give', 'olhaoshi_help', 'rehuashen', 'qizhi',
        'reqiaobian', 'reqiaobian_draw', 'nzry_feijun', 'nzry_binglve', 'tuntian'
      ].map(id => [id, !!lib.skill[id]]));
      rec.uiSame = lib.ui === realHost.ui;
      rec.selectedSame = lib.ui.selected === realHost.ui.selected;
      rec.cardTags = {
        juedouRespondSha: get.tag(card('juedou'), 'respondSha'),
        juedouRespondShan: get.tag(card('juedou'), 'respondShan'),
        juedouLoseCard: get.tag(card('juedou'), 'loseCard'),
        shaRespondShan: get.tag(card('sha'), 'respondShan'),
      };
      rec.dimengHasGuard = lib.skill.dimeng.ai.result.target.toString().includes('!list.length');
      rec.phaseNumber = game.phaseNumber;
      rec.olhaoshiGive = {
        exists: !!lib.skill.olhaoshi_give,
        keys: Object.keys(lib.skill.olhaoshi_give || {}),
        contentType: typeof lib.skill.olhaoshi_give?.content,
        trigger: lib.skill.olhaoshi_give?.trigger || null,
        subContentType: typeof lib.skill.olhaoshi?.subSkill?.give?.content,
      };
      rec.playerAi = game.players.map(p => ({id: p.playerid, ai: !!p.ai, shown: p.ai?.shown, identity: p.identity, identityShown: p.identityShown, out: p.isOut(), removed: !!p.removed}));
      rec.dead = game.dead.map(p => typeof p === 'string' ? p : (p?.playerid || String(p)));
    }, async rec => {});

    await scene('edge-dimeng-legal-event', async rec => {
      actor.addSkill('dimeng');
      identity(actor, 'zhu');
      identity(ally, 'zhong');
      identity(enemy1, 'fan');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
      await give(ally, [['sha', 'club', 3]]);
      await give(enemy1, [['tao', 'heart', 4], ['shan', 'diamond', 5], ['sha', 'spade', 6]]);
      const cards = actor.getCards('h').slice();
      realHost.ui.selected.cards.length = 0;
      for (const c of cards) realHost.ui.selected.cards.push(c);
      realHost.ui.selected.targets.length = 0;
      rec.attitudes = [ally, enemy1].map(p => [p.playerid, get.attitude(actor, p)]);
      rec.selectedCards = cards.length;
      rec.uiSame = lib.ui.selected === realHost.ui.selected;
      rec.playerAiAtSetup = game.players.map(p => ({id: p.playerid, ai: !!p.ai, shown: p.ai?.shown, identity: p.identity, identityShown: p.identityShown, out: p.isOut()}));
    }, async rec => {
      const filterLog = [];
      const originalFilter = lib.skill.dimeng.filterTarget;
      lib.skill.dimeng.filterTarget = function (card2, player2, target2) {
        filterLog.push({cards: realHost.ui.selected.cards.length, targets: realHost.ui.selected.targets.length, hand: target2.countCards('h')});
        return originalFilter.call(this, card2, player2, target2);
      };
      const ev = actor.chooseTarget(2, lib.skill.dimeng.filterTarget).set('ai', target => get.effect_use(target, 'dimeng', actor, actor));
      ev.forced = false;
      ev.complexCard = true;
      ev.filterCard = lib.skill.dimeng.filterCard;
      ev.selectCard = [0, Infinity];
      const attitudeLog = [];
      const originalAttitude = get.attitude;
      get.attitude = function (from, to, ...rest) {
        if (!to?.ai) {
          attitudeLog.push({
            from: from?.playerid || String(from),
            to: to?.playerid || String(to),
            toType: typeof to,
            keys: to ? Object.keys(to).slice(0, 10) : null,
            dead: game.dead.map(p => typeof p === 'string' ? p : p?.playerid),
          });
        }
        return originalAttitude.call(this, from, to, ...rest);
      };
      try {
        await game.loop(ev);
        rec.result = {
          bool: !!ev.result?.bool,
          targets: (ev.result?.targets || []).map(p => p.playerid + ':' + p.name),
          targetHands: (ev.result?.targets || []).map(p => p.countCards('h')),
        };
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      } finally {
        get.attitude = originalAttitude;
        lib.skill.dimeng.filterTarget = originalFilter;
      }
      if (attitudeLog.length) rec.attitudeLog = attitudeLog.slice(0, 8);
      rec.filterLog = filterLog.slice(0, 30);
      const cards = actor.getCards('h').slice();
      const targets = ev.result?.targets || [];
      if (rec.ok && ev.result?.bool && targets.length === 2) {
        const before = targets.map(p => hand(p));
        try {
          const use = actor.useSkill('dimeng', cards, targets);
          await game.loop(use);
          rec.settlement = {before, after: targets.map(p => hand(p)), actorHand: hand(actor)};
          rec.settlementOk = true;
        } catch (e) {
          rec.settlementOk = false;
          rec.settlementError = e.name + ': ' + e.message;
        }
      }
    });

    await scene('edge-dimeng-direct-empty', async rec => {
      actor.addSkill('dimeng');
      identity(actor, 'zhu');
      identity(ally, 'zhong');
      for (const p of game.players) if (p !== actor) identity(p, 'zhong');
      await clearHand(actor); await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
      await give(ally, [['sha', 'club', 3]]);
      for (const p of [enemy1, enemy2, game.players[4], game.players[5], game.players[6], game.players[7]]) {
        await give(p, [['tao', 'heart', 4], ['shan', 'diamond', 5], ['sha', 'spade', 6]]);
      }
      realHost.ui.selected.cards.length = 0;
      for (const c of actor.getCards('h').slice(0, 2)) realHost.ui.selected.cards.push(c);
      realHost.ui.selected.targets.length = 0;
      realHost.ui.selected.targets.push(ally);
      rec.attitudes = game.players.map(p => [p.playerid, get.attitude(actor, p)]);
      rec.selectedLen = realHost.ui.selected.targets.length;
      rec.selectedIds = realHost.ui.selected.targets.map(p => p.playerid);
      rec.uiSame = lib.ui.selected === realHost.ui.selected;
      rec.skillSource = lib.skill.dimeng.ai.result.target.toString().slice(0, 700);
    }, async rec => {
      try {
        rec.result = lib.skill.dimeng.ai.result.target(actor, enemy1);
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
        rec.stack = String(e.stack || '').split('\n').slice(0, 5);
      }
      rec.selectedAfter = realHost.ui.selected.targets.length;
      realHost.ui.selected.targets.length = 0;
      try {
        rec.emptyBranchResult = lib.skill.dimeng.ai.result.target(actor, enemy1);
        rec.emptyBranchOk = true;
      } catch (e) {
        rec.emptyBranchOk = false;
        rec.emptyBranchError = e.name + ': ' + e.message;
      }
    });

    let makeTuntianCase = null;
    await scene('edge-tuntian-hidden', async rec => {
      await clearHand(actor); await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) await clearHand(game.players[i]);
      identity(actor, 'fan');
      identity(ally, 'fan');
      identity(enemy1, 'zhong');
      identity(game.players[4], 'zhong');
      identity(game.players[5], 'zhong');
      identity(game.players[6], 'fan');
      identity(game.players[7], 'fan');
      game.zhu = game.players[4];
      game.players[4].update();
      _status.currentPhase = actor;
      enemy1.addSkill('tuntian');
      rec.attitudeActorTarget = get.attitude(actor, enemy1);
      rec.attitudeViewerTarget = get.attitude(ally, enemy1);
      rec.attitudeFriendTarget = get.attitude(game.players[4], enemy1);
      rec.hasFriend = enemy1.hasFriend();
      rec.isControlledByActor = enemy1.isUnderControl(true, actor);
      rec.isControlledByViewer = enemy1.isUnderControl(true, ally);
      makeTuntianCase = async (label, list) => {
        const old = enemy1.getCards('h');
        if (old.length) {
          _status.currentPhase = enemy1;
          await enemy1.loseToDiscardpile(old);
          _status.currentPhase = actor;
        }
        await give(enemy1, list);
        hideHand(enemy1);
        const juedou = card('juedou', 'spade', 1);
        const sha = card('sha', 'spade', 1);
        const out = {
          hand: hand(enemy1),
          knownByActor: enemy1.getKnownCards(actor).length,
          knownByViewer: enemy1.getKnownCards(ally).length,
        };
        await run('tuntianProbe', ally, async () => {
          out.viewer = get.player()?.playerid || null;
          try {
            out.juedou = lib.skill.tuntian.ai.effect.target(juedou, actor, enemy1, 0);
            out.juedouOk = true;
          } catch (e) {
            out.juedouOk = false;
            out.juedouError = e.name + ': ' + e.message;
          }
          try {
            out.sha = lib.skill.tuntian.ai.effect.target(sha, actor, enemy1, 0);
            out.shaOk = true;
          } catch (e) {
            out.shaOk = false;
            out.shaError = e.name + ': ' + e.message;
          }
          try {
            out.effectJuedou = get.effect(enemy1, juedou, actor, ally);
            out.effectOk = true;
          } catch (e) {
            out.effectOk = false;
            out.effectError = e.name + ': ' + e.message;
          }
        });
        rec[label] = out;
      };
    }, async rec => {
      await makeTuntianCase('caseShaTao', [['sha', 'spade', 5], ['tao', 'heart', 6]]);
      await makeTuntianCase('caseShaSha', [['sha', 'spade', 5], ['sha', 'club', 7]]);
      await makeTuntianCase('caseShanTao', [['shan', 'diamond', 8], ['tao', 'heart', 6]]);
    });

    await scene('edge-olhaoshi-give', async rec => {
      actor.addSkill('olhaoshi');
      identity(actor, 'zhu');
      identity(ally, 'fan');
      identity(enemy1, 'zhong');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) { identity(game.players[i], 'fan'); await clearHand(game.players[i]); }
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2], ['sha', 'club', 3], ['shan', 'diamond', 4], ['tao', 'heart', 5], ['wuzhong', 'spade', 6]]);
      rec.attitudes = [ally, enemy1].map(p => [p.playerid, get.attitude(actor, p)]);
      rec.handCount = actor.countCards('h');
      rec.libSkill = !!lib.skill.olhaoshi_give;
      rec.subSkill = !!lib.skill.olhaoshi.subSkill?.give;
    }, async rec => {
      let chooseEvent = null;
      const original = actor.chooseCardTarget.bind(actor);
      actor.chooseCardTarget = function (...args) {
        chooseEvent = original(...args);
        return chooseEvent;
      };
      const base = baseEvent('phaseDraw', actor, {name: 'phase'});
      const GE = lib.element.GameEvent;
      const originalLoop = GE.prototype.loop;
      const loopErrors = [];
      GE.prototype.loop = async function (...args) {
        try {
          return await originalLoop.apply(this, args);
        } catch (e) {
          loopErrors.push({name: this.name, content: typeof this.content, contentType: this.content?.type, trigger: this._trigger?.name || null, error: e.name + ': ' + e.message});
          throw e;
        }
      };
      try {
        await runContent('olhaoshi_give', actor, lib.skill.olhaoshi_give.content, {_trigger: base, triggername: 'phaseDrawEnd', skill: 'olhaoshi_give'});
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
        rec.stack = String(e.stack || '').split('\n').slice(0, 8);
      } finally {
        GE.prototype.loop = originalLoop;
        actor.chooseCardTarget = original;
      }
      rec.loopErrors = loopErrors.slice(0, 8);
      rec.targets = (chooseEvent?.targets || []).map(p => p.playerid + ':att' + get.attitude(actor, p));
      rec.targetHands = (chooseEvent?.targets || []).map(p => p.countCards('h'));
      rec.ai2 = chooseEvent?.targets ? (chooseEvent.targets.map(p => [p.playerid, chooseEvent.ai2?.(p)])) : null;
      const testCard = actor.getCards('h')[0];
      try {
        realHost.ui.selected.cards.length = 0;
        rec.ai1 = testCard && chooseEvent?.ai1 && chooseEvent ? withEvent(chooseEvent, () => chooseEvent.ai1(testCard)) : null;
        rec.ai1Card = testCard?.name || null;
        rec.ai1Err = null;
      } catch (e) {
        rec.ai1 = null;
        rec.ai1Err = e.name + ': ' + e.message;
      }
      rec.chosenTarget = (chooseEvent?.result?.targets || []).map(p => p.playerid);
      rec.chosenCards = (chooseEvent?.result?.cards || []).map(c => c.name);
    });

    await scene('edge-olhaoshi-help', async rec => {
      actor.addSkill('olhaoshi_help');
      actor.storage.olhaoshi_help = [ally];
      identity(actor, 'zhu');
      identity(ally, 'zhong');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(ally); await clearHand(enemy2);
      await give(actor, [['tao', 'heart', 1]]);
      await give(ally, [['shan', 'diamond', 2], ['tao', 'heart', 3]]);
      await give(enemy2, [['shan', 'club', 4], ['shan', 'spade', 5]]);
      rec.attackerShan = enemy2.countCards('h', 'shan');
      rec.helperShan = ally.countCards('h', 'shan');
      rec.ownerShan = actor.countCards('h', 'shan');
      rec.goon = get.attitude(ally, actor) > 0;
      rec.beforeActorHand = hand(actor);
    }, async rec => {
      const base = baseEvent('useCardToTargeted', enemy2, {
        target: actor,
        targets: [actor],
        card: card('sha', 'spade', 1),
      });
      let chooseEvent = null;
      const shanCard = ally.getCards('h').find(c => c.name === 'shan') || null;
      const taoCard = ally.getCards('h').find(c => c.name === 'tao') || null;
      const original = ally.chooseCard.bind(ally);
      ally.chooseCard = function (...args) {
        chooseEvent = original(...args);
        const originalForResult = chooseEvent.forResult.bind(chooseEvent);
        chooseEvent.forResult = async function (...rest) {
          try {
            if (typeof chooseEvent.ai === 'function') {
              rec.aiShanLive = withEvent(chooseEvent, () => chooseEvent.ai(shanCard));
              rec.aiTaoLive = withEvent(chooseEvent, () => chooseEvent.ai(taoCard));
            }
          } catch (e) {
            rec.aiLiveErr = e.name + ': ' + e.message;
          }
          return await originalForResult(...rest);
        };
        return chooseEvent;
      };
      try {
        await runContent('olhaoshi_help', actor, lib.skill.olhaoshi_help.content, {_trigger: base, triggername: 'useCardToTargeted', skill: 'olhaoshi_help'});
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      } finally {
        ally.chooseCard = original;
      }
      rec.chooseExists = !!chooseEvent;
      rec.getTriggerPlayer = chooseEvent?.getTrigger?.()?.player?.playerid || null;
      rec.getTriggerTarget = chooseEvent?.getTrigger?.()?.target?.playerid || null;
      const shan = shanCard || card('shan', 'diamond', 9);
      const tao = taoCard || card('tao', 'heart', 9);
      try {
        rec.aiShan = rec.aiShanLive ?? (typeof chooseEvent?.ai === 'function' && chooseEvent ? withEvent(chooseEvent, () => chooseEvent.ai(shan)) : null);
        rec.aiTao = rec.aiTaoLive ?? (typeof chooseEvent?.ai === 'function' && chooseEvent ? withEvent(chooseEvent, () => chooseEvent.ai(tao)) : null);
        rec.aiErr = null;
      } catch (e) {
        rec.aiShan = rec.aiShanLive ?? null;
        rec.aiTao = rec.aiTaoLive ?? null;
        rec.aiErr = e.name + ': ' + e.message;
      }
      rec.result = {
        bool: !!chooseEvent?.result?.bool,
        cards: (chooseEvent?.result?.cards || []).map(c => c.name),
      };
      rec.afterActorHand = hand(actor);
    });

    await scene('edge-rehuashen-legal', async rec => {
      actor.addSkill('rehuashen');
      lib.skill.rehuashen.init(actor, 'rehuashen');
      lib.skill.rehuashen.addHuashens(actor, 3);
      rec.character = actor.storage.rehuashen.character.slice();
      rec.map = Object.fromEntries(Object.entries(actor.storage.rehuashen.map).map(([k, v]) => [k, v.slice()]));
      rec.characterCount = rec.character.length;
      rec.filter = lib.skill.rehuashen.filter({name: 'phase'}, actor, 'phaseBegin');
      rec.ranks = {};
      rec.rawVsMap = {};
      for (const name of rec.character) {
        const skills = actor.storage.rehuashen.map[name] || [];
        rec.ranks[name] = skills.map(skill => [skill, get.skillRank(skill, 'in'), get.skillRank(skill, 'out')]);
        const raw = get.character(name)?.skills || [];
        rec.rawVsMap[name] = {raw, mapped: skills, excluded: raw.filter(skill => !skills.includes(skill))};
      }
    }, async rec => {
      const controlEvents = [];
      const originalControl = actor.chooseControl.bind(actor);
      actor.chooseControl = function (...args) {
        const ev = originalControl(...args);
        controlEvents.push(ev);
        return ev;
      };
      const snap = () => ({
        character: actor.storage.rehuashen?.character?.slice() || [],
        current: actor.storage.rehuashen?.current || null,
        current2: actor.storage.rehuashen?.current2 || null,
        choosed: Array.from(actor.storage.rehuashen?.choosed || []),
        currentLegal: !actor.storage.rehuashen?.current || !actor.storage.rehuashen?.current2
          ? null
          : (actor.storage.rehuashen.map[actor.storage.rehuashen.current] || []).includes(actor.storage.rehuashen.current2),
      });
      const cycles = [];
      try {
        for (const triggername of ['phaseBegin', 'phaseEnd']) {
          const start = controlEvents.length;
          const costEvent = {result: null, skill: 'rehuashen', triggername};
          await lib.skill.rehuashen.cost(costEvent, {name: 'phase', player: actor}, actor);
          if (costEvent.result?.bool) {
            const base = baseEvent('phase', actor, {name: 'phase'});
            await runContent('rehuashen', actor, lib.skill.rehuashen.content, {
              _trigger: base,
              triggername,
              skill: 'rehuashen',
              cost_data: costEvent.result.cost_data,
            });
          }
          cycles.push({
            triggername,
            costResult: costEvent.result,
            controls: controlEvents.slice(start).map(ev => ({cond: ev.cond ?? null, controls: ev.controls || null})),
            storage: snap(),
          });
        }
        rec.costResult = cycles[0]?.costResult;
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      } finally {
        actor.chooseControl = originalControl;
      }
      rec.cycles = cycles;
      rec.controls = controlEvents.map(ev => ({cond: ev.cond ?? null, controls: ev.controls || null}));
      rec.afterStorage = snap();
      rec.additional = actor.additionalSkills?.rehuashen || null;
      rec.currentLegal = !rec.afterStorage.current || !rec.afterStorage.current2
        ? null
        : (actor.storage.rehuashen.map[rec.afterStorage.current] || []).includes(rec.afterStorage.current2);
    });

    await scene('edge-rehuashen-empty', async rec => {
      actor.addSkill('rehuashen');
      lib.skill.rehuashen.init(actor, 'rehuashen');
      lib.skill.rehuashen.addHuashens(actor, 3);
      rec.legalCharacterCount = actor.storage.rehuashen.character.length;
      rec.legalFilter = lib.skill.rehuashen.filter({name: 'phase'}, actor, 'phaseBegin');
      rec.artificial = 'cleared storage after real init to test defensive empty state';
      actor.storage.rehuashen.character = [];
      actor.storage.rehuashen.map = {};
      actor.storage.rehuashen.current = null;
      actor.storage.rehuashen.current2 = null;
      rec.emptyFilter = lib.skill.rehuashen.filter({name: 'phase'}, actor, 'phaseBegin');
    }, async rec => {
      const event = {result: null, skill: 'rehuashen', triggername: 'phaseBegin'};
      try {
        await lib.skill.rehuashen.cost(event, {name: 'phase', player: actor}, actor);
        rec.result = event.result;
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      }
    });

    await scene('edge-qizhi-mixed', async rec => {
      actor.addSkill('qizhi');
      lib.skill.__discard_probe = {
        charlotte: true,
        mod: {canBeDiscarded(card2, player2, target2) { return !card2.hasGaintag('__protected'); }},
      };
      enemy2.addSkill('__discard_probe');
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) await clearHand(game.players[i]);
      const eq = card('bagua', 'spade', 2);
      await enemy2.equip(eq);
      eq.addGaintag('__protected');
      await give(enemy2, [['tao', 'heart', 3]]);
      _status.currentPhase = actor;
      rec.beforeTarget = {hand: hand(enemy2), equip: equip(enemy2), protected: eq.hasGaintag('__protected')};
      rec.discardable = enemy2.getDiscardableCards(actor, 'he').map(c => c.name);
      rec.nonDiscardable = enemy2.getCards('he').filter(c => !lib.filter.canBeDiscarded(c, actor, enemy2)).map(c => c.name);
    }, async rec => {
      const base = baseEvent('useCardToPlayered', actor, {
        card: card('sha', 'spade', 1),
        targets: [enemy1],
        target: enemy1,
        isFirstTarget: true,
      });
      try {
        const costEvent = {result: null, skill: 'qizhi'};
        await lib.skill.qizhi.cost(costEvent, base, actor);
        rec.costResult = {
          bool: !!costEvent.result?.bool,
          targets: (costEvent.result?.targets || []).map(p => p.playerid),
        };
        if (costEvent.result?.bool) {
          await runContent('qizhi', actor, lib.skill.qizhi.content, {
            _trigger: base,
            triggername: 'useCardToPlayered',
            skill: 'qizhi',
            targets: costEvent.result.targets,
            cards: [],
          });
        }
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      }
      rec.afterTarget = {hand: hand(enemy2), equip: equip(enemy2), protected: enemy2.getCards('e').some(c => c.hasGaintag('__protected'))};
      rec.qizhiHistory = actor.getHistory('custom', evt => evt.qizhi).length;
    });

    await scene('edge-qizhi-protected-only', async rec => {
      actor.addSkill('qizhi');
      lib.skill.__discard_probe = {
        charlotte: true,
        mod: {canBeDiscarded(card2, player2, target2) { return !card2.hasGaintag('__protected'); }},
      };
      enemy2.addSkill('__discard_probe');
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) await clearHand(game.players[i]);
      const eq = card('bagua', 'spade', 2);
      await enemy2.equip(eq);
      eq.addGaintag('__protected');
      _status.currentPhase = actor;
      rec.beforeTarget = {hand: hand(enemy2), equip: equip(enemy2), protected: eq.hasGaintag('__protected')};
      rec.discardable = enemy2.getDiscardableCards(actor, 'he').map(c => c.name);
    }, async rec => {
      const base = baseEvent('useCardToPlayered', actor, {
        card: card('sha', 'spade', 1),
        targets: [enemy1],
        target: enemy1,
        isFirstTarget: true,
      });
      try {
        const costEvent = {result: null, skill: 'qizhi'};
        await lib.skill.qizhi.cost(costEvent, base, actor);
        rec.costResult = {
          bool: !!costEvent.result?.bool,
          targets: (costEvent.result?.targets || []).map(p => p.playerid),
        };
        if (costEvent.result?.bool) {
          await runContent('qizhi', actor, lib.skill.qizhi.content, {
            _trigger: base,
            triggername: 'useCardToPlayered',
            skill: 'qizhi',
            targets: costEvent.result.targets,
            cards: [],
          });
        }
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      }
      rec.afterTarget = {hand: hand(enemy2), equip: equip(enemy2), protected: enemy2.getCards('e').some(c => c.hasGaintag('__protected'))};
    });

    await scene('edge-reqiaobian-context', async rec => {
      lib.skill.__ctx_judge = {charlotte: true, mod: {cardDiscardable(card2, player2, name) { return name === 'reqiaobian_judge'; }}};
      lib.skill.__ctx_draw = {charlotte: true, mod: {cardDiscardable(card2, player2, name) { return name === 'reqiaobian_draw'; }}};
      lib.skill.__ctx_all = {charlotte: true, mod: {cardDiscardable(card2, player2, name) { return true; }}};
      actor.addSkill('reqiaobian');
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      identity(enemy2, 'fan');
      await clearHand(actor); await clearHand(enemy1); await clearHand(enemy2);
      await give(actor, [['sha', 'spade', 1]]);
      await give(enemy1, [['tao', 'heart', 2]]);
      await give(enemy2, [['shan', 'club', 3]]);
      _status.currentPhase = actor;
      rec.hasMarks = actor.hasMark('reqiaobian');
      rec.subSkillPresent = !!lib.skill.reqiaobian_draw;
    }, async rec => {
      const cases = {};
      for (const [label, skill] of [['judgeOnly', '__ctx_judge'], ['drawOnly', '__ctx_draw'], ['allContexts', '__ctx_all']]) {
        for (const s of ['__ctx_judge', '__ctx_draw', '__ctx_all']) { try { actor.removeSkill(s); } catch (e) {} }
        actor.addSkill(skill);
        const cardInHand = actor.getCards('h')[0];
        const info = {
          filterJudge: lib.filter.cardDiscardable(cardInHand, actor, 'reqiaobian_judge'),
          filterDraw: lib.filter.cardDiscardable(cardInHand, actor, 'reqiaobian_draw'),
          filter: lib.skill.reqiaobian_draw.filter({name: 'phase'}, actor),
        };
        const base = baseEvent('phase', actor, {name: 'phase'});
        try {
          if (!info.filter) {
            info.contentSkippedByFilter = true;
            info.ownContextWouldAllow = info.filterDraw;
            info.cancelled = false;
            info.handAfter = hand(actor);
            info.ok = true;
          } else {
            await runContent('reqiaobian_draw', actor, lib.skill.reqiaobian_draw.content, {
              _trigger: base,
              triggername: 'phaseDrawBefore',
              skill: 'reqiaobian_draw',
            });
            info.cancelled = !!base.cancelled;
            info.handAfter = hand(actor);
            info.ok = true;
          }
        } catch (e) {
          info.ok = false;
          info.error = e.name + ': ' + e.message;
        }
        cases[label] = info;
        if (actor.getCards('h').length < 1) await give(actor, [['sha', 'spade', 1]]);
      }
      rec.cases = cases;
    });

    await scene('edge-feijun-postpay', async rec => {
      actor.addSkill('nzry_feijun');
      actor.addSkill('nzry_binglve');
      lib.skill.nzry_feijun.init(actor);
      identity(actor, 'zhu');
      identity(enemy1, 'fan');
      await clearHand(actor); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) await clearHand(game.players[i]);
      await give(actor, [['shan', 'diamond', 1]]);
      await give(enemy1, [['tao', 'heart', 2]]);
      _status.currentPhase = actor;
      rec.beforeActorHand = actor.countCards('h');
      rec.beforeEnemyHand = enemy1.countCards('h');
      rec.aiBefore = lib.skill.nzry_feijun.ai.result.player(actor) ?? null;
      rec.filterBefore = lib.skill.nzry_feijun.filter({}, actor);
    }, async rec => {
      const paid = actor.getCards('h')[0];
      try {
        const ev = actor.useSkill('nzry_feijun', [paid]);
        await game.loop(ev);
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      }
      rec.afterActorHand = actor.countCards('h');
      rec.afterEnemyHand = enemy1.countCards('h');
      rec.storage = actor.getStorage('nzry_feijun').map(p => p.playerid);
      rec.binglveMarker = actor.getStorage('nzry_feijun').includes(enemy1);
    });

    await scene('edge-feijun-no-target', async rec => {
      actor.addSkill('nzry_feijun');
      actor.addSkill('nzry_binglve');
      lib.skill.nzry_feijun.init(actor);
      identity(actor, 'zhu');
      await clearHand(actor);
      for (const p of game.players) if (p !== actor) await clearHand(p);
      await give(actor, [['shan', 'diamond', 1]]);
      _status.currentPhase = actor;
      rec.filter = lib.skill.nzry_feijun.filter({}, actor);
    }, async rec => {
      const paid = actor.getCards('h')[0];
      try {
        const ev = actor.useSkill('nzry_feijun', [paid]);
        await game.loop(ev);
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
      }
      rec.afterActorHand = actor.countCards('h');
      rec.storage = actor.getStorage('nzry_feijun').map(p => p.playerid);
    });

    // Expected clean-host failure: keep this last so a thrown AI branch cannot
    // corrupt the scenes above. The same event is a normal cancel on the patched host.
    await scene('edge-dimeng-event-empty', async rec => {
      actor.addSkill('dimeng');
      identity(actor, 'zhu');
      for (const p of game.players) if (p !== actor) identity(p, 'zhong');
      await clearHand(actor); await clearHand(ally); await clearHand(enemy1); await clearHand(enemy2);
      for (let i = 4; i < game.players.length; i++) await clearHand(game.players[i]);
      await give(actor, [['wuxie', 'spade', 1], ['wuxie', 'heart', 2]]);
      await give(ally, [['sha', 'club', 3]]);
      for (const p of [enemy1, enemy2, game.players[4], game.players[5], game.players[6], game.players[7]]) {
        await give(p, [['tao', 'heart', 4], ['shan', 'diamond', 5], ['sha', 'spade', 6]]);
      }
      const cards = actor.getCards('h').slice();
      realHost.ui.selected.cards.length = 0;
      for (const c of cards) realHost.ui.selected.cards.push(c);
      realHost.ui.selected.targets.length = 0;
      rec.attitudes = game.players.map(p => [p.playerid, get.attitude(actor, p)]);
      rec.selectedCards = cards.length;
    }, async rec => {
      const filterLog = [];
      const originalFilter = lib.skill.dimeng.filterTarget;
      lib.skill.dimeng.filterTarget = function (card2, player2, target2) {
        filterLog.push({cards: realHost.ui.selected.cards.length, targets: realHost.ui.selected.targets.length, hand: target2.countCards('h')});
        return originalFilter.call(this, card2, player2, target2);
      };
      const ev = actor.chooseTarget(2, lib.skill.dimeng.filterTarget).set('ai', target => get.effect_use(target, 'dimeng', actor, actor));
      ev.forced = false;
      ev.complexCard = true;
      ev.filterCard = lib.skill.dimeng.filterCard;
      ev.selectCard = [0, Infinity];
      try {
        await game.loop(ev);
        rec.result = {
          bool: !!ev.result?.bool,
          targets: (ev.result?.targets || []).map(p => p.playerid),
        };
        rec.ok = true;
      } catch (e) {
        rec.ok = false;
        rec.error = e.name + ': ' + e.message;
        rec.stack = String(e.stack || '').split('\n').slice(0, 6);
      } finally {
        lib.skill.dimeng.filterTarget = originalFilter;
      }
      rec.filterLog = filterLog.slice(0, 30);
      rec.selectedAfter = realHost.ui.selected.targets.map(p => p.playerid);
    });

    return {hostVersion: lib.version, mode: get.mode(), scenes, errors};
  }, options);
}
