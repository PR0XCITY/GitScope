import requests
from config import GITHUB_TOKEN

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
BASE = "https://api.github.com"


def get_repo(full_name: str) -> dict:
    """Fetch repo metadata. full_name = 'owner/repo'"""
    res = requests.get(f"{BASE}/repos/{full_name}", headers=HEADERS)
    res.raise_for_status()
    return res.json()


def get_pull_requests(full_name: str, state: str = "closed", per_page: int = 100) -> list:
    """Fetch all PRs from a repo (handles pagination)."""
    prs = []
    page = 1
    while True:
        res = requests.get(
            f"{BASE}/repos/{full_name}/pulls",
            headers=HEADERS,
            params={"state": state, "per_page": per_page, "page": page, "sort": "updated", "direction": "desc"},
        )
        res.raise_for_status()
        batch = res.json()
        if not batch:
            break
        prs.extend(batch)
        page += 1
        if len(batch) < per_page:
            break
    return prs


def get_pr_details(full_name: str, pr_number: int) -> dict:
    """Fetch detailed PR info including file list."""
    res = requests.get(f"{BASE}/repos/{full_name}/pulls/{pr_number}", headers=HEADERS)
    res.raise_for_status()
    return res.json()


def get_pr_reviews(full_name: str, pr_number: int) -> list:
    """Fetch all reviews on a PR to find first review timestamp."""
    res = requests.get(f"{BASE}/repos/{full_name}/pulls/{pr_number}/reviews", headers=HEADERS)
    res.raise_for_status()
    return res.json()


def get_pr_files(full_name: str, pr_number: int) -> list:
    """Fetch list of files changed in a PR."""
    res = requests.get(f"{BASE}/repos/{full_name}/pulls/{pr_number}/files", headers=HEADERS)
    res.raise_for_status()
    return res.json()