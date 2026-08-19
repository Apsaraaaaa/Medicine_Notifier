"""
One-shot PostgreSQL provisioning for the Medicine Notifier backend.

Creates the `medicine_notifier` database and a dedicated application role,
then writes that role's password into backend/.env so `manage.py migrate`
works immediately afterwards.

    venv\\Scripts\\python scripts\\create_db.py --superuser-password "YOUR_POSTGRES_PASSWORD"

Options:
    --superuser         PostgreSQL admin role to connect as   (default: postgres)
    --superuser-password  its password                        (prompted if omitted)
    --host / --port     where the server is                   (default: 127.0.0.1:5432)
    --app-user          application role to create            (default: medicine_user)
    --app-password      its password       (default: generated and written to .env)
    --db                database name                         (default: medicine_notifier)
    --show-sql          print the equivalent SQL and exit

Re-running is safe: existing objects are left alone, and the app role's
password is reset to the value in .env so the two never drift apart.
"""

import argparse
import getpass
import re
import secrets
import sys
from pathlib import Path

try:
    import psycopg
    from psycopg import sql
except ImportError:  # pragma: no cover - depends on the environment
    sys.exit("psycopg is not installed. Run: venv\\Scripts\\pip install -r requirements.txt")

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--superuser", default="postgres")
    parser.add_argument("--superuser-password")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default="5432")
    parser.add_argument("--app-user", default="medicine_user")
    parser.add_argument("--app-password")
    parser.add_argument("--db", default="medicine_notifier")
    parser.add_argument("--show-sql", action="store_true")
    return parser.parse_args()


def show_sql(args, password="a-strong-password"):
    print(
        f"""
CREATE ROLE {args.app_user} WITH LOGIN PASSWORD '{password}';
CREATE DATABASE {args.db} OWNER {args.app_user} ENCODING 'UTF8';
GRANT ALL PRIVILEGES ON DATABASE {args.db} TO {args.app_user};

-- Django's test runner creates and drops its own database:
ALTER ROLE {args.app_user} CREATEDB;
""".strip()
    )


def update_env(user: str, password: str, db: str, host: str, port: str):
    """Rewrites the DB_* lines in backend/.env, leaving everything else alone."""
    if not ENV_PATH.exists():
        sys.exit(f"{ENV_PATH} not found. Copy .env.example to .env first.")

    text = ENV_PATH.read_text(encoding="utf-8-sig")
    for key, value in [
        ("DB_NAME", db),
        ("DB_USER", user),
        ("DB_PASSWORD", password),
        ("DB_HOST", host),
        ("DB_PORT", port),
    ]:
        pattern = rf"^{key}=.*$"
        if re.search(pattern, text, flags=re.MULTILINE):
            text = re.sub(pattern, f"{key}={value}", text, flags=re.MULTILINE)
        else:
            text = text.rstrip("\n") + f"\n{key}={value}\n"
    ENV_PATH.write_text(text, encoding="utf-8")


def main():
    args = parse_args()
    if args.show_sql:
        show_sql(args)
        return

    password = args.app_password or secrets.token_urlsafe(18)
    su_password = args.superuser_password or getpass.getpass(
        f"Password for PostgreSQL role {args.superuser!r}: "
    )

    try:
        conn = psycopg.connect(
            host=args.host,
            port=args.port,
            user=args.superuser,
            password=su_password,
            dbname="postgres",
            autocommit=True,  # CREATE DATABASE cannot run inside a transaction
        )
    except psycopg.OperationalError as exc:
        sys.exit(f"Could not connect to PostgreSQL at {args.host}:{args.port}\n{exc}")

    with conn:
        cur = conn.cursor()

        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (args.app_user,))
        role_exists = cur.fetchone() is not None
        action = "ALTER" if role_exists else "CREATE"
        cur.execute(
            sql.SQL("{} ROLE {} WITH LOGIN PASSWORD {} CREATEDB").format(
                sql.SQL(action), sql.Identifier(args.app_user), sql.Literal(password)
            )
        )
        print(f"{'Updated' if role_exists else 'Created'} role {args.app_user}")

        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (args.db,))
        if cur.fetchone() is None:
            cur.execute(
                sql.SQL("CREATE DATABASE {} OWNER {} ENCODING 'UTF8'").format(
                    sql.Identifier(args.db), sql.Identifier(args.app_user)
                )
            )
            print(f"Created database {args.db}")
        else:
            print(f"Database {args.db} already exists — leaving it as it is")

        cur.execute(
            sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                sql.Identifier(args.db), sql.Identifier(args.app_user)
            )
        )

    # PostgreSQL 15+ locks down the public schema, so the app role needs it
    # granted from inside the new database rather than from `postgres`.
    with psycopg.connect(
        host=args.host,
        port=args.port,
        user=args.superuser,
        password=su_password,
        dbname=args.db,
        autocommit=True,
    ) as conn:
        conn.execute(
            sql.SQL("GRANT ALL ON SCHEMA public TO {}").format(sql.Identifier(args.app_user))
        )
        conn.execute(
            sql.SQL("ALTER SCHEMA public OWNER TO {}").format(sql.Identifier(args.app_user))
        )

    update_env(args.app_user, password, args.db, args.host, args.port)
    print(f"Wrote DB_* settings into {ENV_PATH}")
    print("\nNext:  venv\\Scripts\\python manage.py migrate")


if __name__ == "__main__":
    main()
