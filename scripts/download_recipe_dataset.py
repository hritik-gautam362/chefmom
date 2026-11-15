#!/usr/bin/env python3
"""Download and verify the public recipe CSV used for the PantryMuse prototype.

Usage:
    python download_recipe_dataset.py --output data/recipe.csv

The source repository labels the dataset MIT, but individual recipe/content rights
should still be reviewed before any public or commercial redistribution.
"""
from __future__ import annotations

import argparse
import hashlib
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

DATASET_URL = (
    "https://huggingface.co/datasets/Shengtao/recipe/resolve/main/recipe.csv?download=true"
)
EXPECTED_SHA256 = "46fa522b43cc29a7adfd04886464501c23fe27b234a20fee3628d02fbe6cce2f"
CHUNK_SIZE = 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".part")

    if destination.exists():
        existing_hash = sha256_file(destination)
        if existing_hash == EXPECTED_SHA256:
            print(f"Already downloaded and verified: {destination}")
            return
        print("Existing file failed checksum; downloading a fresh copy.")

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "PantryMuse-Dataset-Downloader/1.0"},
    )

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            total = response.headers.get("Content-Length")
            total_bytes = int(total) if total and total.isdigit() else None
            downloaded = 0
            with partial.open("wb") as output:
                while True:
                    chunk = response.read(CHUNK_SIZE)
                    if not chunk:
                        break
                    output.write(chunk)
                    downloaded += len(chunk)
                    if total_bytes:
                        percent = downloaded * 100 / total_bytes
                        print(f"\rDownloaded {downloaded:,} bytes ({percent:.1f}%)", end="")
                    else:
                        print(f"\rDownloaded {downloaded:,} bytes", end="")
        print()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        partial.unlink(missing_ok=True)
        raise RuntimeError(
            "Dataset download failed. Check internet access and retry. "
            f"Source: {url}\nReason: {exc}"
        ) from exc

    actual_hash = sha256_file(partial)
    if actual_hash != EXPECTED_SHA256:
        partial.unlink(missing_ok=True)
        raise RuntimeError(
            "Checksum verification failed; refusing to keep a potentially incomplete "
            f"or changed dataset. Expected {EXPECTED_SHA256}, received {actual_hash}."
        )

    os.replace(partial, destination)
    print(f"Verified SHA-256: {actual_hash}")
    print(f"Saved dataset to: {destination.resolve()}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        default="data/recipe.csv",
        help="Destination CSV path (default: data/recipe.csv)",
    )
    args = parser.parse_args()
    try:
        download(DATASET_URL, Path(args.output))
        return 0
    except Exception as exc:  # Keep the CLI error readable for first-time users.
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
