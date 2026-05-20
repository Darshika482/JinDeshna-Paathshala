"""Generate a cleaned students-import SQL file without the `group_hi` column.

Reads `supabase/generated_students_import_bilingual.sql` and writes
`supabase/generated_students_import_clean.sql` next to it.
"""

from __future__ import annotations

import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SUPABASE_DIR = HERE.parent / "supabase"
SRC = SUPABASE_DIR / "generated_students_import_bilingual.sql"
DST = SUPABASE_DIR / "generated_students_import_clean.sql"


def split_top_level_commas(s: str) -> list[str]:
    """Split a tuple body on commas that are NOT inside single-quoted strings or {} arrays."""
    parts: list[str] = []
    buf: list[str] = []
    in_str = False
    depth = 0
    i = 0
    while i < len(s):
        ch = s[i]
        if in_str:
            buf.append(ch)
            if ch == "'":
                # Handle escaped '' inside strings.
                if i + 1 < len(s) and s[i + 1] == "'":
                    buf.append(s[i + 1])
                    i += 2
                    continue
                in_str = False
        else:
            if ch == "'":
                in_str = True
                buf.append(ch)
            elif ch == "{":
                depth += 1
                buf.append(ch)
            elif ch == "}":
                depth -= 1
                buf.append(ch)
            elif ch == "," and depth == 0:
                parts.append("".join(buf).strip())
                buf = []
            else:
                buf.append(ch)
        i += 1
    if buf:
        parts.append("".join(buf).strip())
    return parts


def main() -> None:
    text = SRC.read_text(encoding="utf-8")
    lines = text.splitlines()
    out: list[str] = []

    # Index of group_hi in the column list.
    drop_idx: int | None = None

    for line in lines:
        if line.startswith("insert into students "):
            cols_match = re.search(r"\((.*?)\)\s*values", line)
            assert cols_match, line
            cols_inner = cols_match.group(1)
            cols = [c.strip() for c in cols_inner.split(",")]
            drop_idx = cols.index("group_hi")
            new_cols = [c for c in cols if c != "group_hi"]
            new_line = re.sub(
                r"\((.*?)\)\s*values",
                f"({', '.join(new_cols)}) values",
                line,
            )
            out.append(new_line)
            continue

        if drop_idx is not None and line.lstrip().startswith("("):
            stripped = line.rstrip()
            trailing = ""
            if stripped.endswith(","):
                trailing = ","
                stripped = stripped[:-1]
            elif stripped.endswith(";"):
                trailing = ";"
                stripped = stripped[:-1]

            assert stripped.startswith("(") and stripped.endswith(")"), line
            body = stripped[1:-1]
            values = split_top_level_commas(body)
            kept = [v for i, v in enumerate(values) if i != drop_idx]
            out.append("(" + ", ".join(kept) + ")" + trailing)
            continue

        out.append(line)

    DST.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"Wrote {DST} ({DST.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
