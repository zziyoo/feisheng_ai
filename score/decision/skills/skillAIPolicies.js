import { createPolicyHost } from './policyCore.js?v=41a';
import { SKILL_AI_PACKS } from './skillAIPolicyPacks.js?v=41a';

const policyHost = createPolicyHost();
let installStatus = { state: 'not-installed', reason: null };

export function installSkillAIPolicies(packs = SKILL_AI_PACKS) {
	try {
		policyHost.install(packs);
		installStatus = { state: 'installed', reason: null };
	} catch (error) {
		installStatus = { state: policyHost.stats().installed ? 'installed' : 'failed', reason: String(error?.message || error) };
		throw error;
	}
}

export function uninstallSkillAIPolicies() {
	policyHost.uninstall();
	installStatus = { state: 'not-installed', reason: null };
}

/* Removes only this pack's runtime hooks; it does not edit the disk registry. */
export function uninstallSkillAIPolicyPack(packId) {
	policyHost.uninstallPack(packId);
}

export function installSkillAIPolicyPack(pack) {
	try {
		if (policyHost.stats().installed) policyHost.installPack(pack);
		else policyHost.install([pack]);
		installStatus = { state: 'installed', reason: null };
	} catch (error) {
		installStatus = { state: policyHost.stats().installed ? 'installed' : 'failed', reason: String(error?.message || error) };
		throw error;
	}
}

export function skillAIPolicyStats() {
	return { ...policyHost.stats(), installation: { ...installStatus } };
}
