"""
ImageMagick service for secure command execution
"""

import os
import re
import shlex
import asyncio
import subprocess
from typing import List, Dict, Optional, Tuple, Literal
from pathlib import Path
import uuid
from datetime import datetime

from app.core.config import settings


HEX_COLOR_RE = re.compile(r"^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$")
TARGET_RATIOS = {
    "original": None, "1:1": (1, 1), "4:5": (4, 5), "3:2": (3, 2),
    "2:3": (2, 3), "16:9": (16, 9), "9:16": (9, 16),
}

# Server-owned font identifiers for text watermarks. Do not accept font names
# or paths from API clients: ImageMagick resolves fontconfig patterns itself.
# These families are installed by fonts-dejavu-core and fonts-noto-cjk in every
# production image. Noto CJK is the Google distribution of Adobe Source Han.
WATERMARK_FONT_FAMILIES = {
    "sans": "DejaVu-Sans",
    "sans-bold": "DejaVu-Sans-Bold",
    "sans-condensed": "DejaVu-Sans-Condensed",
    "serif": "DejaVu-Serif",
    "serif-bold": "DejaVu-Serif-Bold",
    "serif-italic": "DejaVu-Serif-Italic",
    "mono": "DejaVu-Sans-Mono",
    "mono-bold": "DejaVu-Sans-Mono-Bold",
    # Keep these legacy IDs so existing saved jobs remain compatible.
    "source-han-sans": "Noto Sans CJK SC",
    "source-han-serif": "Noto Serif CJK SC",
    "noto-sans-sc": "Noto Sans CJK SC",
    "noto-sans-sc-bold": "Noto Sans CJK SC:style=Bold",
    "noto-serif-sc": "Noto Serif CJK SC",
    "noto-serif-sc-bold": "Noto Serif CJK SC:style=Bold",
    "noto-sans-tc": "Noto Sans CJK TC",
    "noto-serif-tc": "Noto Serif CJK TC",
    "noto-sans-jp": "Noto Sans CJK JP",
    "noto-serif-jp": "Noto Serif CJK JP",
    "noto-sans-kr": "Noto Sans CJK KR",
    "noto-serif-kr": "Noto Serif CJK KR",
}


def validate_hex_color(value: str) -> bool:
    """Return True only for the supported, shell-safe hexadecimal colors."""
    return isinstance(value, str) and bool(HEX_COLOR_RE.fullmatch(value))


def hex_to_rgba(value: str, opacity: float) -> str:
    """Convert a validated hex color to an ImageMagick rgba() fill."""
    hex_value = value.lstrip("#")
    if len(hex_value) == 3:
        hex_value = "".join(character * 2 for character in hex_value)
    alpha = int(hex_value[6:8], 16) / 255 if len(hex_value) == 8 else 1.0
    return f"rgba({int(hex_value[0:2], 16)},{int(hex_value[2:4], 16)},{int(hex_value[4:6], 16)},{opacity * alpha:.3f})"


def percentage_to_pixels(short_edge: int, percentage: float) -> int:
    """Convert a short-edge percentage using the product specification rounding."""
    return round(short_edge * percentage / 100)


def calculate_border_pixels(width: int, height: int, params: Dict) -> Dict[str, int]:
    """Pure per-image border calculation; never reuses another image's dimensions."""
    short_edge = min(width, height)
    unit = params["unit"]
    convert = (lambda n: percentage_to_pixels(short_edge, n)) if unit == "percent" else (lambda n: int(n))
    return {side: convert(params[side]) for side in ("top", "right", "bottom", "left")}


def parse_target_ratio(value: str) -> Optional[Tuple[int, int]]:
    if value not in TARGET_RATIOS:
        raise ValueError("Unsupported target ratio")
    return TARGET_RATIOS[value]


def calculate_target_canvas(width: int, height: int, target_ratio: str) -> Tuple[int, int]:
    """Return a canvas that contains the image without cropping or scaling."""
    ratio = parse_target_ratio(target_ratio)
    if ratio is None:
        return width, height
    rw, rh = ratio
    if width * rh > height * rw:
        return width, round(width * rh / rw)
    return round(height * rw / rh), height


def build_border_arguments(width: int, height: int, params: Dict) -> Tuple[List[str], Tuple[int, int]]:
    """Build ImageMagick arguments for a validated border operation.

    `-extent` is used with NorthWest gravity and explicit offsets so asymmetric
    sides are deterministic.  All values arrive from validated Pydantic data.
    """
    outer = calculate_border_pixels(width, height, params)
    args: List[str] = []
    current_w, current_h = width, height
    if params["mode"] == "double" and params["inner_size"]:
        inner = percentage_to_pixels(min(width, height), params["inner_size"]) if params["inner_unit"] == "percent" else int(params["inner_size"])
        args += [f"-bordercolor {shlex.quote(params['inner_color'])}", f"-border {inner}x{inner}", "+repage"]
        current_w += inner * 2
        current_h += inner * 2

    framed_w = current_w + outer["left"] + outer["right"]
    framed_h = current_h + outer["top"] + outer["bottom"]
    args += ["-gravity NorthWest", f"-background {shlex.quote(params['color'])}",
             f"-extent {framed_w}x{framed_h}+{outer['left']}+{outer['top']}", "+repage"]
    current_w, current_h = framed_w, framed_h

    if params["mode"] == "matte" and params["target_ratio"] != "original":
        target_w, target_h = calculate_target_canvas(current_w, current_h, params["target_ratio"])
        gravity = {
            ("left", "top"): "NorthWest", ("center", "top"): "North", ("right", "top"): "NorthEast",
            ("left", "center"): "West", ("center", "center"): "Center", ("right", "center"): "East",
            ("left", "bottom"): "SouthWest", ("center", "bottom"): "South", ("right", "bottom"): "SouthEast",
        }[(params["horizontal_alignment"], params["vertical_alignment"])]
        args += [f"-gravity {gravity}", f"-background {shlex.quote(params['color'])}", f"-extent {target_w}x{target_h}", "+repage"]
        current_w, current_h = target_w, target_h
    if params.get("shadow_enabled"):
        shadow = shlex.quote(params["shadow_color"])
        opacity = round(float(params["shadow_opacity"]) * 100)
        blur = int(params["shadow_blur"])
        offset_x, offset_y = int(params["shadow_offset_x"]), int(params["shadow_offset_y"])
        args += ["\\(", "+clone", f"-background {shadow}", f"-shadow {opacity}x{blur}+{offset_x}+{offset_y}", "\\)",
                 "+swap", f"-background {shlex.quote(params['color'])}", "-layers merge", "+repage"]
    return args, (current_w, current_h)


class ImageMagickError(Exception):
    """Custom exception for ImageMagick errors"""
    pass


class ImageMagickService:
    """
    Secure ImageMagick command execution service
    """
    
    # Whitelisted operations
    ALLOWED_OPERATIONS = {
        # Basic transforms
        "resize", "crop", "rotate", "flip", "flop", "transpose", "transverse",
        # Quality and format
        "quality", "format", "compress", "strip",
        # Filters and effects
        "blur", "sharpen", "unsharp", "emboss", "edge", "charcoal", "sketch",
        "grayscale", "sepia-tone", "negate", "modulate", "brightness-contrast",
        "colorize", "tint", "gamma", "level", "auto-level", "normalize",
        "enhance", "auto-orient", "auto-gamma",
        # Watermark and overlay
        "composite", "annotate", "watermark", "image-watermark", "draw", "font", "pointsize", "fill", "gravity",
        # Geometry
        "extent", "trim", "shave", "border", "frame",
        # Color adjustments
        "colorspace", "depth", "alpha", "transparent",
        # Metadata
        "identify", "verbose",
        # Other safe operations
        "thumbnail", "sample", "scale", "adaptive-resize",
        "deskew", "despeckle", "noise", "median",
    }
    
    # Dangerous patterns to block
    BLOCKED_PATTERNS = [
        r"[;&|`$]",  # Shell injection characters
        r"\.\./",  # Path traversal
        r"ephemeral:",  # ImageMagick special protocols
        r"msl:",
        r"mvg:",
        r"url:",
        r"https?:",
        r"ftp:",
        r"label:",
        r"caption:",
        r"pango:",
        r"/dev/",  # Device files
        r"/proc/",  # Proc filesystem
        r"/etc/",  # Config files
        r"\\x",  # Hex escape sequences
    ]
    
    # Allowed input formats
    ALLOWED_INPUT_FORMATS = {
        "jpg", "jpeg", "png", "webp", "gif", "svg", "tiff", "tif",
        "pdf", "bmp", "ico", "heic", "heif", "avif", "psd"
    }
    
    # Allowed output formats
    ALLOWED_OUTPUT_FORMATS = {
        "jpg", "jpeg", "png", "webp", "gif", "avif", "tiff", "pdf", "bmp", "ico"
    }
    
    def __init__(self):
        self.timeout = settings.imagemagick_timeout
        self.memory_limit = settings.imagemagick_memory_limit
        self.temp_dir = Path(settings.temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._magick_cmd = None  # Will be detected on first use
    
    async def _get_magick_cmd(self) -> str:
        """Detect which ImageMagick command is available"""
        if self._magick_cmd:
            return self._magick_cmd
        
        for cmd in ["magick", "convert"]:
            try:
                process = await asyncio.create_subprocess_shell(
                    f"which {cmd}",
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await process.communicate()
                if process.returncode == 0:
                    self._magick_cmd = cmd
                    return cmd
            except:
                pass
        
        self._magick_cmd = "magick"  # Default fallback
        return self._magick_cmd
    
    def validate_file(self, file_path: str) -> bool:
        """Validate that file exists and has allowed extension"""
        path = Path(file_path)
        if not path.exists():
            return False
        
        ext = path.suffix.lower().lstrip(".")
        return ext in self.ALLOWED_INPUT_FORMATS
    
    def validate_command(self, command: str) -> Tuple[bool, str]:
        """
        Validate ImageMagick command for security
        Returns (is_valid, error_message)
        """
        # Check for blocked patterns
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, command, re.IGNORECASE):
                return False, f"Blocked pattern detected: {pattern}"
        
        return True, ""
    
    def sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to prevent path traversal"""
        # Remove path components
        filename = os.path.basename(filename)
        # Remove potentially dangerous characters
        filename = re.sub(r'[^\w\-_\.]', '_', filename)
        return filename
    
    async def build_command(
        self,
        input_path: str,
        output_path: str,
        operations: List[Dict]
    ) -> str:
        """
        Build a safe ImageMagick command from operations
        """
        magick_cmd = await self._get_magick_cmd()
        
        cmd_parts = [
            magick_cmd,
            f"-limit memory {self.memory_limit}",
            f"-limit time {self.timeout}",
        ]
        
        # Check if input is PDF
        is_pdf = input_path.lower().endswith('.pdf')
        
        if is_pdf:
            # For PDF: add density before input for better quality
            cmd_parts.append("-density 150")
            # Add input file with page selector [0] for first page
            cmd_parts.append(shlex.quote(f"{input_path}[0]"))
            # Flatten to handle transparency
            cmd_parts.append("-flatten")
        else:
            # Add input file (quoted and validated)
            cmd_parts.append(shlex.quote(input_path))
        
        # Always auto-orient to fix EXIF rotation issues
        cmd_parts.append("-auto-orient")
        
        # Process operations
        # Get image dimensions for scaling
        img_width = img_height = None
        try:
            from PIL import Image as PILImage
            with PILImage.open(input_path) as pil_img:
                img_width = pil_img.width
                img_height = pil_img.height
        except:
            pass

        for op in operations:
            op_name = op.get("operation", "").lower().replace("_", "-")
            params = op.get("params", {})
            
            if op_name not in self.ALLOWED_OPERATIONS:
                continue
            
            # Build operation string based on type
            if op_name == "resize":
                width = int(params.get("width", 0))
                height = int(params.get("height", 0))
                mode = params.get("mode", "")
                
                if width > 0 and height > 0:
                    geometry = f"{width}x{height}"
                    if mode == "force":
                        geometry += "!"
                    elif mode == "fill":
                        geometry += "^"
                    cmd_parts.append(f"-resize {geometry}")
                    if img_width and img_height:
                        if mode == "force":
                            img_width, img_height = width, height
                        else:
                            scale = max(width / img_width, height / img_height) if mode == "fill" else min(width / img_width, height / img_height)
                            img_width, img_height = round(img_width * scale), round(img_height * scale)
                elif params.get("percent"):
                    pct = int(params["percent"])
                    cmd_parts.append(f"-resize {pct}%")
                    if img_width and img_height:
                        img_width, img_height = round(img_width * pct / 100), round(img_height * pct / 100)
            
            elif op_name == "crop":
                width = int(params.get("width", 0))
                height = int(params.get("height", 0))
                x = int(params.get("x", 0))
                y = int(params.get("y", 0))
                if width > 0 and height > 0:
                    cmd_parts.append(f"-crop {width}x{height}+{x}+{y} +repage")
                    img_width, img_height = width, height
            
            elif op_name == "crop_aspect":
                aspect_w = int(params.get("aspect_w", 1))
                aspect_h = int(params.get("aspect_h", 1))
                cmd_parts.append("-gravity center")
                cmd_parts.append(f"-crop {aspect_w}:{aspect_h}")
                cmd_parts.append("+repage")
            
            elif op_name == "rotate":
                angle = float(params.get("angle", 0))
                cmd_parts.append(f"-rotate {angle}")
                if img_width and img_height and int(angle) % 180:
                    img_width, img_height = img_height, img_width
            
            elif op_name == "flip":
                cmd_parts.append("-flip")
            
            elif op_name == "flop":
                cmd_parts.append("-flop")
            
            elif op_name == "quality":
                quality = max(1, min(100, int(params.get("value", 85))))
                cmd_parts.append(f"-quality {quality}")
            
            elif op_name == "blur":
                css_blur = float(params.get("sigma", params.get("radius", 0)))
                import logging
                logger = logging.getLogger(__name__)
                if css_blur > 0:
                    if img_width and img_width > 800:
                        scale_factor = img_width / 800
                        sigma = css_blur * scale_factor
                    else:
                        sigma = css_blur * 1.0
                    cmd_parts.append(f"-blur 0x{sigma:.1f}")
                    logger.info(f"BLUR: css_blur={css_blur}, img_width={img_width}, sigma={sigma:.1f}")
            
            elif op_name == "sharpen":
                radius = float(params.get("radius", 0))
                sigma = float(params.get("sigma", 1))
                cmd_parts.append(f"-sharpen {radius}x{sigma}")
            
            elif op_name == "grayscale":
                cmd_parts.append("-colorspace Gray")
            
            elif op_name == "sepia-tone":
                threshold = float(params.get("threshold", 80))
                cmd_parts.append(f"-sepia-tone {threshold}%")
            
            elif op_name == "brightness-contrast":
                brightness = int(params.get("brightness", 0))
                contrast = int(params.get("contrast", 0))
                cmd_parts.append(f"-brightness-contrast {brightness}x{contrast}")
            
            elif op_name == "modulate":
                brightness = int(params.get("brightness", 100))
                saturation = int(params.get("saturation", 100))
                hue = int(params.get("hue", 100))
                cmd_parts.append(f"-modulate {brightness},{saturation},{hue}")
            
            elif op_name == "auto-orient":
                cmd_parts.append("-auto-orient")
            
            elif op_name == "enhance":
                cmd_parts.append("-normalize")
                cmd_parts.append("-modulate 100,110,100")
                cmd_parts.append("-unsharp 0x0.5+0.5+0.008")
            
            elif op_name == "auto-level":
                cmd_parts.append("-auto-level")
            
            elif op_name == "normalize":
                cmd_parts.append("-normalize")
            
            elif op_name == "strip":
                cmd_parts.append("-strip")
            
            elif op_name == "trim":
                cmd_parts.append("-trim +repage")
            
            elif op_name == "negate":
                cmd_parts.append("-negate")
            
            elif op_name == "annotate" or op_name == "watermark":
                text = params.get("text", "")
                if text:
                    text = re.sub(r'[`$\\]', '', text)
                    position = params.get("position", "southeast").lower()
                    font_size_base = int(params.get("font_size", 24))
                    font_size = max(font_size_base, int(font_size_base * (img_width / 800))) if img_width else font_size_base
                    color = params.get("color", "#FFFFFF")
                    shadow_color = params.get("shadow_color", "#000000")
                    opacity = float(params.get("opacity", 0.5))
                    font_name = WATERMARK_FONT_FAMILIES.get(
                        params.get("font", "sans"), WATERMARK_FONT_FAMILIES["sans"]
                    )
                    
                    gravity_map = {
                        "northwest": "NorthWest",
                        "north": "North", 
                        "northeast": "NorthEast",
                        "west": "West",
                        "center": "Center",
                        "east": "East",
                        "southwest": "SouthWest",
                        "south": "South",
                        "southeast": "SouthEast",
                    }
                    gravity = gravity_map.get(position, "SouthEast")
                    
                    shadow_offset = max(2, int(font_size * 0.05))
                    text_offset = max(10, int(font_size * 0.4))
                    
                    cmd_parts.append(f"-gravity {gravity}")
                    cmd_parts.append(f"-font {shlex.quote(font_name)}")
                    cmd_parts.append(f"-pointsize {font_size}")
                    cmd_parts.append(f"-fill {shlex.quote(hex_to_rgba(shadow_color, opacity))}")
                    cmd_parts.append(f"-annotate +{text_offset + shadow_offset}+{text_offset + shadow_offset} {shlex.quote(text)}")
                    cmd_parts.append(f"-fill {shlex.quote(hex_to_rgba(color, opacity))}")
                    cmd_parts.append(f"-annotate +{text_offset}+{text_offset} {shlex.quote(text)}")

            elif op_name == "image-watermark":
                watermark_path = params.get("image_path")
                if not watermark_path or not Path(watermark_path).is_file():
                    raise ImageMagickError("Image watermark is unavailable")
                if img_width is None or img_height is None:
                    raise ImageMagickError("Image watermark requires readable image dimensions")
                scale = float(params.get("scale", 20))
                opacity = float(params.get("opacity", 1))
                target_width = max(1, round(min(img_width, img_height) * scale / 100))
                position = params.get("position", "southeast").lower()
                gravity = {
                    "northwest": "NorthWest", "north": "North", "northeast": "NorthEast", "west": "West",
                    "center": "Center", "east": "East", "southwest": "SouthWest", "south": "South", "southeast": "SouthEast",
                }.get(position, "SouthEast")
                offset_x, offset_y = int(params.get("offset_x", 0)), int(params.get("offset_y", 0))
                cmd_parts += ["\\(", shlex.quote(watermark_path), "-auto-orient", f"-resize {target_width}x", "-alpha set",
                              "-channel A", f"-evaluate set {round(opacity * 100)}%", "+channel", "\\)",
                              f"-gravity {gravity}", f"-geometry +{offset_x}+{offset_y}", "-composite"]
            
            elif op_name == "transparent":
                color = params.get("color", "white").lower()
                fuzz = int(params.get("fuzz", 10))
                fuzz = max(0, min(100, fuzz))
                
                if color == "auto":
                    cmd_parts.append("-alpha set")
                    cmd_parts.append(f"-fuzz {fuzz}%")
                    cmd_parts.append("-fill none -draw 'color 0,0 floodfill'")
                elif color in ("white", "black", "red", "green", "blue", "transparent"):
                    cmd_parts.append("-alpha set")
                    cmd_parts.append(f"-fuzz {fuzz}%")
                    cmd_parts.append(f"-transparent {color}")
                else:
                    cmd_parts.append("-alpha set")
                    cmd_parts.append(f"-fuzz {fuzz}%")
                    cmd_parts.append(f"-transparent '{color}'")

            elif op_name == "border":
                if img_width is None or img_height is None:
                    raise ImageMagickError("Border requires readable image dimensions")
                args, (img_width, img_height) = build_border_arguments(img_width, img_height, params)
                cmd_parts.extend(args)
        
        # Add output file
        cmd_parts.append(shlex.quote(output_path))
        
        return " ".join(cmd_parts)
    
    async def build_raw_command(
        self,
        input_path: str,
        output_path: str,
        raw_command: str
    ) -> Tuple[str, str]:
        """
        Build command from raw user input (terminal mode)
        Returns (command, error_message)
        """
        is_valid, error = self.validate_command(raw_command)
        if not is_valid:
            return "", error
        
        magick_cmd = await self._get_magick_cmd()
        
        command = raw_command.replace("{input}", shlex.quote(input_path))
        command = command.replace("{output}", shlex.quote(output_path))
        
        if not command.strip().startswith(("magick", "convert")):
            command = f"{magick_cmd} {command}"
        
        limits = f"-limit memory {self.memory_limit} -limit time {self.timeout}"
        if command.strip().startswith("magick"):
            command = command.replace("magick ", f"magick {limits} ", 1)
        elif command.strip().startswith("convert"):
            command = command.replace("convert ", f"convert {limits} ", 1)
        
        return command, ""
    
    def _run_command_sync(self, command: str) -> Tuple[bool, str, str]:
        """
        Synchronous command execution in a clean environment.
        This runs in a thread pool to avoid blocking the event loop.
        """
        import logging
        import os
        import signal
        logger = logging.getLogger(__name__)
        
        clean_env = {
            'PATH': '/usr/local/bin:/usr/bin:/bin',
            'HOME': '/tmp',
            'TMPDIR': '/tmp',
            'MAGICK_TEMPORARY_PATH': '/tmp',
            'LC_ALL': 'C',
        }
        
        def preexec():
            os.setsid()
            signal.signal(signal.SIGINT, signal.SIG_DFL)
            signal.signal(signal.SIGTERM, signal.SIG_DFL)
        
        try:
            logger.debug(f"Executing command: {command}")
            
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                timeout=self.timeout,
                cwd=str(self.temp_dir),
                env=clean_env,
                preexec_fn=preexec,
                close_fds=True,
            )
            
            success = result.returncode == 0
            stdout_str = result.stdout.decode('utf-8', errors='replace')
            stderr_str = result.stderr.decode('utf-8', errors='replace')
            
            if not success:
                logger.warning(f"Command failed (exit {result.returncode}): {stderr_str}")
            
            return success, stdout_str, stderr_str
            
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out after {self.timeout}s: {command}")
            return False, "", f"Command timed out after {self.timeout} seconds"
        except Exception as e:
            logger.exception(f"Command execution error: {e}")
            return False, "", str(e)
    
    async def execute(self, command: str) -> Tuple[bool, str, str]:
        """
        Execute ImageMagick command with timeout and resource limits
        Returns (success, stdout, stderr)
        """
        import concurrent.futures
        
        loop = asyncio.get_event_loop()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            result = await loop.run_in_executor(
                executor,
                self._run_command_sync,
                command
            )
        
        return result
    
    async def get_image_info(self, file_path: str) -> Optional[Dict]:
        """Get image metadata using ImageMagick identify"""
        magick_cmd = await self._get_magick_cmd()
        
        command = f"identify -verbose {shlex.quote(file_path)}"
        
        success, stdout, stderr = await self.execute(command)
        
        if not success:
            return None
        
        info = {
            "format": None,
            "width": None,
            "height": None,
            "colorspace": None,
            "depth": None,
            "filesize": None,
        }
        
        for line in stdout.split("\n"):
            line = line.strip()
            if line.startswith("Format:"):
                info["format"] = line.split(":")[1].strip().split()[0]
            elif line.startswith("Geometry:"):
                match = re.search(r"(\d+)x(\d+)", line)
                if match:
                    info["width"] = int(match.group(1))
                    info["height"] = int(match.group(2))
            elif line.startswith("Colorspace:"):
                info["colorspace"] = line.split(":")[1].strip()
            elif line.startswith("Depth:"):
                info["depth"] = line.split(":")[1].strip()
            elif line.startswith("Filesize:"):
                info["filesize"] = line.split(":")[1].strip()
        
        return info
    
    async def create_thumbnail(
        self,
        input_path: str,
        output_path: str,
        size: int = 300
    ) -> bool:
        """Create a thumbnail of the image"""
        import logging
        logger = logging.getLogger(__name__)
        
        # Ensure output directory exists
        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Verify input file exists
        if not Path(input_path).exists():
            logger.error(f"Input file does not exist: {input_path}")
            return False
        
        # For PDFs, use pdftoppm (more reliable than ImageMagick for PDF)
        is_pdf = input_path.lower().endswith('.pdf')
        
        if is_pdf:
            logger.info(f"Creating PDF thumbnail for: {input_path}")
            
            # Method 1: Try pdftoppm
            temp_base = str(Path(output_path).with_suffix(''))
            temp_file = f"{temp_base}.png"
            
            pdftoppm_cmd = f'pdftoppm -png -f 1 -l 1 -r 150 -singlefile "{input_path}" "{temp_base}"'
            logger.info(f"PDF thumbnail command: {pdftoppm_cmd}")
            
            try:
                process = await asyncio.create_subprocess_shell(
                    pdftoppm_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=120)
                
                logger.info(f"pdftoppm returncode: {process.returncode}, checking for: {temp_file}")
                
                if process.returncode == 0 and Path(temp_file).exists():
                    for resize_cmd_name in ["magick", "convert"]:
                        resize_cmd = f'{resize_cmd_name} "{temp_file}" -thumbnail "{size}x{size}>" -quality 85 "{output_path}"'
                        success, _, resize_err = await self.execute(resize_cmd)
                        if success:
                            break
                        if "not found" not in resize_err.lower():
                            break
                    
                    try:
                        Path(temp_file).unlink()
                    except:
                        pass
                    
                    if success and Path(output_path).exists():
                        logger.info(f"PDF thumbnail created: {output_path}")
                        return True
                    else:
                        logger.warning(f"PDF thumbnail resize failed: {resize_err}")
                else:
                    logger.warning(f"pdftoppm failed: returncode={process.returncode}, stderr={stderr.decode()}")
            except asyncio.TimeoutError:
                logger.error("pdftoppm timeout")
            except Exception as e:
                logger.exception(f"PDF thumbnail exception: {e}")
            
            # Method 2: Fallback to ImageMagick with ghostscript
            logger.info("Trying ImageMagick fallback for PDF")
            for cmd in ["magick", "convert"]:
                try:
                    command = f'{cmd} -density 150 "{input_path}[0]" -thumbnail "{size}x{size}>" -quality 85 "{output_path}"'
                    logger.info(f"PDF fallback command: {command}")
                    success, stdout, stderr = await self.execute(command)
                    
                    if success and Path(output_path).exists() and Path(output_path).stat().st_size > 0:
                        logger.info(f"PDF thumbnail created (fallback): {output_path}")
                        return True
                    else:
                        logger.warning(f"Fallback failed: success={success}, exists={Path(output_path).exists()}, stderr={stderr}")
                except Exception as e:
                    logger.exception(f"PDF fallback exception ({cmd}): {e}")
                    continue
            
            # Method 3: Try gs directly
            logger.info("Trying ghostscript directly for PDF")
            try:
                gs_output = str(Path(output_path).with_suffix('.png'))
                gs_cmd = f'gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dFirstPage=1 -dLastPage=1 -sOutputFile="{gs_output}" "{input_path}"'
                logger.info(f"GS command: {gs_cmd}")
                
                process = await asyncio.create_subprocess_shell(
                    gs_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await asyncio.wait_for(process.communicate(), timeout=120)
                
                if Path(gs_output).exists():
                    for resize_cmd_name in ["magick", "convert"]:
                        resize_cmd = f'{resize_cmd_name} "{gs_output}" -thumbnail "{size}x{size}>" -quality 85 "{output_path}"'
                        success, _, _ = await self.execute(resize_cmd)
                        if success:
                            break
                    try:
                        Path(gs_output).unlink()
                    except:
                        pass
                    if success and Path(output_path).exists():
                        logger.info(f"PDF thumbnail created (gs): {output_path}")
                        return True
            except Exception as e:
                logger.exception(f"GS exception: {e}")
        else:
            # ===== FIX: Use Pillow for ALL thumbnails (fast, no subprocess overhead) =====
            try:
                from PIL import Image as PILImage
                
                with PILImage.open(input_path) as img:
                    # Convert RGBA/P to RGB for WebP/JPEG output compatibility
                    if img.mode in ('RGBA', 'LA', 'P'):
                        # Keep alpha for WebP
                        if output_path.lower().endswith('.webp'):
                            img = img.convert('RGBA')
                        else:
                            background = PILImage.new('RGB', img.size, (255, 255, 255))
                            if img.mode == 'P':
                                img = img.convert('RGBA')
                            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                            img = background
                    elif img.mode != 'RGB':
                        img = img.convert('RGB')
                    
                    # Resize to thumbnail dimensions
                    img.thumbnail((size, size), PILImage.LANCZOS)
                    
                    # Save in appropriate format
                    if output_path.lower().endswith('.webp'):
                        img.save(output_path, 'WEBP', quality=85)
                    elif output_path.lower().endswith('.png'):
                        img.save(output_path, 'PNG', optimize=True)
                    else:
                        img.save(output_path, 'JPEG', quality=85)
                
                if Path(output_path).exists():
                    logger.info(f"Thumbnail created with Pillow: {output_path} ({Path(output_path).stat().st_size} bytes)")
                    return True
            except Exception as e:
                logger.warning(f"Pillow thumbnail failed: {e}, falling back to ImageMagick")
            
            # Fallback: use ImageMagick (for formats Pillow can't handle)
            for cmd in ["magick", "convert"]:
                try:
                    command = f'{cmd} "{input_path}" -thumbnail "{size}x{size}>" -quality 85 "{output_path}"'
                    logger.info(f"Thumbnail command: {command}")
                    success, stdout, stderr = await self.execute(command)
                    
                    if success and Path(output_path).exists() and Path(output_path).stat().st_size > 0:
                        logger.info(f"Thumbnail created: {output_path}")
                        return True
                    elif stderr:
                        logger.warning(f"Thumbnail failed ({cmd}): {stderr[:200]}")
                        continue
                except Exception as e:
                    logger.exception(f"Thumbnail exception ({cmd}): {e}")
                    continue
        
        logger.error(f"All thumbnail attempts failed for: {input_path}")
        return False
    
    async def create_pdf_preview(
        self,
        input_path: str,
        output_path: str,
        page: int = 0,
        density: int = 150
    ) -> bool:
        """Create a preview image of a PDF page"""
        for cmd in ["magick", "convert"]:
            command = f"{cmd} -density {density} {shlex.quote(input_path)}[{page}] -background white -alpha remove -quality 90 {shlex.quote(output_path)}"
            success, _, stderr = await self.execute(command)
            if success:
                return True
            if "not found" not in stderr.lower():
                break
        return False
    
    async def apply_preview(
        self,
        input_path: str,
        operations: List[Dict],
        max_size: int = 800
    ) -> Optional[str]:
        """
        Apply operations to image and return preview (for live editing)
        Returns base64 encoded image data or None on error
        """
        import base64
        import logging
        logger = logging.getLogger(__name__)
        
        if not Path(input_path).exists():
            logger.error(f"Input file not found: {input_path}")
            return None
        
        output_path = self.generate_temp_path("webp")
        
        try:
            preview_ops = operations.copy()
            preview_ops.insert(0, {
                "operation": "resize",
                "params": {"width": max_size, "height": max_size, "mode": "fit"}
            })
            
            command = await self.build_command(input_path, output_path, preview_ops)
            logger.info(f"Preview command: {command}")
            
            success, stdout, stderr = await self.execute(command)
            
            if success and Path(output_path).exists():
                with open(output_path, "rb") as f:
                    data = base64.b64encode(f.read()).decode()
                
                Path(output_path).unlink(missing_ok=True)
                
                return f"data:image/webp;base64,{data}"
            else:
                logger.error(f"Preview generation failed: {stderr}")
                return None
                
        except Exception as e:
            logger.exception(f"Error generating preview: {e}")
            Path(output_path).unlink(missing_ok=True)
            return None
    
    def generate_temp_path(self, extension: str = "png") -> str:
        """Generate a unique temporary file path"""
        filename = f"{uuid.uuid4().hex}.{extension}"
        return str(self.temp_dir / filename)


# Singleton instance
imagemagick_service = ImageMagickService()
