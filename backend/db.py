from supabase import create_client
from config import SUPABASE_URL, SUPABASE_KEY

_client = None

def get_db():
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def upsert_repo(github_id: int, full_name: str, owner: str, name: str, default_branch: str) -> int:
    """Insert or update repo, return internal id."""
    db = get_db()
    res = db.table("repositories").upsert({
        "github_id": github_id,
        "full_name": full_name,
        "owner": owner,
        "name": name,
        "default_branch": default_branch,
    }, on_conflict="github_id").execute()
    return res.data[0]["id"]


def upsert_pr(pr_data: dict):
    """Insert or update a single PR record."""
    db = get_db()
    db.table("pull_requests").upsert(pr_data, on_conflict="repo_id,github_pr_number").execute()


def get_repo_by_name(full_name: str) -> dict | None:
    db = get_db()
    res = db.table("repositories").select("*").eq("full_name", full_name).execute()
    return res.data[0] if res.data else None


def get_prs(repo_id: int, limit: int = 200) -> list:
    db = get_db()
    res = (db.table("pull_requests")
             .select("*")
             .eq("repo_id", repo_id)
             .order("opened_at", desc=True)
             .limit(limit)
             .execute())
    return res.data