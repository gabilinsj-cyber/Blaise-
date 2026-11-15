#!/usr/bin/env python3
"""Safely stage a disabled Agent 13 route in an existing Blaise RJ runtime.

Nothing is imported/executed from runtime; no credentials are read. Preserves
other local edits. Requires a known single import and server anchor.
"""
from __future__ import annotations
import argparse
import os
import re
import stat
import tempfile
from pathlib import Path

IMPORT_LINE = "import { createRjAgent13OperatorHttpHandler } from './rj-agent13-operator-http.mjs';"
IMPORT_REF = './rj-agent13-operator-http.mjs'
IMP_ANCHOR = re.compile(r"""(?m)^.*\bfrom\s+['"]\./rj-source-readiness\.mjs['"]\s*;[ \t]*$""")
SERVER = re.compile(
    r"(?m)^(?P<indent>[ \t]*)const[ \t]+server[ \t]*=[ \t]*"
    r"http\.createServer\(\s*createDrainingHandler\(\s*"
    r"(?P<handler>[A-Za-z_$][\w$]*)\s*,\s*readiness\s*\)\s*\)\s*;"
)
HTTP_IMPORT_ANCHOR = re.compile(r"""(?m)^import\s+http\s+from\s+['"]node:http['"]\s*;?[ \t]*$""")
SERVER_DIRECT = re.compile(
    r"(?m)^(?P<indent>[ \t]*)const[ \t]+server[ \t]*=[ \t]*"
    r"http\.createServer\(\s*(?P<handler>[A-Za-z_$][\w$]*)\s*\)\s*;"
)
STAGED_NAME = 'agent13OperatorHandler'

def prepare(source: str) -> tuple[str, str]:
    # Existing custom / partial Agent 13 wiring must be reviewed, not replaced.
    if 'createRjAgent13OperatorHttpHandler' in source or IMPORT_REF in source:
        staged_servers = list(SERVER.finditer(source)) + list(SERVER_DIRECT.finditer(source))
        if (re.search(r'\bconst\s+agent13OperatorHandler\s*=\s*createRjAgent13OperatorHttpHandler\s*\(', source)
                and len(staged_servers) == 1 and staged_servers[0].group('handler') == STAGED_NAME):
            if re.search(r'\bverifyOperatorOidc:\s*null\b', source) and re.search(r'\bagent13:\s*null\b', source):
                return source, 'ALREADY_STAGED_DISABLED'
        raise ValueError('EXISTING_AGENT13_WIRING_REQUIRES_MANUAL_REVIEW')

    anchors = list(IMP_ANCHOR.finditer(source))
    anchor_kind = 'readiness'
    if len(anchors) != 1:
        # Some local runtimes do not import rj-source-readiness.
        anchors = list(HTTP_IMPORT_ANCHOR.finditer(source))
        anchor_kind = 'http'
    if len(anchors) != 1:
        raise ValueError(f'KNOWN_IMPORT_ANCHORS_{len(anchors)}_EXPECTED_1')
    draining = list(SERVER.finditer(source))
    direct = list(SERVER_DIRECT.finditer(source))
    if len(draining) + len(direct) != 1:
        raise ValueError(f'HTTP_SERVER_ANCHORS_{len(draining)+len(direct)}_EXPECTED_1')
    is_draining = len(draining) == 1
    match = draining[0] if is_draining else direct[0]
    indent, upstream = match.group('indent', 'handler')
    if upstream == STAGED_NAME:
        raise ValueError('ALREADY_STAGED_PARTIAL_NO_IMPORT')
    if not re.search(r'\bconst\s+' + re.escape(upstream) + r'\s*=', source):
        raise ValueError('UPSTREAM_HANDLER_NOT_DECLARED')
    # Match the exact variable `server`, not `serverShutdown` or `serverPort`.
    # The previous substring count rejected otherwise valid runtimes.
    exact_declarations = re.findall(r'(?m)^[ \t]*const[ \t]+server[ \t]*=', source)
    if len(exact_declarations) != 1:
        raise ValueError(f'AMBIGUOUS_SERVER_DECLARATIONS_{len(exact_declarations)}')
    replacement = (
        f'{indent}// Staged only; no operator verifier or collector wired.\n'
        f'{indent}const {STAGED_NAME} = createRjAgent13OperatorHttpHandler(\n'
        f'{indent}  {upstream}, {{\n'
        f'{indent}    agent13: null,\n'
        f'{indent}    verifyOperatorOidc: null,\n'
        f'{indent}  }},\n'
        f'{indent});\n'
        + (f'{indent}const server = http.createServer(createDrainingHandler({STAGED_NAME}, readiness));'
           if is_draining else
           f'{indent}const server = http.createServer({STAGED_NAME});')
    )
    modified = source[:match.start()] + replacement + source[match.end():]
    anchor_re = IMP_ANCHOR if anchor_kind == 'readiness' else HTTP_IMPORT_ANCHOR
    m = anchor_re.search(modified)
    if not m:
        raise ValueError('IMPORT_ANCHOR_LOST')
    modified = modified[:m.end()] + '\n' + IMPORT_LINE + modified[m.end():]
    if modified.count(IMPORT_LINE) != 1 or modified.count('const agent13OperatorHandler') != 1:
        raise ValueError('PATCH_POSTCONDITION_FAILED')
    return modified, f'STAGING_READY_WITH_UPSTREAM_{upstream}'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('runtime', type=Path)
    p.add_argument('--apply', action='store_true')
    args = p.parse_args()
    path = args.runtime
    if not path.is_file():
        raise SystemExit('RUNTIME_NOT_FOUND')
    original = path.read_text(encoding='utf-8')
    try:
        new, result = prepare(original)
    except ValueError as exc:
        raise SystemExit('STOPPED_UNCHANGED: ' + str(exc))
    if not args.apply or new == original:
        print('DRY_RUN' if not args.apply else 'NO_CHANGE', result)
        return
    fd, temp = tempfile.mkstemp(prefix='.agent13-runtime-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            stream.write(new)
        os.chmod(temp, stat.S_IMODE(path.stat().st_mode))
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)
    print('APPLIED_DISABLED_AGENT13_ROUTE', result)

if __name__ == '__main__':
    main()
