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
  canvases; alignment; and configurable floating shadows.
- Original presets: Classic White, Thin Black, Polaroid, Double Gallery, Square
  Matte, Portrait Matte, Warm Ivory, Graphite Gallery, Wide Matte, Story Matte,
  Floating Paper, Double Onyx, and Custom.
- Backend ImageMagick previews use the same command builder as final export.

### Watermarks

- Text watermarks with nine-point positioning, opacity, font size, text color,
  shadow color, and built-in Sans, Serif, Mono, plus Noto/Source Han CJK Sans
  and Serif choices for Simplified Chinese, Traditional Chinese, Japanese, and
  Korean. Bold CJK choices are included for titles.
- Logo and image watermarks selected from existing uploaded PNG, JPEG, WebP, or
  SVG library items. Set scale, opacity, position, and X/Y offsets.
- Image watermark requests contain an image ID, never a browser-provided server
  path; the backend validates access and resolves the internal file path.

### NAS import and output

- Optional NAS directory browser, disabled by default and protected by the
  existing login requirement.
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

The container runs as UID/GID `10001`. Grant that identity write access to the
host `uploads`, `processed`, and `temp` directories. Keep the original-photo
mount read-only and never map `/app/processed` to it.

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

## Configuration and security

- `NAS_BROWSER_ENABLED=false` by default.
- Keep `REQUIRE_LOGIN=true` and `ALLOW_REGISTRATION=false` for any internet
  reachable deployment.
- Use HTTPS at the reverse proxy and set `ALLOWED_ORIGINS` to the actual site.
- Do not publish PostgreSQL or Redis ports.
- Change all three required secrets before first startup.
- ImageMagick commands are built from validated operation parameters with
  timeout and resource limits; image and NAS files are MIME-validated.

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

The built-in Noto and Source Han watermark choices are supplied by the
`fonts-noto-cjk` package and are available under the SIL Open Font License 1.1.
They can be used in commercial and non-commercial projects, but are not sold as
standalone fonts. No unverified font files from the local LedCover archive are
bundled into ImageFWX.

Built with [ImageMagick](https://imagemagick.org/),
[rembg](https://github.com/danielgatis/rembg), [Next.js](https://nextjs.org/),
[FastAPI](https://fastapi.tiangolo.com/), [shadcn/ui](https://ui.shadcn.com/),
and [Tailwind CSS](https://tailwindcss.com/).

## Contributing

Issues and pull requests are welcome.
