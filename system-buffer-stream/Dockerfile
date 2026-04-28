FROM python:3.11-slim

WORKDIR /app

COPY system-buffer-stream/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY system-buffer-stream/ /app/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python", "main.py"]
