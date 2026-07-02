import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ingestion import ingest_repo
from metrics import compute_all_metrics, get_repo_id
from db import get_db

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="GitScope API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    repo: str       # e.g. "fastapi/fastapi"
    max_prs: int = 50


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/ingest")
def ingest(req: IngestRequest):
    """
    Ingest a repo synchronously — waits until all PRs are fetched and stored.
    Returns when ingestion is fully complete.
    """
    result = ingest_repo(req.repo, req.max_prs)
    return {"message": f"Ingestion complete for {req.repo}", "repo": req.repo, **result}



@app.get("/metrics/{owner}/{repo}")
def get_metrics(owner: str, repo: str):
    """Get all computed metrics for a repo."""
    full_name = f"{owner}/{repo}"
    repo_id = get_repo_id(full_name)
    if not repo_id:
        raise HTTPException(
            status_code=404,
            detail=f"Repo {full_name} not found. Ingest it first via POST /ingest"
        )
    return compute_all_metrics(repo_id)


@app.get("/repos")
def list_repos():
    """List all ingested repos."""
    db = get_db()
    res = db.table("repositories").select("*").order("created_at", desc=True).execute()
    return res.data


@app.get("/repos/{owner}/{repo}/prs")
def get_prs(owner: str, repo: str, limit: int = 50):
    """Get recent PRs for a repo."""
    full_name = f"{owner}/{repo}"
    repo_id = get_repo_id(full_name)
    if not repo_id:
        raise HTTPException(status_code=404, detail=f"Repo {full_name} not found")
    db = get_db()
    res = (db.table("pull_requests")
             .select("*")
             .eq("repo_id", repo_id)
             .order("opened_at", desc=True)
             .limit(limit)
             .execute())
    return res.data

@app.get("/summary/{owner}/{repo}")
def get_summary(owner: str, repo: str):
    full_name = f"{owner}/{repo}"
    repo_id = get_repo_id(full_name)
    if not repo_id:
        raise HTTPException(status_code=404, detail="Repo not found")
    from metrics import generate_weekly_summary
    return {"summary": generate_weekly_summary(repo_id)}