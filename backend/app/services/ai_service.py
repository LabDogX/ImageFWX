"""
AI Service for intelligent image processing
Includes background removal using rembg and upscaling
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional, Literal
import uuid
import os

from app.core.config import settings

logger = logging.getLogger(__name__)


def _configure_onnx_threads():
    """
    Configure ONNX Runtime intra-op threads globally, once.
    Done at module import so it applies to every rembg session without
    passing sess_opts into new_session() (which varies by rembg version).
    """
    threads = int(settings.onnx_threads)
    if threads > 0:
        os.environ.setdefault("OMP_NUM_THREADS", str(threads))
        logger.info(f"ONNX/OMP threads capped at {threads}")
    else:
        logger.info("ONNX threads: using all available cores (default)")


_configure_onnx_threads()


class AIService:
    """AI-powered image processing service"""
    
    REMBG_MODELS = ["u2net", "isnet-general-use", "u2net_human_seg", "silueta"]
    
    def __init__(self):
        self.temp_dir = Path(settings.temp_dir)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self._rembg_available = None
        self._sessions: dict = {}
    
    async def is_available(self) -> bool:
        """Check if rembg is available"""
        if self._rembg_available is None:
            try:
                import rembg  # noqa: F401
                self._rembg_available = True
                logger.info("rembg is available")
            except ImportError as e:
                logger.error(f"rembg not available: {e}")
                self._rembg_available = False
        return self._rembg_available
    
    def _get_session(self, model: Optional[str] = None):
        """Get or create a rembg session for the given model (cached per-model)."""
        model = model or settings.rembg_model
        if model not in self._sessions:
            try:
                from rembg import new_session
                logger.info(f"Creating rembg session with model: {model}")
                self._sessions[model] = new_session(model)
                logger.info(f"Session created successfully for model: {model}")
            except Exception as e:
                logger.error(f"Failed to create session for {model}: {e}")
                raise
        return self._sessions[model]
    
    async def remove_background(
        self,
        input_path: str,
        output_path: Optional[str] = None,
        model: Optional[str] = None,
        alpha_matting: bool = False,
        **kwargs
    ) -> str:
        """Remove background from image using AI (rembg)"""
        
        model = model or settings.rembg_model
        
        logger.info(f"=== REMOVE BACKGROUND START ===")
        logger.info(f"Input: {input_path}")
        logger.info(f"Model: {model}, Alpha matting: {alpha_matting}")
        
        if output_path is None:
            output_name = f"nobg_{uuid.uuid4().hex}.png"
            output_path = str(self.temp_dir / output_name)
        
        logger.info(f"Output: {output_path}")
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        if not Path(input_path).exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")
        
        logger.info(f"Input file size: {Path(input_path).stat().st_size} bytes")
        
        try:
            import pymatting  # noqa: F401
            has_pymatting = True
            logger.info("pymatting available")
        except ImportError:
            has_pymatting = False
            logger.warning("pymatting not available, alpha matting disabled")
        
        use_alpha = alpha_matting and has_pymatting
        max_size = int(settings.rembg_max_size)
        timeout = int(settings.imagemagick_timeout)
        
        def _process():
            """Synchronous processing"""
            try:
                from PIL import Image
                from rembg import remove
                
                logger.info("Loading image with PIL...")
                img = Image.open(input_path)
                original_size = img.size
                logger.info(f"Image loaded: {img.size}, mode={img.mode}")
                
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')
                    logger.info(f"Converted to RGB")
                
                scale_factor = 1.0
                if max(img.size) > max_size:
                    scale_factor = max_size / max(img.size)
                    new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
                    img = img.resize(new_size, Image.Resampling.LANCZOS)
                    logger.info(f"Resized to: {new_size}")
                
                logger.info("Getting rembg session...")
                session = self._get_session(model)
                
                logger.info(f"Calling rembg.remove() with alpha_matting={use_alpha}...")
                
                if use_alpha:
                    result = remove(
                        img,
                        session=session,
                        alpha_matting=True,
                        alpha_matting_foreground_threshold=240,
                        alpha_matting_background_threshold=10,
                        alpha_matting_erode_size=10,
                        post_process_mask=True,
                    )
                else:
                    result = remove(
                        img,
                        session=session,
                        alpha_matting=False,
                        post_process_mask=True,
                    )
                
                logger.info(f"Remove complete, result size: {result.size}, mode: {result.mode}")
                
                if scale_factor < 1.0:
                    result = result.resize(original_size, Image.Resampling.LANCZOS)
                    logger.info(f"Scaled back to: {original_size}")
                
                if result.mode != 'RGBA':
                    result = result.convert('RGBA')
                
                logger.info(f"Saving to {output_path}...")
                result.save(output_path, 'PNG')
                logger.info("Saved successfully")
                
                return output_path
                
            except Exception as e:
                logger.exception(f"Error in _process: {e}")
                raise
        
        try:
            loop = asyncio.get_running_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, _process),
                timeout=timeout
            )
            logger.info(f"=== REMOVE BACKGROUND SUCCESS ===")
            return result
        except asyncio.TimeoutError:
            logger.error("=== REMOVE BACKGROUND TIMEOUT ===")
            raise RuntimeError(f"Background removal timed out after {timeout}s")
        except Exception as e:
            logger.exception(f"=== REMOVE BACKGROUND ERROR: {e} ===")
            raise
    
    async def upscale(
        self,
        input_path: str,
        output_path: Optional[str] = None,
        scale: int = 2,
        method: Literal["lanczos", "esrgan"] = "lanczos",
    ) -> str:
        """Upscale image resolution"""
        
        logger.info(f"Upscale: {input_path}, scale={scale}")
        
        if output_path is None:
            ext = Path(input_path).suffix or '.png'
            output_name = f"upscale_{scale}x_{uuid.uuid4().hex}{ext}"
            output_path = str(self.temp_dir / output_name)
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        def _upscale():
            from PIL import Image, ImageFilter
            
            with Image.open(input_path) as img:
                new_size = (img.width * scale, img.height * scale)
                logger.info(f"Upscaling: {img.size} -> {new_size}")
                
                result = img.resize(new_size, Image.Resampling.LANCZOS)
                result = result.filter(ImageFilter.UnsharpMask(radius=1, percent=50, threshold=3))
                
                if output_path.lower().endswith('.png'):
                    result.save(output_path, 'PNG')
                elif output_path.lower().endswith('.webp'):
                    result.save(output_path, 'WEBP', quality=95)
                else:
                    if result.mode == 'RGBA':
                        result = result.convert('RGB')
                    result.save(output_path, 'JPEG', quality=95)
                
                return output_path
        
        try:
            loop = asyncio.get_running_loop()
            return await asyncio.wait_for(
                loop.run_in_executor(None, _upscale),
                timeout=120
            )
        except Exception as e:
            logger.exception(f"Upscale error: {e}")
            raise
    
    async def get_available_models(self) -> list:
        return self.REMBG_MODELS
    
    async def get_capabilities(self) -> dict:
        """Report available AI capabilities and current configuration."""
        available = await self.is_available()
        try:
            import pymatting  # noqa: F401
            alpha_matting_available = True
        except ImportError:
            alpha_matting_available = False
        return {
            "background_removal": available,
            "upscale": True,
            "available_models": self.REMBG_MODELS,
            "default_model": settings.rembg_model,
            "alpha_matting_available": alpha_matting_available,
            "loaded_models": list(self._sessions.keys()),
            "max_size": settings.rembg_max_size,
        }
    
    async def diagnose(self) -> dict:
        """Diagnostic info about AI service"""
        info = {
            "rembg_available": False,
            "pymatting_available": False,
            "sessions_loaded": list(self._sessions.keys()),
            "default_model": settings.rembg_model,
            "onnx_threads": settings.onnx_threads,
            "u2net_home": os.environ.get("U2NET_HOME", "not set"),
            "home": os.environ.get("HOME", "not set"),
            "models_dir_exists": False,
            "models_found": [],
            "error": None,
        }
        
        try:
            import rembg
            info["rembg_available"] = True
            info["rembg_version"] = getattr(rembg, "__version__", "unknown")
        except ImportError as e:
            info["error"] = f"rembg import error: {e}"
        
        try:
            import pymatting  # noqa: F401
            info["pymatting_available"] = True
        except ImportError:
            pass
        
        u2net_home = os.environ.get("U2NET_HOME", os.path.expanduser("~/.u2net"))
        info["u2net_home"] = u2net_home
        
        if Path(u2net_home).exists():
            info["models_dir_exists"] = True
            info["models_found"] = [str(p) for p in Path(u2net_home).glob("*.onnx")]
        
        return info


# Singleton
ai_service = AIService()
