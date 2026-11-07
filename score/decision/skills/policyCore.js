import { lib, game, ui, get, _status } from '../../foundation/adapt/host.js?v=41a';

export { lib, game, ui, get, _status };

/*
 * 共享策略核心：只负责安装/卸载宿主钩子、维护备份与统计。
 * 分包模块只注册自己的技能 ID；核心不知道任何具体技能名。
 */

/* 临时兼容边界：两份冻结策略会在烈弓入口互相捕获，且当前卸载器
 * 无法解除被其他 host 包裹的内层。必须在任何包装之前拒绝同时激活。
 * 单模块作用域也覆盖同一策略核心创建的多个 host。 */
const exclusiveWindPacks = new Set(['shenhua_feng', 'refresh_feng']);
const windLeaseKey = Symbol.for('feisheng.skill-ai.exclusive-wind-lease');

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
			backups.push({ owner, key, original, wrapped, layer });
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
			const requested = Array.isArray(nextPacks) ? nextPacks : [];
			const winds = requested.filter(pack => pack && exclusiveWindPacks.has(pack.id));
			if (winds.length > 1) throw new Error('神话再临·风与界限突破·风的烈弓策略暂不支持同时激活；请只选择其中一个分包。');
			if (installed) {
				if (requested.length === packs.length && requested.every((pack, index) => pack === packs[index])) return;
				throw new Error('技能策略已安装，请先卸载再更换分包配置');
			}
			if (winds.length > 1 || (winds.length && lib[windLeaseKey])) {
				throw new Error('神话再临·风与界限突破·风的烈弓策略暂不支持同时激活；请卸载其中一个分包后重启。');
			}
			if (winds.length) {
				windLease = { pack: winds[0].id };
				Object.defineProperty(lib, windLeaseKey, { value: windLease, configurable: true });
			}
			installed = true;
			packs = requested;
			statsByPack = {};
			for (const pack of packs) {
				if (!pack || typeof pack.id !== 'string' || typeof pack.install !== 'function') continue;
				const stats = api.statsOf(pack.id, pack.statsDefaults);
				try {
					const cleanup = pack.install(api, stats);
					if (typeof cleanup === 'function') cleanups.push(cleanup);
				} catch (e) {
					api.uninstall();
					throw new Error('技能策略安装失败：' + pack.id + '：' + (e?.message || e));
				}
			}
		},

		uninstall() {
			for (const cleanup of cleanups.splice(0).reverse()) {
				try { cleanup(); } catch (e) {}
			}
			for (const backup of backups.splice(0).reverse()) {
				try {
					/* 外部闭包仍引用时也停用本包策略，保留外部函数不覆盖。 */
					if (backup.layer) backup.layer.active = false;
					if (backup.owner && backup.owner[backup.key] === backup.wrapped) backup.owner[backup.key] = backup.original;
				} catch (e) {}
			}
			if (windLease && lib[windLeaseKey] === windLease) delete lib[windLeaseKey];
			windLease = null;
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
