"""Try the matching engine from the command line.

With --offline it uses the studies in database/05_seed_studies.sql.
Without it, it reads the studies from Supabase (needs backend/.env).
"""

import argparse
import sys
from pathlib import Path

# Make the backend folder importable when this file is run directly.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.validation import ValidationError  # noqa: E402

SAMPLE = {
    "title": "Smart irrigation controller for small vegetable farms",
    "abstract": (
        "This capstone designs a low cost smart irrigation system that reads soil "
        "moisture sensors and decides when to water crops. A microcontroller opens "
        "the water valves, and farmers can check moisture levels and watering "
        "schedules from a mobile application. The goal is to save water and "
        "reduce manual work on small vegetable farms during the dry season."
    ),
    "keywords": "irrigation, soil moisture, sensor, farm",
}


def parse_args():
    parser = argparse.ArgumentParser(description="Try the Clio matching engine.")
    parser.add_argument("--title", default=SAMPLE["title"])
    parser.add_argument("--abstract", default=SAMPLE["abstract"])
    parser.add_argument("--keywords", default=SAMPLE["keywords"],
                        help="comma-separated keywords")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--offline", action="store_true",
                        help="use the seed file instead of Supabase")
    return parser.parse_args()


def run(args):
    if args.offline:
        from services.matcher import MatchService
        from tests.seed_loader import FakeStudyModel
        return MatchService(FakeStudyModel()).find_matches(
            args.title, args.abstract, args.keywords, limit=args.limit
        )
    from services.matcher import find_matches
    return find_matches(args.title, args.abstract, args.keywords, limit=args.limit)


def show(results):
    if not results:
        print("No matches above the minimum score.")
        return
    for rank, match in enumerate(results, start=1):
        print(f"{rank}. [{match['score']:5.1f}] {match['similarity']}")
        print(f"   {match['title']}")
        print(f"   {match['kind']} | {match['source']} | {match['year']}")
        print(f"   shared: {', '.join(match['shared_terms']) or '-'}")
        print()


def main():
    args = parse_args()
    try:
        show(run(args))
    except ValidationError as error:
        print("The input was rejected:")
        for name, message in error.errors.items():
            print(f"  {name}: {message}")
        sys.exit(1)


if __name__ == "__main__":
    main()