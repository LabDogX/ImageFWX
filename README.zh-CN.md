# ImageFWX

> [English README](README.md)

ImageFWX 是一个基于 ImageMagick 的自托管照片成片工作台。它在 Next.js、FastAPI、PostgreSQL 和 Redis 架构上提供可视化边框编辑器、文字与图片水印、批量处理，以及安全的 NAS 只读照片浏览。

## ImageFWX 适合做什么

- 用统一边框和水印处理单张照片或批量照片。
- 从 NAS 导入照片，不暴露、修改或移动原始文件。
- 将处理结果保存到独立的 NAS 输出目录。
- 在要求登录的私有 Docker 部署中完成完整工作流。

## 核心功能

### 中英文界面

- 可从页面顶部的语言按钮在 English 和简体中文之间切换。选择会保存在浏览器本地；中文浏览器首次打开时默认使用简体中文。

### 相框与边框

- 上、右、下、左可独立设置或联动设置；单位可选像素或每张照片短边百分比。
- 支持安全的 `#RGB`、`#RRGGBB`、`#RRGGBBAA` 颜色、双层边框、固定比例 matte 画布、对齐与可调悬浮阴影。
- 原创预设：Classic White、Thin Black、Polaroid、Double Gallery、Square Matte、Portrait Matte、Warm Ivory、Graphite Gallery、Wide Matte、Story Matte、Floating Paper、Double Onyx 和 Custom。
- 后端 ImageMagick 预览与最终导出共用同一命令构建逻辑。

### 水印

- 文字水印支持九宫格位置、不透明度、字号、文字颜色、阴影颜色，以及 Sans、Serif、Mono、Noto/思源 CJK 字体；可选简体、繁体、日文、韩文与 CJK 粗体标题样式。
- Logo/图片水印可从已上传的 PNG、JPEG、WebP 或 SVG 图片库项中选择，可设置缩放、不透明度、位置和 X/Y 偏移。
- 图片水印请求只包含图片 ID，不接受浏览器提交服务器文件路径；后端验证访问权限后再解析内部路径。

### NAS 导入与输出

- NAS 目录浏览是可选功能，默认关闭，并受既有登录验证保护。
- 拒绝绝对路径、路径穿越、编码路径穿越、Windows 路径和越出 NAS 根目录的符号链接。
- 导入前校验扩展名、MIME 类型和文件大小。
- NAS 原图始终只读；导入副本进入 `/app/uploads`，处理结果写入 `/app/processed`。

### 保留的编辑工具

- 缩放、裁剪、旋转、翻转、格式转换、滤镜、直接下载、图片库、历史和批量任务。
- 在可选 AI 运行时可用时，支持背景移除、自动增强和 2×/4× 放大。

## 快速开始

```bash
git clone https://github.com/LabDogX/ImageFWX.git
cd ImageFWX
./scripts/setup.sh
```

构建并启动 CPU 服务：

```bash
docker compose up -d --build
```

初始化脚本不会覆盖已有 `.env`。如使用公开域名，请在启动前将 `ALLOWED_ORIGINS` 改为 `https://你的域名`。脚本会为创建首个账号临时开启注册；创建完成后应立即设置 `ALLOW_REGISTRATION=false`。

默认外部端口：

| 服务 | 主机端口 | 用途 |
|---|---:|---|
| Web 界面 | 3012 | Next.js 用户界面 |
| API | 8012 | FastAPI API 和 API 文档 |

- Swagger：`http://localhost:8012/docs`
- ReDoc：`http://localhost:8012/redoc`

## NAS / FnOS 部署

Docker-only 部署和 NAS 部署都只使用同一个 `docker-compose.yml`。如需 NAS 导入，在 `.env` 中填写以下内容，再使用普通启动命令：

```env
NAS_BROWSER_ENABLED=true
UPLOADS_STORAGE="/path/to/imagefwx-data/uploads"
PROCESSED_STORAGE="/path/to/processed-photos"
TEMP_STORAGE="/path/to/imagefwx-data/temp"
NAS_SOURCE_STORAGE="/path/to/original-photos"
```

以上均为占位示例，不是固定的宿主机路径；路径包含空格或中文等非 ASCII 字符时，请保留双引号。

```bash
docker compose up -d --build
```

容器以受限的 UID/GID `10001` 运行。对于 FnOS 的 Windows ACL 存储，请显式为该容器身份授予主机 `uploads`、`processed` 和 `temp` 目录的读、写和遍历权限，并让权限继承到目录内容。原始照片目录必须保持只读挂载，且绝不能把 `/app/processed` 映射到该目录。部署会继续使用此受限身份，不会将 ImageFWX 改为 root 或 NAS 所有者身份运行。

### FnOS v1.2+ 权限恢复

FnOS v1.2.0 起，存储空间改用 Windows ACL。Docker bind mount 显示 `rw=true`，并不代表 ImageFWX 的受限运行身份一定可以创建文件。FnOS 说明 Docker 目录仍保留 POSIX ACL 行为，因此应将 ImageFWX 的三个可写目录放入 Docker 项目下独立的 `data` 目录，而不是原始照片图库。完整步骤见[安装文档的 FnOS 权限恢复说明](docs/wiki/Installation.md#fnos-v120-windows-acl-permission-recovery)。

如需域名或 HTTPS，请用反向代理转发 Web 界面端口，并将 `ALLOWED_ORIGINS` 设置为公开的 HTTPS 域名；不再需要第二份 ImageFWX Compose 配置。ImageFWX 会将 Next.js Web 界面中未被本地路由处理的 `/api/*` 请求转发到内部 FastAPI，因此反向代理只需将公开站点转发到 `3012` 端口。

### Lucky 反向代理

在 Lucky 中创建一条 HTTPS Web 服务规则，将**默认后端地址**设为：

```text
http://NAS 局域网 IP:3012
```

“前端域名”只填写域名，例如 `image.example.com`，不要填写 `https://`，也不要额外创建 `/api` 子规则。Lucky 无法稳定地将同一域名下的不同路径分别转发到不同后端。设置 `ALLOWED_ORIGINS=https://image.example.com` 后，重新构建并启动：

```bash
docker compose up -d --build
```

无需为 `8012` 在 Lucky 中创建公网规则；浏览器 API 请求与 Web 界面共用同一个公开域名。

## 处理工作流

```text
NAS 原始照片（只读）
  -> 将选择的文件复制到 /app/uploads
  -> 编辑、预览、添加水印或批量处理
  -> 将结果写入 /app/processed
  -> NAS 处理结果目录（可写）
```

边框会在水印之前处理，所以文字和 Logo 可以定位在扩展的边框或 matte 区域。批量任务中，每张图片都会独立计算百分比边距和目标画布尺寸。

## 存储保留与定时清理

数据库准备就绪后，ImageFWX 会启动低频清理任务。它只扫描三个应用可写挂载目录，绝不会读取、删除或修改 `NAS_SOURCE_STORAGE`。

```env
# 图片库记录、原始上传副本与缩略图
HISTORY_RETENTION_HOURS=24

# ImageMagick 临时工作文件
TEMP_RETENTION_HOURS=24

# /app/processed 下的已完成文件；设为 0 则不清理此目录
PROCESSED_RETENTION_HOURS=168

# 每 60 分钟执行一次；可用范围是 5–1440 分钟
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MINUTES=60
```

任务会删除过期图片数据库记录及其上传副本和缩略图，也会删除未被引用的旧上传文件、临时工作文件和过期处理结果。请根据备份策略设置处理结果保留期：达到期限的导出文件会被永久删除。修改配置后执行 `docker compose up -d --build` 使其生效。

## 配置与安全

- `NAS_BROWSER_ENABLED=false` 是默认值。
- 任何可被互联网访问的部署都应保持 `REQUIRE_LOGIN=true` 和 `ALLOW_REGISTRATION=false`。
- 在反向代理使用 HTTPS，并将 `ALLOWED_ORIGINS` 设置为实际站点。
- 不要发布 PostgreSQL 或 Redis 端口。
- 首次启动前替换三个必填密钥。
- ImageMagick 命令基于已验证的操作参数构建，并设有超时和资源限制；图片与 NAS 文件均做 MIME 校验。
- 浏览器上传和 NAS 导入的单文件上限均为 50 MB。

## 开发与验证

后端：

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pytest -m "not slow"
```

前端：

```bash
cd frontend
npm ci
npm run lint
npm run build
npm audit
```

## 许可证与鸣谢

ImageFWX 保留上游 MIT License 和版权声明。相框、NAS 导入和水印增强均为原创实现；不包含 Magick Frames 的源码、素材、配置、预设或专有命名。

内置 Noto 与思源系列水印字体由 `fonts-noto-cjk` 包提供，遵循 SIL Open Font License 1.1。它们可用于商业和非商业项目，但不得作为独立字体出售；ImageFWX 不会打包 LedCover 本地字体档案中许可证无法核验的字体文件。

本项目使用 [ImageMagick](https://imagemagick.org/)、[rembg](https://github.com/danielgatis/rembg)、[Next.js](https://nextjs.org/)、[FastAPI](https://fastapi.tiangolo.com/)、[shadcn/ui](https://ui.shadcn.com/) 和 [Tailwind CSS](https://tailwindcss.com/)。

## 贡献

欢迎提交 Issue 和 Pull Request。
