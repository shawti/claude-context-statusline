---
description: 移除 context-statusline 状态栏配置并卸载插件
---

干净卸载本插件的状态栏，步骤：

1. 读取 `~/.claude/settings.json`，**只删除 `statusLine` 字段**，其余配置原样保留。
2. 删除脚本副本：

```bash
rm -f ~/.claude/context-statusline.js
```

3. 卸载插件本体：

```bash
claude plugin uninstall context-statusline@shawti-plugins
```

4. 告知用户：状态栏在下次刷新后消失；以后想配其他状态栏可用 `/statusline`。
