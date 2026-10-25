HUMAN:

- [x] A human has tested these changes.

AGENT:

---

## Why

Milestone 0 acceptance criteria and Milestone 3 Market Agent security controls required live infrastructure verification, Postgres-backed checkpointer resumption, and secret protection rules for `.env` management.

## Summary

- **Infrastructure & DB Verification**: Stood up and validated live Docker stack (`postgres-primary`, `postgres-dify`, `keycloak`, `redis`, `minio`, `observability`). Empirically verified live writes to `audit_memory` and `long_term_memory_calibration` tables, as well as `AsyncPostgresSaver` checkpointer resumption and `run_synthetic_trace`.
- **Security & Secret Protection**: Updated `.gitignore` rules to strictly exclude `.env` and `.env.local` files containing live API keys. Added root `.env.example` template with safe placeholders for Git commit.
- **Repository Rebase**: Synchronized local branch `feat/infra-verification-and-market-agent-egress` with latest `origin/main` (PR #41). All 366 unit tests passed cleanly.

## Issue Number

N/A

## How to Test

1. Verify Docker stack:
   ```bash
   docker compose -f docker-compose.yml -f infrastructure/compose/docker-compose.mara.yml -f infrastructure/compose/docker-compose.observability.yml config --quiet
   ```
2. Run full MARA unit test suite:
   ```bash
   poetry run pytest tests/unit/mara
   ```
3. Run live database & checkpointer verification scripts:
   ```bash
   poetry run python scratch/verify_db.py
   poetry run python scratch/verify_calibration.py
   poetry run python scratch/verify_checkpointer.py
   poetry run python scratch/verify_synthetic_trace.py
   ```

## Video/Screenshots

Live terminal verification logs recorded in `walkthrough.md`.

## Type

- [ ] Bug fix
- [x] Feature
- [x] Refactor
- [ ] Breaking change
- [x] Docs / chore

## Notes

- `.env` and `.env.local` are explicitly ignored by Git to protect secrets.
- `postgres-primary` and `postgres-dify` run as separate PostgreSQL instances per ACCB Condition C-5.
