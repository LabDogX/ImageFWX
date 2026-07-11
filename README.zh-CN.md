<div align="center">

<img src="./assets/icon.png" alt="ImageFWX 图标" width="180"/>

# ImageFWX

> 中文 README。仓库主页使用 [English README](README.md)。修改用户可见功能或部署说明时，必须同步更新两份 README。

</div>

## 相框、边框与 NAS 照片

ImageFWX 是基于 ImageMagick WebGUI 的功能增强 fork，提供原创的照片边框、文字/图片水印，以及 NAS 只读浏览和导入。

边框由后端 ImageMagick 生成，实时预览与最终导出共用同一条处理逻辑。项目不包含外部相框代码、素材或预设文件。

NAS 浏览器默认关闭。开启后，NAS 原图以只读方式挂载，选中的文件会先复制到应用 uploads 工作目录；原图不会被修改、重命名或生成缩略图。处理结果必须保存到独立的可写目录，绝不能将 `/app/processed` 指向原始照片目录。

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

## 功能

### 图像处理

- 缩放、裁剪、旋转、翻转与格式转换
- 模糊、锐化、灰度、褐色调、亮度、对比度与饱和度
- 多图批量处理
- 直接下载和处理历史

### 相框与边框

- 四边可独立设置，或使用四边联动
- 像素单位或原图短边百分比
- 严格十六进制颜色校验：`#RGB`、`#RRGGBB`、`#RRGGBBAA`
- 双层边框、固定画布比例和对齐
- 可选悬浮阴影相框
- 后端 ImageMagick 实时预览

内置原创预设：

- Classic White、Thin Black、Polaroid、Double Gallery
- Square Matte、Portrait Matte、Warm Ivory、Graphite Gallery
- Wide Matte、Story Matte、Floating Paper、Double Onyx
- Custom（完全自定义）

支持的画布比例：原始比例、1:1、4:5、3:2、2:3、16:9、9:16。边框会在文字/图片水印之前处理，因此水印可以定位在扩展后的画布区域。

### 水印

- 文字水印：九宫格定位、8–72 pt 字号、不透明度、文字色、阴影色
- 容器内字体白名单：Sans、Serif、Mono
- Logo/图片水印：从已上传的 PNG、JPEG、WebP 或 SVG 图片库项中选择
- 图片水印支持位置、按原图短边计算的缩放、不透明度和 X/Y 偏移

图片水印 API 只接受数据库图片 ID；后端会验证所有权和 MIME 类型，再解析内部路径，不接受浏览器传入的服务器文件路径。

### AI 与界面

- rembg 一键移除背景
- 自动增强与 2×/4× 智能放大
- 图片库、拖放上传、明暗主题、PWA 和终端模式
- Upload / NAS 切换入口；NAS 功能关闭时不会显示 NAS 入口

## 快速开始

```bash
git clone https://github.com/LabDogX/ImageFWX.git
cd ImageFWX
cp .env.example .env
```

编辑 `.env`，至少填写：

```env
SECRET_KEY=<openssl rand -hex 32>
JWT_SECRET=<openssl rand -hex 32>
POSTGRES_PASSWORD=<随机且 URL 安全的密码>
ALLOWED_ORIGINS=https://你的域名
```

然后构建并启动：

```bash
docker compose up -d --build
```

默认访问地址：

| 服务 | 外部端口 | 说明 |
|---|---:|---|
| Web 前端 | 3012 | Next.js 界面 |
| 后端 API | 8012 | FastAPI REST API |
| PostgreSQL | 5432 | 仅 Docker 内部使用 |
| Redis | 6379 | 仅 Docker 内部使用 |

- Swagger：`http://localhost:8012/docs`
- ReDoc：`http://localhost:8012/redoc`

## NAS / 飞牛部署

复制并按实际主机路径修改 NAS 覆盖文件：

```bash
cp docker-compose.nas.example.yml docker-compose.nas.yml
docker compose -f docker-compose.yml -f docker-compose.nas.yml up -d --build
```

容器以固定 UID/GID `10001` 运行。开始前，请为主机上的 `uploads`、`processed` 与 `temp` 目录授予 UID/GID `10001` 写权限；原始照片目录只保持 `:ro` 挂载。

示例：

```yaml
services:
  app:
    volumes:
      - "/vol1/1000/Docker/imagemagick-webui/uploads:/app/uploads"
      - "/vol1/1000/照片处理结果:/app/processed"
      - "/vol1/1000/Docker/imagemagick-webui/temp:/tmp/imagemagick"
      - "/vol1/1000/照片:/mnt/photos:ro"
```

外网部署时必须：

- 使用 HTTPS 反向代理，并将 `ALLOWED_ORIGINS` 设置为实际域名
- 保持 `REQUIRE_LOGIN=true` 与 `ALLOW_REGISTRATION=false`
- 使用随机 `SECRET_KEY`、`JWT_SECRET`、`POSTGRES_PASSWORD`
- 不公开 PostgreSQL 和 Redis 端口

## 本地开发与验证

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

## 项目结构

```text
ImageFWX/
├── backend/                 # FastAPI、任务 Worker、ImageMagick 服务与测试
├── frontend/                # Next.js 用户界面
├── docs/wiki/               # 安装、编辑器、安全与部署文档
├── docker-compose.yml       # 主 Compose 配置
├── docker-compose.nas.example.yml
├── Dockerfile
├── README.md                # English repository homepage
└── README.zh-CN.md          # 本文件
```

## 安全原则

- ImageMagick 命令白名单、资源限制和参数校验
- NAS 仅接受相对路径，阻止路径穿越、绝对路径与符号链接越界
- NAS 原图只读；导入副本进入应用工作目录
- 文件扩展名、MIME 类型和大小均需校验
- 容器以非 root 用户运行

## 许可证与鸣谢

本项目保留上游 MIT License 与版权声明。边框、NAS 导入和水印增强均为本项目原创实现；未引入或打包 Magick Frames 的代码、配置、素材或专有命名。

感谢以下开源项目：

- [ImageMagick](https://imagemagick.org/)
- [rembg](https://github.com/danielgatis/rembg)
- [Next.js](https://nextjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 贡献

欢迎提交 Issue 或 Pull Request。请在修改功能或部署说明时，同时更新英文 `README.md` 与中文 `README.zh-CN.md`。

