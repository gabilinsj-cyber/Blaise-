#!/usr/bin/env python3
"""Shared NOAA-only GOES-19 ACSPO GHRSST L3C reader; no EUMETSAT dependency.

Strictly bounded coast pixel extraction for scientific staging only.
The SST dataset must provide valid 1D latitude, longitude, time and
quality_level=5. Some NOAA files have other geometries: fail closed.
"""
from __future__ import annotations
from datetime import datetime, timezone
import math
POINTS=(
    {"id":"ILHA_GRANDE_OFFSHORE","latitude":-23.4,"longitude":-44.5},
    {"id":"RIO_OFFSHORE","latitude":-23.5,"longitude":-43.25},
    {"id":"CABO_FRIO_OFFSHORE","latitude":-23.25,"longitude":-42.0}
)
def decode_noaa_acspo_sst(file,*,now=None):
    import numpy as np
    import netCDF4 as nc
    at=now or datetime.now(timezone.utc)
    with nc.Dataset(str(file),"r") as ds:
        vars=ds.variables
        latname=next((n for n in ("lat","latitude") if n in vars),None)
        lonname=next((n for n in ("lon","longitude") if n in vars),None)
        sstname=next((n for n in ("sea_surface_temperature","analysed_sst","sst") if n in vars),None)
        qaname=next((n for n in ("quality_level","quality_flag") if n in vars),None)
        if not all((latname,lonname,sstname,qaname)) or "time" not in vars:
            raise ValueError("NOAA_SST_COORD_TIME_QUALITY_MISSING")
        lat=np.asarray(vars[latname][:])
        lon=np.asarray(vars[lonname][:])
        if lat.ndim!=1 or lon.ndim!=1 or lat.size<2 or lon.size<2:
            raise ValueError("NOAA_SST_NONRECTILINEAR_GRID")
        time=vars["time"]
        if len(time)!=1 or not hasattr(time,"units"):
            raise ValueError("NOAA_SST_TIME_AXIS_UNVERIFIED")
        stamp=nc.num2date(time[0],time.units,
            calendar=getattr(time,"calendar","standard"))
        if not hasattr(stamp,"year"):
            raise ValueError("NOAA_SST_DATE_MISSING")
        valid=datetime(stamp.year,stamp.month,stamp.day,stamp.hour,
            stamp.minute,stamp.second,tzinfo=timezone.utc)
        if not 0<=(at-valid).total_seconds()<=12*3600:
            raise ValueError("NOAA_SST_STALE_OR_FUTURE")
        sst=vars[sstname];qa=vars[qaname]
        units=str(getattr(sst,"units","")).lower()
        if units in ("k","kelvin","degrees_kelvin"):
            offset=-273.15
        elif units in ("c","celsius","degree_celsius","degrees_celsius"):
            offset=0
        else:
            raise ValueError("NOAA_SST_UNKNOWN_UNITS")
        def sample(v,i,j):
            dims=v.dimensions
            if len(dims) not in (2,3) or latname not in dims or lonname not in dims or any(
                d not in ("time",latname,lonname) for d in dims):
                raise ValueError("NOAA_SST_WRONG_DIMENSIONS")
            return v[tuple(0 if d=="time" else i if d==latname else j for d in dims)]
        result=[]
        for p in POINTS:
            i=int(np.argmin(np.abs(lat-p["latitude"])))
            j=int(np.argmin(np.abs(((lon-p["longitude"]+180)%360)-180)))
            latitude=float(lat[i])
            longitude=float(((lon[j]+180)%360)-180)
            row={"id":p["id"],"latitude":p["latitude"],
                 "longitude":p["longitude"],"dataLatitude":latitude,
                 "dataLongitude":longitude,"temperatureC":None,"qualityLevel":None}
            if abs(latitude-p["latitude"])<=0.075 and abs(longitude-p["longitude"])<=0.075:
                value=sample(sst,i,j)
                q=sample(qa,i,j)
                if (not np.ma.is_masked(value) and not np.ma.is_masked(q)
                    and np.isfinite(value) and np.isfinite(q) and int(q)==5):
                    c=float(value)+offset
                    if math.isfinite(c) and -3<=c<=40:
                        row["temperatureC"]=round(c,2)
                        row["qualityLevel"]=5
            result.append(row)
        return {"validAt":valid.isoformat().replace("+00:00","Z"),
                "points":result,"gridType":"GHRSST_L3C_1D_LATLON"}
