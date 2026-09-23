#!/usr/bin/env node
// Claude Code statusLine: 显示当前上下文用量 + 距自动压缩余量 + 5h/每周订阅用量剩余。
// 输入: stdin JSON (model / workspace / transcript_path / context_window ...)
// 上下文 token / 窗口大小优先取 stdin 的 context_window（CLI >= 2.1.x 提供，1M 会话也准确），
// 缺失时回退：解析 transcript 最近一条主线 assistant 消息 usage + 按 model id 猜窗口。

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
// effort 仅在模型支持时由 CLI 下发（stdin effort.level），缺失时整项不显示。
const effortLevel = (data.effort && typeof data.effort.level === "string" && data.effort.level) || "";
const cwd = (data.workspace && data.workspace.current_dir) || data.cwd || "";
const dir = cwd ? cwd.split("/").filter(Boolean).pop() : "";

// 对照 Claude Code 2.1.280：阈值 = 压缩窗口 − min(最大输出, 20000)(摘要输出预留) − 13000。
// 压缩窗口默认等于模型窗口，可被 CLAUDE_CODE_AUTO_COMPACT_WINDOW / settings.autoCompactWindow(/autocompact) 调低。
const SUMMARY_OUTPUT_RESERVE = 20_000;
const COMPACT_BUFFER = 13_000;
const MIN_COMPACT_WINDOW = 100_000;
const MAX_COMPACT_WINDOW = 1_000_000;

// 对照 Claude Code 2.1.198 内置模型注册表：fable-5/mythos-5/opus-4-7/opus-4-8/sonnet-5 原生 1M；
// opus-4-6/sonnet-4-6/sonnet-4-5 基础 200k、带 [1m] 后缀才是 1M；haiku 与更早模型 200k。
const NATIVE_1M_MODELS = /claude-(fable-5|mythos-5|opus-4-7|opus-4-8|sonnet-5)/i;

const cw = data.context_window || {};
const windowTokens =
  typeof cw.context_window_size === "number" && cw.context_window_size > 0
    ? cw.context_window_size
    : /\[1m\]/i.test(modelId) || NATIVE_1M_MODELS.test(modelId)
      ? 1_000_000
      : 200_000;
const windowLabel = windowTokens >= 1_000_000 ? `${windowTokens / 1_000_000}M` : `${windowTokens / 1000}k`;

const ctx =
  typeof cw.total_input_tokens === "number" ? cw.total_input_tokens : latestContextTokens(data.transcript_path);
const pct = Math.round((ctx / windowTokens) * 100);

const color = pct >= 80 ? 31 : pct >= 50 ? 33 : 32; // red / yellow / green
const ctxStr = ansi(`${kfmt(ctx)}/${windowLabel} (${pct}%)`, color);

const remainColor = (p) => (p <= 10 ? 31 : p <= 25 ? 33 : 32); // 越少越红

const readJson = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

const positiveNumber = (v) => {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

// 与 CLI 同优先级合并 settings：user < project < local，后者覆盖前者。
const settingsFiles = (projectDir) => {
  const home = process.env.HOME || "";
  const files = [`${home}/.claude/settings.json`];
  if (projectDir) files.push(`${projectDir}/.claude/settings.json`, `${projectDir}/.claude/settings.local.json`);
  return files;
};

const mergedSetting = (key, projectDir) =>
  settingsFiles(projectDir).reduce((acc, f) => {
    const v = (readJson(f) || {})[key];
    return v === undefined || v === null ? acc : v;
  }, undefined);

const isAutoCompactDisabled = (projectDir) => {
  if (process.env.DISABLE_AUTO_COMPACT || process.env.DISABLE_COMPACT) return true;
  const fromSettings = mergedSetting("autoCompactEnabled", projectDir);
  if (fromSettings !== undefined) return fromSettings === false;
  return (readJson(`${process.env.HOME || ""}/.claude.json`) || {}).autoCompactEnabled === false;
};

const resolveCompactWindow = (modelWindow, projectDir) => {
  const configured =
    positiveNumber(process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW) ?? positiveNumber(mergedSetting("autoCompactWindow", projectDir));
  if (configured === undefined) return modelWindow;
  const clamped = Math.min(MAX_COMPACT_WINDOW, Math.max(MIN_COMPACT_WINDOW, configured));
  return Math.min(modelWindow, clamped);
};

const compactThreshold = (compactWindow) => {
  const maxOutput = positiveNumber(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS) ?? SUMMARY_OUTPUT_RESERVE;
  const effective = compactWindow - Math.min(maxOutput, SUMMARY_OUTPUT_RESERVE);
  const base = effective - COMPACT_BUFFER;
  const pct = positiveNumber(process.env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE);
  return pct !== undefined && pct <= 100 ? Math.min(Math.floor(effective * (pct / 100)), base) : base;
};

const projectDir = (data.workspace && data.workspace.project_dir) || cwd;
const leftStr = (() => {
  if (isAutoCompactDisabled(projectDir)) return label("off");
  const threshold = Math.max(1, compactThreshold(resolveCompactWindow(windowTokens, projectDir)));
  // 与 CLI 自带「% until auto-compact」同分母（阈值而非模型窗口）。
  const leftPct = Math.max(0, Math.round(((threshold - ctx) / threshold) * 100));
  return ansi(`${leftPct}%`, remainColor(leftPct));
})();

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
if (effortLevel) parts.push(`${label("effort")} ${ansi(effortLevel, 36)}`);
parts.push(`${label("ctx")} ${ctxStr}`);
parts.push(`${label(T.compact)} ${leftStr}`);
if (fiveHourLeft !== null) parts.push(rateSeg(T.fiveH, fiveHourLeft, rl.five_hour, "5h"));
if (weekLeft !== null) parts.push(rateSeg(T.week, weekLeft, rl.seven_day, "week"));
process.stdout.write(parts.join(sep(" · ")));
