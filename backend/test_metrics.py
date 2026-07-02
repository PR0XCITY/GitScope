import json
from metrics import compute_all_metrics, get_repo_id

repo_id = get_repo_id("fastapi/fastapi")
print(f"Repo ID: {repo_id}")

metrics = compute_all_metrics(repo_id)
print(json.dumps(metrics, indent=2))