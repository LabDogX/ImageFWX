# ImageFWX

> [中文说明](README.zh-CN.md)

ImageFWX is a self-hosted photo-finishing workspace for ImageMagick. It adds a
visual frame editor, text and image watermarks, batch processing, and a safe
read-only NAS photo browser to a Next.js, FastAPI, PostgreSQL, and Redis stack.

## What ImageFWX is for

- Finish a single photo or a batch with consistent borders and watermarks.
- Import photos from a NAS without exposing, modifying, or moving originals.
- Save processed results to a separate NAS directory.
- Run the complete workflow in a private Docker deployment with login required.

## Highlights

### Bilingual interface

- Switch the web interface between English and Simplified Chinese from the
  language control in the header. The selected language is stored locally in
  the browser, and Chinese-language browsers default to Simplified Chinese.

### Frames and borders

- Independent or linked top/right/bottom/left margins in pixels or percent of
  each photo's short edge.
- Safe `#RGB`, `#RRGGBB`, and `#RRGGBBAA` colors; double borders; fixed matte
  canvases; alignment; configurable floating shadows; frosted-glass frames
  derived from the photo; and validated two-color gradients.
- Curated original presets: Classic White, Thin Black, Polaroid, Double Gallery,
  Square Matte, Portrait Matte, Floating Paper, Frosted Glass, Sunset Gradient,
  Ocean Gradient, and Custom.
- Signed-in users can save their own border templates. Templates are private to
  the account and contain validated parameters, never raw ImageMagick commands.
- Backend ImageMagick previews use the same command builder as final export.

### Watermarks

- A four-layer watermark stack: logo, primary text, secondary text, and camera
  EXIF. Each layer can be enabled independently and has its own placement and
  styling controls.
- EXIF layers can safely render camera, lens, capture time, ISO, aperture,
  shutter speed, and focal length for each source image. GPS is never read or
  displayed.
- Built-in Sans, Serif, Mono, Noto/Source Han CJK, Inter, and Open Sans choices.
  Noto/Source Han cover Simplified Chinese, Traditional Chinese, Japanese, and
  Korean; Inter and Open Sans are Latin display options.
- Signed-in users can save their watermark stacks as account-private templates.
- Image watermark requests contain an image ID, never a browser-provided server
  path; the backend validates access and resolves the internal file path.

### NAS import and output

- Optional NAS directory browser, disabled by default and protected by the
  existing login requirement.
- Switch between compact list and lazy-loaded thumbnail views while browsing;
  NAS thumbnails are generated only in application temporary storage.
- Rejects absolute paths, traversal, encoded traversal, Windows paths, and
  symlinks that leave the NAS source root.
- Validates extension, MIME type, and file size before copy-based import.
- Original NAS photos remain read-only. Imported copies enter `/app/uploads`;
  processed files go to `/app/processed`.

### Existing editing tools

- Resize, crop, rotation, flip, format conversion, filters, direct download,
  gallery, history, and batch jobs.
- Background removal, auto enhancement, and 2×/4× upscaling where the optional
  AI runtime is available.

## Quick start

```bash
git clone https://github.com/LabDogX/ImageFWX.git
cd ImageFWX
./scripts/setup.sh
```

Build and start the CPU service:

```bash
docker compose up -d --build
```

The setup script never replaces an existing `.env`. For a public domain, set
`ALLOWED_ORIGINS=https://your-domain.example` before starting. It enables
registration for the first account; set `ALLOW_REGISTRATION=false` immediately
after that account is created.

Default public ports:

| Service | Host port | Purpose |
|---|---:|---|
| Web UI | 3012 | Next.js interface |
| API | 8012 | FastAPI API and API documentation |

- Swagger UI: `http://localhost:8012/docs`
- ReDoc: `http://localhost:8012/redoc`

## NAS / FnOS deployment

ImageFWX uses the same `docker-compose.yml` for Docker-only and NAS setups.
For NAS import, set these values in `.env`, then run the normal start command:

```env
NAS_BROWSER_ENABLED=true
UPLOADS_STORAGE="/path/to/imagefwx-data/uploads"
PROCESSED_STORAGE="/path/to/processed-photos"
TEMP_STORAGE="/path/to/imagefwx-data/temp"
NAS_SOURCE_STORAGE="/path/to/original-photos"
```

These are placeholders, not required host paths. Quote any path containing
spaces or non-ASCII characters.

```bash
docker compose up -d --build
```

The container runs as the restricted UID/GID `10001`. On FnOS Windows ACL
storage, explicitly grant that container identity read/write/traverse access to
the host `uploads`, `processed`, and `temp` directories and let the permission
inherit to their contents. Keep the original-photo mount read-only and never
map `/app/processed` to it. The deployment keeps this restricted runtime
identity; it does not run ImageFWX as root or as the NAS owner account.

### FnOS v1.2+ permission recovery

FnOS v1.2.0 moved storage spaces to Windows ACL permissions. A Docker bind
mount can report `rw=true` while ImageFWX's restricted runtime user still
cannot create files. FnOS documents that Docker directories retain POSIX ACL
behaviour; keep ImageFWX's three writable directories in a dedicated `data`
folder below the Docker project, not inside the original-photo library. See
[the full FnOS recovery steps](docs/wiki/Installation.md#fnos-v120-windows-acl-permission-recovery).

For a domain or HTTPS, place a reverse proxy in front of the Web UI port and
set `ALLOWED_ORIGINS` to the public HTTPS origin; no second ImageFWX Compose
file is needed. ImageFWX proxies unmatched `/api/*` requests from its Next.js
Web UI to the internal FastAPI service, so a reverse proxy only needs to
forward the public site to port `3012`.

### Lucky reverse proxy

Create one HTTPS Web Service rule and point its default backend to
`http://NAS_LAN_IP:3012`. Enter only the domain in Lucky's front-domain field
(for example, `image.example.com`); do not add a separate `/api` child rule.
Lucky does not reliably route different paths of the same hostname to separate
backends. Set `ALLOWED_ORIGINS=https://image.example.com`, rebuild the image,
and restart the service:

```bash
docker compose up -d --build
```

Do not create a Lucky public rule for port `8012`; all browser API traffic uses
the same public domain as the Web UI.

## Processing workflow

```text
NAS originals (read-only)
  -> copy selected files into /app/uploads
  -> edit, preview, watermark, or batch process
  -> write results to /app/processed
  -> NAS results folder (writable)
```

Borders are applied before watermarks, so text and logos can be positioned in
the expanded border or matte area. Each image in a batch calculates percentage
borders and target canvas dimensions independently.

## Storage retention

ImageFWX starts a low-frequency cleanup worker after the database is ready. It
only scans the three writable application mounts and never reads, deletes, or
modifies `NAS_SOURCE_STORAGE`.

```env
# Image-library records, original upload copies, and thumbnails
HISTORY_RETENTION_HOURS=24

# Temporary ImageMagick work files
TEMP_RETENTION_HOURS=24

# Completed files saved under /app/processed; set 0 to disable this cleanup
PROCESSED_RETENTION_HOURS=168

# Run every 60 minutes; accepted interval is 5–1440 minutes
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MINUTES=60
```

The worker removes expired image database rows along with their uploaded copy
and thumbnail. It also removes unreferenced old upload files, temporary work
files, and expired exported results. Choose the processed-results period to
match your backup policy: exports are deleted permanently once their period is
reached. Changes take effect after `docker compose up -d --build`.

## Configuration and security

- `NAS_BROWSER_ENABLED=false` by default.
- Keep `REQUIRE_LOGIN=true` and `ALLOW_REGISTRATION=false` for any internet
  reachable deployment.
- Use HTTPS at the reverse proxy and set `ALLOWED_ORIGINS` to the actual site.
- Do not publish PostgreSQL or Redis ports.
- Change all three required secrets before first startup.
- ImageMagick commands are built from validated operation parameters with
  timeout and resource limits; image and NAS files are MIME-validated.
- A browser upload or NAS import is limited to 50 MB per file.

## Development and verification

Backend:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest -m "not slow"
```

Frontend:

```bash
cd frontend
npm ci
npm run lint
npm run build
npm audit
```

## License and acknowledgments

ImageFWX retains the upstream MIT License and copyright notices. Its frame,
NAS-import, and watermark additions are original implementations. It does not
include Magick Frames source code, assets, configuration, presets, or names.

Noto/Source Han and Inter are supplied under the SIL Open Font License 1.1;
Open Sans is supplied under Apache License 2.0. They may be used in commercial
and non-commercial projects under their respective terms, but are not sold as
standalone fonts. See [NOTICE-FONTS.md](NOTICE-FONTS.md). No unverified local
font archive is bundled into ImageFWX.

Built with [ImageMagick](https://imagemagick.org/),
[rembg](https://github.com/danielgatis/rembg), [Next.js](https://nextjs.org/),
[FastAPI](https://fastapi.tiangolo.com/), [shadcn/ui](https://ui.shadcn.com/),
and [Tailwind CSS](https://tailwindcss.com/).

## Contributing

Issues and pull requests are welcome.
