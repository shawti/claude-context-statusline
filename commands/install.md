---
description: 把 context-statusline 状态栏写入 ~/.claude/settings.json
---

把本插件的状态栏脚本配置到用户全局 settings，步骤：

1. 确定脚本绝对路径：`${CLAUDE_PLUGIN_ROOT}/statusline.js`。
   若上一行显示的是字面量 `${CLAUDE_PLUGIN_ROOT}`（变量未被渲染），改用
   `find ~/.claude/plugins -path "*context-statusline*" -name statusline.js` 定位。
2. 读取 `~/.claude/settings.json`（不存在则按 `{}` 创建），**只改 `statusLine` 字段**，其余配置原样保留：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"<第 1 步得到的绝对路径>\"",
    "refreshInterval": 5
  }
}
```

3. 验证：用 mock stdin 跑一次脚本，确认输出包含 `ctx`、`距压缩`、`5h余`、`周余` 四段且无报错：

```bash
echo '{"model":{"id":"claude-opus-4-8","display_name":"Opus"},"workspace":{"current_dir":"/tmp/demo"},"rate_limits":{"five_hour":{"used_percentage":20},"seven_day":{"used_percentage":50}}}' | node "<脚本绝对路径>"
```

4. 告知用户：状态栏在下次刷新自动生效，无需重启；`5h余` / `周余` 仅 Pro/Max 订阅账号且本会话发出首个请求后才显示。
