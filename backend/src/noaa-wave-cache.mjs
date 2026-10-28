export const NOAA_WAVE_SOURCE_ID = "noaa-gfs-wave";
export function createNoaaWaveCache({ now = Date.now } = {}) {
  let entry = null, lastAttemptAt = null, lastErrorCode = null;
  function recordSuccess(snapshot, { fetchedAt = now() } = {}) {
    const issued = Date.parse(snapshot?.issuedAt);
    const valid = Date.parse(snapshot?.validAt);
    const expires = Date.parse(snapshot?.expiresAt);
    if (![issued, valid, expires, fetchedAt].every(Number.isFinite))
      throw new Error("noaa_cache_time_invalid");
    if (issued > fetchedAt || expires <= fetchedAt)
      throw new Error("noaa_cache_not_current");
    if (expires <= valid || expires > valid + 3600000 || expires > issued + 43200000)
      throw new Error("noaa_cache_expiry_invalid");
    if (!Number.isFinite(snapshot.waveHeightM) || snapshot.waveHeightM < 0)
      throw new Error("noaa_cache_wave_invalid");
    if (snapshot.nature !== "MODELO" || snapshot.units !== "m")
      throw new Error("noaa_cache_metadata_invalid");
    const sourceUrl = new URL(snapshot.sourceUrl);
    if (sourceUrl.protocol !== "https:" ||
        sourceUrl.hostname !== "nomads.ncep.noaa.gov" ||
        sourceUrl.username || sourceUrl.password)
      throw new Error("noaa_cache_source_invalid");
    if (valid < issued || valid > fetchedAt || fetchedAt - valid >= 3600000)
      throw new Error("noaa_cache_validity_invalid");
    const { latitude, longitude } = snapshot;
    if (![latitude, longitude].every(Number.isFinite))
      throw new Error("noaa_cache_coordinates_invalid");
    if (latitude < -25 || latitude > -21)
      throw new Error("noaa_cache_latitude_outside_scope");
    if (longitude < -45 || longitude > -40)
      throw new Error("noaa_cache_longitude_outside_scope");
    const checked = Date.parse(snapshot.checkedAt);
    if (!Number.isFinite(checked) || checked !== fetchedAt)
      throw new Error("noaa_cache_checked_at_invalid");
    const current = now();
    if (!Number.isFinite(current) || fetchedAt > current)
      throw new Error("noaa_cache_clock_invalid");
    if (expires <= current)
      throw new Error("noaa_cache_expired");
    const saved = structuredClone(snapshot);
    entry = { snapshot: saved, fetchedAt, issued, valid, expires };
    lastAttemptAt = fetchedAt;
    lastErrorCode = null;
  }
  function recordFailure(code, { attemptedAt = now() } = {}) {
    const current = now();
    if (![attemptedAt, current].every(Number.isFinite))
      throw new Error("noaa_cache_attempt_time_invalid");
    if (attemptedAt > current)
      throw new Error("noaa_cache_future_attempt");
    if (typeof code !== "string")
      throw new Error("noaa_cache_error_code_invalid");
    lastAttemptAt = attemptedAt;
    lastErrorCode = code;
  }
  function read({ at = now(), mode = "normal" } = {}) {
    if (!Number.isFinite(at))
      throw new Error("noaa_cache_read_time_invalid");
    if (!["normal", "severe"].includes(mode))
      throw new Error("noaa_cache_mode_invalid");
    const refreshIntervalMs = mode === "severe" ? 30000 : 300000;
    const next = lastAttemptAt === null ? null : lastAttemptAt + refreshIntervalMs;
    const base = { sourceId: NOAA_WAVE_SOURCE_ID, mode, refreshIntervalMs,
      refreshDue: next === null || at >= next,
      nextRefreshDueAt: next === null ? null : new Date(next).toISOString(),
      lastAttemptAt: lastAttemptAt === null ? null : new Date(lastAttemptAt).toISOString(),
      lastErrorCode };
    if (!entry) return Object.freeze({ ...base, state: "UNAVAILABLE",
      reason: lastErrorCode ? "refresh_failed_without_snapshot" : "no_snapshot",
      fetchedAt: null, dataAgeMs: null, cacheAgeMs: null, snapshot: null });
    const dataAgeMs = at - entry.valid;
    const cacheAgeMs = at - entry.fetchedAt;
    if (dataAgeMs < 0 || cacheAgeMs < 0)
      return Object.freeze({ ...base, state: "UNAVAILABLE", reason: "clock_skew",
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
        dataAgeMs: null, cacheAgeMs: null, snapshot: null });
    if (at >= entry.expires)
      return Object.freeze({ ...base, state: "STALE", reason: "model_expired",
        fetchedAt: new Date(entry.fetchedAt).toISOString(),
        dataAgeMs, cacheAgeMs, snapshot: null });
    const degraded = lastErrorCode !== null && lastAttemptAt >= entry.fetchedAt;
    return Object.freeze({ ...base,
      state: degraded ? "CURRENT_DEGRADED" : "CURRENT",
      reason: degraded ? "latest_refresh_failed_using_current_cache" : "fresh_snapshot",
      fetchedAt: new Date(entry.fetchedAt).toISOString(),
      dataAgeMs, cacheAgeMs,
      snapshot: structuredClone(entry.snapshot) });
  }
  return Object.freeze({ recordSuccess, recordFailure, read });
}
