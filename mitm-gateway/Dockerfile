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
    "tensorflow-gpu==1.15.5" \
    "numpy==1.18.5" \
    "Pillow==9.5.0" \
    "scipy==1.4.1"



# ---- Stage 2: MITM Gateway --------------------------------------------------
FROM python:3.11-slim

# Copy the entire python 3.7 environment for TF1 subprocess isolation
COPY --from=tf1-env /usr/local /opt/tf1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcap-dev \
    tcpdump \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY mitm-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto stubs
COPY proto /app/proto

# Copy MITM source
COPY mitm-gateway/ /app/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 50052

CMD ["python", "main.py"]
