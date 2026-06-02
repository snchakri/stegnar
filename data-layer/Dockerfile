FROM python:3.11-slim

WORKDIR /app

COPY data-layer/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY data-layer/ /app/

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

CMD ["python", "main.py"]
