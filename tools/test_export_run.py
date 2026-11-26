import contextlib
import io
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import export_run

SCHEMA = """
    CREATE TABLE chat(id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, content TEXT, ts REAL);
    CREATE TABLE budget(id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, input_tokens INTEGER,
        output_tokens INTEGER, ts REAL, event TEXT DEFAULT 'thinking',
        cache_read_tokens INTEGER DEFAULT 0, cache_write_tokens INTEGER DEFAULT 0);
    CREATE TABLE event(id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, type TEXT, content TEXT, ts REAL);
    CREATE TABLE run_state(id INTEGER PRIMARY KEY CHECK (id = 1), step INTEGER, goal TEXT);
"""
GOAL = "Build a tiny tool. Keep it tested."
CONFIG = {"mode": "start", "step": 0, "round": 1, "goal": GOAL,
          "models": {"ann": "model-a", "bob": "model-b"}, "roles": {"ann": "leader", "bob": "worker"},
          "limits": {"rounds": 2, "max_tool_rounds": 5, "input_budget": 1000, "output_budget": 100,
                     "compact_trigger": 400, "command_timeout": 30},
          "network": False}


class RunBuilder:
    def __init__(self, path):
        self.conn = sqlite3.connect(path)
        self.conn.executescript(SCHEMA)
        self.conn.execute("INSERT INTO run_state(id, step, goal) VALUES (1, 0, ?)", (GOAL,))
        self.clock = 1000.0

    def log(self, actor, kind, content):
        self.clock += 1
        text = content if isinstance(content, str) else json.dumps(content)
        self.conn.execute("INSERT INTO event(actor, type, content, ts) VALUES (?, ?, ?, ?)",
                          (actor, kind, text, self.clock))

    def spend(self, actor, tokens_in, tokens_out, cache_read=0, cache_write=0, phase="thinking"):
        self.conn.execute("INSERT INTO budget(actor, input_tokens, output_tokens, ts, event, cache_read_tokens, "
                          "cache_write_tokens) VALUES (?, ?, ?, ?, ?, ?, ?)",
                          (actor, tokens_in, tokens_out, self.clock, phase, cache_read, cache_write))
        self.log(actor, "spend", f"{phase}: input_tokens = {tokens_in}, output_tokens = {tokens_out}, "
                                 f"cache_read_tokens = {cache_read}, cache_write_tokens = {cache_write}")

    def chat(self, actor, content):
        self.conn.execute("INSERT INTO chat(actor, content, ts) VALUES (?, ?, ?)", (actor, content, self.clock))
        self.log(actor, "tool_use", f"post_chat: {{'content': {content!r}}}")
        self.log(actor, "post_chat", content)

    def command(self, actor, command, exit_code=0, timed_out=False, stdout="", stderr=""):
        self.log(actor, "tool_use", f"run_command: {{'command': {command!r}}}")
        self.log(actor, "command", {"command": command, "exit_code": exit_code, "timed_out": timed_out,
                                    "duration": 0.5, "stdout": stdout, "stderr": stderr})

    def start_turn(self, actor, step, round_number):
        self.log(actor, "turn_start", {"step": step, "round": round_number})
        self.log(actor, "wake", "0 new messages")

    def end_turn(self, actor, step, round_number, status="ok"):
        self.log(actor, "turn_end", {"step": step, "round": round_number, "status": status})

    def close(self):
        self.conn.commit()
        self.conn.close()


def build_run(path):
    run = RunBuilder(path)
    run.log("village", "run_config", CONFIG)
    run.log("village", "containers", "started 2 containers, network off")

    run.start_turn("ann", 0, 1)
    run.spend("ann", 100, 10, cache_read=40, cache_write=60)
    run.log("ann", "say", "Planning the work.")
    run.log("ann", "tool_use", "read_task: {}")
    run.log("ann", "tool_use", "post_task: {'description': 'Write the tool', 'max_workers': 1}")
    run.log("ann", "post_task", {"description": "Write the tool", "max_workers": 1, "outcome": "You posted task 1."})
    run.spend("ann", 120, 5)
    run.chat("ann", "Task 1 is on the board.")
    run.end_turn("ann", 0, 1)

    run.start_turn("bob", 1, 1)
    run.spend("bob", 200, 20)
    run.log("bob", "tool_use", "take_task: {'task_id': 1}")
    run.log("bob", "take_task", {"task_id": 1, "outcome": "You took task 1."})
    run.command("bob", "pytest -q", exit_code=1, stdout="1 failed\n", stderr="boom\n")
    run.command("bob", "sleep 99", exit_code=137, timed_out=True)
    run.command("bob", "echo ok", stdout="ok\n")
    run.log("bob", "tool_use", "write_file: {'path': 'tool.py', 'content': 'print(1)'}")
    run.log("bob", "write_file", {"path": "tool.py", "bytes": 8, "exit_code": 0, "stderr": ""})
    run.log("bob", "tool_use", "read_file: {'path': '../secret'}")
    run.log("bob", "read_file", {"path": "../secret", "error": "path is outside /repo"})
    run.spend("bob", 50, 5, phase="compact")
    run.log("bob", "compact", "summarized messages 0-3")
    run.log("bob", "tool_use", "submit_task: {'task_id': 1, 'result': 'done in tool.py'}")
    run.log("bob", "submit_task", {"task_id": 1, "result": "done in tool.py",
                                   "outcome": "Your result for task 1 was submitted."})
    run.log("bob", "tool_use", "take_task: {'task_id': 1}")
    run.log("bob", "take_task", {"task_id": 1, "outcome": "You have already taken task 1."})
    run.end_turn("bob", 1, 1)

    run.start_turn("ann", 2, 2)
    run.spend("ann", 10, 1)
    run.end_turn("ann", 2, 2)

    run.start_turn("bob", 3, 2)
    run.spend("bob", 30, 3)
    run.log("bob", "tool_use", "check_balance: {}")
    run.log("bob", "turn_error", "RuntimeError: api unreachable")
    run.end_turn("bob", 3, 2, status="error")

    run.log("village", "session_end", {"reason": "rounds_done", "turns": 4, "ok": 3, "failed": 1})
    run.log("village", "containers", "removed 2 containers")
    run.close()


def run_exporter(*arguments):
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        export_run.main([str(argument) for argument in arguments])


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


class ExportRunTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        root = Path(cls.directory.name)
        cls.db = root / "village.db"
        cls.out = root / "runs"
        build_run(cls.db)
        highlights = cls.out / "demo" / "highlights.json"
        highlights.parent.mkdir(parents=True)
        cls.highlight_text = json.dumps([{"round": 1, "turn": 2, "title": "bob works", "note": "first commands"},
                                         {"round": 9, "turn": 1, "title": "missing", "note": "no such turn"}])
        highlights.write_text(cls.highlight_text, encoding="utf-8")
        run_exporter(cls.db, "--id", "demo", "--out", cls.out)
        cls.manifest = read(cls.out / "demo" / "index.json")
        cls.round_one = read(cls.out / "demo" / "rounds" / "001.json")
        cls.round_two = read(cls.out / "demo" / "rounds" / "002.json")

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def kinds(self, round_file, turn):
        return [record["kind"] for record in round_file["turns"][turn]["records"]]

    def test_database_is_left_untouched(self):
        self.assertEqual(sorted(path.name for path in self.db.parent.glob("village.db*")), ["village.db"])

    def test_villagers_are_listed_in_turn_order(self):
        self.assertEqual(self.manifest["villagers"], [{"name": "ann", "role": "leader", "model": "model-a"},
                                                      {"name": "bob", "role": "worker", "model": "model-b"}])
        self.assertEqual(self.manifest["goal"], GOAL)
        self.assertEqual(self.manifest["title"], "Build a tiny tool.")

    def test_turn_order_wins_over_run_config_order(self):
        source = export_run.load_source(self.db)
        for event in source.events:
            if event.type == "run_config":
                event.content = json.dumps({**CONFIG, "models": {"cy": "model-c", "bob": "model-b", "ann": "model-a"}})
        manifest, _, _ = export_run.build_export(source, "demo")
        self.assertEqual([villager["name"] for villager in manifest["villagers"]], ["ann", "bob", "cy"])

    def test_totals(self):
        totals = self.manifest["totals"]
        self.assertEqual((totals["rounds"], totals["turns"], totals["okTurns"], totals["failedTurns"]), (2, 4, 3, 1))
        self.assertEqual((totals["commands"], totals["failedCommands"], totals["chatMessages"]), (3, 2, 1))
        self.assertEqual(totals["usage"], {"calls": 6, "input": 510, "output": 44, "cacheRead": 40, "cacheWrite": 60})
        bob = totals["perVillager"][1]
        self.assertEqual((bob["name"], bob["turns"], bob["commands"], bob["failedCommands"]), ("bob", 2, 3, 2))
        self.assertEqual(bob["usage"]["input"], 280)

    def test_usage_matches_budget_table(self):
        conn = export_run.open_database(self.db)
        rows = dict(conn.execute("SELECT actor, SUM(input_tokens) FROM budget GROUP BY actor"))
        conn.close()
        exported = {row["name"]: row["usage"]["input"] for row in self.manifest["totals"]["perVillager"]}
        self.assertEqual(exported, rows)

    def test_tool_use_is_dropped_when_the_tool_logs_its_own_event(self):
        self.assertEqual(self.kinds(self.round_one, 0), ["spend", "say", "tool", "task", "spend", "chat"])
        self.assertEqual(self.kinds(self.round_one, 1),
                         ["spend", "task", "command", "command", "command", "write_file", "read_file", "spend",
                          "compact", "task", "task"])
        tool = self.round_one["turns"][0]["records"][2]
        self.assertEqual((tool["name"], tool["args"]), ("read_task", {}))

    def test_steps_are_contiguous_and_skip_spend(self):
        records = [record for round_file in (self.round_one, self.round_two)
                   for turn in round_file["turns"] for record in turn["records"]]
        steps = [record["step"] for record in records if "step" in record]
        self.assertEqual(steps, list(range(self.manifest["totals"]["steps"])))
        self.assertTrue(all("step" not in record for record in records if record["kind"] == "spend"))

    def test_commands_keep_full_output_and_failure_state(self):
        failed, timed_out, passed = [record for record in self.round_one["turns"][1]["records"]
                                     if record["kind"] == "command"]
        self.assertEqual((failed["exitCode"], failed["failed"], failed["stdout"], failed["stderr"]),
                         (1, True, "1 failed\n", "boom\n"))
        self.assertEqual((timed_out["timedOut"], timed_out["failed"]), (True, True))
        self.assertEqual((passed["failed"], passed["duration"]), (False, 0.5))

    def test_file_records(self):
        records = {record["kind"]: record for record in self.round_one["turns"][1]["records"]}
        self.assertEqual((records["write_file"]["status"], records["write_file"]["bytes"]), ("ok", 8))
        self.assertEqual((records["read_file"]["status"], records["read_file"]["detail"]),
                         ("rejected", "path is outside /repo"))

    def test_write_file_keeps_the_content_from_its_tool_call(self):
        write = next(record for record in self.round_one["turns"][1]["records"] if record["kind"] == "write_file")
        self.assertEqual(write["content"], "print(1)")

    def test_write_content_is_paired_by_path(self):
        source = export_run.load_source(self.db)
        position = next(index for index, event in enumerate(source.events) if event.type == "write_file")
        extra = export_run.Event(0, "bob", "tool_use", "write_file: {'path': 'other.py', 'content': 'x = 2'}",
                                 source.events[position].ts)
        source.events.insert(position - 1, extra)
        _, round_files, _ = export_run.build_export(source, "demo")
        records = round_files["rounds/001.json"]["turns"][1]["records"]
        write = next(record for record in records if record["kind"] == "write_file")
        self.assertEqual((write["path"], write["content"]), ("tool.py", "print(1)"))

    def test_turns_carry_running_totals(self):
        first, second, third, fourth = self.manifest["turns"]
        self.assertEqual(first["before"]["village"]["usage"]["input"], 0)
        self.assertEqual(second["before"]["village"]["usage"]["input"], 220)
        self.assertEqual(second["before"]["actor"]["usage"]["input"], 0)
        self.assertEqual(third["before"]["actor"]["usage"]["input"], 220)
        self.assertEqual((fourth["before"]["actor"]["commands"], fourth["before"]["actor"]["failedCommands"]), (3, 2))
        self.assertEqual(fourth["before"]["village"]["usage"]["calls"], 5)

    def test_task_events_carry_success_and_task_id(self):
        events = self.manifest["taskEvents"]
        self.assertEqual([(event["action"], event["taskId"], event["ok"]) for event in events],
                         [("post_task", 1, True), ("take_task", 1, True), ("submit_task", 1, True),
                          ("take_task", 1, False)])
        self.assertEqual((events[0]["description"], events[0]["maxWorkers"], events[0]["actor"]),
                         ("Write the tool", 1, "ann"))
        self.assertEqual((events[2]["result"], events[2]["version"]), ("done in tool.py", 1))

    def test_chat_is_linked_to_its_event_and_step(self):
        message = self.manifest["chat"][0]
        record = self.round_one["turns"][0]["records"][-1]
        self.assertEqual((message["id"], message["actor"], message["content"]), (1, "ann", "Task 1 is on the board."))
        self.assertEqual((message["eventId"], message["step"], record["chatId"]), (record["id"], record["step"], 1))

    def test_turn_summaries(self):
        first, second, idle, failed = self.manifest["turns"]
        self.assertEqual((second["round"], second["position"], second["actor"], second["logStep"]), (1, 2, "bob", 1))
        self.assertEqual((second["commands"], second["failedCommands"], second["stepCount"]), (3, 2, 9))
        self.assertEqual(second["firstStep"], first["firstStep"] + first["stepCount"])
        self.assertEqual(second["usage"]["calls"], 2)
        self.assertLess(second["firstEventId"], second["lastEventId"])
        self.assertEqual((idle["status"], idle["stepCount"]), ("ok", 1))
        self.assertEqual(self.kinds(self.round_two, 0), ["spend", "idle"])

    def test_failed_turn(self):
        failed = self.manifest["turns"][3]
        self.assertEqual((failed["status"], failed["errors"]), ("error", 1))
        self.assertEqual(self.kinds(self.round_two, 1), ["spend", "tool", "turn_error"])
        self.assertEqual(self.manifest["rounds"][1]["failedTurns"], 1)

    def test_session_limits_and_stop_reason(self):
        session = self.manifest["sessions"][0]
        self.assertEqual((session["mode"], session["firstTurn"], session["network"]), ("start", 0, False))
        self.assertEqual((session["attempted"], session["ok"], session["failed"]), (4, 3, 1))
        self.assertEqual((session["stopReason"], session["stopText"]),
                         ("rounds_done", "the requested rounds were done"))
        self.assertEqual(session["limits"]["inputBudget"], 1000)

    def test_highlights_are_resolved_and_never_overwritten(self):
        self.assertEqual(self.manifest["highlights"],
                         [{"round": 1, "turn": 2, "turnIndex": 1, "actor": "bob", "title": "bob works",
                           "note": "first commands"}])
        self.assertEqual((self.out / "demo" / "highlights.json").read_text(encoding="utf-8"), self.highlight_text)

    def test_runs_index_adds_and_updates_entries(self):
        run_exporter(self.db, "--id", "other", "--out", self.out, "--title", "Second run")
        run_exporter(self.db, "--id", "demo", "--out", self.out)
        runs = read(self.out / "index.json")["runs"]
        self.assertEqual(sorted((run["id"], run["title"]) for run in runs),
                         [("demo", "Build a tiny tool."), ("other", "Second run")])
        self.assertEqual((runs[0]["rounds"], runs[0]["turns"]), (2, 4))

    def test_session_without_stop_event_is_not_recorded(self):
        source = export_run.load_source(self.db)
        source.events = [event for event in source.events if event.type != "session_end"]
        manifest, _, _ = export_run.build_export(source, "demo")
        self.assertEqual((manifest["sessions"][0]["stopReason"], manifest["sessions"][0]["stopText"]),
                         (None, "not recorded"))


if __name__ == "__main__":
    unittest.main()
