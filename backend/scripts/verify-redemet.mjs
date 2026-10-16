import { probeRedemetRjMetar } from '../src/redemet-source.mjs';
try {
  const snapshot = await probeRedemetRjMetar({
    apiKey: process.env.BLAISE_REDEMET_API_KEY ?? '',
    usageApproved: process.env.BLAISE_REDEMET_USAGE_APPROVED === 'true',
  });
  console.log(JSON.stringify({ source: 'REDEMET_DECEA', contract: 'PASS',
    sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.fetchedAt,
    observations: snapshot.observations, excludedRecordCount: snapshot.excludedRecordCount,
    automaticAlertAuthorized: false }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ source: 'REDEMET_DECEA', contract: 'BLOCKED',
    errorCode: error.code ?? 'redemet_unexpected_error', observations: [] }, null, 2));
  process.exitCode = 1;
}
