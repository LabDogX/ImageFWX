#!/usr/bin/env sh
set -eu

# Host-side launcher. Docker Compose cannot select a CUDA, ROCm, or OpenVINO
# image after a container starts, so detect compatible host devices first.
requested="${ACCELERATOR:-auto}"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
    echo "Docker Compose v2 is required." >&2
    exit 1
fi

if [ ! -f .env ]; then
    echo "Missing .env. Run ./scripts/setup.sh first." >&2
    exit 1
fi

has_drm_vendor() {
    wanted="$1"
    for vendor_file in /sys/class/drm/card*/device/vendor; do
        [ -r "$vendor_file" ] || continue
        [ "$(cat "$vendor_file")" = "$wanted" ] && return 0
    done
    return 1
}

first_render_node() {
    for node in /dev/dri/renderD*; do
        [ -e "$node" ] && { printf '%s\n' "$node"; return 0; }
    done
    return 1
}

device_gid() {
    stat -c '%g' "$1" 2>/dev/null
}

detect_accelerator() {
    if command -v nvidia-smi >/dev/null 2>&1 && [ -e /dev/nvidiactl ]; then
        printf '%s\n' nvidia
    elif [ -e /dev/kfd ] && [ -d /dev/dri ] && has_drm_vendor 0x1002; then
        printf '%s\n' amd
    elif [ -d /dev/dri ] && has_drm_vendor 0x8086 && first_render_node >/dev/null; then
        printf '%s\n' intel
    else
        printf '%s\n' cpu
    fi
}

case "$requested" in
    auto) selected="$(detect_accelerator)" ;;
    cpu|nvidia|amd|intel) selected="$requested" ;;
    *)
        echo "ACCELERATOR must be auto, cpu, nvidia, amd, or intel." >&2
        exit 2
        ;;
esac

if [ "$selected" = "amd" ]; then
    [ -e /dev/kfd ] && [ -d /dev/dri ] || {
        echo "AMD selection requires /dev/kfd and /dev/dri." >&2
        exit 1
    }
    render_node="$(first_render_node)" || {
        echo "AMD selection requires a /dev/dri/renderD* device." >&2
        exit 1
    }
    export AMD_VIDEO_GID="$(device_gid /dev/kfd)"
    export AMD_RENDER_GID="$(device_gid "$render_node")"
elif [ "$selected" = "intel" ]; then
    render_node="$(first_render_node)" || {
        echo "Intel selection requires a /dev/dri/renderD* device." >&2
        exit 1
    }
    export INTEL_RENDER_GID="$(device_gid "$render_node")"
fi

# Stop only competing ImageFWX app services; volumes and database remain intact.
docker compose --profile gpu --profile intel --profile amd stop app app-gpu app-intel app-amd >/dev/null 2>&1 || true

case "$selected" in
    cpu)
        profile=""
        service="app"
        verifier=""
        docker compose up -d --build "$service"
        ;;
    nvidia)
        profile="gpu"
        service="app-gpu"
        verifier="/verify-nvidia-acceleration.sh"
        docker compose --profile "$profile" up -d --build "$service"
        ;;
    amd)
        profile="amd"
        service="app-amd"
        verifier="/verify-amd-acceleration.sh"
        docker compose --profile "$profile" up -d --build "$service"
        ;;
    intel)
        profile="intel"
        service="app-intel"
        verifier="/verify-intel-acceleration.sh"
        docker compose --profile "$profile" up -d --build "$service"
        ;;
esac

if [ -z "$verifier" ]; then
    echo "ImageFWX started with CPU processing."
    exit 0
fi

attempt=1
while [ "$attempt" -le 30 ]; do
    if docker compose exec -T "$service" "$verifier"; then
        echo "ImageFWX started with ${selected} acceleration."
        exit 0
    fi
    sleep 2
    attempt=$((attempt + 1))
done

if [ "$requested" = "auto" ]; then
    echo "${selected} provider verification failed; falling back to CPU." >&2
    docker compose --profile "$profile" stop "$service" >/dev/null 2>&1 || true
    docker compose up -d --build app
    exit 0
fi

echo "${selected} provider verification failed. Check container logs and host drivers." >&2
exit 1
