"""
minio_client.py — MinIO object storage client for Routing System.

Uploads artifacts (PCAP files, carved images) to the MinIO buckets
for immutable forensic storage.

ENV VARS (must match docker-compose.yml):
  MINIO_ENDPOINT  — host:port  (default minio:9000)
  MINIO_ACCESS    — access key (default stegnar)
  MINIO_SECRET    — secret key (default stegnar_minio_secret)
  MINIO_SECURE    — true/false (default false)
"""

import io
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("stegnar.routing.minio")

# ── Env vars MUST match docker-compose.yml names exactly ─────────────────────
ENDPOINT   = os.environ.get("MINIO_ENDPOINT",   "minio:9000")
ACCESS_KEY = os.environ.get("MINIO_ACCESS",      "stegnar")          # was MINIO_ACCESS_KEY — FIXED
SECRET_KEY = os.environ.get("MINIO_SECRET",      "stegnar_minio_secret")  # was MINIO_SECRET_KEY — FIXED
SECURE     = os.environ.get("MINIO_SECURE",      "false").lower() == "true"


class MinioClient:
    def __init__(self):
        protocol = "https" if SECURE else "http"
        endpoint_url = f"{protocol}://{ENDPOINT}"
        logger.info(
            "[MinIO] Connecting → %s (access=%s secure=%s)",
            endpoint_url, ACCESS_KEY[:4] + "***", SECURE,
        )
        self._s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
        )

    def ensure_bucket(self, bucket: str):
        """Create bucket if it does not exist."""
        try:
            self._s3.head_bucket(Bucket=bucket)
        except ClientError as e:
            if e.response["Error"]["Code"] in ("404", "NoSuchBucket"):
                logger.info("[MinIO] Creating bucket: %s", bucket)
                self._s3.create_bucket(Bucket=bucket)
            else:
                raise

    def upload_file(self, bucket: str, file_path: str, object_name: str = None) -> str:
        """
        Upload a local file to MinIO.
        Returns the s3:// URI on success, empty string on failure.
        """
        if not os.path.exists(file_path):
            logger.error("[MinIO] upload_file: file not found: %s", file_path)
            return ""

        if object_name is None:
            object_name = os.path.basename(file_path)

        try:
            self.ensure_bucket(bucket)
            self._s3.upload_file(file_path, bucket, object_name)
            uri = f"s3://{bucket}/{object_name}"
            logger.info("[MinIO] Uploaded file → %s (%d bytes)", uri, os.path.getsize(file_path))
            return uri
        except ClientError as e:
            logger.error("[MinIO] upload_file FAILED for %s → %s: %s", file_path, bucket, e)
            return ""
        except Exception as e:
            logger.error("[MinIO] upload_file unexpected error: %s", e)
            return ""

    def upload_bytes(self, bucket: str, data: bytes, object_name: str) -> str:
        """
        Upload raw bytes directly to MinIO.
        Returns the s3:// URI on success, empty string on failure.
        """
        if not data:
            logger.warning("[MinIO] upload_bytes called with empty data for %s/%s", bucket, object_name)
            return ""

        try:
            self.ensure_bucket(bucket)
            self._s3.put_object(Bucket=bucket, Key=object_name, Body=io.BytesIO(data))
            uri = f"s3://{bucket}/{object_name}"
            logger.info("[MinIO] Uploaded bytes → %s (%d bytes)", uri, len(data))
            return uri
        except ClientError as e:
            logger.error("[MinIO] upload_bytes FAILED for %s/%s: %s", bucket, object_name, e)
            return ""
        except Exception as e:
            logger.error("[MinIO] upload_bytes unexpected error: %s", e)
            return ""

    def presigned_url(self, bucket: str, object_name: str, expires_in: int = 3600) -> str:
        """Generate a presigned HTTP GET URL for a stored object."""
        try:
            url = self._s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": bucket, "Key": object_name},
                ExpiresIn=expires_in,
            )
            logger.debug("[MinIO] Presigned URL for %s/%s (expires %ds)", bucket, object_name, expires_in)
            return url
        except Exception as e:
            logger.error("[MinIO] presigned_url failed for %s/%s: %s", bucket, object_name, e)
            return ""
