import json, re, sys, uuid
source, destination = sys.argv[1:]
components = {}
pattern = re.compile(r"--- ([\w.\-]+):([\w.\-]+):([\w.\-]+)")
for line in open(source, encoding="utf-8"):
    match = pattern.search(line)
    if match:
        group, name, version = match.groups()
        purl = f"pkg:maven/{group}/{name}@{version}"
        components[purl] = {"type": "library", "group": group, "name": name, "version": version, "purl": purl}
bom = {
    "bomFormat": "CycloneDX", "specVersion": "1.5", "version": 1,
    "serialNumber": "urn:uuid:" + str(uuid.uuid5(uuid.NAMESPACE_URL, "https://github.com/gabilinsj-cyber/Blaise-")),
    "metadata": {"component": {"type": "application", "name": "Blaise V6 RJ", "version": "6.0.0-rc.1"}},
    "components": sorted(components.values(), key=lambda c: c["purl"]),
}
with open(destination, "w", encoding="utf-8") as target:
    json.dump(bom, target, ensure_ascii=False, indent=2)
