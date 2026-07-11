<div align="center">

<img src="./assets/icon.png" alt="ImageMagick WebGUI Icon" width="180"/> 

# ImageMagick WebGUI

> English README (repository homepage). [中文说明](README.zh-CN.md) · Keep both README files synchronized when changing user-facing features or deployment instructions.

## Frames and NAS photos

ImageFWX adds an original border editor with Classic White, Thin Black, Polaroid,
Double Gallery, Square Matte, and Portrait Matte parameter presets. Borders are
rendered by the backend ImageMagick pipeline for both preview and export; no
external frame code or assets are included.

Additional original presets provide warm, graphite, wide, story, floating-paper,
and double-dark treatments. Text watermarks support built-in font choices and
custom text/shadow colors. Uploaded PNG, JPEG, WebP, and SVG library images can
also be used as safely resolved logo/image watermarks.

The NAS browser is disabled by default. Enable it only with a read-only source
mount and a separate writable output mount:

```yaml
volumes:
  - "/vol1/1000/照片:/mnt/photos:ro"
  - "/vol1/1000/照片处理结果:/app/processed"
environment:
  - NAS_BROWSER_ENABLED=true
  - NAS_SOURCE_DIR=/mnt/photos
  - NAS_MAX_IMPORT_FILES=100
  - REQUIRE_LOGIN=true
  - ALLOW_REGISTRATION=false
```

NAS files are copied into `/app/uploads` before processing; original photos are
never renamed, modified, or thumbnail-generated in the NAS source. Do not point
`/app/processed` at the original-photo directory. The project retains the
upstream MIT License and copyright notices.

<br/>
</div>

<div align="center">

[![Stars](https://img.shields.io/github/stars/LabDogX/ImageFWX?style=for-the-badge)](https://github.com/LabDogX/ImageFWX/stargazers)
[![Forks](https://img.shields.io/github/forks/LabDogX/ImageFWX?style=for-the-badge)](https://github.com/LabDogX/ImageFWX/network/members)
[![Issues](https://img.shields.io/github/issues/LabDogX/ImageFWX?style=for-the-badge)](https://github.com/LabDogX/ImageFWX/issues)
[![License](https://img.shields.io/github/license/LabDogX/ImageFWX?style=for-the-badge)](https://github.com/LabDogX/ImageFWX/blob/main/LICENSE)

**A modern, beautiful web interface for ImageMagick with AI-powered features**

[Features](#-features) • [Quick Start](#-quick-start) • [Configuration](#%EF%B8%8F-configuration) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 📽️ Demo Video

https://github.com/user-attachments/assets/53538ac9-8642-4c9b-972f-772c17efa9fa

---

## ✨ Features

### 🎨 Image Processing
- **Resize & Crop** - Precise dimensions, percentage scaling, aspect ratio lock
- **Format Conversion** - WebP, AVIF, JPEG, PNG, GIF, TIFF, PDF support
- **Filters & Effects** - Blur, Sharpen, Grayscale, Sepia, Brightness, Contrast, Saturation
- **Watermark & Text** - Custom text overlays with position, opacity, and font size control
- **Rotate & Flip** - 90°, 180°, 270° rotation with horizontal/vertical flip
- **Batch Processing** - Process multiple images simultaneously

### 🤖 AI-Powered Features
- **Background Removal** - One-click AI background removal using rembg
- **Auto Enhance** - Automatic image enhancement (normalize, saturation, sharpening)
- **Smart Upscaling** - 2x/4x resolution upscaling with LANCZOS algorithm

### 🖥️ User Interface
- **Notion-inspired Design** - Ultra-clean, minimalist white interface
- **Real-time Preview** - See changes before applying
- **Drag & Drop Upload** - Easy multi-file upload
- **Image Editor** - Full-featured editor with live preview
- **Terminal Mode** - Direct ImageMagick command input for power users
- **Dark/Light Mode** - Automatic or manual theme switching
- **PWA Support** - Install as desktop/mobile app

### 🔧 Technical
- **Docker Ready** - One command deployment
- **Type-Safe** - Full TypeScript + Pydantic validation
- **Secure** - Command whitelist, timeouts, resource limits
- **Queue System** - Redis-based job queue for heavy operations
- **History** - Track all processed images with re-download option

---

## 🚀 Quick Start
```bash
git clone https://github.com/LabDogX/ImageFWX.git
cd ImageFWX
cp .env.example .env
# Fill SECRET_KEY, JWT_SECRET, POSTGRES_PASSWORD, and ALLOWED_ORIGINS in .env.
docker compose up -d --build
```

**Access:** http://localhost:3012

> 📖 **Need custom ports, authentication, or reverse proxy?** See [Installation Guide](docs/wiki/Installation.md)

> ⚠️ **Production:** Change `SECRET_KEY` and `JWT_SECRET` in docker-compose.yml before deploying!

## 📖 Documentation

### Default Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3012 | Next.js web interface |
| Backend | 8012 | FastAPI REST API |
| PostgreSQL | 5432 | Database (internal) |
| Redis | 6379 | Queue system (internal) |

### API Documentation

Once running, access the interactive API docs:
- **Swagger UI:** [http://localhost:8012/docs](http://localhost:8012/docs)
- **ReDoc:** [http://localhost:8012/redoc](http://localhost:8012/redoc)

### Architecture
```
┌─────────────────┐     ┌─────────────────┐
│   Next.js 15    │────▶│    FastAPI      │
│   (Frontend)    │     │   (Backend)     │
│   Port: 3000    │     │   Port: 8000    │
└─────────────────┘     └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌───────▼───────┐
              │ PostgreSQL│           │     Redis     │
              │   (DB)    │           │   (Queue)     │
              │ Port: 5432│           │  Port: 6379   │
              └───────────┘           └───────────────┘
                                              │
                                      ┌───────▼───────┐
                                      │  RQ Worker    │
                                      │ (Background)  │
                                      └───────────────┘
```

### Supported Operations

| Operation | Parameters | Example |
|-----------|------------|---------|
| `resize` | `width`, `height`, `percent`, `fit` | `{"width": 800, "height": 600}` |
| `crop` | `x`, `y`, `width`, `height` | `{"x": 0, "y": 0, "width": 500, "height": 500}` |
| `rotate` | `degrees` | `{"degrees": 90}` |
| `flip` | `direction` | `{"direction": "horizontal"}` |
| `blur` | `sigma` | `{"sigma": 10}` |
| `sharpen` | `sigma` | `{"sigma": 2}` |
| `brightness` | `value` | `{"value": 120}` |
| `contrast` | `value` | `{"value": 110}` |
| `saturation` | `value` | `{"value": 130}` |
| `grayscale` | - | `{}` |
| `sepia-tone` | `threshold` | `{"threshold": 80}` |
| `watermark` | `text`, `position`, `font_size`, `opacity` | `{"text": "©2024", "position": "southeast"}` |
| `format` | `format`, `quality` | `{"format": "webp", "quality": 85}` |

### Terminal Mode

For advanced users, use Terminal Mode to run raw ImageMagick commands:
```bash
# Convert to WebP with quality
magick input.jpg -quality 80 output.webp

# Create thumbnail
magick input.jpg -thumbnail 300x300 output.jpg

# Add border
magick input.jpg -border 10x10 -bordercolor "#ff0000" output.jpg

# Composite images
magick base.jpg overlay.png -composite output.jpg
```

---

## 📸 Screenshots

<details>
<summary>Click to view screenshots</summary>

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Image Editor
![Editor](docs/screenshots/editor.png)

### Dark Mode
![Dark Mode](docs/screenshots/darkmode.png)

### Settings
![Settings](docs/screenshots/settings.png)
</details>

---

## 🛠️ Development

### Local Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

### Project Structure
```
imagemagick-webui/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Config, security, database
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Business logic
│   │   └── workers/      # Background tasks
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── features/     # Feature components
│   │   ├── layout/       # Layout components
│   │   └── ui/           # UI primitives (shadcn/ui)
│   └── lib/              # Utilities, API client, store
├── docker-compose.yml
├── Dockerfile
└── README.md
```

---

## 🔒 Security

- **Command Whitelist** - Only allowed ImageMagick operations
- **Input Validation** - Pydantic models for all inputs
- **Resource Limits** - Memory (2GB), timeout (300s), disk limits
- **File Validation** - MIME type and extension checking
- **Rate Limiting** - Configurable request limits
- **Non-root Container** - Runs as unprivileged user

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 💖 Support

If you find this project useful, please consider supporting its development:

<div align="center">

[![Buy Me A Coffee](https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png)](https://www.buymeacoffee.com/przemekskw)

[![PayPal](https://img.shields.io/badge/PayPal-Donate-blue.svg?style=for-the-badge)](https://paypal.me/przemekskw)

[![GitHub Sponsors](https://img.shields.io/github/sponsors/PrzemekSkw?style=for-the-badge&logo=github&color=ea4aaa)](https://github.com/sponsors/PrzemekSkw)

</div>

Your support helps maintain and improve this project. Thank you! ❤️

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=PrzemekSkw/imagemagick-webui&type=Date)](https://star-history.com/#PrzemekSkw/imagemagick-webui&Date)

---

## 🙏 Acknowledgments

- [ImageMagick](https://imagemagick.org/) - The powerful image processing library
- [rembg](https://github.com/danielgatis/rembg) - AI background removal
- [Next.js](https://nextjs.org/) - React framework
- [FastAPI](https://fastapi.tiangolo.com/) - Python web framework
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS

---

<div align="center">

Made with ❤️ by [PrzemekSkw](https://github.com/PrzemekSkw)

</div>
