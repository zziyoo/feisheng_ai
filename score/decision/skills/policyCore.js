import { lib, game, ui, get, _status } from '../../foundation/adapt/host.js?v=41a';

export { lib, game, ui, get, _status };

/*
 * 共享策略核心：只负责安装/卸载宿主钩子、维护备份与统计。
 * 分包模块只注册自己的技能 ID；核心不知道任何具体技能名。
 */

/* 旧核心把此 Symbol 当作排他锁；保留该锁以拒绝旧版混装。 */
const exclusiveWindPacks = new Set(['shenhua_feng', 'refresh_feng']);
const windLeaseKey = Symbol.for('feisheng.skill-ai.exclusive-wind-lease');
const windProtocol = 'dual-feng-shared-entry-v1';
/* Shared across policyCore module instances loaded with different query strings. */
const sharedEntryKey = Symbol.for('feisheng.skill-ai.shared-entry.v1');

function sharedEntries() {
	if (!lib[sharedEntryKey]) Object.defineProperty(lib, sharedEntryKey, { value: new WeakMap(), configurable: true });
	return lib[sharedEntryKey];
}

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
	let windLease = null;
	const windOwners = new Map();
	const childPacks = new Map();
	const backups = [];
	const cleanups = [];
	let installingPack = null;

	const api = {
		lib, game, get, _status,

		statsOf(packId, defaults) {
			if (!statsByPack[packId]) statsByPack[packId] = cloneStats(defaults);
			return statsByPack[packId];
		},

		/* All participants must declare the same semantics. Exactly one handler is
		 * called; handlers are not chained and their scores are never added. */
		wrapShared(owner, key, contract, factory) {
			if (!installingPack || !owner || typeof key !== 'string' || typeof owner[key] !== 'function') {
				throw new Error('共享策略入口缺少安装所有者或宿主回调');
			}
			const entries = sharedEntries();
			let byKey = entries.get(owner);
			if (!byKey) { byKey = new Map(); entries.set(owner, byKey); }
			let entry = byKey.get(key);
			if (entry && (entry.contract !== contract || owner[key] !== entry.wrapper)) {
				throw new Error('共享策略入口冲突或已被外部修改：' + key);
			}
			if (!entry) {
				if (contract === 'xinliegong.aiOrder.draw-unlock.v1' && ['liegong:aiOrder', 'refresh-feng:liegong-order'].includes(owner[key].__djscSkillPolicy)) {
					throw new Error('检测到旧版烈弓包装残留；请卸载旧包并重启。');
				}
				entry = { contract, original: owner[key], owners: new Map(), wrapper: null };
				const state = entry;
				entry.wrapper = markWrapper(function (...args) {
					const first = [...state.owners.entries()].sort((a, b) => a[0].localeCompare(b[0]))[0];
					return (first ? first[1].handler : state.original).apply(this, args);
				}, 'shared:' + contract);
			}
			if (entry.owners.has(installingPack)) throw new Error('共享策略入口重复注册：' + installingPack + '/' + key);
			const handler = factory(entry.original);
			if (typeof handler !== 'function') throw new Error('共享策略入口工厂未返回函数：' + key);
			if (!byKey.has(key)) {
				owner[key] = entry.wrapper;
				if (owner[key] !== entry.wrapper) throw new Error('共享策略入口写入失败：' + key);
				byKey.set(key, entry);
			}
			const packId = installingPack;
			const token = { handler };
			entry.owners.set(packId, token);
			cleanups.push({ packId, fn: () => {
				if (entry.owners.get(packId) !== token) return;
				entry.owners.delete(packId);
				if (entry.owners.size) return;
				if (owner[key] === entry.wrapper) {
					owner[key] = entry.original;
					if (owner[key] === entry.original) byKey.delete(key);
				}
				/* An external closure may still reference this now-inert wrapper. */
			} });
			return entry.wrapper;
		},

		wrap(owner, key, tag, factory) {
			if (!owner || typeof key !== 'string' || owner[key] == null) return null;
			const original = owner[key];
			let wrapped;
			try { wrapped = factory(original); } catch (e) { return null; }
			if (typeof wrapped !== 'function') return null;
			let layer = null;
			if (windLease && (tag === 'liegong:aiOrder' || tag === 'refresh-feng:liegong-order')) {
				const policy = wrapped;
				layer = { active: true };
				wrapped = function (...args) {
					return (layer.active ? policy : original).apply(this, args);
				};
			}
			markWrapper(wrapped, tag);
			try { owner[key] = wrapped; } catch (e) { return null; }
			backups.push({ owner, key, original, wrapped, layer, packId: installingPack });
			return { owner, key, original, wrapped };
		},

		wrapPrototype(ctorName, method, tag, factory) {
			const ctor = lib.element && lib.element[ctorName];
			const proto = ctor && ctor.prototype;
			return api.wrap(proto, method, tag, factory);
		},

		addCleanup(fn) {
			if (typeof fn === 'function') cleanups.push({ packId: installingPack, fn });
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
			const requested = Array.isArray(nextPacks) ? nextPacks : [];
			const winds = requested.filter(pack => pack && exclusiveWindPacks.has(pack.id));
			if (installed) {
				if (requested.length === packs.length && requested.every((pack, index) => pack === packs[index])) return;
				throw new Error('全量安装要求空宿主；请先全部卸载，或使用 installSkillAIPolicyPack 增量安装。');
			}
			if (winds.length) {
				if (new Set(winds.map(pack => pack.id)).size !== winds.length || winds.some(pack => pack.windProtocol !== windProtocol)) {
					throw new Error('风包版本不支持共享入口，或存在重复分包；请先迁移兼容版本。');
				}
				const existing = lib[windLeaseKey];
				if (existing && (existing.protocol !== windProtocol || !(existing.owners instanceof Map))) throw new Error('已存在不兼容的旧版风包租约；请先卸载旧包并重启。');
				if (existing && winds.some(pack => existing.owners.has(pack.id))) throw new Error('风包已由其他宿主注册；请先卸载原有实例。');
				windLease = existing || { protocol: windProtocol, owners: new Map() };
				if (!existing) Object.defineProperty(lib, windLeaseKey, { value: windLease, configurable: true });
				for (const pack of winds) {
					const token = {};
					windOwners.set(pack.id, token);
					windLease.owners.set(pack.id, token);
				}
			}
			installed = true;
			packs = requested;
			statsByPack = {};
			for (const pack of packs) {
				if (!pack || typeof pack.id !== 'string' || typeof pack.install !== 'function') continue;
				const stats = api.statsOf(pack.id, pack.statsDefaults);
				try {
					installingPack = pack.id;
					const cleanup = pack.install(api, stats);
					if (typeof cleanup === 'function') cleanups.push({ packId: pack.id, fn: cleanup });
				} catch (e) {
					api.uninstall();
					throw new Error('技能策略安装失败：' + pack.id + '：' + (e?.message || e));
				} finally {
					installingPack = null;
				}
			}
		},

		/* Incremental installation owns a separate host so failure cannot tear down
		 * previously installed packs. Shared entry and lease remain process-wide. */
		installPack(pack) {
			if (!installed) throw new Error('请先安装策略宿主，再增量安装分包');
			if (!pack || typeof pack.id !== 'string' || typeof pack.install !== 'function') throw new Error('无效的分包');
			const existing = packs.find(item => item && item.id === pack.id);
			if (existing) {
				if (existing === pack) return;
				throw new Error('分包 ID 已由不同实例注册：' + pack.id);
			}
			const child = createPolicyHost();
			child.install([pack]);
			childPacks.set(pack.id, child);
			packs.push(pack);
		},

		uninstallPack(packId) {
			if (!installed || !packs.some(pack => pack && pack.id === packId)) return;
			const child = childPacks.get(packId);
			if (child) {
				child.uninstall();
				childPacks.delete(packId);
				packs = packs.filter(pack => !pack || pack.id !== packId);
				return;
			}
			for (let i = cleanups.length - 1; i >= 0; i--) {
				if (cleanups[i].packId !== packId) continue;
				const cleanup = cleanups.splice(i, 1)[0];
				try { cleanup.fn(); } catch (e) {}
			}
			for (let i = backups.length - 1; i >= 0; i--) {
				if (backups[i].packId !== packId) continue;
				const backup = backups.splice(i, 1)[0];
				try {
					/* 外部闭包仍引用时也停用本包策略，保留外部函数不覆盖。 */
					if (backup.layer) backup.layer.active = false;
					if (backup.owner && backup.owner[backup.key] === backup.wrapped) backup.owner[backup.key] = backup.original;
				} catch (e) {}
			}
			const token = windOwners.get(packId);
			if (token && windLease && windLease.owners.get(packId) === token) windLease.owners.delete(packId);
			windOwners.delete(packId);
			if (windLease && lib[windLeaseKey] === windLease && windLease.owners.size === 0) delete lib[windLeaseKey];
			packs = packs.filter(pack => !pack || pack.id !== packId);
			delete statsByPack[packId];
		},

		uninstall() {
			for (const pack of [...packs].reverse()) if (pack && typeof pack.id === 'string') api.uninstallPack(pack.id);
			windLease = null;
			installed = false;
			packs = [];
			statsByPack = {};
		},

		stats() {
			const result = { installed };
			const packStats = {};
			for (const [packId, stats] of Object.entries(statsByPack)) packStats[packId] = stats;
			for (const child of childPacks.values()) Object.assign(packStats, child.stats().packs);
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
