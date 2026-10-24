#!/usr/bin/env bash
cd "$(dirname "$0")/.."
python scripts/smoke_test.py "$@"
