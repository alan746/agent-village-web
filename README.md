# agent-village-web

A static web viewer that replays recorded runs of agent-village, a small village of LLM agents that take turns working on one goal with their own shell, a shared repository, a group chat, a task board and a shared token budget.

The viewer shows the village at one moment of the run, the playhead, and lets you play the run back or jump around in it:

- a panel per villager with its name, role, model, status (acting now, finished this round, waiting), tokens used so far and the feed of its current or most recent turn: what it said, the commands it ran with their output, files it read and wrote, task board actions and chat posts;
- a sidebar with the group chat, the task board rebuilt for the playhead, and run details: villagers, limits, sessions, totals and highlights;
- a transport bar with play and pause, step and turn navigation, speed, the current position and a timeline of every turn, coloured by villager and marked where commands or turns failed and where highlights are.

A villager's own prose (what it said, its chat posts, task descriptions and submitted results) is rendered as a small, conservative subset of Markdown: paragraphs and line breaks, bold, italic with `*`, inline code, fenced code blocks, bullet and numbered lists with one level of nesting, headings and `http`/`https` links; underscores, raw HTML, tables and blockquotes stay literal, an unclosed `**` or backtick is shown as written, and an unclosed code fence runs to the end of the message. Commands, their output, written file contents, tool arguments, the run goal and highlights are always shown literally.

Keyboard: Space plays or pauses, Left and Right move one step, Shift+Left and Shift+Right move one turn, Escape restores an expanded panel.

## Running it

Requires Node.js (tested with Node 24) and, for exporting runs, Python 3.10 or later with no extra packages.

```bash
npm install
npm run dev        # development server
npm test           # unit tests for the state logic (Vitest)
npm run build      # type check and production build into dist/
python -m unittest # exporter tests, run from the project root
```

## Exporting a run

The viewer reads JSON files under `public/runs/`, written by `tools/export_run.py` from a run's `village.db`:

```bash
python tools/export_run.py path/to/runs/20261124_033232/village.db --id 20261124_033232
python tools/export_run.py other/village.db --id my-run --title "Short title for the run list"
```

The database is opened read-only and immutable, so no `-wal` or `-shm` files appear next to it. `--out` changes the output directory (default `public/runs` in this project). Exporting a run again replaces its files and updates its entry in `public/runs/index.json`; other runs are left alone. When `index.json` lists more than one run, the top bar shows a run picker.

### Highlights

A run can have a hand-written `public/runs/<id>/highlights.json`: an array of `{"round", "turn", "title", "note"}`, where `turn` is the 1-based position of the turn in its round. The exporter never writes this file. It reads it, checks that each round and turn exists, and copies the entries into the run manifest, so export the run again after editing it. Highlights are listed in the Run tab and marked on the timeline.

## Links

The address always holds the run and the position, for example `#run=20261124_033232&round=34&turn=3&step=5`. `step` is the step within the turn. Without it, a link opens at the end of the turn so the whole turn is visible. Without `round`, the run opens at its first step. A link always opens paused.

## Data format

All files carry `"format": 1`. The viewer refuses other formats and asks for a new export.

`public/runs/index.json` lists the runs: `id`, `title`, `startTs`, `endTs`, `rounds`, `turns`. Timestamps are Unix seconds.

`public/runs/<id>/index.json` is the run manifest, loaded first:

| Key | Contents |
|---|---|
| `id`, `title`, `goal`, `startTs`, `endTs` | The run |
| `marked` | Whether the log has turn markers; older runs without them have rounds inferred from the order of turns |
| `villagers` | `name`, `role`, `model`, in turn order |
| `sessions` | One per call to `village.py`: mode, starting round, first turn, network, `limits` (rounds, max tool rounds, input and output budget, compact trigger, command timeout), turns attempted, ok and failed, stop reason |
| `totals` | Rounds, turns, steps, commands, failed commands, chat messages, token usage, and the same per villager |
| `rounds` | Per round: file name, turn indexes, times, steps, commands, failed commands, failed turns, token usage |
| `turns` | Per turn: round, position in the round, actor, status, times, first and last event id, first step and step count, token usage, commands, failed commands, turn errors, and `before`: the village's and the actor's running totals before the turn |
| `chat` | Every chat message with its event id, step and turn |
| `taskEvents` | Every task board action with its step, actor, task id, whether it succeeded and the outcome text, plus the description, worker limit, result or version where they apply |
| `highlights` | The resolved highlights |

`public/runs/<id>/rounds/NNN.json` holds the detailed records of one round, loaded when the playhead needs them. Each turn has a list of records in log order. Every visible record has a global `step` number. `spend` records hold the token use of one model call and are counted but not shown as steps.

| Kind | Fields |
|---|---|
| `say` | `text` the villager wrote |
| `command` | `command`, `exitCode`, `timedOut`, `duration`, full `stdout` and `stderr`, `failed` |
| `read_file`, `write_file` | `path`, `status` (`ok`, `failed`, `rejected`), `detail`; writes also have `bytes` and the written `content` |
| `chat` | `text`, `chatId` |
| `task` | `action`, `taskId`, `ok`, `outcome`, and `description`, `maxWorkers`, `result` or `version` |
| `tool` | `name` and parsed `args` for tools that log nothing else, such as `read_task` or `check_balance` |
| `compact`, `turn_error`, `note` | Memory compaction, a failed turn, and other notes such as `prefix_changed` |
| `idle` | Added when a turn has nothing visible, so every turn has at least one step |
| `spend` | `phase`, `input`, `output`, `cacheRead`, `cacheWrite` |

The records follow agent-village's `transcript.py`. A tool that logs its own event, such as `run_command`, is shown by that event, and its `tool_use` line is dropped. The one exception is `write_file`, whose `tool_use` line is the only place the written content is recorded, so the exporter moves that content onto the `write_file` record. Text is never cut in the export; the viewer clips long output and lets you expand it.

## Deploying

`npm run build` writes a self-contained static site to `dist/`, including the exported runs from `public/runs/`. All paths are relative, so `dist/` works from any sub-path of any static host. The site makes no requests outside its own files.

`.github/workflows/deploy.yml` runs the tests, builds the site and publishes `dist/` to GitHub Pages on every push to `main`.

## Limits

- It replays recorded runs only. There is no live mode yet; a run in progress has to be exported again to see new turns.
- Playback moves one step at a time with a reading pause scaled by the speed. It does not follow the real time between events.
- A villager's thinking is shown only as far as the log records it: the text it wrote and the tools it called. Tool results that the log does not keep, such as what `read_file` returned or what `read_task` showed, cannot be shown.
