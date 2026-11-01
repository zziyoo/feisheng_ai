import { lib, game, get, _status } from '../../foundation/adapt/host.js?v=41a';

export { lib, game, get, _status };

/*
 * 共享策略核心：只负责安装/卸载宿主钩子、维护备份与统计。
 * 分包模块只注册自己的技能 ID；核心不知道任何具体技能名。
 */

function markWrapper(wrapped, tag) {
	try { wrapped.__djscSkillPolicy = tag; } catch (e) {}
	return wrapped;
}

function cloneStats(defaults) {
	const copy = {};
	for (const [key, value] of Object.entries(defaults || {})) copy[key] = Array.isArray(value) ? value.slice() : value;
	return copy;
}

export function createPolicyHost() {
	let installed = false;
	let packs = [];
	let statsByPack = {};
	const backups = [];
	const cleanups = [];

	const api = {
		lib, game, get, _status,

		statsOf(packId, defaults) {
			if (!statsByPack[packId]) statsByPack[packId] = cloneStats(defaults);
			return statsByPack[packId];
		},

		wrap(owner, key, tag, factory) {
			if (!owner || typeof key !== 'string' || owner[key] == null) return null;
			const original = owner[key];
			let wrapped;
			try { wrapped = factory(original); } catch (e) { return null; }
			if (typeof wrapped !== 'function') return null;
			markWrapper(wrapped, tag);
			try { owner[key] = wrapped; } catch (e) { return null; }
			backups.push({ owner, key, original, wrapped });
			return { owner, key, original, wrapped };
		},

		wrapPrototype(ctorName, method, tag, factory) {
			const ctor = lib.element && lib.element[ctorName];
			const proto = ctor && ctor.prototype;
			return api.wrap(proto, method, tag, factory);
		},

		addCleanup(fn) {
			if (typeof fn === 'function') cleanups.push(fn);
		},

		aliveOthers(player) {
			const list = [];
			try {
				for (const current of game.players) {
					if (!current || current === player || typeof current.isIn !== 'function' || !current.isIn()) continue;
					list.push(current);
				}
			} catch (e) {}
			return list;
		},

		playerOf(card) {
			try {
				if (card && typeof get.owner === 'function') {
					const owner = get.owner(card);
					if (owner) return owner;
				}
			} catch (e) {}
			try {
				if (typeof get.player === 'function') {
					const player = get.player();
					if (player) return player;
				}
			} catch (e) {}
			try { return (_status && _status.event && _status.event.player) || null; } catch (e) { return null; }
		},

		cardName(card, player) {
			try {
				if (typeof get.name === 'function') {
					const name = get.name(card, player);
					if (name) return name;
				}
			} catch (e) {}
			return card && card.name ? card.name : '';
		},

		position(card) {
			try { return typeof get.position === 'function' ? get.position(card) : null; } catch (e) { return null; }
		},

		buttonIndex(buttons, button) {
			const list = Array.isArray(buttons) ? buttons : [];
			let index = list.indexOf(button);
			if (index < 0 && button) {
				const link = button.link || button;
				index = list.findIndex(item => item === link || (item && item.link === link));
			}
			return Math.max(0, index);
		},

		activeSkillIds(player, startEvent) {
			const ids = [];
			try {
				let ev = startEvent || (_status && _status.event) || null;
				for (let depth = 0; ev && depth < 8; depth++) {
					for (const cand of [ev.skill, ev.sourceSkill, ev.skillName, ev.name]) {
						if (typeof cand === 'string' && cand && lib.skill && lib.skill[cand] && typeof lib.skill[cand] === 'object' && !ids.includes(cand)) ids.push(cand);
					}
					ev = typeof ev.getParent === 'function' ? ev.getParent() : (ev.parent || null);
				}
			} catch (e) {}
			return ids;
		},

		install(nextPacks) {
			if (installed) return;
			installed = true;
			packs = Array.isArray(nextPacks) ? nextPacks : [];
			statsByPack = {};
			for (const pack of packs) {
				if (!pack || typeof pack.id !== 'string' || typeof pack.install !== 'function') continue;
				const stats = api.statsOf(pack.id, pack.statsDefaults);
				try {
					const cleanup = pack.install(api, stats);
					if (typeof cleanup === 'function') cleanups.push(cleanup);
				} catch (e) {
					try { console.warn('[无名AI·技能策略] 分包安装失败: ' + pack.id, e); } catch (err) {}
				}
			}
		},

		uninstall() {
			for (const cleanup of cleanups.splice(0).reverse()) {
				try { cleanup(); } catch (e) {}
			}
			for (const backup of backups.splice(0).reverse()) {
				try {
					if (backup.owner && backup.owner[backup.key] === backup.wrapped) backup.owner[backup.key] = backup.original;
				} catch (e) {}
			}
			installed = false;
			packs = [];
			statsByPack = {};
		},

		stats() {
			const result = { installed };
			const packStats = {};
			for (const [packId, stats] of Object.entries(statsByPack)) packStats[packId] = stats;
			for (const stats of Object.values(packStats)) {
				for (const [key, value] of Object.entries(stats)) {
					if (!(key in result)) result[key] = value;
				}
			}
			result.packs = packStats;
			return result;
		},
	};

	return api;
}
