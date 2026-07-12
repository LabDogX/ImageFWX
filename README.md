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
  shadow color, and built-in Sans, Serif, Mono, Source Han Sans (思源黑体), or
  Source Han Serif (思源宋体) fonts.
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

Detect the compatible accelerator and start the matching service:

```bash
./scripts/start-with-acceleration.sh
```

The setup script never replaces an existing `.env`. For a public domain, set
`ALLOWED_ORIGINS=https://your-domain.example` before starting. It enables
registration for the first account; set `ALLOW_REGISTRATION=false` immediately
after that account is created.

Set `ACCELERATOR=cpu`, `nvidia`, `amd`, or `intel` in `.env` to override the
automatic choice. In `auto` mode, an unavailable selected provider falls back
to CPU after verification.

Default public ports:

| Service | Host port | Purpose |
|---|---:|---|
| Web UI | 3012 | Next.js interface |
| API | 8012 | FastAPI API and API documentation |

- Swagger UI: `http://localhost:8012/docs`
- ReDoc: `http://localhost:8012/redoc`

## Hardware acceleration

The default service is CPU-only. Background removal can use an optional ONNX
Runtime execution provider; all other image editing continues to use
ImageMagick.

| Hardware | Status | Start command |
|---|---|---|
| CPU | Default | `docker compose up -d --build` |
| NVIDIA CUDA | Existing profile | `docker compose --profile gpu up -d --build app-gpu` |
| Intel GPU | Experimental OpenVINO profile | `docker compose --profile intel up -d --build app-intel` |
| AMD GPU | Experimental MIGraphX profile | `docker compose --profile amd up -d --build app-amd` |

`./scripts/start-with-acceleration.sh` detects the Linux host before starting
containers: NVIDIA first, then AMD ROCm, then Intel DRM; otherwise it uses the
CPU service. It derives AMD and Intel device group IDs from the host and checks
the selected ONNX provider inside the container. This avoids a healthy-looking
container silently using CPU when an accelerator image is misconfigured.

For Intel GPU acceleration, use a Linux host with the Intel DRM device exposed
at `/dev/dri`; the `app-intel` service maps that device. Set
`OPENVINO_DEVICE=GPU` to require the GPU, or leave `AUTO` to let OpenVINO
choose a compatible Intel device. `CPU` is useful for diagnosis. Intel NPU
passthrough depends on the host device node and is not bundled in the Compose
profile.

Run only one of `app`, `app-gpu`, or `app-intel` against the same Compose
project at a time. The explicit target-service commands above prevent the
default CPU service from being started alongside an accelerator service.

AMD acceleration uses the MIGraphX execution provider on Linux x86_64 hosts
with a ROCm-supported AMD GPU and driver. Before starting, confirm the host
can access `/dev/kfd` and `/dev/dri`, then set the matching numeric group IDs
in `.env`:

```bash
stat -c '%g' /dev/kfd
stat -c '%g' /dev/dri/renderD128
```

```env
AMD_VIDEO_GID=<group ID for /dev/kfd>
AMD_RENDER_GID=<group ID for /dev/dri/renderD128>
MIGRAPHX_DEVICE_ID=0
ROCR_VISIBLE_DEVICES=0
```

The AMD image is large because it includes ROCm and MIGraphX. It uses only
device mappings and groups; it does not request privileged mode, an unconfined
seccomp profile, or `SYS_PTRACE`. The first model execution can take longer
while MIGraphX compiles the graph.

Verify that the container selected MIGraphX after startup:

```bash
docker compose --profile amd exec app-amd /verify-amd-acceleration.sh
```

## NAS / Feiniu deployment

ImageFWX uses the same `docker-compose.yml` for Docker-only and NAS setups.
For NAS import, set these values in `.env`, then run the normal start command:

```env
NAS_BROWSER_ENABLED=true
UPLOADS_STORAGE="/vol1/1000/Docker/ImageFWX/uploads"
PROCESSED_STORAGE="/vol1/1000/照片处理结果"
TEMP_STORAGE="/vol1/1000/Docker/ImageFWX/temp"
NAS_SOURCE_STORAGE="/vol1/1000/照片"
```

```bash
docker compose up -d --build
```

The container runs as UID/GID `10001`. Grant that identity write access to the
host `uploads`, `processed`, and `temp` directories. Keep the original-photo
mount read-only and never map `/app/processed` to it.

For a domain or HTTPS, place Nginx Proxy Manager, Caddy, Traefik, or an
existing reverse proxy in front of the Web UI port. Set `ALLOWED_ORIGINS` to
the public HTTPS origin; no second ImageFWX Compose file is needed.

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
- `ACCELERATOR_PROVIDER` accepts `auto`, `cpu`, `cuda`, `openvino`, or
  `migraphx`. `OPENVINO_DEVICE` accepts `AUTO`, `CPU`, `GPU`, `GPU.0`,
  `GPU.1`, or `NPU`.
- `MIGRAPHX_DEVICE_ID` selects the AMD GPU index when using `app-amd`.

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

Source Han Sans and Source Han Serif watermark choices are supplied by the
`fonts-noto-cjk` package and are available under the SIL Open Font License 1.1.

Built with [ImageMagick](https://imagemagick.org/),
[rembg](https://github.com/danielgatis/rembg), [Next.js](https://nextjs.org/),
[FastAPI](https://fastapi.tiangolo.com/), [shadcn/ui](https://ui.shadcn.com/),
and [Tailwind CSS](https://tailwindcss.com/).

## Contributing

Issues and pull requests are welcome.
