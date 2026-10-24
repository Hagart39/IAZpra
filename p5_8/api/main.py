"""Міні ІАС «Оперативний Дашборд»: FastAPI (sync) + raw SQL."""
from datetime import date, timedelta
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from api.db import query

app = FastAPI(title="Оперативний Дашборд API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SORT_FIELDS = {"occurred_at", "sector", "direction", "event_type", "intensity", "id"}


def build_where(from_: Optional[date], to: Optional[date], sector, direction, event_type, min_intensity):
    """Спільний фільтр для всіх аналітичних ендпоїнтів."""
    cond, params = [], []
    if from_:
        cond.append("occurred_at >= %s"); params.append(from_)
    if to:
        cond.append("occurred_at < %s"); params.append(to + timedelta(days=1))
    for col, val in (("sector", sector), ("direction", direction), ("event_type", event_type)):
        if val:
            cond.append(f"{col} = %s"); params.append(val)
    if min_intensity is not None:
        cond.append("intensity >= %s"); params.append(min_intensity)
    return ("WHERE " + " AND ".join(cond)) if cond else "", params


def filters_dep(
    from_: Optional[date] = Query(None, alias="from"),
    to: Optional[date] = None,
    sector: Optional[str] = None,
    direction: Optional[str] = None,
    event_type: Optional[str] = None,
    min_intensity: Optional[int] = Query(None, ge=1, le=50),
):
    return build_where(from_, to, sector, direction, event_type, min_intensity)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/filters")
def filters():
    def distinct(col):
        return [r[col] for r in query(f"SELECT DISTINCT {col} FROM incidents ORDER BY {col}")]
    rng = query("SELECT MIN(occurred_at)::date AS mn, MAX(occurred_at)::date AS mx FROM incidents")[0]
    return {"sectors": distinct("sector"), "directions": distinct("direction"), "event_types": distinct("event_type"),
            "min_date": str(rng["mn"] or ""), "max_date": str(rng["mx"] or "")}


@app.get("/kpi")
def kpi(f=Depends(filters_dep)):
    where, p = f
    r = query(f"SELECT COUNT(*) AS total_incidents, COALESCE(SUM(intensity),0) AS total_intensity,"
              f" COALESCE(ROUND(AVG(intensity)::numeric, 1), 0) AS avg_intensity FROM incidents {where}", p)[0]
    top = query(f"SELECT direction FROM incidents {where} GROUP BY direction ORDER BY COUNT(*) DESC LIMIT 1", p)
    return {"total_incidents": r["total_incidents"], "total_intensity": int(r["total_intensity"]),
            "avg_intensity": float(r["avg_intensity"]), "top_direction": top[0]["direction"] if top else None}


@app.get("/trend")
def trend(group: str = Query("day", pattern="^(day|week)$"), f=Depends(filters_dep)):
    where, p = f
    rows = query(f"SELECT date_trunc('{group}', occurred_at)::date AS t, COUNT(*) AS value"
                 f" FROM incidents {where} GROUP BY 1 ORDER BY 1", p)
    return [{"t": str(r["t"]), "value": r["value"]} for r in rows]


def distribution(col, f):
    where, p = f
    return [{"label": r["label"], "value": r["value"]} for r in
            query(f"SELECT {col} AS label, COUNT(*) AS value FROM incidents {where} GROUP BY 1 ORDER BY 2 DESC", p)]


@app.get("/distribution/directions")
def dist_directions(f=Depends(filters_dep)):
    return distribution("direction", f)


@app.get("/distribution/types")
def dist_types(f=Depends(filters_dep)):
    return distribution("event_type", f)


@app.get("/heatmap")
def heatmap(f=Depends(filters_dep)):
    where, p = f
    rows = query(f"SELECT sector, to_char(date_trunc('week', occurred_at), 'YYYY-MM-DD') AS w, COUNT(*) AS c"
                 f" FROM incidents {where} GROUP BY 1, 2 ORDER BY 1, 2", p)
    weeks = sorted({r["w"] for r in rows})
    sectors = sorted({r["sector"] for r in rows})
    cell = {(r["sector"], r["w"]): r["c"] for r in rows}
    return {"columns": weeks, "rows": [{"sector": s, "values": [cell.get((s, w), 0) for w in weeks]} for s in sectors]}


@app.get("/incidents")
def incidents(page: int = Query(1, ge=1), page_size: int = Query(20, ge=5, le=100),
              sort: str = "occurred_at", order: str = Query("desc", pattern="^(asc|desc)$"),
              f=Depends(filters_dep)):
    if sort not in SORT_FIELDS:
        raise HTTPException(400, f"sort must be one of {sorted(SORT_FIELDS)}")
    where, p = f
    total = query(f"SELECT COUNT(*) AS n FROM incidents {where}", p)[0]["n"]
    items = query(f"SELECT id, occurred_at, sector, direction, event_type, intensity, source FROM incidents {where}"
                  f" ORDER BY {sort} {order} LIMIT %s OFFSET %s", p + [page_size, (page - 1) * page_size])
    for it in items:
        it["occurred_at"] = it["occurred_at"].isoformat(sep=" ")
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@app.get("/incidents/{incident_id}")
def incident(incident_id: int):
    rows = query("SELECT * FROM incidents WHERE id = %s", (incident_id,))
    if not rows:
        raise HTTPException(404, "Інцидент не знайдено")
    r = rows[0]
    r["occurred_at"] = r["occurred_at"].isoformat(sep=" ")
    return r
