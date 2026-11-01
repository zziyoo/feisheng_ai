// 分包注册表（共享核心与分包模块的唯一边界）。
// 集成脚本只在本文件的 marker 之间追加内容，不改动已有分包。
// @djsc-pack-imports-begin
import { pack as outOfScope } from './packs/outOfScope.js?v=41a';
import { pack as refreshStandard } from './packs/refreshStandard.js?v=41a';
import { pack as shenhuaLei } from './packs/shenhuaLei.js?v=41a';
import { pack as shenhuaFeng } from './packs/shenhuaFeng.js?v=41a';
import { pack as refreshFeng } from './packs/refreshFeng.js?v=41a';
// @djsc-pack-imports-end

export const SKILL_AI_PACKS = [
	// @djsc-pack-registry-begin
	outOfScope,
	refreshStandard,
	shenhuaLei,
	shenhuaFeng,
	refreshFeng,
	// @djsc-pack-registry-end
];
