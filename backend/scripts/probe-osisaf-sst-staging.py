#!/usr/bin/env python3
"""OSI SAF OSI-207-c one-shot numeric probe; never serves customer data.

The public HTTPS location is from the EUMETSAT OSI SAF official product page.
No credentials, third-party maps, GPS, redirects or background polling.
If the HTTPS service denies access or NetCDF quality cannot be verified,
the answer is UNAVAILABLE, not a sea temperature.
"""
from __future__ import annotations
import json, sys, re, urllib.request, urllib.error
from pathlib import Path
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

ROOT="https://osi-saf.ifremer.fr/sst/l3c/west_atlantic_east_pacific/"
PROVIDER="EUMETSAT_OSI_SAF_OSI_207_C"
LAT,LON=-23.5,-42.5
MAX_INDEX=180_000
MAX_FILE=32*1024*1024

class LinkReader(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":
            for k,v in attrs:
                if k=="href" and v:self.links.append(v)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("REDIRECT_DISALLOWED")

def limited_get(url,limit):
    info=urlsplit(url)
    if info.scheme!="https" or info.hostname!="osi-saf.ifremer.fr" or        not info.path.startswith("/sst/l3c/west_atlantic_east_pacific/"):
        raise ValueError("SOURCE_HOST_NOT_ALLOWED")
    opener=urllib.request.build_opener(NoRedirect)
    req=urllib.request.Request(url,headers={
        "Accept":"text/html,application/x-netcdf,application/octet-stream",
        "User-Agent":"BlaiseV6RJ-Staging-Validation/6.0 (public scientific validation)"
    })
    with opener.open(req,timeout=15) as response:
        n=response.headers.get("Content-Length")
        if n and int(n)>limit:raise ValueError("FILE_TOO_LARGE")
        data=response.read(limit+1)
        if len(data)>limit:raise ValueError("FILE_TOO_LARGE")
        return data

def pick_recent_netcdf(checked_at):
    current=ROOT;seen=set()
    # Navigate a bounded directory structure, never crawl arbitrary websites.
    for depth in range(5):
        if current in seen:break
        seen.add(current)
        page=limited_get(current,MAX_INDEX).decode("utf-8","replace")
        links=LinkReader();links.feed(page)
        files=[];dirs=[]
        for href in links.links:
            if href.startswith(("../","?","#","http:","https:")):continue
            full=urljoin(current,href)
            if not full.startswith(ROOT):continue
            name=href.rstrip("/").split("/")[-1]
            if href.lower().endswith((".nc",".nc4")) and re.search(r"20\d{6}",name):
                files.append((name,full))
            elif href.endswith("/") and re.fullmatch(r"(20\d{2}|\d{2}|\d{4}|\d{8})",name):
                dirs.append((name,full))
        if files:
            # Restrict to recent candidate files, never assume they are current.
            files.sort(reverse=True)
            for name,url in files:
                date=re.search(r"20\d{6}",name)
                if date:
                    age=(checked_at-datetime.strptime(date.group(),"%Y%m%d").replace(tzinfo=timezone.utc)).total_seconds()
                    if -86400<age<3*86400:return url
            return None
        if not dirs:return None
        dirs.sort(reverse=True)
        # Do not automatically descend into years far in the past.
        current=dirs[0][1]
    return None

def decode_sst(path,at):
    try:
        import netCDF4 as nc
        import numpy as np
    except ImportError:
        raise ValueError("NETCDF_DECODER_NOT_INSTALLED")
    with nc.Dataset(str(path),"r") as ds:
        variables=ds.variables
        latname=next((x for x in ("lat","latitude") if x in variables),None)
        lonname=next((x for x in ("lon","longitude") if x in variables),None)
        sstname=next((x for x in ("sea_surface_temperature","analysed_sst","sst") if x in variables),None)
        qname=next((x for x in ("quality_level","quality_flag") if x in variables),None)
        if not all((latname,lonname,sstname,qname)) or "time" not in variables:
            raise ValueError("SST_QA_OR_COORDINATES_ABSENT")
        lats=np.asarray(variables[latname][:])
        lons=np.asarray(variables[lonname][:])
        if lats.ndim!=1 or lons.ndim!=1:
            raise ValueError("COMPLEX_SATELLITE_GRID_REQUIRES_SEPARATE_VALIDATION")
        ilat=int(np.argmin(np.abs(lats-LAT)))
        ilon=int(np.argmin(np.abs(((lons-LON+180)%360)-180)))
        actual_lat=float(lats[ilat])
        actual_lon=float(((lons[ilon]+180)%360)-180)
        if abs(actual_lat-LAT)>0.11 or abs(actual_lon-LON)>0.11:
            raise ValueError("OFFSHORE_CELL_TOO_DISTANT")
        sst=variables[sstname]
        quality=variables[qname]
        # Dimension names must allow a single point/sample, never download full raster.
        def sample(var):
            axes=var.dimensions
            if not all(d in ("time",latname,lonname,"lat","lon","latitude","longitude") for d in axes):
                raise ValueError("UNKNOWN_NETCDF_GRID_AXES")
            index=tuple(0 if d=="time" else ilat if d in ("lat","latitude") else ilon for d in axes)
            return var[index]
        q=sample(quality)
        if np.ma.is_masked(q) or not np.isfinite(q) or float(q)<4:
            raise ValueError("SST_LOW_QUALITY_OR_MISSING")
        v=sample(sst)
        if np.ma.is_masked(v) or not np.isfinite(v):
            raise ValueError("SST_VALUE_MISSING")
        unit=str(getattr(sst,"units","")).lower()
        measured=float(v)
        if unit in ("k","kelvin","degrees_kelvin"):c=measured-273.15
        elif unit in ("c","degree_celsius","degrees_celsius","celsius"):c=measured
        else:raise ValueError("SST_UNSUPPORTED_UNITS")
        if not -3<=c<=40:raise ValueError("SST_OUT_OF_RANGE")
        t=variables["time"]
        dt=nc.num2date(t[0],t.units,calendar=getattr(t,"calendar","standard"))
        if not hasattr(dt,"year"):raise ValueError("NETCDF_TIME_MISSING")
        valid_time=datetime(dt.year,dt.month,dt.day,dt.hour,dt.minute,dt.second,tzinfo=timezone.utc)
        delta=(at-valid_time).total_seconds()
        if delta<0 or delta>12*3600:raise ValueError("SST_TIME_EXPIRED_OR_FUTURE")
        return {"status":"SST_SATELLITE_CELL_VALIDATED",
          "valueC":round(c,2),"unit":"°C","kind":"E",
          "validAt":valid_time.isoformat().replace("+00:00","Z"),
          "qaLevel":int(q),"actualLatitude":actual_lat,"actualLongitude":actual_lon}

def execute():
    now=datetime.now(timezone.utc)
    base={"contract":"BLAISE_OSI_207C_STAGING_EVIDENCE_V1","sourceId":PROVIDER,
      "checkedAt":now.isoformat().replace("+00:00","Z"),
      "status":"UNAVAILABLE","valueC":None,
      "sourceUrl":ROOT,"publishedToAndroid":False,"productionChanged":False,
      "officialObservation":False,"officialAlert":False}
    try:
        url=pick_recent_netcdf(now)
        if not url:raise ValueError("RECENT_NETCDF_FILE_NOT_DISCOVERABLE")
        raw=limited_get(url,MAX_FILE)
        if raw[:4]!=b"\x89HDF" and raw[:3]!=b"CDF":
            raise ValueError("DOWNLOAD_NOT_NETCDF")
        import tempfile
        with tempfile.TemporaryDirectory(prefix="blaise-osisaf-") as directory:
            target=Path(directory)/"osi-207-c.nc"
            target.write_bytes(raw)
            fields=decode_sst(target,now)
        base.update(fields)
        base["sourceUrl"]=url
    except Exception as exc:
        base["reason"]=type(exc).__name__+":"+str(exc)[:100]
    return base

if __name__=="__main__":
    if "--live" not in sys.argv:
        print("--live required; no OSI SAF request",file=sys.stderr)
        raise SystemExit(2)
    record=execute()
    dest=Path(__file__).resolve().parents[2]/"evidence"/"international-sources"
    dest.mkdir(parents=True,exist_ok=True)
    (dest/"osi-saf-sst-staging.json").write_text(
      json.dumps(record,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("BLAISE_OSISAF_STAGING_RESULT="+json.dumps(record,separators=(",",":")))
