"""
Tests for ImageMagick WebGUI Backend
"""

import pytest
import asyncio
from pathlib import Path
from httpx import AsyncClient, ASGITransport

# Test ImageMagick Service
class TestImageMagickService:
    """Tests for ImageMagick service"""
    
    def test_validate_command_safe(self):
        """Test that safe commands pass validation"""
        from app.services.imagemagick import imagemagick_service
        
        safe_commands = [
            "-resize 800x600",
            "-crop 100x100+0+0",
            "-quality 85",
            "-blur 0x5",
            "-grayscale Rec709Luminance",
        ]
        
        for cmd in safe_commands:
            is_valid, error = imagemagick_service.validate_command(cmd)
            assert is_valid, f"Command should be valid: {cmd}, error: {error}"
    
    def test_validate_command_blocked(self):
        """Test that dangerous commands are blocked"""
        from app.services.imagemagick import imagemagick_service
        
        dangerous_commands = [
            "input.jpg; rm -rf /",  # Shell injection
            "url:http://evil.com/image.jpg",  # URL protocol
            "../../../etc/passwd",  # Path traversal
            "ephemeral:test",  # Dangerous protocol
        ]
        
        for cmd in dangerous_commands:
            is_valid, error = imagemagick_service.validate_command(cmd)
            assert not is_valid, f"Command should be blocked: {cmd}"
    
    def test_sanitize_filename(self):
        """Test filename sanitization"""
        from app.services.imagemagick import imagemagick_service
        
        # Note: hyphens are intentionally preserved by sanitize_filename
        # (regex [^\w\-_\.]); only shell-dangerous chars become underscores.
        test_cases = [
            ("normal.jpg", "normal.jpg"),
            ("../etc/passwd", "passwd"),
            ("file;rm -rf.jpg", "file_rm_-rf.jpg"),
            ("file with spaces.png", "file_with_spaces.png"),
        ]
        
        for input_name, expected in test_cases:
            result = imagemagick_service.sanitize_filename(input_name)
            assert result == expected, f"Expected {expected}, got {result}"


class TestFileService:
    """Tests for file service"""
    
    def test_get_output_path_unique(self):
        """Output paths should be unique across calls"""
        from app.services.file_service import file_service
        
        path1 = file_service.get_output_path("photo.jpg", "png")
        path2 = file_service.get_output_path("photo.jpg", "png")
        
        # uuid suffix should make every path unique
        assert path1 != path2
    
    def test_get_output_path_extension(self):
        """Output path should carry the requested format as extension"""
        from app.services.file_service import file_service
        
        path = file_service.get_output_path("photo.jpg", "webp")
        assert path.endswith(".webp")
    
    def test_get_output_path_user_segment(self):
        """Output dir should reflect user_id, or 'anonymous' when absent"""
        from app.services.file_service import file_service
        
        anon = file_service.get_output_path("photo.jpg", "png")
        owned = file_service.get_output_path("photo.jpg", "png", user_id=42)
        
        assert "anonymous" in anon
        assert "42" in owned.split("/")[-2]


class TestSecurityFunctions:
    """Tests for security utilities"""
    
    def test_password_hashing(self):
        """Test password hashing and verification"""
        from app.core.security import get_password_hash, verify_password
        
        password = "test_password_123"
        hashed = get_password_hash(password)
        
        # Hash should be different from password
        assert hashed != password
        
        # Verification should work
        assert verify_password(password, hashed)
        assert not verify_password("wrong_password", hashed)
    
    def test_jwt_token_creation(self):
        """Test JWT token creation and verification"""
        from app.core.security import create_access_token, verify_token
        
        data = {"sub": "123", "email": "test@example.com"}
        token = create_access_token(data)
        
        # Token should be a string
        assert isinstance(token, str)
        
        # Should be decodable
        decoded = verify_token(token)
        assert decoded is not None
        assert decoded["sub"] == "123"
    
    def test_invalid_token_rejected(self):
        """Test that invalid tokens are rejected"""
        from app.core.security import verify_token
        
        invalid_tokens = [
            "not_a_token",
            "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.invalid.signature",
            "",
        ]
        
        for token in invalid_tokens:
            result = verify_token(token)
            assert result is None, f"Token should be invalid: {token}"


# Run tests
if __name__ == "__main__":
    pytest.main([__file__, "-v"])
