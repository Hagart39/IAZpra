# API «Оперативний Дашборд»

Спільні query-параметри для аналітичних ендпоїнтів: `from`, `to` (YYYY-MM-DD), `sector`, `direction`, `event_type`, `min_intensity` (1..50).

| Ендпоїнт | Відповідь |
|---|---|
| `GET /health` | `{status:"ok"}` |
| `GET /filters` | `{sectors, directions, event_types, min_date, max_date}` |
| `GET /kpi` | `{total_incidents, total_intensity, avg_intensity, top_direction}` |
| `GET /trend?group=day\|week` | `[{t, value}]` |
| `GET /distribution/directions` | `[{label, value}]` |
| `GET /distribution/types` | `[{label, value}]` |
| `GET /heatmap` | `{columns:[тижні], rows:[{sector, values}]}` |
| `GET /incidents?page&page_size(5..100)&sort&order` | `{total, page, page_size, items}` |
| `GET /incidents/{id}` | повний запис |

Інтерактивна документація: http://localhost:8000/docs
