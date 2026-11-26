import argparse
import ast
import json
import re
import sqlite3
import sys
from collections import Counter, deque
from dataclasses import dataclass, field
from pathlib import Path

FORMAT = 1
TITLE_LIMIT = 140
OWN_EVENT_TOOLS = {"run_command", "write_file", "read_file", "post_chat", "post_task", "take_task",
                   "submit_task", "done_task"}
VILLAGE_EVENTS = {"run_config", "containers", "stopped", "session_end"}
QUIET_EVENTS = {"wake", "turn_start", "turn_end"}
NOTE_EVENTS = {"resume_repair", "prefix_changed", "thinking_dropped"}
FILE_EVENTS = {"read_file", "write_file"}
STOP_REASONS = {"rounds_done": "the requested rounds were done",
                "budget_exhausted": "the token budget ran out",
                "consecutive_failures": "too many consecutive turns failed"}
LIMIT_KEYS = {"rounds": "rounds", "max_tool_rounds": "maxToolRounds", "input_budget": "inputBudget",
              "output_budget": "outputBudget", "compact_trigger": "compactTrigger",
              "command_timeout": "commandTimeout"}
TASK_SUCCESS = {
    "post_task": re.compile(r"^You posted task (\d+)\.$"),
    "take_task": re.compile(r"^You took task (\d+)\.$"),
    "submit_task": re.compile(r"^Your result for task (\d+) was (?:submitted|updated to version (\d+); "
                              r"it replaces your previous submission)\.$"),
    "done_task": re.compile(r"^Task (\d+) is marked done\.$"),
}
SPEND_PATTERN = re.compile(r"^(\w+): input_tokens = (-?\d+), output_tokens = (-?\d+)"
                           r"(?:, cache_read_tokens = (-?\d+), cache_write_tokens = (-?\d+))?")
RUN_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
SENTENCE_PATTERN = re.compile(r"(.+?[.!?])(?:\s|$)")
USAGE_KEYS = ("calls", "input", "output", "cacheRead", "cacheWrite")
DEFAULT_OUT = Path(__file__).resolve().parent.parent / "public" / "runs"


@dataclass
class Event:
    id: int
    actor: str
    type: str
    content: str
    ts: float

    def data(self):
        try:
            value = json.loads(self.content)
        except (TypeError, ValueError):
            return None
        return value if isinstance(value, dict) else None


@dataclass
class Turn:
    actor: str
    round: int
    log_step: int | None
    start: float
    first_id: int
    events: list = field(default_factory=list)
    status: str | None = None


@dataclass
class Source:
    events: list
    chat_rows: list
    goal: str


def open_database(db_path):
    return sqlite3.connect(f"{Path(db_path).resolve().as_uri()}?mode=ro&immutable=1", uri=True)


def table_exists(conn, name):
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)).fetchone() is not None


def load_source(db_path):
    conn = open_database(db_path)
    try:
        events = [Event(*row) for row in conn.execute("SELECT id, actor, type, content, ts FROM event ORDER BY id")]
        chat_rows = []
        if table_exists(conn, "chat"):
            chat_rows = conn.execute("SELECT id, actor, content, ts FROM chat ORDER BY id").fetchall()
        goal = conn.execute("SELECT goal FROM run_state").fetchone() if table_exists(conn, "run_state") else None
    finally:
        conn.close()
    return Source(events, chat_rows, (goal[0] if goal else "") or "")


def build_turns(events):
    marked = any(event.type == "turn_start" for event in events)
    starter = "turn_start" if marked else "wake"
    actors, turns, current = [], [], None
    for event in events:
        if event.actor == "village" or event.type in VILLAGE_EVENTS:
            continue
        if event.type == starter:
            info = event.data() or {}
            if not marked and event.actor not in actors:
                actors.append(event.actor)
            current = Turn(event.actor, info.get("round", 0) if marked else 0, info.get("step") if marked else None,
                           event.ts, event.id)
            turns.append(current)
            continue
        if event.type == "turn_end" and current is not None:
            current.status = (event.data() or {}).get("status")
        if current is None or current.actor != event.actor:
            current = Turn(event.actor, current.round if current else 0, None, event.ts, event.id)
            turns.append(current)
        current.events.append(event)
    if not marked and actors:
        for index, turn in enumerate(turns):
            turn.round = index // len(actors) + 1
    return turns, marked


def command_failed(data):
    return bool(data.get("timed_out")) or data.get("exit_code") not in (0, None)


def parse_tool_args(text):
    raw = text.strip()
    try:
        value = ast.literal_eval(raw)
        json.dumps(value)
    except (ValueError, SyntaxError, TypeError, MemoryError, RecursionError):
        return {"raw": raw}
    return value if isinstance(value, dict) else {"raw": raw}


def tool_name(event):
    return (event.content or "").split(":", 1)[0].strip()


def tool_record(event):
    name = tool_name(event)
    if name in OWN_EVENT_TOOLS:
        return None
    return {"kind": "tool", "name": name, "args": parse_tool_args((event.content or "").partition(":")[2])}


def written_file_args(event):
    if event.type != "tool_use" or tool_name(event) != "write_file":
        return None
    args = parse_tool_args((event.content or "").partition(":")[2])
    return args if isinstance(args.get("path"), str) else None


def take_written_content(pending, path):
    for position, args in enumerate(pending):
        if args["path"] == path:
            pending.pop(position)
            content = args.get("content")
            return content if isinstance(content, str) else None
    return None


def spend_record(event):
    match = SPEND_PATTERN.match(event.content or "")
    numbers = [int(value or 0) for value in match.groups()[1:]] if match else [0, 0, 0, 0]
    return {"kind": "spend", "phase": match.group(1) if match else "", "input": numbers[0], "output": numbers[1],
            "cacheRead": numbers[2], "cacheWrite": numbers[3]}


def command_record(data):
    return {"kind": "command", "command": data.get("command") or "", "exitCode": data.get("exit_code"),
            "timedOut": bool(data.get("timed_out")), "duration": data.get("duration"),
            "stdout": data.get("stdout") or "", "stderr": data.get("stderr") or "", "failed": command_failed(data)}


def file_record(kind, data):
    if "error" in data:
        status, detail = "rejected", str(data["error"])
    elif data.get("exit_code") not in (0, None):
        status, detail = "failed", data.get("stderr") or ""
    else:
        status, detail = "ok", ""
    record = {"kind": kind, "path": data.get("path") or "", "status": status, "detail": detail}
    if kind == "write_file":
        record["bytes"] = data.get("bytes")
    return record


def task_record(event):
    data = event.data()
    if data is None:
        return {"kind": "task", "action": event.type, "taskId": None, "ok": False, "outcome": event.content or ""}
    outcome = str(data.get("outcome", ""))
    match = TASK_SUCCESS[event.type].match(outcome)
    record = {"kind": "task", "action": event.type, "taskId": int(match.group(1)) if match else data.get("task_id"),
              "ok": bool(match), "outcome": outcome}
    if event.type == "post_task":
        record["description"] = data.get("description") or ""
        record["maxWorkers"] = data.get("max_workers")
    if event.type == "submit_task":
        record["result"] = data.get("result") or ""
        record["version"] = int(match.group(2) or 1) if match else None
    return record


def normalise(event):
    data = event.data()
    if event.type == "tool_use":
        return tool_record(event)
    if event.type == "spend":
        return spend_record(event)
    if event.type == "say":
        return {"kind": "say", "text": event.content or ""}
    if event.type == "post_chat":
        return {"kind": "chat", "text": event.content or "", "chatId": None}
    if event.type == "command" and data:
        return command_record(data)
    if event.type in FILE_EVENTS and data:
        return file_record(event.type, data)
    if event.type in TASK_SUCCESS:
        return task_record(event)
    if event.type == "compact":
        return {"kind": "compact", "text": event.content or ""}
    if event.type == "turn_error":
        return {"kind": "turn_error", "text": event.content or ""}
    if event.type in NOTE_EVENTS:
        return {"kind": "note", "type": event.type, "text": event.content or ""}
    return None


def is_unrendered(event):
    return event.type not in QUIET_EVENTS and event.type != "tool_use"


def stamp(ts):
    return round(ts, 3)


def turn_records(turn, first_step, skipped):
    records, step, pending_writes = [], first_step, []
    for event in turn.events:
        written = written_file_args(event)
        if written is not None:
            pending_writes.append(written)
        record = normalise(event)
        if record is None:
            if is_unrendered(event):
                skipped[event.type] += 1
            continue
        record = {"id": event.id, "ts": stamp(event.ts), **record}
        if record["kind"] == "write_file":
            record["content"] = take_written_content(pending_writes, record["path"])
        if record["kind"] != "spend":
            record["step"] = step
            step += 1
        records.append(record)
    if step == first_step:
        records.append({"id": turn.first_id, "ts": stamp(turn.start), "kind": "idle", "step": step})
    return records


def empty_usage():
    return dict.fromkeys(USAGE_KEYS, 0)


def add_usage(total, other):
    for key in USAGE_KEYS:
        total[key] += other[key]


def records_usage(records):
    usage = empty_usage()
    for record in records:
        if record["kind"] == "spend":
            add_usage(usage, {**record, "calls": 1})
    return usage


def summarise_turn(index, position, turn, records):
    visible = [record for record in records if "step" in record]
    commands = [record for record in records if record["kind"] == "command"]
    last = turn.events[-1] if turn.events else None
    return {"index": index, "round": turn.round, "position": position, "actor": turn.actor,
            "logStep": turn.log_step, "status": turn.status, "startTs": stamp(turn.start),
            "endTs": stamp(last.ts if last else turn.start), "firstEventId": turn.first_id,
            "lastEventId": last.id if last else turn.first_id, "firstStep": visible[0]["step"],
            "stepCount": len(visible), "usage": records_usage(records), "commands": len(commands),
            "failedCommands": sum(record["failed"] for record in commands),
            "errors": sum(record["kind"] == "turn_error" for record in records)}


def empty_tally():
    return {"usage": empty_usage(), "commands": 0, "failedCommands": 0}


def add_tally(total, summary):
    add_usage(total["usage"], summary["usage"])
    total["commands"] += summary["commands"]
    total["failedCommands"] += summary["failedCommands"]


def copy_tally(tally):
    return {"usage": dict(tally["usage"]), "commands": tally["commands"], "failedCommands": tally["failedCommands"]}


def attach_running_totals(turn_summaries):
    village, actors = empty_tally(), {}
    for summary in turn_summaries:
        own = actors.setdefault(summary["actor"], empty_tally())
        summary["before"] = {"village": copy_tally(village), "actor": copy_tally(own)}
        add_tally(village, summary)
        add_tally(own, summary)


def round_file_name(number):
    return f"rounds/{number:03d}.json"


def summarise_round(number, summaries):
    usage = empty_usage()
    for summary in summaries:
        add_usage(usage, summary["usage"])
    return {"round": number, "file": round_file_name(number), "turns": [summary["index"] for summary in summaries],
            "startTs": summaries[0]["startTs"], "endTs": max(summary["endTs"] for summary in summaries),
            "stepCount": sum(summary["stepCount"] for summary in summaries),
            "commands": sum(summary["commands"] for summary in summaries),
            "failedCommands": sum(summary["failedCommands"] for summary in summaries),
            "failedTurns": sum(summary["status"] == "error" for summary in summaries), "usage": usage}


def attach_chat_ids(turn_summaries, records_by_turn, chat_rows):
    waiting = {}
    for row in chat_rows:
        waiting.setdefault((row[1], row[2]), deque()).append(row)
    messages = []
    for summary in turn_summaries:
        for record in records_by_turn[summary["index"]]:
            if record["kind"] != "chat":
                continue
            queue = waiting.get((summary["actor"], record["text"]))
            row = queue.popleft() if queue else None
            record["chatId"] = row[0] if row else None
            messages.append({"id": record["chatId"], "actor": summary["actor"], "content": record["text"],
                             "ts": stamp(row[3]) if row else record["ts"], "eventId": record["id"],
                             "step": record["step"], "turn": summary["index"]})
    return messages, sum(len(queue) for queue in waiting.values())


def task_events(turn_summaries, records_by_turn):
    events = []
    for summary in turn_summaries:
        for record in records_by_turn[summary["index"]]:
            if record["kind"] != "task":
                continue
            fields = {key: value for key, value in record.items() if key not in ("kind", "id")}
            events.append({"eventId": record["id"], "turn": summary["index"], "actor": summary["actor"], **fields})
    return events


def stop_text(event):
    if event is None:
        return "not recorded"
    if event.type == "stopped":
        return event.content or ""
    reason = (event.data() or {}).get("reason")
    return STOP_REASONS.get(reason, f"unknown reason {reason!r}")


def session_limits(config):
    limits = config.get("limits") or {}
    return {target: limits.get(source) for source, target in LIMIT_KEYS.items()}


def summarise_session(config_event, session_events, first_turn):
    config = config_event.data() or {}
    statuses = [(event.data() or {}).get("status") for event in session_events if event.type == "turn_end"]
    end = next((event for event in session_events if event.type in ("session_end", "stopped")), None)
    reason = (end.data() or {}).get("reason") if end is not None and end.type == "session_end" else None
    return {"mode": config.get("mode"), "round": config.get("round"), "logStep": config.get("step"),
            "ts": stamp(config_event.ts), "eventId": config_event.id, "firstTurn": first_turn,
            "network": config.get("network"), "limits": session_limits(config),
            "attempted": sum(event.type == "turn_start" for event in session_events),
            "ok": statuses.count("ok"), "failed": statuses.count("error"),
            "stopReason": reason, "stopText": stop_text(end)}


def build_sessions(events, turns):
    turn_starts = [turn.first_id for turn in turns]
    sessions = []
    for event in events:
        if event.type == "run_config":
            sessions.append((event, []))
        elif sessions:
            sessions[-1][1].append(event)
    return [summarise_session(config, rest, sum(start < config.id for start in turn_starts))
            for config, rest in sessions]


def build_villagers(events, turns):
    configs = [event.data() or {} for event in events if event.type == "run_config"]
    latest = configs[-1] if configs else {}
    models = latest.get("models") or {}
    roles = latest.get("roles") or {}
    names = list(dict.fromkeys([*(turn.actor for turn in turns), *models]))
    return [{"name": name, "role": roles.get(name, ""), "model": models.get(name, "")} for name in names]


def villager_totals(names, turn_summaries, chat):
    rows = []
    for name in names:
        own = [summary for summary in turn_summaries if summary["actor"] == name]
        usage = empty_usage()
        for summary in own:
            add_usage(usage, summary["usage"])
        rows.append({"name": name, "turns": len(own), "usage": usage,
                     "commands": sum(summary["commands"] for summary in own),
                     "failedCommands": sum(summary["failedCommands"] for summary in own),
                     "chatMessages": sum(message["actor"] == name for message in chat)})
    return rows


def build_totals(names, turn_summaries, round_summaries, chat):
    usage = empty_usage()
    for summary in turn_summaries:
        add_usage(usage, summary["usage"])
    statuses = [summary["status"] for summary in turn_summaries]
    return {"rounds": len(round_summaries), "turns": len(turn_summaries), "okTurns": statuses.count("ok"),
            "failedTurns": statuses.count("error"),
            "unfinishedTurns": len(statuses) - statuses.count("ok") - statuses.count("error"),
            "steps": sum(summary["stepCount"] for summary in turn_summaries),
            "commands": sum(summary["commands"] for summary in turn_summaries),
            "failedCommands": sum(summary["failedCommands"] for summary in turn_summaries),
            "chatMessages": len(chat), "usage": usage,
            "perVillager": villager_totals(names, turn_summaries, chat)}


def first_sentence(text):
    lines = text.strip().splitlines()
    line = lines[0].strip() if lines else ""
    match = SENTENCE_PATTERN.match(line)
    sentence = match.group(1) if match else line
    return sentence if len(sentence) <= TITLE_LIMIT else sentence[:TITLE_LIMIT - 1].rstrip() + "…"


def resolve_highlights(entries, turn_summaries):
    by_place = {(summary["round"], summary["position"]): summary for summary in turn_summaries}
    resolved = []
    for entry in entries:
        summary = by_place.get((entry.get("round"), entry.get("turn"))) if isinstance(entry, dict) else None
        if summary is None:
            print(f"highlight skipped, no such round and turn: {entry!r}", file=sys.stderr)
            continue
        resolved.append({"round": summary["round"], "turn": summary["position"], "turnIndex": summary["index"],
                         "actor": summary["actor"], "title": str(entry.get("title", "")),
                         "note": str(entry.get("note", ""))})
    return resolved


def build_export(source, run_id, title=None, highlights=()):
    turns, marked = build_turns(source.events)
    skipped = Counter()
    positions = Counter()
    turn_summaries, records_by_turn, next_step = [], [], 0
    for index, turn in enumerate(turns):
        positions[turn.round] += 1
        records = turn_records(turn, next_step, skipped)
        summary = summarise_turn(index, positions[turn.round], turn, records)
        next_step += summary["stepCount"]
        turn_summaries.append(summary)
        records_by_turn.append(records)
    attach_running_totals(turn_summaries)
    chat, unmatched_chat = attach_chat_ids(turn_summaries, records_by_turn, source.chat_rows)
    grouped = {}
    for summary in turn_summaries:
        grouped.setdefault(summary["round"], []).append(summary)
    round_summaries = [summarise_round(number, summaries) for number, summaries in grouped.items()]
    villagers = build_villagers(source.events, turns)
    goal = source.goal or next(((event.data() or {}).get("goal", "") for event in source.events
                                if event.type == "run_config"), "")
    manifest = {
        "format": FORMAT, "id": run_id, "title": title or first_sentence(goal) or run_id, "goal": goal,
        "startTs": stamp(source.events[0].ts) if source.events else None,
        "endTs": stamp(source.events[-1].ts) if source.events else None,
        "marked": marked, "villagers": villagers, "sessions": build_sessions(source.events, turns),
        "totals": build_totals([villager["name"] for villager in villagers], turn_summaries, round_summaries, chat),
        "rounds": round_summaries, "turns": turn_summaries, "chat": chat,
        "taskEvents": task_events(turn_summaries, records_by_turn),
        "highlights": resolve_highlights(highlights, turn_summaries),
    }
    round_files = {
        entry["file"]: {"format": FORMAT, "run": run_id, "round": entry["round"],
                        "turns": [{"index": index, "actor": turn_summaries[index]["actor"],
                                   "position": turn_summaries[index]["position"],
                                   "records": records_by_turn[index]} for index in entry["turns"]]}
        for entry in round_summaries}
    notes = {"skippedEventTypes": dict(skipped), "unmatchedChatRows": unmatched_chat}
    return manifest, round_files, notes


def write_json(path, value, indent=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    separators = None if indent else (",", ":")
    path.write_text(json.dumps(value, indent=indent, separators=separators) + "\n", encoding="utf-8", newline="\n")


def read_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def read_highlights(run_dir):
    entries = read_json(run_dir / "highlights.json", [])
    return entries if isinstance(entries, list) else []


def index_entry(manifest):
    return {"id": manifest["id"], "title": manifest["title"], "startTs": manifest["startTs"],
            "endTs": manifest["endTs"], "rounds": manifest["totals"]["rounds"], "turns": manifest["totals"]["turns"]}


def update_runs_index(out_dir, manifest):
    path = out_dir / "index.json"
    existing = read_json(path, {})
    runs = [run for run in existing.get("runs", []) if run.get("id") != manifest["id"]]
    runs.append(index_entry(manifest))
    runs.sort(key=lambda run: (run.get("startTs") or 0, run["id"]), reverse=True)
    write_json(path, {"format": FORMAT, "runs": runs}, indent=2)


def export_run(db_path, run_id, out_dir, title=None):
    out_dir = Path(out_dir)
    run_dir = out_dir / run_id
    manifest, round_files, notes = build_export(load_source(db_path), run_id, title, read_highlights(run_dir))
    rounds_dir = run_dir / "rounds"
    if rounds_dir.exists():
        for stale in rounds_dir.glob("*.json"):
            stale.unlink()
    for name, content in round_files.items():
        write_json(run_dir / name, content)
    write_json(run_dir / "index.json", manifest)
    update_runs_index(out_dir, manifest)
    return manifest, notes


def report(manifest, notes, run_dir):
    totals = manifest["totals"]
    print(f"run {manifest['id']}: {totals['rounds']} rounds, {totals['turns']} turns "
          f"({totals['failedTurns']} failed), {totals['steps']} visible steps")
    print(f"commands: {totals['commands']}, failed: {totals['failedCommands']}; "
          f"chat messages: {totals['chatMessages']}; task events: {len(manifest['taskEvents'])}; "
          f"highlights: {len(manifest['highlights'])}")
    for row in totals["perVillager"]:
        usage = row["usage"]
        print(f"  {row['name']}: {row['turns']} turns, {usage['calls']} model calls, "
              f"{usage['input']:,} input tokens, {usage['output']:,} output tokens")
    if notes["skippedEventTypes"]:
        print(f"event types not shown as steps: {notes['skippedEventTypes']}")
    if notes["unmatchedChatRows"]:
        print(f"chat rows without a post_chat event: {notes['unmatchedChatRows']}")
    print(f"written to {run_dir}")


def main(argv=None):
    parser = argparse.ArgumentParser(prog="export_run.py",
                                     description="Export an agent-village run as static JSON for the replay viewer.")
    parser.add_argument("db", help="path to the run's village.db")
    parser.add_argument("--id", required=True, help="run id, used as the directory name and in links")
    parser.add_argument("--out", default=str(DEFAULT_OUT),
                        help="directory that holds all exported runs (default: public/runs in this project)")
    parser.add_argument("--title", help="title shown in the run picker; defaults to the goal's first sentence")
    args = parser.parse_args(argv)
    if not Path(args.db).is_file():
        parser.error(f"no database at {args.db}")
    if not RUN_ID_PATTERN.fullmatch(args.id):
        parser.error("the run id may only contain letters, digits, dots, dashes and underscores")
    manifest, notes = export_run(args.db, args.id, args.out, args.title)
    report(manifest, notes, Path(args.out) / args.id)


if __name__ == "__main__":
    main()
