from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE_ROOT = PROJECT_ROOT.parent
SUMMARY_MD = WORKSPACE_ROOT / "决赛理论题准备-复习总结.md"
QUESTIONS_MD = WORKSPACE_ROOT / "决赛理论题准备.md"

CATEGORIES = [
    {
        "id": "law",
        "title": "法律法规与合规罚则",
        "keywords": ["网络安全法", "数据安全法", "个人信息保护法", "条例", "办法", "罚款", "处罚", "监管", "网信", "保密", "审计"],
    },
    {
        "id": "privacy",
        "title": "个人信息、隐私与跨境",
        "keywords": ["个人信息", "敏感", "隐私", "匿名化", "人脸", "出境", "跨境", "GDPR", "OECD", "APEC", "标准合同"],
    },
    {
        "id": "access",
        "title": "访问控制、身份认证与零信任",
        "keywords": ["访问控制", "RBAC", "ABAC", "PBAC", "ACL", "BLP", "SSO", "Kerberos", "MFA", "认证", "零信任", "令牌"],
    },
    {
        "id": "governance",
        "title": "等保、关基、数据安全治理",
        "keywords": ["等保", "等级保护", "关键信息基础设施", "关基", "分类分级", "成熟度", "风险评估", "应急", "重要数据", "核心数据"],
    },
    {
        "id": "network",
        "title": "网络、无线与物联网",
        "keywords": ["VLAN", "TTL", "SSL", "TCP", "OSI", "WEP", "Wi-Fi", "WPA", "ZigBee", "LoRa", "物联网", "车联网", "CAN"],
    },
    {
        "id": "data_cloud",
        "title": "数据库、大数据、备份与云安全",
        "keywords": ["Oracle", "MySQL", "数据库", "TDE", "Hadoop", "HDFS", "YARN", "备份", "RPO", "云", "CWPP", "KMS"],
    },
    {
        "id": "crypto_chain",
        "title": "区块链与密码学",
        "keywords": ["区块链", "比特币", "PoW", "POS", "共识", "智能合约", "哈希", "RSA", "密码", "零知识", "侧信道", "51%"],
    },
    {
        "id": "attack_forensics",
        "title": "攻防、取证、供应链与 APP 检测",
        "keywords": ["攻击", "漏洞", "取证", "供应链", "APP", "SDK", "Frida", "Wireshark", "应急处置", "日志", "恶意", "API 网关"],
    },
    {
        "id": "civil_contract",
        "title": "民法、电子签名与未成年人",
        "keywords": ["民法", "侵权", "电子签名", "电子合同", "未成年人", "自然人", "撤回", "同意"],
    },
    {"id": "mixed", "title": "综合易错", "keywords": []},
]


QUESTION_RE = re.compile(r"Q\s*(\d+)\s*[、,，]")
OPTION_RE = re.compile(r"([A-E])\s*[、.．]\s*")


def clean(text: str) -> str:
    text = text.replace("\r", "\n").replace("\u3000", " ").replace("\xa0", " ")
    text = text.replace("**", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_marks(text: str) -> str:
    return clean(text.replace("==", ""))


def category_for_text(text: str) -> str:
    upper_text = text.upper()
    best_id = "mixed"
    best_score = 0
    for category in CATEGORIES:
        if category["id"] == "mixed":
            continue
        score = 0
        for keyword in category["keywords"]:
            key = keyword.upper()
            if re.fullmatch(r"[A-Z0-9%+.-]{2,}", key):
                if re.search(rf"(?<![A-Z0-9]){re.escape(key)}(?![A-Z0-9])", upper_text):
                    score += 1
            elif key in upper_text:
                score += 1
        if score > best_score:
            best_score = score
            best_id = category["id"]
    return best_id


def parse_summary(summary_text: str) -> list[dict[str, Any]]:
    lines = summary_text.splitlines()
    cards_by_category: dict[str, list[dict[str, Any]]] = {item["id"]: [] for item in CATEGORIES}
    current_h2 = ""
    current_h3 = ""
    table_rows: list[list[str]] = []
    bullets: list[str] = []

    def flush_table() -> None:
        nonlocal table_rows
        if not table_rows:
            return
        title = current_h3 or current_h2 or "重点表格"
        text = f"{current_h2} {title} " + " ".join(" ".join(row) for row in table_rows[:12])
        cat = category_for_text(text)
        cards_by_category[cat].append({"title": title, "kind": "table", "rows": table_rows[:24]})
        table_rows = []

    def flush_bullets() -> None:
        nonlocal bullets
        if not bullets:
            return
        title = current_h3 or current_h2 or "记忆提示"
        cat = category_for_text(f"{current_h2} {title} {' '.join(bullets)}")
        cards_by_category[cat].append({"title": title, "kind": "bullets", "items": bullets[:18]})
        bullets = []

    for raw_line in lines:
        line = raw_line.strip()
        if line.startswith("## "):
            flush_table()
            flush_bullets()
            current_h2 = re.sub(r"^##\s+", "", line)
            current_h3 = ""
            continue
        if line.startswith("### "):
            flush_table()
            flush_bullets()
            current_h3 = re.sub(r"^###\s+", "", line)
            continue
        if line.startswith("|") and line.endswith("|"):
            cells = [strip_marks(cell.strip()) for cell in line.strip("|").split("|")]
            if cells and not all(set(cell) <= {"-", " ", ":"} for cell in cells):
                table_rows.append(cells)
            continue
        if line.startswith("-") or re.match(r"^\d+\.\s+", line):
            flush_table()
            bullets.append(strip_marks(re.sub(r"^(-|\d+\.)\s*", "", line)))
            continue
        if line.startswith("记忆钩子") or line.startswith("第二轮") or line.startswith("第四轮"):
            flush_table()
            bullets.append(strip_marks(line))

    flush_table()
    flush_bullets()

    topics = []
    for category in CATEGORIES:
        topics.append({"id": category["id"], "title": category["title"], "cards": cards_by_category[category["id"]]})
    return topics


def split_question_blocks(text: str) -> list[str]:
    matches = list(QUESTION_RE.finditer(text))
    blocks = []
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        blocks.append(text[match.start() : end].strip())
    return blocks


def highlighted_to_answer(marked: list[str], options: dict[str, str]) -> list[str]:
    answers: list[str] = []
    for fragment in marked:
        frag = strip_marks(fragment)
        for letter, option in options.items():
            if frag.startswith(f"{letter}、") or frag.startswith(f"{letter}.") or frag == letter:
                answers.append(letter)
            elif strip_marks(option) and strip_marks(option) in frag:
                answers.append(letter)
        if frag in {"正确", "错误"}:
            answers.append(frag)
    return sorted(set(answers), key=lambda item: "ABCDE正确错误".find(item[0]))


def parse_question_block(block: str) -> dict[str, Any] | None:
    if "==" not in block:
        judge = re.search(r"[（(]\s*(正确|错误)\s*[）)]", block)
        if not judge:
            return None

    head = QUESTION_RE.search(block)
    if not head:
        return None
    qid = int(head.group(1))
    body = block[head.end() :].strip().strip('"')
    marked = re.findall(r"==(.+?)==", body, flags=re.S)

    option_matches = list(OPTION_RE.finditer(body))
    options: dict[str, str] = {}
    if option_matches:
      for index, match in enumerate(option_matches):
          letter = match.group(1)
          start = match.end()
          end = option_matches[index + 1].start() if index + 1 < len(option_matches) else len(body)
          option_text = strip_marks(body[start:end])
          option_text = re.sub(r"\s*Q\d+.*$", "", option_text).strip()
          options[letter] = option_text
      question = strip_marks(body[: option_matches[0].start()])
    else:
      question = strip_marks(re.sub(r"[（(]\s*(正确|错误)\s*[）)]", "", body))

    answer = highlighted_to_answer(marked, options)
    judge = re.search(r"[（(]\s*(正确|错误)\s*[）)]", body)
    if not answer and judge:
        answer = [judge.group(1)]

    if not answer:
        return None

    if answer[0] in {"正确", "错误"}:
        qtype = "judge"
        answer_value: str | list[str] = answer[0]
        options = {"正确": "正确", "错误": "错误"}
    else:
        qtype = "multi" if len(answer) > 1 else "single"
        answer_value = answer
        answer = [item for item in answer if item in options]
        if not answer:
            return None
        answer_value = answer

    topic = category_for_text(question + " " + " ".join(options.values()))
    return {
        "id": qid,
        "type": qtype,
        "topic": topic,
        "question": question,
        "options": options,
        "answer": answer_value,
    }


def parse_questions(question_text: str) -> list[dict[str, Any]]:
    questions: list[dict[str, Any]] = []
    seen: set[int] = set()
    for block in split_question_blocks(question_text):
        item = parse_question_block(block)
        if item and item["id"] not in seen:
            seen.add(item["id"])
            questions.append(item)
    questions.sort(key=lambda item: item["id"])
    return questions


def attach_counts(topics: list[dict[str, Any]], questions: list[dict[str, Any]]) -> None:
    counts = {category["id"]: 0 for category in CATEGORIES}
    for question in questions:
        counts[question["topic"]] = counts.get(question["topic"], 0) + 1
    for topic in topics:
        topic["questionCount"] = counts.get(topic["id"], 0)


def build_data(summary_path: Path, questions_path: Path) -> dict[str, Any]:
    summary_text = clean(summary_path.read_text(encoding="utf-8"))
    question_text = clean(questions_path.read_text(encoding="utf-8"))
    topics = parse_summary(summary_text)
    questions = parse_questions(question_text)
    attach_counts(topics, questions)
    return {
        "topics": topics,
        "questions": questions,
        "meta": {
            "topicCount": len(topics),
            "questionCount": len(questions),
            "generatedFrom": ["review-summary", "marked-review-questions"],
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build breakthrough study data from Markdown notes.")
    parser.add_argument("--summary", type=Path, default=SUMMARY_MD)
    parser.add_argument("--questions", type=Path, default=QUESTIONS_MD)
    parser.add_argument("--out", type=Path, default=PROJECT_ROOT / "breakthrough.json")
    parser.add_argument("--js-out", type=Path, default=PROJECT_ROOT / "breakthrough-data.js")
    args = parser.parse_args()

    data = build_data(args.summary, args.questions)
    text = json.dumps(data, ensure_ascii=False, indent=2)
    args.out.write_text(text, encoding="utf-8")
    args.js_out.write_text("window.BREAKTHROUGH_DATA = " + text + ";\n", encoding="utf-8")
    print(f"Built {data['meta']['topicCount']} topics and {data['meta']['questionCount']} questions")
    print(f"Wrote {args.out}")
    print(f"Wrote {args.js_out}")


if __name__ == "__main__":
    main()
