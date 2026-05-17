"""Longform article ingestion pipeline.

Entry points:
    python -m longform_ingest --all                    # ingest every active source
    python -m longform_ingest --source <slug>          # ingest one source
    python -m longform_ingest --url <url>              # OG fetch one URL (no DB write)
"""

__version__ = "0.1.0"
