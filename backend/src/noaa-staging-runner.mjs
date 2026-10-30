import { collectNoaaWave } from './noaa-wave-collector.mjs';

if (process.env.BLAISE_NOAA_STAGING_RUN !== 'true') {
  console.error('NOAA_STAGING_BLOQUEADO');
  process.exitCode = 2;
} else {
  const latitude = Number(process.env.BLAISE_NOAA_STAGING_LATITUDE);
  const longitude = Number(process.env.BLAISE_NOAA_STAGING_LONGITUDE);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -25 || latitude > -21 ||
      longitude < -45 || longitude > -40) {
    console.error('COORDENADAS_INVALIDAS');
    process.exitCode = 1;
  } else {
    try {
      const resultado = await collectNoaaWave(latitude, longitude);
      console.log(JSON.stringify({
        fonte: resultado.sourceName,
        alturaOndasM: resultado.waveHeightM,
        validade: resultado.validAt,
        verificadoEm: resultado.checkedAt,
        expiraEm: resultado.expiresAt
      }));
    } catch (erro) {
      console.error('COLETA_NOAA_FALHOU', erro.message);
      process.exitCode = 1;
    }
  }
}
