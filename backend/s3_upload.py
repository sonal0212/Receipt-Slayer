import os
import uuid
import logging
from urllib.parse import urlparse

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

_s3_client = None


def _get_s3_client():
    global _s3_client
    if _s3_client is None:
        _s3_client = boto3.client(
            "s3",
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            region_name=os.getenv("AWS_REGION", "us-east-1"),
        )
    return _s3_client


def upload_receipt_to_s3(file_bytes: bytes, filename: str, content_type: str) -> str | None:
    """Upload a receipt image to S3 and return the object URL.

    Returns the S3 URL on success, or None if S3 is not configured or upload fails.
    """
    bucket = os.getenv("AWS_S3_BUCKET")
    if not bucket or not os.getenv("AWS_ACCESS_KEY_ID"):
        logger.warning("S3 not configured — skipping upload")
        return None

    ext = filename.rsplit(".", 1)[-1] if "." in filename else "jpg"
    key = f"receipts/{uuid.uuid4().hex}.{ext}"

    try:
        client = _get_s3_client()
        client.put_object(
            Bucket=bucket,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        region = os.getenv("AWS_REGION", "us-east-1")
        url = f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
        logger.info("Uploaded receipt to S3: %s", url)
        return url
    except ClientError as e:
        logger.error("S3 upload failed: %s", e)
        return None


def fetch_receipt_from_s3(s3_url: str) -> tuple[bytes, str] | None:
    """Download a receipt image from S3 by its URL.

    Returns (file_bytes, content_type) or None on failure.
    """
    try:
        parsed = urlparse(s3_url)
        # Extract bucket and key from URL like https://bucket.s3.region.amazonaws.com/key
        host_parts = parsed.hostname.split(".")
        bucket = host_parts[0]
        key = parsed.path.lstrip("/")

        client = _get_s3_client()
        response = client.get_object(Bucket=bucket, Key=key)
        body = response["Body"].read()
        content_type = response.get("ContentType", "image/jpeg")
        return body, content_type
    except Exception as e:
        logger.error("Failed to fetch from S3: %s", e)
        return None
