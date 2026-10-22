# Ubuntu deployment

## First-time setup

1. Clone the repository on the Ubuntu server and enter the project root.
2. Create `inventory/backend/.env` and `sales/backend/.env` with the required production secrets. Do not commit these files.
3. Run `bash deploy/setup-ubuntu.sh` as a regular user with sudo access.

The setup installs required services and dependencies, builds and publishes the frontend, configures nginx, and starts the backends with PM2.

## Updating

From the project root on the server, run:

```bash
bash deploy/update.sh
```

## Logs and configuration

- Backend process logs: `pm2 logs`
- Nginx errors: `sudo tail -f /var/log/nginx/error.log`
- Set `TRACKING_BASE_URL` in `sales/backend/.env` to the server's public address, for example `http://<server-ip>`.
- Add the server's public IP to MongoDB Atlas > Network Access.
