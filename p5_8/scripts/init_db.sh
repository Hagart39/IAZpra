#!/usr/bin/env bash
# Застосувати схему БД (потрібен DATABASE_URL у .env)
set -e
cd "$(dirname "$0")/.."
export $(grep -v '^#' .env | xargs)
psql "$DATABASE_URL" -f db/schema.sql
