"""Try the matching engine from the command line.

Reads the studies from Supabase (needs a .env file with SUPABASE_URL and SUPABASE_KEY).
"""

import argparse
import sys

from app.errors import ValidationError

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
    parser.add_argument("--limit", type=int, default=None)
    return parser.parse_args()


def run(args):
    from app.services.matcher import find_matches
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