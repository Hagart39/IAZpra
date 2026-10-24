"""Генерація 500 навчальних (синтетичних) подій за останні 90 днів."""
import os
import random
from datetime import datetime, timedelta

import psycopg2
from dotenv import load_dotenv

load_dotenv()
random.seed(42)

SECTORS = ["Сектор А", "Сектор Б", "Сектор В", "Сектор Г", "Сектор Д"]
DIRECTIONS = ["Північний", "Північно-Східний", "Східний", "Південно-Східний", "Південний", "Центральний"]
EVENT_TYPES = ["Артобстріл", "Удар БпЛА", "Стрілецький бій", "Розвідка", "Ракетний удар"]
SOURCES = ["Донесення підрозділу", "Повітряна розвідка", "РЕР", "Спостережний пост"]

now = datetime.now().replace(microsecond=0)
rows = []
for _ in range(500):
    t = (now - timedelta(days=random.uniform(0, 90))).replace(microsecond=0)
    etype = random.choice(EVENT_TYPES)
    direction = random.choices(DIRECTIONS, weights=[1, 2, 4, 3, 2, 1])[0]
    rows.append((t, random.choice(SECTORS), direction, etype, random.randint(1, 50),
                 random.choice(SOURCES), f"{etype} на напрямку «{direction}» (навчальний запис)"))

with psycopg2.connect(os.environ["DATABASE_URL"]) as conn, conn.cursor() as cur:
    cur.execute("TRUNCATE incidents RESTART IDENTITY")
    cur.executemany(
        "INSERT INTO incidents (occurred_at, sector, direction, event_type, intensity, source, summary)"
        " VALUES (%s, %s, %s, %s, %s, %s, %s)", rows)
print(f"Додано {len(rows)} записів")
