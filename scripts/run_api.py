"""Start the API with isolated dependencies on Windows, macOS and Linux."""

import os
import subprocess
import sys
import venv
from pathlib import Path

root = Path(__file__).resolve().parents[1]
environment = root / ".tools/data-env"
runtime = environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
if not runtime.exists():
    venv.create(environment, with_pip=True)
check = subprocess.run(
    [str(runtime), "-c", "import fastapi, sqlalchemy, alembic, uvicorn, nba_api"],
    capture_output=True,
)
if check.returncode:
    subprocess.run(
        [
            str(runtime),
            "-m",
            "pip",
            "install",
            "-r",
            str(root / "services/api/requirements.txt"),
        ],
        check=True,
    )
    verified = subprocess.run(
        [str(runtime), "-c", "import sqlalchemy"], capture_output=True, text=True
    )
    if verified.returncode and "Application Control" in verified.stderr:
        print(
            "Installing the supported pure-Python SQLAlchemy build for this Windows policy.",
            flush=True,
        )
        subprocess.run(
            [
                str(runtime),
                "-m",
                "pip",
                "install",
                "--force-reinstall",
                "--no-binary",
                "SQLAlchemy",
                "SQLAlchemy==2.1.6",
            ],
            check=True,
            env={**os.environ, "DISABLE_SQLALCHEMY_CEXT": "1"},
        )
args = [
    str(runtime),
    "-m",
    "uvicorn",
    "services.api.app.main:app",
    "--host",
    os.environ.get("API_HOST", "127.0.0.1"),
    "--port",
    os.environ.get("API_PORT", "8000"),
]
if "--reload" in sys.argv:
    args.append("--reload")
raise SystemExit(subprocess.call(args, cwd=root))
