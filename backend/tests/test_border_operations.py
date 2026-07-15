import pytest
from pydantic import ValidationError

from app.api.operations import BorderParams, Operation
from app.api.templates import TemplateWriteRequest
from app.services.imagemagick import (
    ImageMagickService, build_border_arguments, calculate_border_pixels, calculate_target_canvas,
    extract_exif_watermark_fields,
    validate_hex_color,
)


def border(**updates):
    value = {
        "mode": "custom", "unit": "px", "top": 0, "right": 0,
        "bottom": 0, "left": 0, "color": "#FFFFFF", "inner_unit": "px",
        "inner_size": 0, "inner_color": "#111111", "target_ratio": "original",
        "horizontal_alignment": "center", "vertical_alignment": "center",
    }
    value.update(updates)
    return BorderParams.model_validate(value).model_dump()


def test_custom_border_dimensions():
    _, dimensions = build_border_arguments(1000, 800, border(top=10, right=10, bottom=10, left=10))
    assert dimensions == (1020, 820)
    _, dimensions = build_border_arguments(1000, 800, border(top=10, right=20, bottom=30, left=40))
    assert dimensions == (1060, 840)


def test_percent_and_polaroid_use_each_image_short_edge():
    params = border(unit="percent", top=5, right=5, bottom=5, left=5)
    assert calculate_border_pixels(1000, 800, params) == {"top": 40, "right": 40, "bottom": 40, "left": 40}
    _, dimensions = build_border_arguments(1000, 800, params)
    assert dimensions == (1080, 880)
    polaroid = border(unit="percent", top=3, right=3, bottom=12, left=3)
    _, dimensions = build_border_arguments(1000, 800, polaroid)
    assert dimensions == (1048, 920)
    # A different input must calculate its own short edge instead of reusing 800.
    assert calculate_border_pixels(400, 1000, params)["top"] == 20


def test_double_border_dimensions():
    params = border(mode="double", top=24, right=24, bottom=24, left=24, inner_size=4)
    _, dimensions = build_border_arguments(1000, 800, params)
    assert dimensions == (1056, 856)


def test_matte_only_expands_and_meets_ratio():
    params = border(mode="matte", top=3, right=3, bottom=3, left=3, target_ratio="1:1")
    _, dimensions = build_border_arguments(1000, 800, params)
    assert dimensions[0] == dimensions[1]
    width, height = calculate_target_canvas(1000, 800, "4:5")
    assert width >= 1000 and height >= 800
    assert abs(width / height - 4 / 5) <= 1 / min(width, height)


def test_generated_frame_dimensions_and_source_offsets():
    gradient = border(
        style="gradient", top=10, right=20, bottom=30, left=40,
        gradient_start="#112233", gradient_end="#DDEEFF", gradient_angle=45,
    )
    args, dimensions = build_border_arguments(1000, 800, gradient)
    assert dimensions == (1060, 840)
    assert "-geometry +40+10" in args
    assert "gradient:'#112233-#DDEEFF'" in args

    frosted = border(
        mode="matte", style="frosted", top=10, right=20, bottom=30, left=40,
        target_ratio="1:1", frosted_blur=20, frosted_tint="#FFFFFF",
    )
    args, dimensions = build_border_arguments(1000, 800, frosted)
    assert dimensions == (1060, 1060)
    assert "-geometry +40+120" in args
    assert "-blur 0x20" in args


@pytest.mark.parametrize("value,valid", [("#abc", True), ("#A1B2C3", True), ("#11223344", True), ("red", False), ("#12", False), ("#abcdefgh", False)])
def test_hex_colors(value, valid):
    assert validate_hex_color(value) is valid


@pytest.mark.parametrize("changes", [
    {"top": -1}, {"top": 5001}, {"unit": "percent", "top": 51},
    {"inner_size": 1001}, {"inner_unit": "percent", "inner_size": 21},
    {"color": "rgba(0,0,0,1)"}, {"target_ratio": "5:4"}, {"mode": "unsafe"},
])
def test_invalid_border_params_are_rejected(changes):
    with pytest.raises(ValidationError):
        BorderParams.model_validate({**border(), **changes})


def test_operation_validates_border_before_command_building():
    with pytest.raises(ValidationError):
        Operation(operation="border", params={"color": "red"})


def test_text_and_image_watermark_params_are_strictly_validated():
    default_text = Operation(operation="watermark", params={"text": "中文 watermark"})
    assert default_text.params["font"] == "noto-sans-sc"
    assert Operation(operation="watermark", params={"text": "large", "font_size": 512}).params["font_size"] == 512
    text = Operation(operation="watermark", params={"text": "© Photo", "color": "#123", "shadow_color": "#000000", "font": "serif"})
    assert text.params["font"] == "serif"
    source_han = Operation(operation="watermark", params={"text": "照片", "font": "source-han-sans"})
    assert source_han.params["font"] == "source-han-sans"
    noto_bold = Operation(operation="watermark", params={"text": "照片", "font": "noto-sans-sc-bold"})
    assert noto_bold.params["font"] == "noto-sans-sc-bold"
    image = Operation(operation="image-watermark", params={"image_id": 12, "scale": 25, "opacity": 0.5})
    assert image.params["image_id"] == 12
    with pytest.raises(ValidationError):
        Operation(operation="image-watermark", params={"image_id": 12, "scale": 101})
    with pytest.raises(ValidationError):
        Operation(operation="watermark", params={"text": "x", "font": "untrusted.ttf"})
    with pytest.raises(ValidationError):
        Operation(operation="watermark", params={"text": "too large", "font_size": 513})


def test_watermark_stack_validates_all_fixed_layers():
    stack = Operation(operation="watermark-stack", params={
        "logo": {"enabled": True, "image_id": 12},
        "primary_text": {"enabled": True, "text": "Primary"},
        "secondary_text": {"enabled": True, "text": "Secondary", "font": "serif"},
        "exif": {"enabled": True, "fields": ["camera", "iso", "shutter_speed"]},
    })
    assert stack.params["logo"]["image_id"] == 12
    assert stack.params["secondary_text"]["font"] == "serif"
    with pytest.raises(ValidationError):
        Operation(operation="watermark-stack", params={"logo": {"enabled": True}})
    with pytest.raises(ValidationError):
        Operation(operation="watermark-stack", params={"exif": {"fields": ["gps"]}})


def test_template_payloads_use_the_same_strict_operation_contract():
    border_template = TemplateWriteRequest(
        name="  My   gradient  ", kind="border",
        payload={"style": "gradient", "gradient_start": "#123", "gradient_end": "#456"},
    )
    assert border_template.name == "My gradient"
    assert border_template.validated_payload()["style"] == "gradient"
    with pytest.raises(ValidationError):
        TemplateWriteRequest(
            name="Unsafe", kind="border", payload={"style": "gradient", "gradient_start": "red"},
        ).validated_payload()
    with pytest.raises(ValidationError):
        TemplateWriteRequest(
            name="Unsafe", kind="watermark", payload={"primary_text": {"font": "outside.ttf"}},
        ).validated_payload()


@pytest.mark.asyncio
async def test_source_han_watermark_uses_server_font_allowlist(tmp_path, monkeypatch):
    from PIL import Image
    from app.services.imagemagick import ImageMagickService
    source = tmp_path / "source.png"
    Image.new("RGB", (1000, 800), "white").save(source)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))
    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [{
        "operation": "watermark", "params": {"text": "照片", "font": "source-han-serif"},
    }])
    assert "-font /usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc" in command


@pytest.mark.asyncio
async def test_extended_watermark_fonts_use_server_fontconfig_patterns(tmp_path, monkeypatch):
    from PIL import Image
    from app.services.imagemagick import ImageMagickService
    source = tmp_path / "source.png"
    Image.new("RGB", (1000, 800), "white").save(source)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))
    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [{
        "operation": "watermark", "params": {"text": "照片", "font": "noto-sans-sc-bold"},
    }])
    assert "-font /usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc" in command


@pytest.mark.asyncio
async def test_default_watermark_uses_cjk_font_and_preserves_unicode_text(tmp_path, monkeypatch):
    from PIL import Image

    source = tmp_path / "source.png"
    Image.new("RGB", (1000, 800), "white").save(source)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))

    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [{
        "operation": "watermark", "params": {"text": "中文水印"},
    }])

    assert "-font /usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc" in command
    assert "'中文水印'" in command


@pytest.mark.asyncio
async def test_border_after_resize_uses_resized_short_edge(tmp_path, monkeypatch):
    """Operation order must calculate percentages after prior resize work."""
    from PIL import Image
    from app.services.imagemagick import ImageMagickService
    source = tmp_path / "source.png"
    Image.new("RGB", (1000, 800)).save(source)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))
    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [
        {"operation": "resize", "params": {"width": 500, "height": 500, "mode": "fit"}},
        {"operation": "border", "params": border(unit="percent", top=10, right=10, bottom=10, left=10)},
    ])
    # 1000×800 fit into 500×500 becomes 500×400; 10% borders are 40px.
    assert "-gravity North -splice 0x40" in command
    assert "-gravity East -splice 40x0" in command
    assert "-gravity South -splice 0x40" in command
    assert "-gravity West -splice 40x0" in command


@pytest.mark.asyncio
async def test_border_uses_dimensions_after_exif_auto_orient(tmp_path, monkeypatch):
    """Portrait camera images must not be framed using raw sensor dimensions."""
    from PIL import Image

    source = tmp_path / "portrait-camera.jpg"
    exif = Image.Exif()
    exif[274] = 6  # rotate 90° clockwise when auto-oriented
    Image.new("RGB", (1000, 800), "white").save(source, exif=exif)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))

    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.jpg"), [{
        "operation": "border", "params": border(top=10, right=20, bottom=30, left=40),
    }])

    # ``-auto-orient`` changes 1000×800 into 800×1000 before the border runs.
    assert "-gravity North -splice 0x10" in command
    assert "-gravity East -splice 20x0" in command
    assert "-gravity South -splice 0x30" in command
    assert "-gravity West -splice 40x0" in command


@pytest.mark.asyncio
async def test_image_watermark_command_uses_validated_internal_path(tmp_path, monkeypatch):
    from PIL import Image
    from app.services.imagemagick import ImageMagickService
    source, logo = tmp_path / "source.png", tmp_path / "logo.png"
    Image.new("RGB", (1000, 800), "white").save(source)
    Image.new("RGBA", (100, 50), (0, 0, 0, 128)).save(logo)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))
    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [{
        "operation": "image-watermark", "params": {"image_path": str(logo), "position": "southeast", "scale": 20, "opacity": 0.5, "offset_x": 4, "offset_y": 6},
    }])
    assert "-resize 160x" in command
    assert "-geometry +4+6 -composite" in command


@pytest.mark.asyncio
async def test_watermark_stack_builds_logo_text_and_exif_layers(tmp_path, monkeypatch):
    from PIL import Image

    source, logo = tmp_path / "source.jpg", tmp_path / "logo.png"
    exif = Image.Exif()
    exif[271], exif[272], exif[34855], exif[33437], exif[33434], exif[37386] = (
        "Canon", "R6", 400, (28, 10), (1, 125), (50, 1),
    )
    Image.new("RGB", (1000, 800), "white").save(source, exif=exif)
    Image.new("RGBA", (100, 50), (0, 0, 0, 128)).save(logo)
    monkeypatch.setattr(ImageMagickService, "_get_magick_cmd", lambda self: __import__("asyncio").sleep(0, result="magick"))

    command = await ImageMagickService().build_command(str(source), str(tmp_path / "out.png"), [{
        "operation": "watermark-stack", "params": {
            "logo": {"enabled": True, "image_path": str(logo), "scale": 10, "position": "northwest", "opacity": 1, "offset_x": 0, "offset_y": 0},
            "primary_text": {"enabled": True, "text": "Primary", "font": "noto-sans-sc", "font_size": 24, "position": "southwest", "opacity": .7, "color": "#FFFFFF", "shadow_color": "#000000", "offset_x": 0, "offset_y": 0},
            "secondary_text": {"enabled": True, "text": "Secondary", "font": "serif", "font_size": 18, "position": "southwest", "opacity": .7, "color": "#FFFFFF", "shadow_color": "#000000", "offset_x": 0, "offset_y": 42},
            "exif": {"enabled": True, "fields": ["camera", "aperture", "shutter_speed", "iso", "focal_length"], "separator": " · ", "font": "mono", "font_size": 16, "position": "southeast", "opacity": .7, "color": "#FFFFFF", "shadow_color": "#000000", "offset_x": 0, "offset_y": 0},
        },
    }])
    assert "-resize 80x" in command
    assert "Primary" in command and "Secondary" in command
    assert "Canon R6" in command and "f/2.8" in command and "1/125s" in command
    assert "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf" in command
    assert extract_exif_watermark_fields(str(source))["iso"] == "ISO 400"
