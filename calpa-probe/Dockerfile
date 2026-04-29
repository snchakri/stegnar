# =============================================================================
# CALPA-NET Probe — vTBP Prerequisite Test Container
#
# Architecture:
#   Stage 1 (tf1-env): Python 3.7 + TensorFlow 1.15 venv at /opt/tf1
#   Stage 2 (probe):   Python 3.11 HTTP probe server; calls TF1 via subprocess
#
# The TF1 checkpoint is at:
#   /models/Model_438375.ckpt  (mounted from host)
#
# The model libs (SRNet, psm) are at:
#   /calpa/libs/               (mounted from host CALPA-NET-master/libs)
# =============================================================================

# ---- Stage 1: TF1 environment (Legacy AI model runtime) -----------------------
FROM python:3.7 AS tf1-env

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libglib2.0-0 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --upgrade pip
RUN pip install --no-cache-dir \
    "tensorflow==1.15.5" \
    "numpy==1.18.5" \
    "Pillow==9.5.0" \
    "scipy==1.4.1"



# ---- Stage 2: Probe HTTP server ---------------------------------------------
FROM python:3.11-slim AS probe

# Copy the entire python 3.7 environment
COPY --from=tf1-env /usr/local /opt/tf1

# Runtime system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Install probe server deps (modern Python 3.11)
RUN pip install --no-cache-dir \
    "flask==3.0.3" \
    "Pillow==10.3.0" \
    "numpy==1.26.4"

WORKDIR /probe

# Copy probe source
COPY probe_server.py .
COPY calpa_worker.py .

# Model and libs are mounted at runtime:
#   /models/        — TF1 checkpoint files
#   /calpa/libs/    — SRNet.py, psm/, etc.
#   /images/        — test images to scan

ENV CALPA_PYTHON_PATH=/opt/tf1/bin/python
ENV CALPA_MODEL_PATH=/models/Model_438375.ckpt
ENV CALPA_MODEL_TYPE=srnet
ENV CALPA_LIBS_PATH=/calpa/libs
ENV FLASK_ENV=development
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

CMD ["python", "probe_server.py"]
