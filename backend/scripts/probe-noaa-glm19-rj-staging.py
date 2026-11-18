#!/usr/bin/env python3
"""One-shot REAL NOAA GOES-19 GLM lightning sample for Rio de Janeiro.

Official NOAA Open Data Dissemination bucket, no AWS account or API key.
A single LCFA NetCDF covers about 20s; flashes are satellite optical
detections, NOT guaranteed cloud-to-ground strikes, risk alerts or 92 city
station observations. No persistent collection or app publication.
"""
from __future__ import annotations
from datetime import datetime,timezone,timedelta
from pathlib import Path
import json
import re
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET

S3="https://noaa-goes19.s3.amazonaws.com/"
PREFIX="GLM-L2-LCFA"
BOX=dict(minLat=-24.5,maxLat=-20.5,minLon=-45.5,maxLon=-40.5)
KEY_PATTERN=re.compile(
 r"^GLM-L2-LCFA/(?P<year>20\d{2})/(?P<doy>\d{3})/(?P<hour>\d{2})/"
 r"OR_GLM-L2-LCFA_G19_s(?P<stamp>20\d{11})\d{1,4}_e20\d{11}\d{1,4}_c20\d{11}\d{1,4}\.nc$"
)
MAX_LIST=650_000
MAX_FILE=14*1024*1024
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("NOAA_GLM_REDIRECT_BLOCKED")

def get_https(url,cap,fetch=None):
    if not url.startswith(S3) or "@" in url or "#" in url:
        raise ValueError("NOAA_GLM_HOST_NOT_ALLOWED")
    if fetch:return fetch(url)
    handler=urllib.request.build_opener(NoRedirect)
    request=urllib.request.Request(url,headers={
        "Accept":"application/xml,application/x-netcdf,application/octet-stream",
        "User-Agent":"BlaiseV6RJ-ScientificGLM-Staging/6.0"})
    with handler.open(request,timeout=18) as resp:
        size=resp.headers.get("Content-Length")
        if size and int(size)>cap:raise ValueError("NOAA_GLM_DOWNLOAD_TOO_LARGE")
        body=resp.read(cap+1)
        if len(body)>cap:raise ValueError("NOAA_GLM_DOWNLOAD_TOO_LARGE")
        return body

def list_url(hour):
    if not isinstance(hour,datetime) or hour.tzinfo is None:
        raise ValueError("NOAA_GLM_CLOCK_REQUIRED")
    prefix=f"{PREFIX}/{hour.year:04d}/{hour.timetuple().tm_yday:03d}/{hour.hour:02d}/"
    from urllib.parse import urlencode
    return S3+"?"+urlencode({"list-type":"2","prefix":prefix,"max-keys":"600"})

def parse_s3_glm_keys(xml,now):
    if not isinstance(xml,bytes) or len(xml)>MAX_LIST:
        raise ValueError("NOAA_GLM_S3_XML_INVALID")
    root=ET.fromstring(xml)
    found=[]
    for x in root.iter():
        if x.tag.split("}")[-1]!="Key" or not x.text:continue
        key=x.text
        m=KEY_PATTERN.fullmatch(key)
        if not m:continue
        try:
            t=datetime.strptime(m["stamp"],"%Y%j%H%M%S").replace(tzinfo=timezone.utc)
        except ValueError:continue
        expected=f"{PREFIX}/{t.year:04d}/{t.timetuple().tm_yday:03d}/{t.hour:02d}/"
        if not key.startswith(expected):continue
        age=(now-t).total_seconds()
        if 0<=age<=35*60:found.append((t,key))
    return sorted(found,reverse=True)

def find_latest_glm_key(now,fetch=None):
    hour=now.replace(minute=0,second=0,microsecond=0)
    choices=[]
    for at in (hour,hour-timedelta(hours=1)):
        try:
            xml=get_https(list_url(at),MAX_LIST,fetch)
            choices.extend(parse_s3_glm_keys(xml,now))
        except Exception:
            # Do not silently call another data provider.
            pass
    return max(choices,default=(None,None))[1]

def decode_glm_sample(path):
    import netCDF4 as nc
    import numpy as np
    with nc.Dataset(str(path),"r") as ds:
        vars=ds.variables
        if "flash_lat" not in vars or "flash_lon" not in vars:
            raise ValueError("NOAA_GLM_FLASH_COORDS_MISSING")
        lat=vars["flash_lat"][:]
        lon=vars["flash_lon"][:]
        if len(lat)!=len(lon) or len(lat)>500000:
            raise ValueError("NOAA_GLM_FLASH_COUNT_OR_LENGTH_INVALID")
        la=np.ma.filled(lat,np.nan)
        lo=np.ma.filled(lon,np.nan)
        valid=np.isfinite(la)&np.isfinite(lo)&(la>=-90)&(la<=90)&(lo>=-180)&(lo<=180)
        box=valid&(la>=BOX["minLat"])&(la<=BOX["maxLat"])&(
            lo>=BOX["minLon"])&(lo<=BOX["maxLon"])
        return dict(validFlashesInSingleFile=int(np.count_nonzero(valid)),
                    rjRectangleFlashesInSingleFile=int(np.count_nonzero(box)))

def probe_noaa_glm(*,now=None,find=None,download=None,decode=None):
    at=now or datetime.now(timezone.utc)
    out=dict(contract="BLAISE_NOAA_GLM19_RJ_ONE_FILE_STAGING_V1",
        status="UNAVAILABLE",sourceId="NOAA_GLM",kind="O",
        satellite="GOES19",productId="GLM-L2-LCFA",
        checkedAt=at.isoformat().replace("+00:00","Z"),
        validAt=None,sourceUrl=S3,area=BOX,
        rjRectangleFlashesInSingleFile=None,
        validFlashesInSingleFile=None,
        physicalGroundStrikesMeasured=False,
        municipalFlashesValidated=False,officialAlert=False,
        publishableWarning=False,publishedToSubscribers=False,
        automaticCollection=False)
    try:
        get_key=find or find_latest_glm_key
        key=get_key(at)
        if not key:raise ValueError("NOAA_GLM_CURRENT_FILE_NOT_FOUND")
        match=KEY_PATTERN.fullmatch(key)
        if not match:raise ValueError("NOAA_GLM_BAD_FILENAME")
        t=datetime.strptime(match["stamp"],"%Y%j%H%M%S").replace(tzinfo=timezone.utc)
        if not 0<=(at-t).total_seconds()<=35*60:
            raise ValueError("NOAA_GLM_STALE_FILE")
        url=S3+key
        data=(download or (lambda u:get_https(u,MAX_FILE)))(url)
        if not isinstance(data,bytes) or len(data)<100 or not (
            data.startswith(b"\x89HDF") or data.startswith(b"CDF")):
            raise ValueError("NOAA_GLM_INVALID_NETCDF")
        with tempfile.TemporaryDirectory(prefix="blaise-noaa-glm-") as folder:
            file=Path(folder)/"goes19-glm.nc"
            file.write_bytes(data)
            sample=(decode or decode_glm_sample)(file)
        count=sample.get("rjRectangleFlashesInSingleFile")
        allflashes=sample.get("validFlashesInSingleFile")
        if type(count)!=int or type(allflashes)!=int or count<0 or count>allflashes:
            raise ValueError("NOAA_GLM_FLASH_VALUES_INVALID")
        out.update(status="VALIDATED_ONE_FILE",sourceUrl=url,
            validAt=t.isoformat().replace("+00:00","Z"),
            rjRectangleFlashesInSingleFile=count,
            validFlashesInSingleFile=allflashes)
    except Exception as exc:
        out["reason"]=type(exc).__name__+":"+str(exc)[:120]
    return out

if __name__=="__main__":
    if "--live" not in sys.argv:
        raise SystemExit("--live required; no automatic GLM source polling")
    outcome=probe_noaa_glm()
    dest=Path(__file__).resolve().parents[2]/"evidence"/"international-sources"
    dest.mkdir(parents=True,exist_ok=True)
    (dest/"noaa-goes19-glm-rj-one-file.json").write_text(
        json.dumps(outcome,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("BLAISE_NOAA_GLM19_RJ_STAGING="+json.dumps(outcome,separators=(",",":")))
