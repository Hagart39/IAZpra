# Практична 5.8. Міні ІАС «Оперативний Дашборд» (варіант 4)

**PostgreSQL → FastAPI (sync, raw SQL) → Web (HTML/CSS/JS + Chart.js)**

Універсальна панель ситуаційних показників: KPI, тренд по днях або тижнях, 2 розподіли (за напрямками й типами), heatmap «сектор × тиждень», таблиця інцидентів з пагінацією та модальними деталями. Усі блоки керуються спільними фільтрами. Дані синтетичні: 500 навчальних подій за 90 днів.

## Структура
```
db/       schema.sql (таблиця incidents + індекси), seed.py (500 записів)
api/      db.py (psycopg2, get_conn), main.py (FastAPI-ендпоїнти)
web/      index.html, app.js, styles.css
scripts/  init_db.*, seed_db.*, smoke_test.*
docs/     опис API
```

## Запуск за 3 хв

### Windows (PowerShell), з папки `p5_8`
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env          # за потреби виправ логін/пароль PostgreSQL
psql -U postgres -c "CREATE DATABASE operatyvnyi_dashbord;"
.\scripts\init_db.ps1
.\scripts\seed_db.ps1
uvicorn api.main:app --reload   # API: http://localhost:8000/docs
```
В іншому вікні:
```powershell
cd web
python -m http.server 5500      # відкрити http://localhost:5500/?view=analyst
```
Перевірка: `.\scripts\smoke_test.ps1`

### Linux
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
psql -U postgres -c "CREATE DATABASE operatyvnyi_dashbord;"
bash scripts/init_db.sh
bash scripts/seed_db.sh
uvicorn api.main:app --reload
cd web && python -m http.server 5500
bash scripts/smoke_test.sh
```

## Режими аудиторій (`?view=`)
| Режим | Що видно |
|---|---|
| `executive` | KPI, тренд, короткий текстовий інсайт |
| `analyst` | усі блоки: розподіли, heatmap, таблиця, модальні деталі |
| `demo` | KPI, графіки, heatmap; таблиці немає, поле `source` приховане |

## Сценарій демонстрації
1. Відкрити `?view=executive`: 4 KPI, тренд і текстовий висновок для керівника.
2. Задати фільтр (наприклад, напрямок «Східний») і натиснути «Застосувати»: усі блоки оновлюються разом.
3. Перемкнути тренд «по тижнях».
4. Перейти в `?view=analyst`: розподіли за напрямками й типами, heatmap «сектор × тиждень».
5. У таблиці гортати сторінки й натиснути «Деталі»: відкриється модальне вікно з повним записом.
6. Перейти в `?view=demo`: показ для відкритої аудиторії без таблиці й без джерел.
