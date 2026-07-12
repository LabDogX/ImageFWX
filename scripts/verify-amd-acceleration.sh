#!/usr/bin/env sh
set -eu

python - <<'PY'
import onnxruntime as ort

providers = ort.get_available_providers()
if "MIGraphXExecutionProvider" not in providers:
    raise SystemExit(
        "MIGraphXExecutionProvider is unavailable. Check the ROCm host driver, "
        "/dev/kfd and /dev/dri mappings, and AMD_*_GID values. "
        f"Available providers: {providers}"
    )
print("AMD MIGraphX acceleration available:", providers)
PY
