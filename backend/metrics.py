from datetime import datetime, timezone, timedelta
from collections import Counter
from db import get_db
import os


def get_repo_id(full_name: str) -> int | None:
    db = get_db()
    res = db.table("repositories").select("id").eq("full_name", full_name).execute()
    return res.data[0]["id"] if res.data else None


def get_merged_prs(repo_id: int, days: int = 28) -> list:
    """Get merged PRs from the last N days."""
    db = get_db()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (db.table("pull_requests")
             .select("*")
             .eq("repo_id", repo_id)
             .eq("state", "merged")
             .gte("merged_at", since)
             .order("merged_at", desc=True)
             .execute())
    return res.data


def get_all_merged_prs(repo_id: int) -> list:
    """Get all merged PRs for trend analysis."""
    db = get_db()
    res = (db.table("pull_requests")
             .select("*")
             .eq("repo_id", repo_id)
             .eq("state", "merged")
             .order("merged_at", desc=True)
             .execute())
    return res.data


def compute_dora_metrics(repo_id: int, days: int = 28) -> dict:
    """
    Compute all 4 DORA metrics for a repo over the last N days.
    
    1. Deployment Frequency — PRs merged per week
    2. Lead Time for Changes — avg cycle time (opened → merged)
    3. Change Failure Rate — % of PRs that are reverts
    4. MTTR — not computable from PR data alone, set to None
    """
    prs = get_merged_prs(repo_id, days=days)

    if not prs:
        return {
            "deployment_frequency_per_week": 0,
            "lead_time_hours": None,
            "change_failure_rate_pct": 0,
            "mttr_hours": None,
            "total_prs_merged": 0,
            "period_days": days,
        }

    total_merged = len(prs)
    weeks = days / 7

    # 1. Deployment frequency
    deployment_frequency = round(total_merged / weeks, 2)

    # 2. Lead time — avg cycle time of merged PRs
    cycle_times = [
        pr["cycle_time_hours"]
        for pr in prs
        if pr.get("cycle_time_hours") is not None
    ]
    lead_time = round(sum(cycle_times) / len(cycle_times), 2) if cycle_times else None

    # 3. Change failure rate — PRs with "revert" in title
    revert_count = sum(
        1 for pr in prs
        if pr.get("title") and "revert" in pr["title"].lower()
    )
    failure_rate = round((revert_count / total_merged) * 100, 2) if total_merged else 0

    return {
        "deployment_frequency_per_week": deployment_frequency,
        "lead_time_hours":               lead_time,
        "change_failure_rate_pct":       failure_rate,
        "mttr_hours":                    None,
        "total_prs_merged":              total_merged,
        "period_days":                   days,
    }


def compute_cycle_time_trend(repo_id: int, weeks: int = 8) -> list:
    """
    Weekly cycle time trend for the last N weeks.
    Returns list of {week_start, avg_cycle_time_hours, pr_count}
    """
    prs = get_all_merged_prs(repo_id)
    if not prs:
        return []

    # Get the Monday of this current week
    today = datetime.now(timezone.utc).date()
    current_monday = today - timedelta(days=today.weekday())

    # Pre-fill the last `weeks` weeks (including the current week)
    weekly = {}
    for i in range(weeks):
        week_start = current_monday - timedelta(weeks=i)
        weekly[str(week_start)] = []

    # Group PRs by week
    for pr in prs:
        if not pr.get("merged_at") or not pr.get("cycle_time_hours"):
            continue
        merged = datetime.fromisoformat(pr["merged_at"].replace("Z", "+00:00"))
        # Get Monday of that week
        week_start = (merged - timedelta(days=merged.weekday())).date()
        week_key = str(week_start)
        # Only include it if it's within our N weeks window
        if week_key in weekly:
            weekly[week_key].append(pr["cycle_time_hours"])

    trend = []
    # sorted() automatically sorts from oldest date to newest date because of ISO format
    for week_str, times in sorted(weekly.items()):
        if times:
            avg_cycle = round(sum(times) / len(times), 2)
        else:
            avg_cycle = 0
            
        trend.append({
            "week_start":            week_str,
            "avg_cycle_time_hours":  avg_cycle,
            "pr_count":              len(times),
        })

    return trend


def compute_high_churn_files(repo_id: int, top_n: int = 10) -> list:
    """
    Files that appear in the most PRs (high churn = often changed).
    Returns list of {filename, pr_count, churn_ratio}
    """
    prs = get_all_merged_prs(repo_id)
    if not prs:
        return []

    total_prs = len(prs)
    file_counter = Counter()

    for pr in prs:
        paths = pr.get("file_paths") or []
        for path in paths:
            file_counter[path] += 1

    churn = []
    for filename, count in file_counter.most_common(top_n):
        churn.append({
            "filename":    filename,
            "pr_count":    count,
            "churn_ratio": round(count / total_prs * 100, 1),
        })

    return churn


def compute_pr_size_distribution(repo_id: int) -> dict:
    """
    Classify PRs by size: XS/S/M/L/XL based on lines changed.
    """
    prs = get_all_merged_prs(repo_id)
    sizes = {"XS": 0, "S": 0, "M": 0, "L": 0, "XL": 0}

    for pr in prs:
        total_lines = (pr.get("additions") or 0) + (pr.get("deletions") or 0)
        if total_lines <= 10:
            sizes["XS"] += 1
        elif total_lines <= 50:
            sizes["S"] += 1
        elif total_lines <= 200:
            sizes["M"] += 1
        elif total_lines <= 500:
            sizes["L"] += 1
        else:
            sizes["XL"] += 1

    return sizes


def compute_author_stats(repo_id: int) -> list:
    """Top contributors by PR count and avg cycle time."""
    prs = get_all_merged_prs(repo_id)
    authors = {}

    for pr in prs:
        author = pr.get("author", "unknown")
        if author not in authors:
            authors[author] = {"pr_count": 0, "cycle_times": []}
        authors[author]["pr_count"] += 1
        if pr.get("cycle_time_hours"):
            authors[author]["cycle_times"].append(pr["cycle_time_hours"])

    result = []
    for author, data in authors.items():
        avg_cycle = (
            round(sum(data["cycle_times"]) / len(data["cycle_times"]), 2)
            if data["cycle_times"] else None
        )
        result.append({
            "author":              author,
            "pr_count":            data["pr_count"],
            "avg_cycle_time_hours": avg_cycle,
        })

    return sorted(result, key=lambda x: x["pr_count"], reverse=True)


def compute_all_metrics(repo_id: int) -> dict:
    """Compute everything at once for the dashboard."""
    return {
        "dora":         compute_dora_metrics(repo_id),
        "cycle_trend":  compute_cycle_time_trend(repo_id),
        "churn_files":  compute_high_churn_files(repo_id),
        "pr_sizes":     compute_pr_size_distribution(repo_id),
        "authors":      compute_author_stats(repo_id),
    }
def generate_weekly_summary(repo_id: int) -> str:
    from groq import Groq
    from config import GROQ_API_KEY, LLM_MODEL
    client = Groq(api_key=GROQ_API_KEY)
    metrics = compute_dora_metrics(repo_id)
    churn = compute_high_churn_files(repo_id, top_n=3)
    prompt = f"""You are an engineering analytics assistant. Write a 3-sentence 
    weekly health summary for an engineering team based on these metrics:
    - PRs merged per week: {metrics['deployment_frequency_per_week']}
    - Average lead time: {metrics['lead_time_hours']} hours
    - Change failure rate: {metrics['change_failure_rate_pct']}%
    - Top churning files: {[f['filename'] for f in churn]}
    Be specific, actionable, and direct. No fluff."""
    res = client.chat.completions.create(
        model=LLM_MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    return res.choices[0].message.content