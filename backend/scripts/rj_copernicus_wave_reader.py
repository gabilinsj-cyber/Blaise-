"""Copernicus Marine Toolbox actual data access; opt-in only, no credentials in code.
This bridge emits normalized JSON to stdout and errors to stderr.
"""
import json
import os
import sys
from datetime import datetime, timezone

DATASET = "cmems_mod_glo_wav_anfc_0.083deg_PT3H-i"

def main():
    if os.getenv("BLAISE_COPERNICUS_LICENSE_VERIFIED") != "true":
        raise RuntimeError("copernicus_license_not_verified")
    if os.getenv("BLAISE_COPERNICUS_REDISTRIBUTION_AUTHORIZED") != "true":
        raise RuntimeError("copernicus_redistribution_not_authorized")
    import copernicusmarine
    import numpy as np
    lat, lon = -22.9, -42.9
    # Toolbox remote lazy access; point and short time window, no full-world download.
    ds = copernicusmarine.open_dataset(
        dataset_id=DATASET, variables=["VHM0"],
        minimum_longitude=lon - .05, maximum_longitude=lon + .05,
        minimum_latitude=lat - .05, maximum_latitude=lat + .05,
    )
    try:
        point = ds["VHM0"].sel(latitude=lat, longitude=lon, method="nearest")
        point = point.isel(time=-1)
        value = float(point.values)
        if not np.isfinite(value):
            raise RuntimeError("copernicus_invalid_value")
        valid = np.datetime_as_string(point.time.values, unit="s") + "Z"
        print(json.dumps({
            "sourceId": "COPERNICUS_MARINE", "productId": DATASET,
            "licenseVerified": True, "redistributionAuthorized": True,
            "kind": "FORECAST", "variable": "WAVE_HEIGHT", "unit": "m",
            "value": value, "latitude": lat, "longitude": lon,
            "validTimeUtc": valid,
            "receivedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "qualityFlag": "VALIDATED"
        }))
    finally:
        ds.close()

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(type(exc).__name__, file=sys.stderr)
        sys.exit(1)
