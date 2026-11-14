#!/usr/bin/env sh
# Host planner, mission-control and the assets on this laptop over HTTPS with Tailscale Funnel.
# Free stand-in for the server until prod. Needs Docker, Tailscale (logged in, Funnel enabled for
# this node in the admin console) and infra/.env.laptop (see laptop.env.example).
#   sh infra/funnel.sh        start (or rebuild) and expose
#   sh infra/funnel.sh down   stop the stack and the Funnel
set -eu
cd "$(dirname "$0")/.."

compose() {
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.laptop.yml --env-file infra/.env.laptop "$@"
}

if [ "${1:-}" = "down" ]; then
  tailscale funnel reset
  compose down
  exit 0
fi

[ -f infra/.env.laptop ] || { echo "infra/.env.laptop is missing: cp infra/laptop.env.example infra/.env.laptop" >&2; exit 1; }

compose up -d --build --remove-orphans

# Funnel allows public HTTPS on 443, 8443 and 10000 only. 443 is avoided on purpose: a local k3s
# Traefik (or any hostPort on 443) catches it before tailscaled. Planner shares 10000 with the
# assets under /planner (Tailscale strips the prefix).
tailscale funnel --bg --https=8443 http://127.0.0.1:8080                   # mission-control, incl. wss /ws
tailscale funnel --bg --https=10000 http://127.0.0.1:8090                  # assets (Caddy, CORS)
tailscale funnel --bg --https=10000 --set-path=/planner http://127.0.0.1:8000 # planner

host=$(tailscale status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["Self"]["DNSName"].rstrip("."))')
compose ps
cat <<EOF

Public URLs (set these in Vercel, then redeploy the web app):
  VITE_MC_URL=https://$host:8443
  VITE_PLANNER_URL=https://$host:10000/planner
  VITE_ASSETS_URL=https://$host:10000/
Check: curl https://$host:8443/health && curl https://$host:10000/planner/health
EOF
