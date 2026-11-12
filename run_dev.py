import subprocess
import sys
import os
import time

def main():
    print("=" * 60)
    print("STARTING VAULTORY FULL-STACK APPLICATION")
    print("=" * 60)
    print("Backend:  FastAPI + SQLAlchemy + OpenCV + ReportLab (Port 8000)")
    print("Frontend: React + Tailwind CSS + Lucide (Port 5173)")
    print("Demo Account: demo@vaultory.io / Password123!")
    print("=" * 60)

    # 1. Start FastAPI backend
    backend_cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "8000", "--reload"]
    backend_proc = subprocess.Popen(backend_cmd)

    # 2. Start Vite frontend
    frontend_dir = os.path.join(os.getcwd(), "frontend")
    frontend_cmd = "npm run dev"
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir, shell=True)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping Vaultory services...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Vaultory stopped.")

if __name__ == "__main__":
    main()

