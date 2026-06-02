FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    iptables \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY stegnar-proxy/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proto /app/proto
COPY stegnar-proxy/ /app/

RUN chmod +x /app/entrypoint.sh

# Needs NET_ADMIN capabilities to set iptables
ENTRYPOINT ["/app/entrypoint.sh"]
