"""Cross-platform entry point; dependencies stay inside the project's .tools directory."""
import os
import subprocess
import sys
import venv
from pathlib import Path

root = Path(__file__).resolve().parents[1]
environment = root / '.tools' / 'data-env'
runtime = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
if not runtime.exists():
    print('Creating isolated NBA data environment…', flush=True)
    venv.create(environment, with_pip=True)
check = subprocess.run([str(runtime), '-c', 'import nba_api'], capture_output=True)
if check.returncode:
    subprocess.run([str(runtime), '-m', 'pip', 'install', '-r', str(root / 'scripts' / 'requirements.txt')], check=True)
raise SystemExit(subprocess.call([str(runtime), str(root / 'scripts' / 'nba_data.py'), *sys.argv[1:]], cwd=root))
