# Backup and restore

What has to be backed up, how to back it up, and how to prove that the backup
can be restored.

**A backup that has never been restored is not a backup.** The restore drill
below is part of the operating routine, not an optional extra.

---

## 1. What to back up

| Item | Where | Why | Loss impact |
| --- | --- | --- | --- |
| PostgreSQL database | `db` container, volume `db-data` | Orders, catalogue, prices, stock, prescriptions metadata, audit log, accounts | **Total loss of the business record** |
| Uploaded product photos | volume `uploads` | Product images | The catalogue still works, without photos |
| Uploaded prescriptions | volume `uploads` (`prescriptions/`) | Prescription documents | **Cannot dispense prescription-only orders**; may breach record-keeping rules |
| Environment file | `/opt/medical-store/.env` | Secrets and configuration | Re-create it; the values must be recoverable from a password manager |
| Database migrations | the repository | Schema history | Cannot deploy |

The `uploads` volume contains both the product photos and the prescription
documents, under separate namespaces. Back up the whole volume; there is no
secret in a product photo, but a prescription document is sensitive personal
data and the backup must be protected accordingly.

---

## 2. Backup script

Create `/opt/medical-store/backup.sh`:

```bash
#!/usr/bin/env bash
# Backup the medical store: database + uploads + configuration.
set -euo pipefail

APP_DIR=/opt/medical-store
BACKUP_DIR=/var/backups/medical-store
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
KEEP_DAYS=30

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

# 1. Database (custom format, restorable with pg_restore)
docker compose exec -T db pg_dump \
  -U "${POSTGRES_USER:-medical_store}" \
  -d "${POSTGRES_DB:-medical_store}" \
  --format=custom --no-owner --no-acl \
  > "$BACKUP_DIR/db-$STAMP.dump"

# 2. Uploads (product photos and prescription documents)
docker run --rm \
  -v medical-store_uploads:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/uploads-$STAMP.tar.gz" -C /data .

# 3. Configuration (secrets excluded: keep them in a password manager)
grep -v -E 'PASSWORD|SECRET|KEY|TOKEN' .env > "$BACKUP_DIR/env-$STAMP.txt" || true

# 4. Checksums
cd "$BACKUP_DIR"
sha256sum "db-$STAMP.dump" "uploads-$STAMP.tar.gz" > "checksums-$STAMP.txt"

# 5. Remove old backups
find "$BACKUP_DIR" -type f -mtime "+$KEEP_DAYS" -delete

echo "Backup finished: $STAMP"
```

```bash
sudo chmod 700 /opt/medical-store/backup.sh
sudo chown medical-store:medical-store /opt/medical-store/backup.sh
sudo mkdir -p /var/backups/medical-store
sudo chown medical-store:medical-store /var/backups/medical-store
sudo chmod 700 /var/backups/medical-store
```

Schedule it with cron, at a time when the pharmacy is closed:

```bash
sudo crontab -u medical-store -e
# 02:17 every day
17 2 * * * /opt/medical-store/backup.sh >> /var/log/medical-store-backup.log 2>&1
```

Check the log after the first run. A backup job that fails silently is
worse than no backup job at all, because it creates false confidence.

## 3. Off-site copy

Keep a copy somewhere else. `restic` with an S3 or SFTP target is a good
choice because the repository is encrypted:

```bash
sudo apt install -y restic
export RESTIC_REPOSITORY="sftp:backup@offsite.example.in:/medical-store"
export RESTIC_PASSWORD_FILE="/etc/medical-store/restic-password"

# Put the password in a root-only file
sudo install -m 600 /dev/null /etc/medical-store/restic-password
sudo sh -c 'echo "a-long-random-password" > /etc/medical-store/restic-password'

# Add to the backup script, at the end
restic backup "$BACKUP_DIR"
restic forget --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune
```

## 4. Restore

### 4.1 Restore the database

```bash
cd /opt/medical-store

# Stop the application so that nothing writes during the restore
docker compose stop app

# Drop and recreate the database
docker compose exec -T db psql -U "${POSTGRES_USER:-medical_store}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB:-medical_store} WITH (FORCE);"
docker compose exec -T db psql -U "${POSTGRES_USER:-medical_store}" -d postgres \
  -c "CREATE DATABASE ${POSTGRES_DB:-medical_store} OWNER ${POSTGRES_USER:-medical_store};"

# Restore
docker compose exec -T db pg_restore \
  -U "${POSTGRES_USER:-medical_store}" \
  -d "${POSTGRES_DB:-medical_store}" \
  --no-owner --no-acl --clean --if-exists \
  < /var/backups/medical-store/db-<STAMP>.dump

docker compose start app
curl -fsS http://127.0.0.1:3000/api/health
```

### 4.2 Restore the uploads

```bash
docker compose stop app
docker run --rm \
  -v medical-store_uploads:/data \
  -v /var/backups/medical-store:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/uploads-<STAMP>.tar.gz -C /data"
docker compose start app
```

### 4.3 Restore into a scratch environment first

Never test a restore on the production server. Copy the backup to a separate
machine and restore it there:

```bash
# On the scratch machine
cp /var/backups/medical-store/db-<STAMP>.dump .

# Start only a database and restore into it
docker run -d --name restore-test -e POSTGRES_PASSWORD=scratch \
  -e POSTGRES_DB=medical_store postgres:16-alpine
sleep 5
docker cp db-<STAMP>.dump restore-test:/tmp/
docker exec restore-test pg_restore -U postgres -d medical_store --no-owner --no-acl /tmp/db-<STAMP>.dump
docker exec restore-test psql -U postgres -d medical_store -c "SELECT count(*) FROM \"Order\";"
docker rm -f restore-test
```

## 5. Restore drill (monthly)

1. Pick the newest backup.
2. Restore it into a scratch environment (above).
3. Check that the counts are plausible: orders, products, users, prescriptions.
4. Start the application against the restored database on the scratch machine
   and log in.
5. Record the result (date, backup used, outcome) in the pharmacy's
   operations log.

A drill that finds a broken backup is a success. A drill that is skipped is
an unknown risk.

---

## 6. Migrations and rollback

### Applying migrations

```bash
docker compose exec app npx prisma migrate deploy
```

`migrate deploy` only applies the migrations that have not been applied yet.
It never drops data and never prompts.

`prisma migrate dev` and `prisma migrate reset` are development commands.
Never run them against a production database.

### Rolling back a release

The rollback procedure depends on what changed:

**A. Only application code changed (no migration).**

```bash
cd /opt/medical-store
git checkout <the previous tag>
docker compose build
docker compose up -d
```

**B. A migration was applied.**

1. Restore the database from the backup taken immediately before the
   migration.
2. Deploy the previous release.
3. Fix the migration, then re-apply it in a development environment and test
   it there.

This is why a backup must be taken immediately before a deployment with a
migration:

```bash
sudo -u medical-store /opt/medical-store/backup.sh
docker compose exec app npx prisma migrate deploy
```

### Writing migrations safely

- Add columns; do not drop or rename a column in the same release that stops
  using it. Drop it in the next release.
- Never change a column that holds an enum value in place; add the new value
  first, migrate the rows, then remove the old one.
- Always review the generated SQL before it is applied:
  `cat prisma/migrations/<name>/migration.sql`.
- Test the migration on a copy of the production database before the release.

---

## 7. Retention and deletion

| Data | Retention | Where it is configured |
| --- | --- | --- |
| Orders and their audit trail | The period the applicable record-keeping rules require - **confirm it** | The database; there is no automatic deletion |
| Prescription documents | Three years by default - **confirm it** | `PrescriptionDocument.retentionExpiresAt` |
| Prescription records (the decision, not the file) | The period the applicable rules require | The database |
| Sessions | Ended sessions are removed by the daily maintenance run | `scripts/maintenance.ts` |
| Rate limit counters | In memory, removed when the window passes | `scripts/maintenance.ts` |
| Backups | 30 days locally, longer off site | `backup.sh` |
| Uploaded files of deleted products | Removed with the product | The product delete action |

**These retention periods are defaults, not legal advice.** They must be
confirmed against the applicable rules and recorded in
[PHARMACY_COMPLIANCE_CHECKLIST.md](PHARMACY_COMPLIANCE_CHECKLIST.md).

To delete the data of a customer on request:

1. Confirm that the order and prescription records do not have to be kept for
   a legal or record-keeping reason. If they do, refuse the deletion of those
   records and explain why.
2. Delete the prescription documents (and their files) that are not subject to
   a retention obligation.
3. Record the request, the decision and the reasons in the audit log.

---

## 8. Disaster recovery

| Failure | Response |
| --- | --- |
| The server is lost | Provision a new server, restore the database and the uploads from the off-site backup, redeploy |
| The database volume is corrupted | Restore from the most recent local backup; if that fails, from the off-site copy |
| A migration corrupted the data | Restore from the backup taken immediately before the migration |
| The application is compromised | Rotate every secret in `.env`, revoke all sessions (`UPDATE "Session" SET "expiresAt" = NOW();`), rebuild the image from the repository, review the audit log |
| A customer reports a data problem | Do not edit the database by hand. Use the administration area; every change is audited. If a manual correction is unavoidable, record it in the audit log with the reason |

**Never run a destructive database command against a database that has not
been backed up and verified.** Take a backup, restore it into a scratch
environment, verify it, and only then work on the production copy.
