import { createPolicyHost } from './policyCore.js?v=41a';
import { SKILL_AI_PACKS } from './skillAIPolicyPacks.js?v=41a';

const policyHost = createPolicyHost();

export function installSkillAIPolicies() {
	policyHost.install(SKILL_AI_PACKS);
}

export function uninstallSkillAIPolicies() {
	policyHost.uninstall();
}

export function skillAIPolicyStats() {
	return policyHost.stats();
}
