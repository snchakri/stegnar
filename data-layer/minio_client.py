"""
minio_client.py — MinIO object storage client.

Uploads artifacts (PCAP files, carved images) to the MinIO buckets
for immutable forensic storage.
"""

import logging
import os
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger("stegnar.data.minio")

ENDPOINT   = os.environ.get("MINIO_ENDPOINT", "minio:9000")
ACCESS_KEY = os.environ.get("MINIO_ACCESS", os.environ.get("MINIO_ACCESS_KEY", "stegnar"))
SECRET_KEY = os.environ.get("MINIO_SECRET", os.environ.get("MINIO_SECRET_KEY", "stegnar_minio_secret"))
SECURE     = os.environ.get("MINIO_SECURE", "false").lower() == "true"


class MinioClient:
    def __init__(self):
        protocol = "https" if SECURE else "http"
        self._s3 = boto3.client(
            "s3",
            endpoint_url=f"{protocol}://{ENDPOINT}",
            aws_access_key_id=ACCESS_KEY,
            aws_secret_access_key=SECRET_KEY,
        )

    def upload_file(self, bucket: str, file_path: str, object_name: str = None) -> str:
        """
        Upload a file to MinIO.
        Returns the s3:// URI on success.
        """
        if object_name is None:
            object_name = os.path.basename(file_path)

        try:
            self._s3.upload_file(file_path, bucket, object_name)
            uri = f"s3://{bucket}/{object_name}"
            logger.debug("Uploaded artifact to %s", uri)
            return uri
        except ClientError as e:
            logger.error("Failed to upload %s to MinIO: %s", file_path, e)
            return ""

    def upload_bytes(self, bucket: str, data: bytes, object_name: str) -> str:
        """
        Upload raw bytes directly to MinIO.
        Returns the s3:// URI on success.
        """
        try:
            self._s3.put_object(Bucket=bucket, Key=object_name, Body=data)
            uri = f"s3://{bucket}/{object_name}"
            logger.debug("Uploaded artifact bytes to %s", uri)
            return uri
        except ClientError as e:
            logger.error("Failed to upload bytes to MinIO: %s", e)
            return ""
