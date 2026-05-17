FROM python:3.11-slim
WORKDIR /app
COPY install-server/serve.py .
COPY agent-installer/install.sh .
COPY agent-installer/install.ps1 .
EXPOSE 8080
CMD ["python", "serve.py"]
