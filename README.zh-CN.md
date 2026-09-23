# context-statusline

[English](./README.md)

Claude Code 状态栏插件：一行看清 **上下文用量** 和 **订阅用量剩余**。

```
storyline-agent · Opus 4.8 · effort high · ctx 327k/1M (33%) · 距压缩 66% · 5h余 77%(19:30) · 周余 41%(周五21:30)
```

| 段 | 含义 |
|---|---|
| `storyline-agent` | 当前项目目录名 |
| `Opus 4.8` | 当前模型 |
| `effort high` | 当前推理 effort 档位（仅支持 effort 的模型显示） |
| `ctx 327k/1M (33%)` | 当前上下文 token / 窗口大小（自动识别 1M / 200k 窗口） |
| `距压缩 66%` | 距触发自动 compact 还剩的比例（以压缩阈值为分母；自动压缩关闭时显示 `off`） |
| `5h余 77%(19:30)` | 5 小时滚动窗口订阅用量剩余，括号内为重置时间（跨天显示 `明02:30`） |
| `周余 41%(周五21:30)` | 每周订阅用量剩余，括号内为重置时间 |

百分比颜色：剩余 >25% 绿、≤25% 黄、≤10% 红。

标签语言随系统语言自适应（`LC_ALL`/`LC_MESSAGES`/`LANG` 为 `zh*` 显示中文，其余显示英文）：

```
demo · Opus 4.8 · effort high · ctx 327k/1M (33%) · compact 66% · 5h 77%(19:30) · wk 41%(Fri 21:30)
```

## 安装

```
/plugin marketplace add shawti/claude-context-statusline
/plugin install context-statusline@shawti-plugins
/context-statusline:install
```

第三步把脚本复制到 `~/.claude/context-statusline.js` 并写入 `~/.claude/settings.json`，下次刷新生效。

## 更新

```
/context-statusline:update
```

一条命令完成：更新插件到最新版、同步脚本副本。

## 卸载

```
/context-statusline:uninstall
```

一条命令完成：删 `statusLine` 配置、删脚本副本、卸载插件本体。

## 要求

- `node` 在 PATH 中
- Claude Code ≥ 2.1.150（statusline 输入才带 `rate_limits` 字段）
- `5h余` / `周余` 仅 Claude Pro/Max 订阅账号显示；API key 计费账号无此两段，其余功能不受影响

## 实现说明

- 上下文 token = transcript 中最近一条主线 assistant 消息的 `input + cache_read + cache_creation`，只读 transcript 尾部 1MB，不发任何网络请求
- `距压缩` 与 Claude Code 自动 compact 阈值同口径：压缩窗口 − min(最大输出, 20k) − 13k；压缩窗口默认等于模型窗口，遵从 `CLAUDE_CODE_AUTO_COMPACT_WINDOW` / `autoCompactWindow`（`/autocompact`），并支持 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`
- CLI 处于被动压缩模式（只在 API 返回上下文超长时才压缩）时，可能显示 0% 仍未压缩；该状态不在 statusline stdin 中，插件无法感知
- `5h余` / `周余` 直接取 statusline stdin 的 `rate_limits.five_hour / seven_day`，无外部 API 调用

## License

MIT
