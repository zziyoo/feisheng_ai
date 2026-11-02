/*
 * 纯规则聚合出口：只为既有测试/工具保留统一 import 路径。
 * 运行时分包模块直接 import 各自的 rules/<pack>.js，不经过本文件，
 * 因此某个分包独立交付时不需要携带其他分包的规则。
 */
export * from './rules/refreshStandard.js';
export * from './rules/shenhuaLei.js';
export * from './rules/shenhuaFeng.js';
export * from './rules/refreshFeng.js';
export * from './rules/shenhuaHuo.js';
export * from './rules/outOfScope.js';
