FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY target-server/server.py .

ENV PORT=443
ENV PYTHONUNBUFFERED=1

# Volumes expected at runtime:
#   /images/stego/   — steganographic PNG images (from BOSSbase stego set)
#   /images/cover/   — clean cover PNG images    (from BOSSbase cover set)
#   /certs/          — TLS cert/key (auto-generated if absent)

EXPOSE 443

HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD python -c "import urllib.request, ssl; ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE; urllib.request.urlopen('https://localhost:443/health', context=ctx)"

CMD ["python", "server.py"]
