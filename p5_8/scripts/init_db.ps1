# Застосувати схему БД (потрібен DATABASE_URL у .env)
Set-Location (Join-Path $PSScriptRoot "..")
$url = (Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }) -replace '^DATABASE_URL=', ''
psql $url -f db/schema.sql
