#!/usr/bin/env bash
#
# Runs the backend tests that need a real PostgreSQL, against a throwaway container.
# Your dev database is never touched: the container listens on 127.0.0.1 only, uses its own
# user and password, and is removed when the run ends (also on failure or Ctrl-C).
#
#   scripts/run-postgres-tests.sh          only the *Postgres* test classes
#   scripts/run-postgres-tests.sh --all    the whole backend test suite
#
# Optional environment variables:
#   PROCUREIQ_TEST_PG_PORT    host port for the container (default 55437)
#   PROCUREIQ_TEST_PG_IMAGE   image to run (default: the image of the procureiq-postgres
#                             container if it exists, otherwise postgres:17-alpine)
#
# The database must be named procureiq_step70: some of the tests refuse any other name, to be
# sure they only ever run against a disposable loopback database.

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)" || exit 1
cd "$ROOT" || exit 1

fail() {
  printf '\n✖ %s\n' "$1"
  exit 1
}

MODE=postgres

case "${1:-}" in
  "") ;;
  --all) MODE=all ;;
  *)
    echo "Usage: scripts/run-postgres-tests.sh [--all]"
    exit 2
    ;;
esac

for tool in docker mvn; do
  command -v "$tool" >/dev/null 2>&1 || fail "$tool was not found."
done

docker info >/dev/null 2>&1 || fail "Docker is not running."

NAME=procureiq-test-pg
PORT="${PROCUREIQ_TEST_PG_PORT:-55437}"
DB_NAME=procureiq_step70
DB_USER=procureiq_test
DB_PASSWORD=test-only-pw
URL="jdbc:postgresql://127.0.0.1:$PORT/$DB_NAME"
OUT=/tmp/procureiq_pgtests_run.txt

if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "Port $PORT is already in use. Set PROCUREIQ_TEST_PG_PORT to another port."
fi

IMAGE="${PROCUREIQ_TEST_PG_IMAGE:-}"
[ -n "$IMAGE" ] || IMAGE=$(docker inspect --format '{{.Config.Image}}' procureiq-postgres 2>/dev/null)
[ -n "$IMAGE" ] || IMAGE=postgres:17-alpine

# One variable set per test step, read from the tests themselves so new steps are picked up.
STEPS=$(grep -rhoE "PROCUREIQ_STEP[0-9]+_DB_URL" backend/src/test | sed -E 's/PROCUREIQ_STEP([0-9]+)_DB_URL/\1/' | sort -un)
[ -n "$STEPS" ] || fail "No PROCUREIQ_STEP<n>_DB_URL variables were found in backend/src/test."

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1; }
trap cleanup EXIT
trap 'exit 130' INT TERM
docker rm -f "$NAME" >/dev/null 2>&1

echo "→ Starting a throwaway Postgres ($IMAGE) on 127.0.0.1:$PORT..."
docker run -d --name "$NAME" \
  -e POSTGRES_USER="$DB_USER" -e POSTGRES_PASSWORD="$DB_PASSWORD" -e POSTGRES_DB="$DB_NAME" \
  -p "127.0.0.1:$PORT:5432" "$IMAGE" >/dev/null || fail "Docker could not start the test database."

READY=0
for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -h 127.0.0.1 -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  docker logs --tail 20 "$NAME" 2>&1 | cut -c1-200
  fail "The test database did not become ready in 60 seconds."
fi

echo "✔ Throwaway database is ready ($URL)"

COUNT=0
for n in $STEPS; do
  export "PROCUREIQ_STEP${n}_DB_URL=$URL"
  export "PROCUREIQ_STEP${n}_DB_USER=$DB_USER"
  export "PROCUREIQ_STEP${n}_DB_PASSWORD=$DB_PASSWORD"
  COUNT=$((COUNT + 1))
done

rm -f backend/target/surefire-reports/*Postgres* 2>/dev/null

if [ "$MODE" = all ]; then
  echo "→ Running the whole backend test suite ($COUNT database variable sets provided)..."
  ( cd backend && mvn test ) > "$OUT" 2>&1
else
  echo "→ Running the *Postgres* test classes ($COUNT database variable sets provided)..."
  ( cd backend && mvn test -Dtest='*Postgres*' -Dsurefire.failIfNoSpecifiedTests=false ) > "$OUT" 2>&1
fi
RC=$?

if [ "$MODE" = postgres ]; then
  echo ""
  grep -h "Tests run:" backend/target/surefire-reports/*Postgres*.txt 2>/dev/null | cut -c1-200
fi

echo ""
grep -E "Tests run:.*Failures" "$OUT" | tail -n 1 | sed 's/^\[[A-Z]*\] //'

if [ "$RC" -ne 0 ]; then
  echo ""
  echo "--- first problems reported by Maven (full output: $OUT) ---"
  grep -E "^\[ERROR\]" "$OUT" | head -n 30 | cut -c1-260
  echo ""
  echo "✖ There were failures."
  exit "$RC"
fi

echo "✔ All tests passed."
