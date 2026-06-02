FROM python:3.11-slim
WORKDIR /app

# Copy packaging utilities and installation scripts
COPY install-server/serve.py .
COPY install-server/pack.py .
COPY agent-installer/install.sh .
COPY agent-installer/install.ps1 .

# Copy agent and protobuf files to package
COPY endpoint-agent /app/endpoint-agent
COPY proto /app/proto

# Compile agent bundles
RUN python pack.py && rm -rf /app/endpoint-agent /app/proto pack.py

EXPOSE 8080
CMD ["python", "serve.py"]
