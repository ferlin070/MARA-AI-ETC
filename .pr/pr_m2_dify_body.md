HUMAN:


- [ ] A human has tested these changes.

AGENT:

---

## Why

Milestone 2 requires Dify Knowledge Service deployment, `postgres-dify` isolation (ACCB C-5), and backend adapter implementation (`services/knowledge_service/dify_adapter.py`) so RAG tools can query Dify datasets without direct agent coupling. Additionally, Dify v1.0+ plugin daemon and CORS configurations were required to eliminate 500/400 errors during local development.

## Summary

- **Dify Adapter**: Implemented `DifyAdapter` in `services/knowledge_service/dify_adapter.py` backed by Dify's `/datasets/{id}/retrieve` API with §9.3 metadata filtering, §9.4 version pinning, and §9.5 relevance thresholding.
- **Service & Gateway Wiring**: Exported `DifyAdapter` from `services/knowledge_service`, added `DifySettings` to `shared/config/settings.py`, and added `build_real_knowledge_backend()` in `services/api_gateway/composition.py`.
- **Infrastructure & Compose**: Added `dify-plugin-daemon` (`langgenius/dify-plugin-daemon:0.6.5-local`) to `docker-compose.dify.yml`, fixed CORS origins (`*`), anchored init volume paths to `./infrastructure/compose/init/`, and re-bound Grafana to host port 3002 to prevent port clash with openhands-app.
- **Dev Settings Configured**: Wired `dataset_id` (`2d2b03a9-17b7-4aad-9993-7c5a7abd8670`) and generated `api_key` for `MARA Policy Corpus` into `configs/dev/settings.toml`.

## Issue Number

N/A

## How to Test

1. Launch Docker stack:
   ```bash
   docker compose -f docker-compose.yml -f infrastructure/compose/docker-compose.mara.yml -f infrastructure/compose/docker-compose.observability.yml -f infrastructure/compose/docker-compose.dify.yml up -d
   ```
2. Run configuration test:
   ```bash
   python -c "from shared.config import get_settings; print(get_settings().dify)"
   ```
3. Test Dify API health & CORS:
   ```bash
   curl -i -H "Origin: http://localhost:3001" http://localhost:5001/console/api/setup
   ```

## Type

- [ ] Bug fix
- [x] Feature
- [ ] Refactor
- [ ] Breaking change
- [ ] Docs / chore

## Notes

Requires running containers via `docker compose up` as specified above.
