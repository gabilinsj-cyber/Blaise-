import { readMarineGribPoint } from "./marine-grib-reader.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
export function noaaWaveUrl(cycleMillis, forecastHour = 0) {
  const iso = new Date(cycleMillis).toISOString();
  const day = iso.slice(0, 10).replaceAll("-", "");
  const hour = iso.slice(11, 13);
  const url = new URL("https://nomads.ncep.noaa.gov/cgi-bin/filter_gfswave.pl");
  const file = `gfswave.t${hour}z.global.0p25.f${String(forecastHour).padStart(3, "0")}.grib2`;
  url.searchParams.set("file", file);
  url.searchParams.set("dir", "/gfs." + day + "/" + hour + "/wave/gridded");
  url.searchParams.set("var_HTSGW", "on");
  url.searchParams.set("lev_surface", "on");
  url.searchParams.set("subregion", "on");
  url.searchParams.set("leftlon", "-45");
  url.searchParams.set("rightlon", "-40");
  url.searchParams.set("toplat", "-21");
  url.searchParams.set("bottomlat", "-25");
  return url.href;
}
export async function fetchNoaaGrib(url, fetchImpl = fetch) {
  const signal = AbortSignal.timeout(30000);
  const response = await fetchImpl(url, { signal, redirect: "error" });
  if (!response.ok) throw new Error("noaa_http_" + response.status);
  if (!response.body) throw new Error("noaa_body_missing");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 1000000) throw new Error("noaa_download_too_large");
    chunks.push(chunk);
  }
  const data = Buffer.concat(chunks);
  if (data.length < 20) throw new Error("noaa_grib_too_short");
  if (data.toString("ascii", 0, 4) !== "GRIB") throw new Error("noaa_grib_invalid");
  if (data.toString("ascii", 0, 4) !== "GRIB") throw new Error("noaa_grib_invalid");
  if (data[7] !== 2) throw new Error("noaa_grib_edition_invalid");
  if (data[7] !== 2) throw new Error("noaa_grib_edition_invalid");
  if (data.readBigUInt64BE(8) !== BigInt(data.length)) throw new Error("noaa_grib_length_invalid");
  if (data.subarray(-4).toString("ascii") !== "7777") throw new Error("noaa_grib_end_invalid");
  return data;
}
export function noaaWaveCycles(nowMillis = Date.now()) {
  const step = 6 * 60 * 60 * 1000;
  const latest = Math.floor(nowMillis / step) * step;
  return [0, 1, 2, 3].map(i => latest - i * step);
}
export async function fetchRecentNoaaWave(nowMillis = Date.now(), fetchImpl = fetch) {
  for (const cycleMillis of noaaWaveCycles(nowMillis)) {
    const forecastHour = Math.floor((nowMillis - cycleMillis) / 3600000);
    if (nowMillis - cycleMillis >= 43200000) continue;
    const url = noaaWaveUrl(cycleMillis, forecastHour);
    try {
      const data = await fetchNoaaGrib(url, fetchImpl);
      return { data, cycleMillis, forecastHour, sourceUrl: url };
    } catch (error) {
      if (error.message !== "noaa_http_404") throw error;
    }
  }
  throw new Error("noaa_recent_cycles_unavailable");
}
export async function collectNoaaWave(latitude, longitude, nowMillis = Date.now(), fetchImpl = fetch) {
  const recent = await fetchRecentNoaaWave(nowMillis, fetchImpl);
  const dir = await mkdtemp(join(tmpdir(), "blaise-noaa-"));
  try {
    const file = join(dir, "wave.grib2");
    await writeFile(file, recent.data);
    const point = await readMarineGribPoint(file, latitude, longitude);
    if (Date.parse(point.issuedAt) !== recent.cycleMillis)
      throw new Error("noaa_cycle_mismatch");
    if (Date.parse(point.validAt) !== recent.cycleMillis + recent.forecastHour * 3600000)
      throw new Error("noaa_validity_mismatch");
    const age = nowMillis - recent.cycleMillis;
    if (age < 0 || age >= 43200000)
      throw new Error("noaa_cycle_expired");
    return { ...point,
      sourceName: "NOAA GFS Wave",
      sourceUrl: recent.sourceUrl,
      nature: "MODELO",
      checkedAt: new Date(nowMillis).toISOString(),
expiresAt: new Date(Math.min(recent.cycleMillis + 43200000, Date.parse(point.validAt) + 3600000)).toISOString(),
      latitude, longitude };
  } finally {
    await rm(dir, {recursive:true, force:true});
  }
}
