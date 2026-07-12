#!/usr/bin/env sh
set -eu

python - <<'PY'
import onnxruntime as ort

providers = ort.get_available_providers()
if "OpenVINOExecutionProvider" not in providers:
    raise SystemExit(
        "OpenVINOExecutionProvider is unavailable. Check /dev/dri, "
        "INTEL_RENDER_GID, and the selected OpenVINO device. "
        f"Available providers: {providers}"
    )
print("Intel OpenVINO acceleration available:", providers)
PY
