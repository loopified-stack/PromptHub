from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIRECTORY = PROJECT_ROOT / "library" / "prompts"
CURRENT_INDEX_FILE = PROJECT_ROOT / "library" / "prompts.json"
OUTPUT_FILE = PROJECT_ROOT / "library" / "prompts.json"

REQUIRED_FIELDS = [
    "id",
    "title",
    "category",
    "description",
    "created_at",
]


def convert_for_json(value: Any) -> Any:
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
    content = file_path.read_text(encoding="utf-8-sig")

    if not content.startswith("---"):
        raise ValueError(
            f"{file_path.name}: Missing opening front matter delimiter."
        )

    parts = content.split("---", 2)

    if len(parts) < 3:
        raise ValueError(
            f"{file_path.name}: Missing closing front matter delimiter."
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
            f"{file_path.name}: Front matter must contain YAML metadata."
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
    metadata["body_file"] = f"prompts/{file_path.name}"
    metadata.pop("body", None)

    return metadata


def load_existing_prompts() -> list[dict[str, Any]]:
    if not CURRENT_INDEX_FILE.exists():
        return []

    data = json.loads(
        CURRENT_INDEX_FILE.read_text(encoding="utf-8")
    )

    if not isinstance(data, list):
        raise ValueError(
            "library/prompts.json must contain a JSON array."
        )

    return data


def build_prompts() -> None:
    if not PROMPTS_DIRECTORY.exists():
        raise FileNotFoundError(
            f"Prompt directory does not exist: {PROMPTS_DIRECTORY}"
        )

    existing_prompts = load_existing_prompts()

    markdown_files = sorted(
        file_path
        for file_path in PROMPTS_DIRECTORY.glob("*.md")
        if not file_path.name.startswith("_")
    )

    markdown_prompts: dict[str, dict[str, Any]] = {}

    for file_path in markdown_files:
        prompt = read_prompt_file(file_path)
        prompt_id = str(prompt["id"]).strip()

        if prompt_id in markdown_prompts:
            raise ValueError(
                f"Duplicate Markdown prompt id: {prompt_id}"
            )

        markdown_prompts[prompt_id] = prompt

    result: list[dict[str, Any]] = []
    used_ids: set[str] = set()

    for prompt in existing_prompts:
        prompt_id = str(prompt.get("id", "")).strip()

        if not prompt_id:
            raise ValueError(
                "Existing prompts.json contains an entry without an id."
            )

        if prompt_id in used_ids:
            raise ValueError(
                f"Duplicate id in prompts.json: {prompt_id}"
            )

        used_ids.add(prompt_id)

        if prompt_id in markdown_prompts:
            result.append(
                markdown_prompts.pop(prompt_id)
            )

        elif prompt.get("body_file"):
            print(
                f"Removing stale Markdown prompt: {prompt_id}"
            )
            continue

        else:
            result.append(prompt)

    for prompt in markdown_prompts.values():
        prompt_id = str(prompt["id"]).strip()

        if prompt_id in used_ids:
            raise ValueError(
                f"Duplicate prompt id: {prompt_id}"
            )

        used_ids.add(prompt_id)
        result.append(prompt)

    OUTPUT_FILE.write_text(
        json.dumps(
            result,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"Successfully generated {OUTPUT_FILE}")
    print(f"Prompts included: {len(result)}")
    print(f"Markdown prompts: {len(markdown_files)}")
    print(
        f"Legacy JSON prompts preserved: "
        f"{len(result) - len(markdown_files)}"
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