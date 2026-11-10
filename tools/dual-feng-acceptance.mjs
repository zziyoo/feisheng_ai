export function evaluateDualAcceptance(evidence, inputs) {
 const baseline = evidence?.baseline;
 const ok = baseline?.head === 'fcc9eb2581e9470e228dea112add930fa0be0e07' && baseline.status === 'PASS'
   && evidence.runtime_equivalent === true && inputs?.runtime_equivalent === true && inputs?.clean_source === true
   && /^[a-f0-9]{64}$/.test(evidence.installer_sha256 || '') && inputs.installer_sha256 === evidence.installer_sha256
   && evidence.installer_tests?.passed === 18 && evidence.installer_tests?.failed === 0
   && evidence.package_tests?.total === 39 && evidence.package_tests?.passed === 39 && evidence.package_tests?.failed === 0
   && Array.isArray(evidence.package_assertions) && evidence.package_assertions.length === 39 && evidence.package_assertions.every(item => item.pass === true) && evidence.archive_checks === 'PASS';
 return { baseline_acceptance: {head: baseline?.head || null, status: baseline?.status || '未验证'},
  can_mark_deliverable: ok, complete_delivery: ok, delivery_stage: ok ? '内部验收通过' : '候选待验收',
  pack_status: ok ? '内部验收通过' : '候选待验收', delivery_status: ok ? '内部验收通过' : '候选待验收',
  external_integration_receipt: 'pending', external_integration_note: '外部集成回执尚未取得', publication_status: '未发布' };
}
