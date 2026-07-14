#!/bin/bash
set -e

echo "🚀 Starting ImageMagick WebGUI..."

# Start RQ worker in background
echo "📦 Starting RQ worker..."
cd /app/backend
python -m app.workers.worker &
WORKER_PID=$!

# Wait for database to be ready and initialize tables
echo "🔧 Initializing database..."
cd /app/backend
python init_db.py

# Start the retention-based cleanup worker after the database is available.
# It only scans /app/uploads, /app/processed, and /tmp/imagemagick; the
# read-only NAS source mount is never part of cleanup.
CLEANUP_PID=""
case "${CLEANUP_ENABLED:-true}" in
  false|FALSE|False|0|no|NO|No|off|OFF|Off)
    echo "🧹 Scheduled storage cleanup is disabled"
    ;;
  *)
    echo "🧹 Starting scheduled storage cleanup..."
    cd /app/backend
    python -m app.workers.cleanup &
    CLEANUP_PID=$!
    ;;
esac

# Start FastAPI backend (single worker to avoid race conditions)
echo "⚡ Starting FastAPI backend on port 8000..."
cd /app/backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
sleep 3

# Start Next.js frontend (standalone mode)
echo "🎨 Starting Next.js frontend on port 3000..."
cd /app/frontend/.next/standalone
export HOSTNAME=0.0.0.0
export PORT=3000
node server.js &
FRONTEND_PID=$!

echo "✅ All services started!"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:8000"
echo "   - API Docs: http://localhost:8000/docs"

# Handle shutdown
trap "kill $WORKER_PID $CLEANUP_PID $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGTERM SIGINT

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
