# Deployment

Target: a single Linux server (Ubuntu 22.04 or newer) with Docker and a
public address.

**Read [PHARMACY_COMPLIANCE_CHECKLIST.md](PHARMACY_COMPLIANCE_CHECKLIST.md)
first.** The deployment procedure below assumes the checklist is complete. If
it is not, deploy with `PAYMENT_LIVE=false` and with **Accept new orders**
switched off, so that the system is available for training without taking
real orders.

---

## 1. Server preparation

```bash
# 1. Update the system
sudo apt update && sudo apt upgrade -y

# 2. Create a dedicated user for the stack
sudo adduser --system --group --home /opt/medical-store medical-store
sudo mkdir -p /opt/medical-store
sudo chown medical-store:medical-store /opt/medical-store

# 3. Install Docker (from the official repository)
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 4. Allow the deployment user to use Docker
sudo usermod -aG docker medical-store
```

## 2. Deploy the application

```bash
sudo -u medical-store -H bash
cd /opt/medical-store

# Get the code (from your repository or a copy)
git clone <repository-url> .

# Prepare the environment
cp .env.docker.example .env
chmod 600 .env
$EDITOR .env
```

`.env` must contain at least:

```env
POSTGRES_PASSWORD=<a long random password>
DATABASE_URL="postgresql://medical_store:<the same password>@db:5432/medical_store?schema=public"
APP_URL="https://pharmacy.example.in"
PAYMENT_WEBHOOK_SECRET=<openssl rand -hex 32>
PAYMENT_LIVE=false
PAYMENT_PROVIDER=sandbox
```

```bash
# Build and start
docker compose build
docker compose up -d

# Apply the migrations
docker compose exec app npx prisma migrate deploy

# Create the first administrator
docker compose exec app npm run admin:bootstrap -- --email owner@example.com --name "Owner"

# Check that it is healthy
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

## 3. HTTPS setup

The Compose stack includes Nginx and Certbot.

1. Point the public host name at the server.
2. Edit `docker/nginx/conf.d/medical-store.conf` and replace
   `pharmacy.example.in` with the real host name, in the `server_name`
   directive and in the two certificate paths.
3. Create the certificate directory and request the certificate:

```bash
mkdir -p docker/nginx/certs
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d pharmacy.example.in \
  --agree-tos -m admin@example.in --non-interactive
```

4. Reload Nginx:

```bash
docker compose exec nginx nginx -s reload
```

5. Enable automatic renewal. Uncomment the `entrypoint` in
   `docker-compose.yml` or add a host cron job:

```bash
sudo crontab -e
# every morning, renew the certificates that are close to expiry
17 3 * * * cd /opt/medical-store && docker compose run --rm certbot certbot renew --webroot -w /var/www/certbot && docker compose exec nginx nginx -s reload
```

6. Verify:

```bash
curl -I https://pharmacy.example.in
echo | openssl s_client -connect pharmacy.example.in:443 2>/dev/null | openssl x509 -noout -dates
```

## 4. Firewall and hardening

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

The PostgreSQL port is never published to the host, and the application
container is bound to `127.0.0.1`, so only Nginx can reach it.

Additional hardening:

```bash
# 1. Automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 2. SSH: no password login, no root login
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo systemctl reload ssh

# 3. Fail2ban
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban

# 4. Do not expose the Docker socket
sudo chmod 660 /var/run/docker.sock
sudo usermod -aG docker medical-store   # only for the deployment user
```

Notes:

- Run the application as the unprivileged `nextjs` user inside the container
  (the `Dockerfile` already does this).
- The `uploads` volume is owned by that user. Back it up with the database.
- Set `ADMIN_SESSION_TTL_HOURS` to the shortest period that is workable.
- The database password, the webhook secret and the gateway credentials are
  only in `.env` (mode 600) and in the environment of the container. Rotate
  them if the host is compromised.

## 5. Logs

```bash
docker compose logs -f app          # application logs (structured JSON)
docker compose logs -f nginx        # access and error logs
docker compose logs -f db
```

The audit log is in the administration area under **Audit log**, and in the
`AuditEvent` table. It is separate from the operational logs.

Retention: configure the Docker log driver in `/etc/docker/daemon.json`:

```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "5" }
}
```

## 6. Health checks

| Check | Command | Meaning |
| --- | --- | --- |
| Application | `curl -fsS http://127.0.0.1:3000/api/health` | The application and the database are reachable |
| Container | `docker compose ps` | Every service is `healthy` |
| Public | `curl -I https://pharmacy.example.in` | TLS and the reverse proxy work |
| Certificate | `echo \| openssl s_client -connect pharmacy.example.in:443 ...` | The certificate is valid and not about to expire |

The Compose health check runs every 30 seconds and restarts the application
container after three consecutive failures.

## 7. Scheduled maintenance

```bash
sudo crontab -u medical-store -e
```

```cron
# Daily maintenance: expire stale prescriptions, prune expired sessions.
17 3 * * * cd /opt/medical-store && docker compose exec -T app node --conditions=react-server --import tsx scripts/maintenance.ts >> /var/log/medical-store-maintenance.log 2>&1
```

## 8. Deployment procedure

For each release:

```bash
cd /opt/medical-store
sudo -u medical-store -H bash
git pull
docker compose build
docker compose up -d
docker compose exec app npx prisma migrate deploy
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

Migrations run before the new containers serve traffic, and they are
backwards compatible with the previous release (add columns, do not drop
them in the same release). See
[BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md#migrations-and-rollback) for the
rollback procedure.

## 9. Accessing the site

The site is a normal website: open it in Chrome, Edge or Firefox on Windows or
Linux.

| URL | Purpose |
| --- | --- |
| `https://pharmacy.example.in/` | Storefront |
| `https://pharmacy.example.in/login` | Sign in |
| `https://pharmacy.example.in/admin` | Administration area (staff only) |

The administration area requires a staff account. Create one with
`docker compose exec app npm run admin:bootstrap -- --email ... --name ...`,
or have an existing administrator create it in the administration area.

## 10. Operating the pharmacy

Daily:

- Check the **Audit log** for unexpected activity.
- Check the dashboard for low stock and for orders waiting for a prescription
  review.
- Confirm that the backup job succeeded.

Weekly:

- Reconcile the payment provider's settlement against the orders in the
  application.
- Review the orders that are still open.

Monthly:

- Review the audit log as a whole.
- Confirm the backups still restore (see the restore drill in
  [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md)).
- Re-check the compliance checklist for anything that is about to expire
  (licence, prescription validity configuration, certificate).
