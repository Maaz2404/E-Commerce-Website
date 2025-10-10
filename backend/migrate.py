import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

MIGRATIONS_DIR = "migrations"

def run_migrations():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")

    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()

    # create a table to track applied migrations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY
    );
    """)
    conn.commit()

    cursor.execute("SELECT filename FROM schema_migrations;")
    applied = {row[0] for row in cursor.fetchall()}

    for filename in sorted(os.listdir(MIGRATIONS_DIR)):
        if filename.endswith(".sql") and filename not in applied:
            print(f"Applying {filename}...")
            with open(os.path.join(MIGRATIONS_DIR, filename), "r") as f:
                sql = f.read()
                cursor.execute(sql)
                cursor.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s);",
                    (filename,)
                )
                conn.commit()

    cursor.close()
    conn.close()
    print("✅ All migrations applied!")

if __name__ == "__main__":
    run_migrations()
