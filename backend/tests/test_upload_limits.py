from app.core.config import MAX_SINGLE_FILE_SIZE_MB, Settings
from app.api.settings import effective_upload_limit


def test_service_caps_legacy_upload_limit_at_50_mb():
    assert Settings(max_upload_size_mb=500).max_upload_size_mb == MAX_SINGLE_FILE_SIZE_MB


def test_settings_response_caps_stale_user_preference_at_service_limit():
    assert effective_upload_limit(500) == MAX_SINGLE_FILE_SIZE_MB
