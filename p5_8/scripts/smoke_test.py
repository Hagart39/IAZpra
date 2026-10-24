"""Мінімальна перевірка працездатності API."""
import json
import sys
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
CHECKS = {
    "/health": ["status"],
    "/filters": ["sectors", "directions", "event_types", "min_date", "max_date"],
    "/kpi": ["total_incidents", "total_intensity", "avg_intensity", "top_direction"],
    "/trend": None,
}
ok = True
for path, keys in CHECKS.items():
    try:
        data = json.load(urllib.request.urlopen(BASE + path, timeout=5))
        good = isinstance(data, list) and all({"t", "value"} <= set(r) for r in data) if keys is None \
            else all(k in data for k in keys)
    except Exception as e:  # noqa: BLE001
        good, data = False, e
    print(f"{'OK  ' if good else 'FAIL'} {path}")
    ok &= good
print("OK" if ok else "FAILED")
sys.exit(0 if ok else 1)
