#!/usr/bin/env node
// Claude Code statusLine: 显示当前上下文用量 + 距自动压缩余量 + 5h/每周订阅用量剩余。
// 输入: stdin JSON (model / workspace / transcript_path / exceeds_200k_tokens ...)
// 上下文 token = 最近一条主线 assistant 消息的 input + cache_read + cache_creation。

const fs = require("fs");

const TAIL_BYTES = 1024 * 1024;

const ansi = (s, code) => `\x1b[${code}m${s}\x1b[0m`;
const label = (s) => ansi(s, "38;5;249"); // 可见中性灰(标签:项目名/模型/距压缩)
const sep = (s) => ansi(s, "38;5;243"); // 分隔符稍暗

const kfmt = (n) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (n >= 1000) return Math.round(n / 1000) + "k";
  return String(n);
};

const readStdin = () => {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
};

const readTail = (path) => {
  const { size } = fs.statSync(path);
  const len = Math.min(size, TAIL_BYTES);
  const buf = Buffer.alloc(len);
  const fd = fs.openSync(path, "r");
  try {
    fs.readSync(fd, buf, 0, len, size - len);
  } finally {
    fs.closeSync(fd);
  }
  return buf.toString("utf8");
};

const latestContextTokens = (transcriptPath) => {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return 0;
  const lines = readTail(transcriptPath).split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type !== "assistant" || row.isSidechain === true) continue;
    const u = row.message && row.message.usage;
    if (!u) continue;
    return (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  return 0;
};

const data = readStdin();
const modelId = (data.model && data.model.id) || "";
const modelName = (data.model && data.model.display_name) || modelId || "Claude";
const cwd = (data.workspace && data.workspace.current_dir) || data.cwd || "";
const dir = cwd ? cwd.split("/").filter(Boolean).pop() : "";

// Claude Code 触发自动压缩的阈值 = 有效窗口 - 13000 (见 CLI 内 rN_: H-13000)。
const COMPACT_RESERVE = 13_000;

const windowTokens = /\[?1m\]?/i.test(modelId) ? 1_000_000 : 200_000;
const windowLabel = windowTokens >= 1_000_000 ? `${windowTokens / 1_000_000}M` : `${windowTokens / 1000}k`;

const ctx = latestContextTokens(data.transcript_path);
const pct = Math.round((ctx / windowTokens) * 100);

const color = pct >= 80 ? 31 : pct >= 50 ? 33 : 32; // red / yellow / green
const ctxStr = ansi(`${kfmt(ctx)}/${windowLabel} (${pct}%)`, color);

const remainColor = (p) => (p <= 10 ? 31 : p <= 25 ? 33 : 32); // 越少越红

const threshold = Math.max(0, windowTokens - COMPACT_RESERVE);
const leftPct = Math.max(0, Math.round(((threshold - ctx) / windowTokens) * 100));
const leftStr = ansi(`${leftPct}%`, remainColor(leftPct));

// rate_limits 仅订阅账号且首个 API 响应后才有，缺失时整项不显示。
const rateRemainPct = (w) =>
  w && typeof w.used_percentage === "number" ? Math.max(0, Math.round(100 - w.used_percentage)) : null;
const rl = data.rate_limits || {};
const fiveHourLeft = rateRemainPct(rl.five_hour);
const weekLeft = rateRemainPct(rl.seven_day);

// 标签语言按 POSIX 优先级 LC_ALL > LC_MESSAGES > LANG 自适应，zh* 中文、其余英文。
const localeStr =
  process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || "";
const isZh = /^zh/i.test(localeStr);
const T = isZh
  ? { compact: "距压缩", fiveH: "5h余", week: "周余", nextDay: "明", weekPre: "周", wd: ["日", "一", "二", "三", "四", "五", "六"], wdSep: "" }
  : { compact: "compact", fiveH: "5h", week: "wk", nextDay: "+1d ", weekPre: "", wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], wdSep: " " };

const pad2 = (n) => String(n).padStart(2, "0");
const resetAt = (epochSec, style) => {
  if (typeof epochSec !== "number") return "";
  const d = new Date(epochSec * 1000);
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (style === "week") return `${T.weekPre}${T.wd[d.getDay()]}${T.wdSep}${hm}`;
  return d.getDate() === new Date().getDate() ? hm : `${T.nextDay}${hm}`;
};
const rateSeg = (name, leftPctVal, win, style) => {
  const reset = resetAt(win.resets_at, style);
  return `${label(name)} ${ansi(`${leftPctVal}%`, remainColor(leftPctVal))}${reset ? label(`(${reset})`) : ""}`;
};

const parts = [];
if (dir) parts.push(label(dir));
parts.push(label(modelName));
parts.push(`${label("ctx")} ${ctxStr}`);
parts.push(`${label(T.compact)} ${leftStr}`);
if (fiveHourLeft !== null) parts.push(rateSeg(T.fiveH, fiveHourLeft, rl.five_hour, "5h"));
if (weekLeft !== null) parts.push(rateSeg(T.week, weekLeft, rl.seven_day, "week"));
process.stdout.write(parts.join(sep(" · ")));
