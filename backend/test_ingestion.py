# test_ingestion.py
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")

from ingestion import ingest_repo

result = ingest_repo("facebook/react", max_prs=5)
print("\n=== INGESTION RESULT ===")
print(result)