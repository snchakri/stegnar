FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpcap-dev \
    tcpdump \
    curl \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY endpoint-agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proto stubs
COPY proto /app/proto

# Copy agent source
COPY endpoint-agent/ /app/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# NET_RAW capability is added via docker-compose (cap_add)
CMD ["python", "main.py"]
