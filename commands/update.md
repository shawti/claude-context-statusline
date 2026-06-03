---
description: 更新 context-statusline 插件并同步状态栏脚本
---

把插件更新到最新版并同步脚本副本，步骤：

1. 更新 marketplace 缓存与插件本体：

```bash
claude plugin marketplace update shawti-plugins
claude plugin update context-statusline@shawti-plugins
```

2. 同步脚本副本（缓存路径带版本号，取最新）：

```bash
LATEST=$(ls -d ~/.claude/plugins/cache/shawti-plugins/context-statusline/*/ | sort -V | tail -1)
cp "${LATEST}statusline.js" ~/.claude/context-statusline.js
```

3. 验证：用 mock stdin 跑一次，确认输出正常无报错：

```bash
echo '{"model":{"id":"claude-opus-4-8","display_name":"Opus"},"workspace":{"current_dir":"/tmp/demo"},"rate_limits":{"five_hour":{"used_percentage":20},"seven_day":{"used_percentage":50}}}' | node ~/.claude/context-statusline.js
```

4. 告知用户更新到的版本号；状态栏下次刷新自动生效，无需重启。
