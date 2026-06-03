# context-statusline

Claude Code 状态栏插件：一行看清 **上下文用量** 和 **订阅用量剩余**。

```
storyline-agent · Opus 4.8 · ctx 327k/1M (33%) · 距压缩 66% · 5h余 77%(19:30) · 周余 41%(周五21:30)
```

| 段 | 含义 |
|---|---|
| `storyline-agent` | 当前项目目录名 |
| `Opus 4.8` | 当前模型 |
| `ctx 327k/1M (33%)` | 当前上下文 token / 窗口大小（自动识别 1M / 200k 窗口） |
| `距压缩 66%` | 距触发自动 compact 还剩的窗口比例 |
| `5h余 77%(19:30)` | 5 小时滚动窗口订阅用量剩余，括号内为重置时间（跨天显示 `明02:30`） |
| `周余 41%(周五21:30)` | 每周订阅用量剩余，括号内为重置时间 |

百分比颜色：剩余 >25% 绿、≤25% 黄、≤10% 红。

## 安装

```
/plugin marketplace add shawti/claude-context-statusline
/plugin install context-statusline@shawti-plugins
/context-statusline:install
```

第三步把脚本复制到 `~/.claude/context-statusline.js` 并写入 `~/.claude/settings.json`，下次刷新生效。插件升级后重跑 `/context-statusline:install` 同步脚本。

## 要求

- `node` 在 PATH 中
- Claude Code ≥ 2.1.150（statusline 输入才带 `rate_limits` 字段）
- `5h余` / `周余` 仅 Claude Pro/Max 订阅账号显示；API key 计费账号无此两段，其余功能不受影响

## 卸载

```
/context-statusline:uninstall
```

一条命令完成：删 `statusLine` 配置、删脚本副本、卸载插件本体。

## 实现说明

- 上下文 token = transcript 中最近一条主线 assistant 消息的 `input + cache_read + cache_creation`，只读 transcript 尾部 1MB，不发任何网络请求
- `距压缩` 按 Claude Code 自动 compact 阈值（窗口 − 13k 预留）计算
- `5h余` / `周余` 直接取 statusline stdin 的 `rate_limits.five_hour / seven_day.used_percentage`，无外部 API 调用

## License

MIT
