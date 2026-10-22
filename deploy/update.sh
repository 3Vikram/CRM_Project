#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "Pulling the latest project changes..."
git pull

install_dependencies() {
  local directory="$1"
  echo "Installing dependencies in $directory..."
  if [[ -f "$directory/package-lock.json" ]]; then
    (cd "$directory" && npm ci)
  else
    (cd "$directory" && npm install)
  fi
}

install_dependencies inventory/backend
install_dependencies sales/backend
install_dependencies inventory/frontend

echo "Building the frontend..."
(cd inventory/frontend && npm run build)

echo "Publishing frontend files to /var/www/crm..."
sudo install -d -m 0755 /var/www/crm
sudo find /var/www/crm -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
sudo cp -a inventory/frontend/dist/. /var/www/crm/

echo "Reloading backend processes and nginx..."
pm2 reload ecosystem.config.js
sudo systemctl reload nginx
