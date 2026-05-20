"""Inject `session_classes` defaults into every Class Teacher in mockVolunteers.js.

Idempotent: if a teacher already has `session_classes` defined, the line is
left untouched. Each teacher's three sessions default to their primary class
code (taken from `assigned_classes`).
"""

from __future__ import annotations

import re
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "src" / "data" / "mockVolunteers.js"


def main() -> None:
    text = PATH.read_text(encoding="utf-8")

    pattern = re.compile(
        r"(roles: \['Class Teacher'\],\s*"
        r"assigned_class:\s*'([^']+)',\s*"
        r"assigned_classes:\s*\['[^']+'\],)"
    )

    def repl(match: re.Match[str]) -> str:
        head = match.group(1)
        code = match.group(2)
        # Don't double-add if a session_classes hint already exists nearby.
        if "session_classes" in match.group(0):
            return match.group(0)
        return (
            f"{head}\n"
            f"    session_classes: {{ '1': '{code}', '2': '{code}', '3': '{code}' }},"
        )

    new_text, count = pattern.subn(repl, text)
    if "session_classes" in text and count == 0:
        print("No changes (already updated).")
        return

    PATH.write_text(new_text, encoding="utf-8")
    print(f"Updated {count} teacher entries in {PATH.name}.")


if __name__ == "__main__":
    main()
