import pytest

from app.api import operations as operations_api


@pytest.mark.asyncio
async def test_png_command_preview_uses_png_display_extension(monkeypatch):
    """PNG previews must use the same safe builder path as other formats."""

    async def fake_build_command(input_path, output_path, built_operations):
        assert input_path == "{input}"
        assert output_path == "{output}.webp"
        assert built_operations[-1] == {"operation": "quality", "params": {"value": 85}}
        return "magick '{input}' -auto-orient -resize 800x600 -quality 85 '{output}.webp'"

    monkeypatch.setattr(operations_api.imagemagick_service, "build_command", fake_build_command)
    monkeypatch.setattr(operations_api.imagemagick_service, "validate_command", lambda command: (True, ""))

    response = await operations_api.preview_command(
        operations_api.PreviewCommandRequest(
            operations=[operations_api.Operation(operation="resize", params={"width": 800, "height": 600, "mode": "fit"})],
            output_format="png",
        )
    )

    assert response.valid is True
    assert "input.jpg" in response.command
    assert "output.png" in response.command
    assert "output.webp" not in response.command
