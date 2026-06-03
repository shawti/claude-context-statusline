# context-statusline

[简体中文](./README.zh-CN.md)

Claude Code statusline plugin: **context usage** and **subscription quota remaining** at a glance.

```
demo · Opus 4.8 · ctx 327k/1M (33%) · compact 66% · 5h 77%(19:30) · wk 41%(Fri 21:30)
```

| Segment | Meaning |
|---|---|
| `demo` | current project directory name |
| `Opus 4.8` | current model |
| `ctx 327k/1M (33%)` | context tokens / window size (auto-detects 1M vs 200k windows) |
| `compact 66%` | window share left before auto-compact triggers |
| `5h 77%(19:30)` | 5-hour rolling window quota remaining; reset time in parens (`+1d 02:30` when past midnight) |
| `wk 41%(Fri 21:30)` | weekly quota remaining; reset weekday + time in parens |

Colors: remaining >25% green, ≤25% yellow, ≤10% red.

Labels adapt to the system language (`LC_ALL`/`LC_MESSAGES`/`LANG` starting with `zh` → Chinese, anything else → English):

```
storyline-agent · Opus 4.8 · ctx 327k/1M (33%) · 距压缩 66% · 5h余 77%(19:30) · 周余 41%(周五21:30)
```

## Install

```
/plugin marketplace add shawti/claude-context-statusline
/plugin install context-statusline@shawti-plugins
/context-statusline:install
```

The third step copies the script to `~/.claude/context-statusline.js` and writes the `statusLine` config into `~/.claude/settings.json`; takes effect on the next refresh.

## Update

```
/context-statusline:update
```

One command: updates the plugin to the latest version and syncs the script copy.

## Uninstall

```
/context-statusline:uninstall
```

One command: removes the `statusLine` config, deletes the script copy, and uninstalls the plugin.

## Requirements

- `node` on PATH
- Claude Code ≥ 2.1.150 (statusline input carries `rate_limits` since then)
- `5h` / `wk` segments only appear for Claude Pro/Max subscription accounts; API-key billing accounts simply won't see them — everything else still works

## Implementation notes

- Context tokens = `input + cache_read + cache_creation` of the latest main-chain assistant message in the transcript; reads only the last 1MB of the file, no network requests
- `compact` is computed against Claude Code's auto-compact threshold (window − 13k reserve)
- `5h` / `wk` come straight from `rate_limits.five_hour / seven_day` in the statusline stdin — no external API calls

## License

MIT
