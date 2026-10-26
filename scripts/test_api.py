import os
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
runtime = (
    root
    / ".tools/data-env"
    / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)
raise SystemExit(
    subprocess.call(
        [
            str(runtime) if runtime.exists() else sys.executable,
            "-m",
            "unittest",
            "discover",
            "-s",
            "tests",
            "-p",
            "test_*api*.py",
        ],
        cwd=root,
    )
)
