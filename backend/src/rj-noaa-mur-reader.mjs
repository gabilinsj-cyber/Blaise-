// NOAA CoastWatch ERDDAP reader for MUR SST; requires verified dataset terms before enabling.
const HOST = 'https://coastwatch.pfeg.noaa.gov';
const DATASET = 'jplMURSST41';
export function createNoaaMurSstReader({ fetchImpl = fetch, licenseVerified = false, redistributionAuthorized = false, latitude = -22.9, longitude = -42.9, timeoutMs = 12000 } = {}) {
  if (!Number.isFinite(latitude) || latitude < -25 || latitude > -18 || !Number.isFinite(longitude) || longitude < -47 || longitude > -37) throw new RangeError('invalid_rj_point');
  return async function readNoaa() {
    if (!licenseVerified || !redistributionAuthorized) throw new Error('noaa_license_not_verified');
    // ERDDAP griddap CSV returns a header, units row and data rows. Time latest is resolved by server.
    const query = 'analysed_sst[(last)][(' + latitude + ')][(' + longitude + ')]';
    const url = HOST + '/erddap/griddap/' + DATASET + '.csv?' + encodeURIComponent(query);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try { response = await fetchImpl(url, { signal: controller.signal, headers: { Accept: 'text/csv' } }); }
    finally { clearTimeout(timer); }
    if (!response.ok) throw new Error('noaa_http_error');
    const raw = await response.text();
    if (raw.length > 8192) throw new Error('noaa_response_too_large');
    const rows = raw.trim().split(/\r?\n/).map(line => line.split(',').map(s => s.replace(/^"|"$/g, '').trim()));
    const header = rows[0] || [];
    const timeIndex = header.indexOf('time');
    const valueIndex = header.indexOf('analysed_sst');
    if (timeIndex < 0 || valueIndex < 0 || rows.length < 3) throw new Error('noaa_csv_schema_invalid');
    const row = rows[rows.length - 1];
    const value = Number(row[valueIndex]);
    const time = new Date(row[timeIndex]);
    if (!Number.isFinite(value) || !Number.isFinite(time.getTime())) throw new Error('noaa_sample_invalid');
    // MUR SST griddap commonly exposes degC, but the units row must confirm this.
    const unit = rows[1]?.[valueIndex];
    if (!['degree_C', 'degrees_C', 'degC'].includes(unit)) throw new Error('noaa_units_unverified');
    return { sourceId: 'NOAA', productId: DATASET, licenseVerified, redistributionAuthorized,
      kind: 'OBSERVATION', variable: 'SEA_SURFACE_TEMPERATURE', unit: 'degC',
      value, latitude, longitude, validTimeUtc: time.toISOString(),
      receivedAtUtc: new Date().toISOString(), qualityFlag: 'VALIDATED' };
  };
}
