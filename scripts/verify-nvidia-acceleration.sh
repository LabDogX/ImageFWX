#!/usr/bin/env sh
set -eu

python - <<'PY'
import onnxruntime as ort

providers = ort.get_available_providers()
if "CUDAExecutionProvider" not in providers:
    raise SystemExit(
        "CUDAExecutionProvider is unavailable. Check NVIDIA Container Toolkit "
        "and the host driver. Available providers: "
        f"{providers}"
    )
print("NVIDIA CUDA acceleration available:", providers)
PY
