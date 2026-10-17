"""Local operator preflight. Hidden password; no persistence or chat transmission."""
import getpass
import os
from pathlib import Path
import subprocess
import sys

env = os.environ.copy()
env['COPERNICUSMARINE_SERVICE_USERNAME'] = input('Usuário Copernicus Marine [gabi]: ').strip() or 'gabi'
while True:
    password = getpass.getpass('Senha Copernicus (oculta, não salva): ')
    if password:
        env['COPERNICUSMARINE_SERVICE_PASSWORD'] = password
        break
    print('Senha vazia. Digite a senha no terminal; não envie ao chat.', flush=True)
env['BLAISE_COPERNICUS_PYTHON'] = sys.executable
try:
    result = subprocess.run(['node', str(Path(__file__).with_name('verify-copernicus-rj.mjs'))], env=env, timeout=65, check=False)
    sys.exit(result.returncode)
finally:
    env.pop('COPERNICUSMARINE_SERVICE_PASSWORD', None)
