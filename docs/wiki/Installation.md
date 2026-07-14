# Installation Guide

## Table of Contents
- [Quick Start](#quick-start)
- [Changing Ports](#changing-ports)
- [NAS Photo Browser](#nas-photo-browser-optional)
- [Configuration](#configuration)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [Production Deployment](#production-deployment)

---

## Quick Start

ImageFWX has one deployment path and one Compose file:

```bash
git clone https://github.com/LabDogX/ImageFWX.git
cd ImageFWX
./scripts/setup.sh
docker compose up -d --build
```

Access the Web UI at `http://localhost:3012` by default.
The setup script generates secrets and does not overwrite an existing `.env`.
For a public domain, set `ALLOWED_ORIGINS` to the HTTPS origin before starting.
It enables registration for the first account; set `ALLOW_REGISTRATION=false`
after that account has been created.

---

## Changing Ports

Edit these values in `.env`, then rebuild the frontend:

```env
FRONTEND_PORT=3012
BACKEND_PORT=8012
NEXT_PUBLIC_API_PORT=8012
```

```bash
docker compose down
docker compose up -d --build
```

---

## NAS photo browser (optional)

The NAS browser is off by default and is designed for import-by-copy: originals
remain read-only under `/mnt/photos`, while imports become ordinary application
uploads and processed results go to a different writable directory. On FnOS
NAS, configure the storage variables in `.env`. The values below are
placeholders; quote any path containing spaces or non-ASCII characters and
never point the processed output to the original-photo directory:

```env
NAS_BROWSER_ENABLED=true
UPLOADS_STORAGE="/path/to/imagefwx-data/uploads"
PROCESSED_STORAGE="/path/to/processed-photos"
TEMP_STORAGE="/path/to/imagefwx-data/temp"
NAS_SOURCE_STORAGE="/path/to/original-photos"
```

Then use the same command as every other deployment:

```bash
docker compose up -d --build
```

Do not point `/app/processed` at the original-photo directory. Change the
default `SECRET_KEY` and `JWT_SECRET` before exposing the application.
The image runs as the restricted UID/GID `10001`. On FnOS Windows ACL storage,
grant that identity read/write/traverse access to the three writable host
directories and ensure the permission inherits to their contents (the source
directory stays read-only). For a domain and HTTPS, use your existing reverse
proxy and set `ALLOWED_ORIGINS` to the public HTTPS origin.

### Storage retention

ImageFWX runs a scheduled cleanup worker after initialization. It only scans
`/app/uploads`, `/app/processed`, and `/tmp/imagemagick`; it never scans the
read-only NAS source. Configure these values in `.env`:

```env
HISTORY_RETENTION_HOURS=24
TEMP_RETENTION_HOURS=24
PROCESSED_RETENTION_HOURS=168
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MINUTES=60
```

`HISTORY_RETENTION_HOURS` controls image records, their upload copies, and
thumbnails. `PROCESSED_RETENTION_HOURS=0` disables automated deletion of final
exports. Otherwise, expired results are permanently removed; set a retention
period that matches your backup policy.

---

## Configuration

### Authentication

**Enable login requirement:**
```yaml
# In docker-compose.yml:
environment:
  - REQUIRE_LOGIN=true
  - ALLOW_REGISTRATION=false  # Disable new signups after creating admin
```

Restart: `docker compose restart`

---

### Image Processing Settings
```yaml
environment:
  - DEFAULT_OUTPUT_FORMAT=avif     # avif, webp, jpeg, png
  - DEFAULT_QUALITY=90             # 1-100
  - MAX_UPLOAD_SIZE_MB=50          # Hard maximum size of one file (MB)
  - IMAGEMAGICK_TIMEOUT=600        # Processing timeout (seconds)
```

---

### Security Keys (PRODUCTION REQUIRED!)

**Generate secure keys:**
```bash
# Linux/Mac:
openssl rand -hex 32

# Or Python:
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Update docker-compose.yml:**
```yaml
environment:
  - SECRET_KEY=your-generated-key-here
  - JWT_SECRET=your-other-generated-key-here
```

---

## Reverse Proxy Setup

### Nginx Proxy Manager

**Proxy Host - Details:**
```
Domain Names: example.com
Scheme: http
Forward Hostname/IP: YOUR_SERVER_IP
Forward Port: 3000

☑ Websockets Support
☐ Cache Assets
```

**Custom Locations - Add `/api`:**
```
Location: /api
Scheme: http
Forward Hostname/IP: YOUR_SERVER_IP
Forward Port: 8000

Custom Nginx Configuration:
client_max_body_size 100M;
proxy_connect_timeout 300;
proxy_send_timeout 300;
proxy_read_timeout 300;
```

**SSL:**
```
☑ Force SSL
☑ HTTP/2 Support
☑ Request SSL Certificate
```

**Update CORS:**
```yaml
# In docker-compose.yml:
environment:
  - ALLOWED_ORIGINS=https://example.com
```

Restart: `docker compose restart`

---

### Traefik

Add labels to docker-compose.yml:
```yaml
services:
  app:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.imagemagick.rule=Host(`example.com`)"
      - "traefik.http.routers.imagemagick.entrypoints=websecure"
      - "traefik.http.routers.imagemagick.tls.certresolver=myresolver"
      - "traefik.http.services.imagemagick.loadbalancer.server.port=3000"
```

---

### Caddy

Create `Caddyfile`:
```
example.com {
    reverse_proxy localhost:3000
    
    @api path /api/*
    handle @api {
        reverse_proxy localhost:8000
    }
}
```

---

## Production Deployment

### Pre-deployment Checklist

- [ ] Change `SECRET_KEY` to random 32+ character string
- [ ] Change `JWT_SECRET` to random 32+ character string  
- [ ] Set `REQUIRE_LOGIN=true`
- [ ] Set `ALLOW_REGISTRATION=false` after creating admin
- [ ] Configure `ALLOWED_ORIGINS` with your domain
- [ ] Set up HTTPS via reverse proxy
- [ ] Configure backups for Docker volumes
- [ ] Test upload/download functionality
- [ ] Monitor resource usage

---

### Backups

**Backup volumes:**
```bash
docker run --rm \
  -v imagemagick-webgui_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/postgres-backup-$(date +%Y%m%d).tar.gz -C /data .
```

**Restore:**
```bash
docker run --rm \
  -v imagemagick-webgui_postgres_data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/postgres-backup-20241215.tar.gz -C /data
```

---

### Updates

**Option 1 (pre-built image):**
```bash
docker compose pull
docker compose up -d
```

**Option 2 (built from source):**
```bash
git pull
docker compose build --no-cache
docker compose up -d
```

---

## Troubleshooting

### Port already in use
```bash
# Check what's using the port:
sudo lsof -i :3000
sudo lsof -i :8000

# Change ports in docker-compose.yml
```

### Upload fails
```bash
# Check logs:
docker compose logs app | grep -i error

# Increase upload size:
# Edit docker-compose.yml:
environment:
  - MAX_UPLOAD_SIZE_MB=50
```

### Can't connect from other devices
```bash
# Check ALLOWED_ORIGINS:
environment:
  - ALLOWED_ORIGINS=*  # Allow all (testing only!)
  # Or specific:
  - ALLOWED_ORIGINS=https://example.com,http://nas.example.local:3000
```

---

## Support

- 🐛 [Report Issues](https://github.com/LabDogX/ImageFWX/issues)
- 💬 [Discussions](https://github.com/LabDogX/ImageFWX/discussions)
- 📖 [Documentation](https://github.com/LabDogX/ImageFWX/wiki)
