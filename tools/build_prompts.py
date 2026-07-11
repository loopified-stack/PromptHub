from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIRECTORY = PROJECT_ROOT / "library" / "prompts"
OUTPUT_FILE = PROJECT_ROOT / "library" / "prompts.generated.json"

REQUIRED_FIELDS = [
    "id",
    "title",
    "category",
    "description",
    "created_at",
]


def convert_for_json(value: Any) -> Any:
    """Convert YAML values into JSON-compatible values."""

    if isinstance(value, (date, datetime)):
        return value.isoformat()

    if isinstance(value, dict):
        return {
            key: convert_for_json(item)
            for key, item in value.items()
        }

    if isinstance(value, list):
        return [
            convert_for_json(item)
            for item in value
        ]

    return value


def read_prompt_file(file_path: Path) -> dict[str, Any]:
    """Read one Markdown prompt and extract its YAML front matter."""

    content = file_path.read_text(encoding="utf-8-sig")

    if not content.startswith("---"):
        raise ValueError(
            f"{file_path.name}: Missing opening front matter delimiter '---'."
        )

    parts = content.split("---", 2)

    if len(parts) < 3:
        raise ValueError(
            f"{file_path.name}: Missing closing front matter delimiter '---'."
        )

    front_matter_text = parts[1].strip()
    prompt_body = parts[2].strip()

    if not prompt_body:
        raise ValueError(
            f"{file_path.name}: Prompt body is empty."
        )

    metadata = yaml.safe_load(front_matter_text)

    if not isinstance(metadata, dict):
        raise ValueError(
            f"{file_path.name}: Front matter must contain YAML key-value pairs."
        )

    missing_fields = [
        field
        for field in REQUIRED_FIELDS
        if not metadata.get(field)
    ]

    if missing_fields:
        raise ValueError(
            f"{file_path.name}: Missing required fields: "
            + ", ".join(missing_fields)
        )

    metadata = convert_for_json(metadata)

    metadata["body_file"] = (
        f"prompts/{file_path.name}"
    )

    # The prompt text remains in the Markdown file.
    metadata.pop("body", None)

    return metadata


def build_prompts() -> None:
    """Build prompts.json from all Markdown prompt files."""

    if not PROMPTS_DIRECTORY.exists():
        raise FileNotFoundError(
            f"Prompt directory does not exist: {PROMPTS_DIRECTORY}"
        )

    markdown_files = sorted(
        file_path
        for file_path in PROMPTS_DIRECTORY.glob("*.md")
        if not file_path.name.startswith("_")
    )

    if not markdown_files:
        raise ValueError(
            "No Markdown prompt files were found."
        )

    prompts: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for file_path in markdown_files:
        prompt = read_prompt_file(file_path)
        prompt_id = str(prompt["id"])

        if prompt_id in used_ids:
            raise ValueError(
                f"Duplicate prompt id: {prompt_id}"
            )

        used_ids.add(prompt_id)
        prompts.append(prompt)

    prompts.sort(
        key=lambda prompt: (
            str(prompt.get("created_at", "")),
            str(prompt.get("title", "")),
        ),
        reverse=True,
    )

    OUTPUT_FILE.write_text(
        json.dumps(
            prompts,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"Successfully generated {OUTPUT_FILE}"
    )
    print(
        f"Prompts included: {len(prompts)}"
    )


if __name__ == "__main__":
    try:
        build_prompts()
    except Exception as error:
        print(
            f"Build failed: {error}",
            file=sys.stderr,
        )
        sys.exit(1)