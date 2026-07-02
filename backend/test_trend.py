import sys
from metrics import get_repo_id, compute_cycle_time_trend

def main():
    repo_id = get_repo_id("vercel/next.js")
    if not repo_id:
        print("Repo not found")
        sys.exit(1)
    
    trend = compute_cycle_time_trend(repo_id)
    import json
    print(json.dumps(trend, indent=2))

if __name__ == "__main__":
    main()
