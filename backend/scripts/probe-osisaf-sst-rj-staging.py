#!/usr/bin/env python3
"""EUMETSAT OSI SAF GOES-19 OSI-207-c SST, three fixed RJ offshore points.

Public-product HTTPS test only. NOT air temperature, nor 92 city thermometers.
Does not call paid APIs, publish customer data, or schedule background work.
When the distributor or quality data are missing, return UNAVAILABLE.
"""
from __future__ import annotations
import importlib.util
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ORIGINAL = Path(__file__).with_name("probe-osisaf-sst-staging.py")
spec = importlib.util.spec_from_file_location("osi_saf_existing_probe", ORIGINAL)
legacy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)
SOURCE_ID = "EUMETSAT_OSI_SAF_SST"
PRODUCT_ID = "OSI-207-c"
ROOT = legacy.ROOT
MAX_NETCDF = 128 * 1024 * 1024
POINTS = (
    {"id": "ILHA_GRANDE_OFFSHORE", "latitude": -23.4, "longitude": -44.5},
    {"id": "RIO_OFFSHORE", "latitude": -23.5, "longitude": -43.25},
    {"id": "CABO_FRIO_OFFSHORE", "latitude": -23.25, "longitude": -42.0},
)

def source_allowed(url):
    info = urlsplit(url)
    return (info.scheme == "https" and info.hostname == "osi-saf.ifremer.fr"
            and info.path.startswith("/sst/l3c/west_atlantic_east_pacific/")
            and info.path.lower().endswith((".nc", ".nc4"))
            and not info.username and not info.password
            and not info.fragment and not info.query)

def time_iso(t):
    if not hasattr(t, "year"):
        raise ValueError("OSI_SAF_NETCDF_TIME_INVALID")
    return datetime(t.year, t.month, t.day, t.hour, t.minute,
                    t.second, tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")

def decode_rj_osi_saf_sst(path, *, now=None):
    import netCDF4 as nc
    import numpy as np
    at = now or datetime.now(timezone.utc)
    with nc.Dataset(str(path), "r") as ds:
        v = ds.variables
        latkey = next((n for n in ("lat", "latitude") if n in v), None)
        lonkey = next((n for n in ("lon", "longitude") if n in v), None)
        sstkey = next((n for n in ("sea_surface_temperature", "analysed_sst", "sst") if n in v), None)
        qualitykey = next((n for n in ("quality_level", "quality_flag") if n in v), None)
        if not all((latkey, lonkey, sstkey, qualitykey)) or "time" not in v:
            raise ValueError("OSI_SAF_NETCDF_MISSING_SST_COORD_TIME_OR_QA")
        lat, lon = np.asarray(v[latkey][:]), np.asarray(v[lonkey][:])
        if lat.ndim != 1 or lon.ndim != 1 or len(lat) < 2 or len(lon) < 2:
            raise ValueError("OSI_SAF_GRID_NOT_1D_LATLON")
        timevar = v["time"]
        if len(timevar) != 1:
            raise ValueError("OSI_SAF_TIME_AXIS_NOT_SINGLE")
        timevalue = nc.num2date(timevar[0], timevar.units,
            calendar=getattr(timevar, "calendar", "standard"))
        valid = time_iso(timevalue)
        ts = datetime.fromisoformat(valid.replace("Z", "+00:00"))
        age = (at - ts).total_seconds()
        if age < 0 or age > 12 * 3600:
            raise ValueError("OSI_SAF_SST_EXPIRED_OR_FUTURE")
        sst, quality = v[sstkey], v[qualitykey]
        def sample(var, latidx, lonidx):
            dims = var.dimensions
            if len(dims) not in (2, 3) or any(d not in ("time", latkey, lonkey) for d in dims):
                raise ValueError("OSI_SAF_GRID_AXES_UNVERIFIED")
            if latkey not in dims or lonkey not in dims:
                raise ValueError("OSI_SAF_SPATIAL_AXIS_MISSING")
            sel = tuple(0 if d == "time" else latidx if d == latkey else lonidx for d in dims)
            return var[sel]
        units = str(getattr(sst, "units", "")).lower()
        if units not in ("k", "kelvin", "degrees_kelvin", "c", "celsius",
                         "degree_celsius", "degrees_celsius"):
            raise ValueError("OSI_SAF_SST_UNIT_UNKNOWN")
        result = []
        for p in POINTS:
            i = int(np.argmin(np.abs(lat-p["latitude"])))
            j = int(np.argmin(np.abs(((lon-p["longitude"]+180)%360)-180)))
            latitude = float(lat[i])
            longitude = float(((lon[j]+180)%360)-180)
            point = dict(id=p["id"], latitude=p["latitude"],
                longitude=p["longitude"], dataLatitude=latitude,
                dataLongitude=longitude, temperatureC=None, qualityLevel=None)
            if abs(latitude-p["latitude"]) <= 0.075 and abs(longitude-p["longitude"]) <= 0.075:
                qa = sample(quality, i, j)
                value = sample(sst, i, j)
                if (not np.ma.is_masked(qa) and np.isfinite(qa)
                    and float(qa) >= 4
                    and not np.ma.is_masked(value) and np.isfinite(value)):
                    kelvin = float(value)
                    c = kelvin-273.15 if units in ("k", "kelvin", "degrees_kelvin") else kelvin
                    if math.isfinite(c) and -3 <= c <= 40:
                        point["temperatureC"] = round(c, 2)
                        point["qualityLevel"] = int(qa)
            result.append(point)
        return {"validAt": valid, "points": result,
                "qualityThreshold": 4, "gridType": "GHRSST_L3C_1D_LATLON"}

def probe_osi_saf_rj(*, now=None, discovery=None, download=None, decode=None):
    at = now or datetime.now(timezone.utc)
    data = dict(contract="BLAISE_OSI_SAF_207C_RJ_SST_OFFSHORE_V1",
        sourceId=SOURCE_ID, productId=PRODUCT_ID, kind="E",
        checkedAt=at.isoformat().replace("+00:00", "Z"),
        status="UNAVAILABLE", measuredAsAirTemperature=False,
        noUserLocation=True, publishedToAndroid=False, publishedToSubscriber=False,
        automaticCollection=False, oceanPoints=3, verifiedPoints=0,
        sourceUrl=ROOT, validAt=None, points=[],
        requiredAttribution="EUMETSAT OSI SAF, OSI-207-c, CC BY 4.0")
    try:
        pick = discovery or legacy.pick_recent_netcdf
        url = pick(at)
        if not url or not source_allowed(url):
            raise ValueError("OSI_SAF_RECENT_FILE_NOT_ACCESSIBLE")
        get = download or (lambda link: legacy.limited_get(link, MAX_NETCDF))
        payload = get(url)
        if not isinstance(payload, bytes) or len(payload) < 80 or not (
            payload.startswith(b"\x89HDF") or payload.startswith(b"CDF")):
            raise ValueError("OSI_SAF_NOT_VALID_NETCDF")
        import tempfile
        with tempfile.TemporaryDirectory(prefix="blaise-rj-osi-saf-") as folder:
            path = Path(folder)/"osi-saf-207c.nc"
            path.write_bytes(payload)
            read = decode or decode_rj_osi_saf_sst
            result = read(path, now=at)
        valid = datetime.fromisoformat(result["validAt"].replace("Z", "+00:00"))
        if not 0 <= (at-valid).total_seconds() <= 12*3600:
            raise ValueError("OSI_SAF_SST_TIME_NOT_FRESH")
        rows = result["points"]
        if (len(rows) != len(POINTS) or
            any(row.get("id") != p["id"] or
                row.get("latitude") != p["latitude"] or
                row.get("longitude") != p["longitude"] for row, p in zip(rows, POINTS))):
            raise ValueError("OSI_SAF_POINTS_NOT_VERIFIED")
        good = sum(isinstance(p["temperatureC"], (int, float)) and
            p["temperatureC"] is not None and -3 <= p["temperatureC"] <= 40
            and isinstance(p.get("qualityLevel"), int) and p["qualityLevel"] >= 4
            for p in rows)
        data.update(status="FULL" if good == 3 else "PARTIAL" if good else "UNAVAILABLE",
            sourceUrl=url, validAt=result["validAt"], verifiedPoints=good, points=rows,
            qualityThreshold=4, gridType=result.get("gridType"))
        if not good:
            data["reason"] = "OSI_SAF_SST_NO_HIGH_QUALITY_COASTAL_CELL"
    except Exception as exc:
        data["reason"] = type(exc).__name__+":"+str(exc)[:130]
    return data

def main():
    if "--live" not in sys.argv:
        raise SystemExit("--live required: no OSI SAF external requests made")
    output = probe_osi_saf_rj()
    dest = Path(__file__).resolve().parents[2]/"evidence"/"international-sources"
    dest.mkdir(parents=True, exist_ok=True)
    (dest/"osi-saf-rj-coast-sst.json").write_text(
        json.dumps(output, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print("BLAISE_OSI_SAF_RJ_REAL="+json.dumps({
        "status": output["status"], "verifiedPoints": output["verifiedPoints"],
        "checkedAt": output["checkedAt"], "validAt": output["validAt"],
        "reason": output.get("reason"), "sourceUrl": output["sourceUrl"],
        "kind": "E", "publishedToAndroid": False
    }, separators=(",", ":")))

if __name__ == "__main__":
    main()
