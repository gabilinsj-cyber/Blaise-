#!/usr/bin/env python3
"""Official NOAA CoastWatch/ACSPO GOES-19 L3C GHRSST SST: three RJ ocean cells.

Fallback for inaccessible EUMETSAT OSI-207-c. Same GOES-19 satellite family,
different NOAA/STAR processing; NOT an independent observation sensor.
One recent public NOAA NetCDF file maximum, no paid services or publication.
"""
from __future__ import annotations
import importlib.util
from datetime import datetime,timezone,timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlsplit
import json
import re
import sys
import urllib.request
import tempfile

CURRENT_DIR=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("osi_coastal_reader",
    CURRENT_DIR/"probe-osisaf-sst-rj-staging.py")
osi=importlib.util.module_from_spec(spec)
spec.loader.exec_module(osi)
ROOT="https://coastwatch.noaa.gov/data/pub0014/coastwatch/sst/nrt/abi/g19/l3c/"
MAX_HTML=160_000
MAX_NETCDF=80*1024*1024
ID="NOAA_COASTWATCH_SST"
POINTS=osi.POINTS
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):
        raise ValueError("NOAA_REDIRECT_DISALLOWED")
class Links(HTMLParser):
    def __init__(self):
        super().__init__();self.refs=[]
    def handle_starttag(self,tag,attrs):
        if tag.lower()=="a":
            for key,value in attrs:
                if key.lower()=="href" and value:self.refs.append(value)

def allowed(url,*,file=False):
    p=urlsplit(url)
    return (p.scheme=="https" and p.hostname=="coastwatch.noaa.gov"
        and p.path.startswith("/data/pub0014/coastwatch/sst/nrt/abi/g19/l3c/")
        and not p.username and not p.password and not p.query and not p.fragment
        and (p.path.lower().endswith(".nc") if file else p.path.endswith("/")))

def bounded_get(url,cap):
    if not allowed(url,file=url.lower().endswith(".nc")):
        raise ValueError("NOAA_SST_URL_NOT_ALLOWLISTED")
    req=urllib.request.Request(url,headers={
        "User-Agent":"BlaiseV6RJ-ScientificStaging/6.0",
        "Accept":"text/html,application/x-netcdf,application/octet-stream"})
    client=urllib.request.build_opener(NoRedirect)
    with client.open(req,timeout=15) as stream:
        length=stream.headers.get("Content-Length")
        if length and int(length)>cap:raise ValueError("NOAA_SST_PAYLOAD_TOO_LARGE")
        body=stream.read(cap+1)
        if len(body)>cap:raise ValueError("NOAA_SST_PAYLOAD_TOO_LARGE")
        return body

def recent_filename_date(name):
    match=re.match(r"^(20\d{12})-STAR-L3C_GHRSST-.*-ABI_G19-ACSPO_.*\.nc$",name)
    if not match:return None
    try:
        return datetime.strptime(match.group(1),"%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
    except ValueError:return None

def choose_latest_noaa_sst(now=None,fetch_html=None):
    now=now or datetime.now(timezone.utc)
    get=fetch_html or (lambda u:bounded_get(u,MAX_HTML).decode("utf-8","replace"))
    # Follow a strictly bounded date directory tree. Never crawl other hosts.
    current=ROOT
    for depth in range(6):
        page=get(current)
        if not isinstance(page,str) or len(page)>MAX_HTML:
            raise ValueError("NOAA_SST_LISTING_BAD")
        parser=Links();parser.feed(page)
        names=[]
        for href in parser.refs:
            if href.startswith(("?","#","../","http:","https:")):continue
            link=urljoin(current,href)
            if link!=current and not link.startswith(ROOT):continue
            names.append((href,link))
        possible=[]
        directories=[]
        for href,link in names:
            if href.lower().endswith(".nc") and allowed(link,file=True):
                when=recent_filename_date(href)
                if when and timedelta(0)<=now-when<=timedelta(hours=12):
                    possible.append((when,link))
            elif href.endswith("/") and allowed(link) and re.fullmatch(
                r"(?:20\d{2}|\d{1,2}|\d{3}|\d{8})/",href):
                directory=href[:-1]
                directories.append((directory,link))
        if possible:return max(possible,key=lambda row:row[0])[1]
        if not directories:return None
        # Prefer path components matching current date; no historical loops.
        current=max(directories,key=lambda row:int(row[0]))[1]
    return None

def probe_noaa_coastwatch_sst(*,now=None,discovery=None,download=None,decode=None):
    at=now or datetime.now(timezone.utc)
    record=dict(contract="BLAISE_NOAA_ACSPO_G19_RJ_SST_OFFSHORE_V1",
        sourceId=ID,productId="GOES19_ABI_ACSPO_L3C",
        satelliteFamily="GOES19_ABI",underlyingSensorIndependentOfEumetsat=False,
        kind="E",checkedAt=at.isoformat().replace("+00:00","Z"),
        status="UNAVAILABLE",verifiedPoints=0,expectedPoints=3,
        validAt=None,points=[],sourceUrl=ROOT,
        officialObservation=False,airTemperatureMeasurements=0,
        publishedToAndroid=False,publishedToSubscriber=False,automaticCollection=False,
        attribution="NOAA CoastWatch / NOAA STAR ACSPO")
    try:
        pick=discovery or choose_latest_noaa_sst
        url=pick(at)
        if not url or not allowed(url,file=True):
            raise ValueError("NOAA_COASTWATCH_RECENT_L3C_FILE_MISSING")
        get=download or (lambda u:bounded_get(u,MAX_NETCDF))
        raw=get(url)
        if not isinstance(raw,bytes) or len(raw)<100 or not (raw.startswith(b"\x89HDF") or raw.startswith(b"CDF")):
            raise ValueError("NOAA_COASTWATCH_NOT_NETCDF")
        with tempfile.TemporaryDirectory(prefix="blaise-noaa-acspo-rj-") as folder:
            file=Path(folder)/"coastwatch-g19-l3c.nc"
            file.write_bytes(raw)
            reader=decode or osi.decode_rj_osi_saf_sst
            result=reader(file,now=at)
        t=datetime.fromisoformat(result["validAt"].replace("Z","+00:00"))
        if not 0 <= (at-t).total_seconds() <= 12*3600:
            raise ValueError("NOAA_COASTWATCH_SST_STALE")
        pts=result["points"]
        if len(pts)!=3 or any(p["id"]!=expected["id"] or
            p["latitude"]!=expected["latitude"] or
            p["longitude"]!=expected["longitude"]
            for p,expected in zip(pts,POINTS)):
            raise ValueError("NOAA_COASTWATCH_POINT_MISMATCH")
        # NOAA ACSPO specifies ONLY confidently clear pixels (= QA level 5).
        for p in pts:
            if p.get("qualityLevel")!=5:
                p["temperatureC"]=None;p["qualityLevel"]=None
        good=sum(p.get("temperatureC") is not None and -3<=p["temperatureC"]<=40
            for p in pts)
        record.update(status="FULL" if good==3 else "PARTIAL" if good else "UNAVAILABLE",
            verifiedPoints=good,sourceUrl=url,validAt=result["validAt"],
            points=pts,qualityThreshold=5,gridType=result.get("gridType"))
        if not good:record["reason"]="NOAA_ACSPO_NO_CONFIDENTLY_CLEAR_COASTAL_PIXEL"
    except Exception as exc:
        record["reason"]=type(exc).__name__+":"+str(exc)[:130]
    return record

if __name__=="__main__":
    if "--live" not in sys.argv:raise SystemExit("--live required")
    outcome=probe_noaa_coastwatch_sst()
    directory=CURRENT_DIR.parents[1]/"evidence"/"international-sources"
    directory.mkdir(parents=True,exist_ok=True)
    (directory/"noaa-coastwatch-acspo-rj-sst.json").write_text(
        json.dumps(outcome,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
    print("BLAISE_NOAA_COASTWATCH_SST_REAL="+json.dumps({
        "state":outcome["status"],"verified":outcome["verifiedPoints"],
        "validAt":outcome["validAt"],"sourceUrl":outcome["sourceUrl"],
        "reason":outcome.get("reason"),"category":"E",
        "publishedToSubscriber":False},separators=(",",":")))
