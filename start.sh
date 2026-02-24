#!/bin/bash

# DCS Server Intelligence - Startup Script
# Starts both API and frontend servers with LAN access

cleanup() {
    echo ""
    echo "Shutting down servers..."

    # Kill child processes
    if [ -n "$API_PID" ]; then
        kill $API_PID 2>/dev/null
        wait $API_PID 2>/dev/null
        echo "API server stopped"
    fi

    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
        wait $FRONTEND_PID 2>/dev/null
        echo "Frontend server stopped"
    fi

    echo "Goodbye!"
    exit 0
}

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

echo "Starting DCS Server Intelligence..."
echo ""

# Start API server
echo "Starting API server on port 8000..."
uvicorn api:app --host 0.0.0.0 --port 8000 --reload &
API_PID=$!

# Give API a moment to start
sleep 2

# Check if API started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo "ERROR: API server failed to start"
    exit 1
fi

# Start frontend
echo "Starting frontend on port 5173..."
cd frontend && npm run dev &
FRONTEND_PID=$!
cd ..

# Give frontend a moment to start
sleep 3

# Get local IP
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "========================================"
echo "  Servers running!"
echo "========================================"
echo ""
echo "  Frontend:  http://${LOCAL_IP}:5173/"
echo "  API:       http://${LOCAL_IP}:8000/"
echo "  API Docs:  http://${LOCAL_IP}:8000/docs"
echo ""
echo "  Press Ctrl+C to stop"
echo "========================================"
echo ""

# Wait for either process to exit
wait $API_PID $FRONTEND_PID
