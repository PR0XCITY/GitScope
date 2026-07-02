import logging
from datetime import datetime, timezone
from dateutil import parser as dateparser
from github_client import get_repo, get_pull_requests, get_pr_reviews, get_pr_files
from db import upsert_repo, upsert_pr

logger = logging.getLogger("gitscope")


def parse_dt(s: str | None) -> datetime | None:
    """Parse ISO datetime string to datetime object."""
    if not s:
        return None
    return dateparser.parse(s).replace(tzinfo=timezone.utc)


def hours_between(a: datetime | None, b: datetime | None) -> float | None:
    """Compute hours between two datetimes."""
    if not a or not b:
        return None
    diff = (b - a).total_seconds()
    return round(diff / 3600, 2)


def ingest_repo(full_name: str, max_prs: int = 100) -> dict:
    """
    Full ingestion pipeline for one repo.
    Fetches PRs from GitHub, computes metrics, stores in Supabase.
    Returns summary of what was ingested.
    """
    logger.info(f"Starting ingestion for {full_name}")

    # 1. Fetch and store repo metadata
    repo_data = get_repo(full_name)
    repo_id = upsert_repo(
        github_id=repo_data["id"],
        full_name=full_name,  # use what the user typed, not GitHub's response
        owner=full_name.split("/")[0],
        name=repo_data["name"],
        default_branch=repo_data["default_branch"],
    )
    logger.info(f"Repo stored with id={repo_id}")

    # 2. Fetch closed PRs (merged ones have merged_at set)
    raw_prs = get_pull_requests(full_name, state="closed")
    raw_prs = raw_prs[:max_prs]
    logger.info(f"Fetched {len(raw_prs)} closed PRs")

    ingested = 0
    for pr in raw_prs:
        pr_number = pr["number"]

        try:
            # Parse timestamps
            opened_at  = parse_dt(pr.get("created_at"))
            merged_at  = parse_dt(pr.get("merged_at"))
            closed_at  = parse_dt(pr.get("closed_at"))

            # Only count as merged if merged_at exists
            state = "merged" if merged_at else "closed"

            # Get first review timestamp
            reviews = get_pr_reviews(full_name, pr_number)
            first_review_at = None
            if reviews:
                review_times = [
                    parse_dt(r["submitted_at"])
                    for r in reviews
                    if r.get("submitted_at") and r["state"] != "PENDING"
                ]
                if review_times:
                    first_review_at = min(review_times)

            # Get changed files
            files = get_pr_files(full_name, pr_number)
            file_paths = [f["filename"] for f in files]
            additions = sum(f.get("additions", 0) for f in files)
            deletions = sum(f.get("deletions", 0) for f in files)

            # Compute cycle time and review time
            cycle_time_hours  = hours_between(opened_at, merged_at)
            review_time_hours = hours_between(opened_at, first_review_at)

            pr_record = {
                "repo_id":            repo_id,
                "github_pr_number":   pr_number,
                "title":              pr.get("title", ""),
                "author":             pr["user"]["login"],
                "state":              state,
                "opened_at":          opened_at.isoformat() if opened_at else None,
                "merged_at":          merged_at.isoformat() if merged_at else None,
                "closed_at":          closed_at.isoformat() if closed_at else None,
                "first_review_at":    first_review_at.isoformat() if first_review_at else None,
                "changed_files":      len(files),
                "additions":          additions,
                "deletions":          deletions,
                "file_paths":         file_paths,
                "cycle_time_hours":   cycle_time_hours,
                "review_time_hours":  review_time_hours,
            }

            upsert_pr(pr_record)
            ingested += 1
            logger.info(f"  PR #{pr_number} ingested — cycle time: {cycle_time_hours}h")

        except Exception as e:
            logger.warning(f"  PR #{pr_number} failed: {e}")
            continue

    return {
        "repo":     full_name,
        "repo_id":  repo_id,
        "ingested": ingested,
        "total":    len(raw_prs),
    }