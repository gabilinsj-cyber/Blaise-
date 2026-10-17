"""Bounded official hourly model subset. Credentials only from process environment.
Never log credentials, upstream exceptions or token-bearing URLs.
"""
import contextlib
import datetime as dt
import json
import math
import os
import sys

PRODUCT = 'GLOBAL_ANALYSISFORECAST_PHY_001_024'
DATASETS = {
    'seaLevel': ('cmems_mod_glo_phy_anfc_merged-sl_PT1H-i', ['ocean_tide', 'total_sea_level'], 'm'),
    'currents': ('cmems_mod_glo_phy_anfc_merged-uv_PT1H-i', ['utotal', 'vtotal'], 'm s-1'),
}

def collect():
    if not all(os.environ.get(k) for k in ('COPERNICUSMARINE_SERVICE_USERNAME', 'COPERNICUSMARINE_SERVICE_PASSWORD')):
        raise ValueError('copernicus_credentials_missing')
    import copernicusmarine as cm
    import numpy as np
    now = dt.datetime.now(dt.timezone.utc)
    start = now.replace(minute=0, second=0, microsecond=0)
    products = {}
    for key, (dataset_id, variables, unit) in DATASETS.items():
        # Redirect Toolbox notices away from the JSON protocol; parent discards stderr.
        with contextlib.redirect_stdout(sys.stderr):
            ds = cm.open_dataset(dataset_id=dataset_id, variables=variables,
                minimum_latitude=-23.5, maximum_latitude=-23.5,
                minimum_longitude=-43.0, maximum_longitude=-43.0,
                start_datetime=start, end_datetime=start + dt.timedelta(hours=6),
                coordinates_selection_method='nearest', raise_if_updating=True)
            try:
                if ds.sizes.get('latitude') != 1 or ds.sizes.get('longitude') != 1 or not 1 <= ds.sizes.get('time', 0) <= 8:
                    raise ValueError('copernicus_dimensions_invalid')
                if key == 'currents' and ('depth' not in ds.coords or ds.sizes.get('depth') != 1):
                    raise ValueError('copernicus_depth_invalid')
                lat, lon = float(ds.latitude.values[0]), float(ds.longitude.values[0])
                depth = float(ds.depth.values[0]) if 'depth' in ds.coords else None
                for variable in variables:
                    if ds[variable].attrs.get('units') != unit:
                        raise ValueError('copernicus_units_invalid')
                ds.load()
                rows = []
                for i, time in enumerate(ds.time.values):
                    row = {'validAt': np.datetime_as_string(time, unit='s') + 'Z'}
                    for variable in variables:
                        value = float(ds[variable].isel(time=i).values.item())
                        row[variable] = value if math.isfinite(value) else None
                    rows.append(row)
                products[key] = {'datasetId': dataset_id, 'latitude': lat, 'longitude': lon,
                    'depthM': depth, 'units': {v: unit for v in variables}, 'rows': rows}
            finally:
                ds.close()
    return {'productId': PRODUCT, 'fetchedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'products': products}

if __name__ == '__main__':
    try:
        print(json.dumps(collect(), allow_nan=False, separators=(',', ':')))
    except Exception as error:
        code = str(error) if isinstance(error, ValueError) and str(error).startswith('copernicus_') else 'copernicus_collection_failed'
        print(json.dumps({'errorCode': code}))
        sys.exit(1)
