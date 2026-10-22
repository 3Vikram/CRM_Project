#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

if [[ "$EUID" -eq 0 ]]; then
  echo "Do not run this script as root. Run it as a regular user with sudo access." >&2
  exit 1
fi

echo "Checking backend environment files..."
missing_env=0
for env_file in inventory/backend/.env sales/backend/.env; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing required file: $env_file" >&2
    missing_env=1
  fi
done
if [[ "$missing_env" -ne 0 ]]; then
  echo "Create both backend .env files before continuing." >&2
  exit 1
fi

echo "Checking nginx installation..."
if ! command -v nginx >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y nginx
fi

echo "Checking Node.js 20 installation..."
node_major=""
if command -v node >/dev/null 2>&1; then
  node_major="$(node -p "process.versions.node.split('.')[0]")"
fi
if [[ "$node_major" != "20" ]]; then
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Checking PM2 installation..."
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

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

echo "Installing nginx configuration..."
sudo install -d -m 0755 /etc/nginx/snippets
sudo install -m 0644 deploy/crm-proxy.conf /etc/nginx/snippets/crm-proxy.conf
sudo install -m 0644 deploy/nginx-crm.conf /etc/nginx/sites-available/crm
sudo ln -sfn /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/crm
if [[ -e /etc/nginx/sites-enabled/default ]]; then
  sudo rm -f /etc/nginx/sites-enabled/default
fi
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

echo "Checking UFW firewall..."
if command -v ufw >/dev/null 2>&1 && sudo ufw status | grep -q '^Status: active'; then
  sudo ufw allow 'Nginx Full'
fi

echo "Starting or reloading backend processes..."
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "Enabling PM2 startup on reboot..."
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME"
pm2 save

echo "PM2 process status:"
pm2 status

echo "Detecting the server's public IP..."
public_ip="$(curl -fsS --max-time 10 ifconfig.me || true)"
if [[ -n "$public_ip" ]]; then
  echo "Public IP: $public_ip"
  echo "Open http://$public_ip/"
else
  echo "Public IP: unavailable (check network access and run curl -s ifconfig.me)"
  echo "Open http://<that ip>/"
fi

echo "Reminder: add this server's public IP to MongoDB Atlas > Network Access."
