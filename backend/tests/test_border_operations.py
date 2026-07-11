import pytest
from pydantic import ValidationError

from app.api.operations import BorderParams, Operation
from app.services.imagemagick import (
    build_border_arguments, calculate_border_pixels, calculate_target_canvas,
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
    text = Operation(operation="watermark", params={"text": "© Photo", "color": "#123", "shadow_color": "#000000", "font": "serif"})
    assert text.params["font"] == "serif"
    image = Operation(operation="image-watermark", params={"image_id": 12, "scale": 25, "opacity": 0.5})
    assert image.params["image_id"] == 12
    with pytest.raises(ValidationError):
        Operation(operation="image-watermark", params={"image_id": 12, "scale": 101})
    with pytest.raises(ValidationError):
        Operation(operation="watermark", params={"text": "x", "font": "untrusted.ttf"})


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
    assert "-extent 580x480+40+40" in command


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
