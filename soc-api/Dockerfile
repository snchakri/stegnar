FROM python:3.11-slim

# NOTE: soc-api uses the Docker Python SDK (`docker` in requirements.txt)
# and the host Docker socket is mounted via docker-compose.yml
# to allow the service to control containers. Keep the image lean
# by avoiding docker CLI installation.

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
	tshark \
	&& rm -rf /var/lib/apt/lists/*

COPY soc-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY soc-api/ /app/
COPY proto/ /app/proto/

# Port 3001
EXPOSE 3001

CMD ["/bin/sh", "/app/wait_for_services.sh"]
