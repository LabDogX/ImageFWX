# ImageFWX

> English project homepage · [中文说明](README.zh-CN.md)

ImageFWX is a self-hosted photo-finishing workspace for ImageMagick. It adds a
visual frame editor, text and image watermarks, batch processing, and a safe
read-only NAS photo browser to a Next.js, FastAPI, PostgreSQL, and Redis stack.

When user-facing features or deployment instructions change, update this file
and [README.zh-CN.md](README.zh-CN.md) together.

## What ImageFWX is for

- Finish a single photo or a batch with consistent borders and watermarks.
- Import photos from a NAS without exposing, modifying, or moving originals.
- Save processed results to a separate NAS directory.
- Run the complete workflow in a private Docker deployment with login required.

## Highlights

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
  shadow color, and built-in Sans, Serif, or Mono fonts.
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
cp .env.example .env
```

Set these values in `.env` before starting:

```env
SECRET_KEY=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
POSTGRES_PASSWORD=<random URL-safe password>
ALLOWED_ORIGINS=https://your-domain.example
REQUIRE_LOGIN=true
ALLOW_REGISTRATION=false
```

Build and start the CPU service:

```bash
docker compose up -d --build
```

Default public ports:

| Service | Host port | Purpose |
|---|---:|---|
| Web UI | 3012 | Next.js interface |
| API | 8012 | FastAPI API and API documentation |

- Swagger UI: `http://localhost:8012/docs`
- ReDoc: `http://localhost:8012/redoc`

## NAS / Feiniu deployment

Copy the override, replace the example paths with your NAS paths, and start
with both Compose files:

```bash
cp docker-compose.nas.example.yml docker-compose.nas.yml
docker compose -f docker-compose.yml -f docker-compose.nas.yml up -d --build
```

Example mounts:

```yaml
services:
  app:
    volumes:
      - "/vol1/1000/Docker/imagemagick-webui/uploads:/app/uploads"
      - "/vol1/1000/照片处理结果:/app/processed"
      - "/vol1/1000/Docker/imagemagick-webui/temp:/tmp/imagemagick"
      - "/vol1/1000/照片:/mnt/photos:ro"
    environment:
      NAS_BROWSER_ENABLED: "true"
      NAS_SOURCE_DIR: /mnt/photos
      NAS_MAX_IMPORT_FILES: "100"
```

The container runs as UID/GID `10001`. Grant that identity write access to the
host `uploads`, `processed`, and `temp` directories. Keep the original-photo
mount read-only and never map `/app/processed` to it.

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

Built with [ImageMagick](https://imagemagick.org/),
[rembg](https://github.com/danielgatis/rembg), [Next.js](https://nextjs.org/),
[FastAPI](https://fastapi.tiangolo.com/), [shadcn/ui](https://ui.shadcn.com/),
and [Tailwind CSS](https://tailwindcss.com/).

## Contributing

Issues and pull requests are welcome. Keep `README.md` and `README.zh-CN.md`
aligned whenever you change user-visible behavior or deployment guidance.
