---
description: 把 context-statusline 状态栏写入 ~/.claude/settings.json
---

把本插件的状态栏脚本安装到用户全局 settings，步骤：

1. 定位插件内脚本：`${CLAUDE_PLUGIN_ROOT}/statusline.js`。
   若上一行显示的是字面量 `${CLAUDE_PLUGIN_ROOT}`（变量未被渲染），改用
   `find ~/.claude/plugins -path "*context-statusline*" -name statusline.js` 定位（取最新版本目录）。
2. 复制到稳定路径（插件缓存路径带版本号，升级后会变，不能直接指过去）：

```bash
cp "<第 1 步的路径>" ~/.claude/context-statusline.js
```

3. 读取 `~/.claude/settings.json`（不存在则按 `{}` 创建），**只改 `statusLine` 字段**，其余配置原样保留：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"$HOME/.claude/context-statusline.js\"",
    "refreshInterval": 5
  }
}
```

4. 验证：用 mock stdin 跑一次，确认输出包含 `ctx`、`距压缩`、`5h余`、`周余` 四段且无报错：

```bash
echo '{"model":{"id":"claude-opus-4-8","display_name":"Opus"},"workspace":{"current_dir":"/tmp/demo"},"rate_limits":{"five_hour":{"used_percentage":20},"seven_day":{"used_percentage":50}}}' | node ~/.claude/context-statusline.js
```

5. 告知用户：状态栏在下次刷新自动生效，无需重启；`5h余` / `周余` 仅 Pro/Max 订阅账号且本会话发出首个请求后才显示；插件升级后重跑本命令同步脚本。
