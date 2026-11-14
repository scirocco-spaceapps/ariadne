#!/usr/bin/env sh
# Pull main and rebuild the services. Run on the server from anywhere; the GitHub deploy workflow
# calls it over SSH. Needs infra/.env (see infra/.env.example).
set -eu
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d --build --remove-orphans
docker compose -f infra/docker-compose.yml --env-file infra/.env ps
