from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import pdfplumber


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = PROJECT_ROOT / "48dfbf7cad45d0f4.pdf"

QUESTION_RE = re.compile(r"Q\s*(\d+)\s*[\u3001,\uff0c]")
OPTION_RE = re.compile(r"(^|\n)\s*([A-E])\s*[\u3001.\uff0e]\s*")
ANSWER_RE = re.compile(r"\u7b54\u6848\s*[:\uff1a]\s*([A-E]+|\u6b63\u786e|\u9519\u8bef)")
JUDGE_RE = re.compile(r"[\uff08(]\s*(\u6b63\s*\u786e|\u9519\s*\u8bef)\s*[\uff09)]\s*\"?\s*$")


def normalize_text(text: str) -> str:
    replacements = {
        "\r": "\n",
        "\u3000": " ",
        "\xa0": " ",
        "\ufe59": "\uff08",
        "\ufe5a": "\uff09",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_page_columns(page: pdfplumber.page.Page) -> list[str]:
    width = float(page.width)
    height = float(page.height)
    mid = width / 2
    boxes = [
        (0, 0, mid + 8, height),
        (mid - 8, 0, width, height),
    ]
    texts: list[str] = []
    for box in boxes:
        cropped = page.crop(box)
        text = cropped.extract_text(x_tolerance=1, y_tolerance=3) or ""
        texts.append(normalize_text(text))
    return texts


def collect_blocks(pdf_path: Path) -> list[dict[str, Any]]:
    chunks: list[dict[str, Any]] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_index, page in enumerate(pdf.pages, start=1):
            for col_index, text in enumerate(extract_page_columns(page)):
                if not text:
                    continue
                matches = list(QUESTION_RE.finditer(text))
                if not matches:
                    if chunks:
                        chunks[-1]["raw"] = normalize_text(chunks[-1]["raw"] + "\n" + text)
                    continue

                prefix = text[: matches[0].start()].strip()
                if prefix and chunks:
                    chunks[-1]["raw"] = normalize_text(chunks[-1]["raw"] + "\n" + prefix)

                for index, match in enumerate(matches):
                    start = match.start()
                    end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
                    qid = int(match.group(1))
                    chunks.append(
                        {
                            "id": qid,
                            "sourcePage": page_index,
                            "column": col_index + 1,
                            "raw": normalize_text(text[start:end].strip().strip('"')),
                        }
                    )
    chunks.sort(key=lambda item: item["id"])
    return chunks


def clean_inline_noise(value: str) -> str:
    value = value.strip().strip('"').strip()
    value = re.sub(r"\s+", " ", value)
    return value


def split_options(body: str) -> tuple[str, dict[str, str]]:
    matches = list(OPTION_RE.finditer(body))
    if not matches:
        return clean_inline_noise(body), {}

    question = clean_inline_noise(body[: matches[0].start()])
    options: dict[str, str] = {}
    for index, match in enumerate(matches):
        letter = match.group(2)
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(body)
        option_text = clean_inline_noise(body[start:end])
        option_text = re.sub(r"\s*\u7b54\u6848\s*[:\uff1a]\s*[A-E\u6b63\u786e\u9519\u8bef]+.*$", "", option_text).strip()
        options[letter] = option_text
    return question, options


def parse_block(block: dict[str, Any]) -> tuple[dict[str, Any] | None, str | None]:
    raw = normalize_text(block["raw"])
    head = QUESTION_RE.match(raw)
    if not head:
        return None, "missing question id"

    qid = int(head.group(1))
    body = raw[head.end() :].strip()
    answer_match = ANSWER_RE.search(body)
    judge_match = JUDGE_RE.search(body)

    answer = ""
    answer_span: tuple[int, int] | None = None
    if answer_match:
        answer = answer_match.group(1)
        answer_span = answer_match.span()
    elif judge_match:
        answer = re.sub(r"\s+", "", judge_match.group(1))
        answer_span = judge_match.span()

    if not answer:
        return None, "missing answer"

    body_without_answer = body
    if answer_span:
        body_without_answer = (body[: answer_span[0]] + " " + body[answer_span[1] :]).strip()

    if answer in {"\u6b63\u786e", "\u9519\u8bef"}:
        question = clean_inline_noise(body_without_answer)
        qtype = "judge"
        options: dict[str, str] = {"\u6b63\u786e": "\u6b63\u786e", "\u9519\u8bef": "\u9519\u8bef"}
    else:
        question, options = split_options(body_without_answer)
        if not options:
            return None, "missing options"
        missing_letters = [letter for letter in answer if letter not in options]
        if missing_letters:
            return None, f"answer option missing: {''.join(missing_letters)}"
        qtype = "multi" if len(answer) > 1 else "single"

    return (
        {
            "id": qid,
            "type": qtype,
            "question": question,
            "options": options,
            "answer": list(answer) if qtype != "judge" else answer,
            "sourcePage": block["sourcePage"],
        },
        None,
    )


def build_question_bank(pdf_path: Path) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    blocks = collect_blocks(pdf_path)
    questions: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    seen: set[int] = set()

    for block in blocks:
        item, error = parse_block(block)
        if item is None:
            errors.append(
                {
                    "id": block["id"],
                    "sourcePage": block["sourcePage"],
                    "column": block["column"],
                    "reason": error,
                    "raw": block["raw"][:500],
                }
            )
            continue
        if item["id"] in seen:
            errors.append(
                {
                    "id": item["id"],
                    "sourcePage": item["sourcePage"],
                    "column": block["column"],
                    "reason": "duplicate question id",
                    "raw": block["raw"][:500],
                }
            )
            continue
        seen.add(item["id"])
        questions.append(item)

    questions.sort(key=lambda item: item["id"])
    ids = {item["id"] for item in questions}
    raw_ids = {block["id"] for block in blocks}
    max_id = max(raw_ids) if raw_ids else 0
    report = {
        "sourcePdf": str(pdf_path),
        "rawQuestionMarkers": len(blocks),
        "parsedQuestions": len(questions),
        "maxQuestionId": max_id,
        "typeCounts": dict(Counter(item["type"] for item in questions)),
        "missingQuestionIds": [qid for qid in range(1, max_id + 1) if qid not in ids],
        "errorCount": len(errors),
        "errors": errors,
    }
    return questions, report


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract question bank from PDF.")
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "questions.json")
    parser.add_argument("--js-out", type=Path, default=PROJECT_ROOT / "questions-data.js")
    parser.add_argument("--report", type=Path, default=PROJECT_ROOT / "parse-report.json")
    args = parser.parse_args()

    questions, report = build_question_bank(args.pdf)
    questions_json = json.dumps(questions, ensure_ascii=False, indent=2)
    args.out.write_text(questions_json, encoding="utf-8")
    args.js_out.write_text("window.QUESTION_BANK = " + questions_json + ";\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Parsed {len(questions)} questions from {args.pdf}")
    print(f"Type counts: {report['typeCounts']}")
    print(f"Errors: {report['errorCount']}")
    print(f"Wrote {args.out}")
    print(f"Wrote {args.js_out}")
    print(f"Wrote {args.report}")


if __name__ == "__main__":
    main()
