from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_JSON = PROJECT_ROOT / "library" / "prompts.json"
PROMPTS_DIRECTORY = PROJECT_ROOT / "library" / "prompts"


def safe_filename(prompt_id: str) -> str:
    """Create a safe Markdown filename from a prompt ID."""

    filename = re.sub(
        r"[^a-zA-Z0-9_-]+",
        "-",
        prompt_id.strip(),
    ).strip("-")

    if not filename:
        raise ValueError(
            f"Could not create a filename from ID: {prompt_id!r}"
        )

    return f"{filename}.md"


def load_prompts() -> list[dict[str, Any]]:
    """Load and validate prompts.json."""

    data = json.loads(
        PROMPTS_JSON.read_text(encoding="utf-8")
    )

    if not isinstance(data, list):
        raise ValueError(
            "library/prompts.json must contain a JSON array."
        )

    return data


def create_markdown(
    prompt: dict[str, Any],
) -> str:
    """Convert one legacy JSON prompt into Markdown with YAML front matter."""

    body = str(prompt.get("body", "")).strip()

    if not body:
        raise ValueError(
            f"{prompt.get('id', 'unknown')}: Prompt body is empty."
        )

    metadata = {
        key: value
        for key, value in prompt.items()
        if key not in {"body", "body_file"}
    }

    front_matter = yaml.safe_dump(
        metadata,
        allow_unicode=True,
        sort_keys=False,
        width=1000,
    ).strip()

    return (
        "---\n"
        f"{front_matter}\n"
        "---\n\n"
        f"{body}\n"
    )


def migrate(write_files: bool) -> None:
    """Preview or create Markdown files for legacy JSON prompts."""

    prompts = load_prompts()
    PROMPTS_DIRECTORY.mkdir(
        parents=True,
        exist_ok=True,
    )

    legacy_count = 0
    created_count = 0
    skipped_count = 0

    for prompt in prompts:
        prompt_id = str(
            prompt.get("id", "")
        ).strip()

        if not prompt_id:
            raise ValueError(
                "A prompt entry is missing its ID."
            )

        # Already migrated prompts have body_file and no body.
        if not prompt.get("body"):
            continue

        legacy_count += 1

        output_file = (
            PROMPTS_DIRECTORY
            / safe_filename(prompt_id)
        )

        if output_file.exists():
            print(
                f"SKIP: {output_file.relative_to(PROJECT_ROOT)} "
                "(file already exists)"
            )
            skipped_count += 1
            continue

        print(
            f"{'CREATE' if write_files else 'WOULD CREATE'}: "
            f"{output_file.relative_to(PROJECT_ROOT)}"
        )

        if write_files:
            output_file.write_text(
                create_markdown(prompt),
                encoding="utf-8",
            )
            created_count += 1

    print()
    print(f"Legacy prompts found: {legacy_count}")
    print(f"Files created: {created_count}")
    print(f"Files skipped: {skipped_count}")

    if not write_files:
        print()
        print(
            "Dry run only. No files were changed."
        )
        print(
            "Run again with --write to create the files."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Convert legacy prompts from prompts.json "
            "into individual Markdown files."
        )
    )

    parser.add_argument(
        "--write",
        action="store_true",
        help="Actually create the Markdown files.",
    )

    arguments = parser.parse_args()

    try:
        migrate(write_files=arguments.write)
    except Exception as error:
        print(
            f"Migration failed: {error}",
            file=sys.stderr,
        )
        sys.exit(1)