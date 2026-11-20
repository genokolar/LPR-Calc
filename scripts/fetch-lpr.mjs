#!/usr/bin/env node
/**
 * 从已有数据的最新日期起，分段拉取至当前的 LPR 历史数据，
 * 与已有数据合并去重，生成：
 *   - public/lpr-history.json  完整历史数据（构建时嵌入，前端优先读取）
 *   - public/lpr-latest.json   仅最新一期（向后兼容）
 *
 * 关键点：起点是"已有数据的最新日期"而非固定最近一年，
 * 因此即使超过一年没有更新，也能补齐期间所有缺失月份。
 * 分段大小 366 天，避免触发服务端对单次跨度的限制。
 *
 * 用于 GitHub Actions 构建时嵌入，也可在本地手动执行：node scripts/fetch-lpr.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const API = 'https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/LprHis';
const SEGMENT_DAYS = 366; // 每段最大跨度（天）

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

// 解析代码内置数据（src/data/lprData.ts）
function parseBuiltin() {
  const src = readFileSync('src/data/lprData.ts', 'utf8');
  const re = /\{\s*date:\s*"(\d{4}-\d{2}-\d{2})",\s*oneYear:\s*([\d.]+),\s*fiveYear:\s*([\d.]+)\s*\}/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    out.push({ date: m[1], oneYear: parseFloat(m[2]), fiveYear: parseFloat(m[3]) });
  }
  return out;
}

// 读取已有数据：优先仓库中的 lpr-history.json（上次 Actions 提交的结果），否则用代码内置数据
function loadExisting() {
  if (existsSync('public/lpr-history.json')) {
    try {
      const j = JSON.parse(readFileSync('public/lpr-history.json', 'utf8'));
      if (Array.isArray(j.records) && j.records.length > 0) return j.records;
    } catch {
      // 解析失败则退回内置数据
    }
  }
  return parseBuiltin();
}

async function fetchSegment(start, end) {
  const url = `${API}?lang=CN&startDate=${fmt(start)}&endDate=${fmt(end)}&pageNum=1&pageSize=100`;
  console.log(`  GET ${fmt(start)} ~ ${fmt(end)}`);
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return (j.records || [])
    .map((r) => ({ date: r.showDateCN, oneYear: parseFloat(r['1Y']), fiveYear: parseFloat(r['5Y']) }))
    .filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && !isNaN(r.oneYear) && !isNaN(r.fiveYear));
}

// 从 sinceDate 起分段拉取至今天；某段无数据即停止（LPR 每月公布，中间不会真空）
async function fetchSince(sinceDate) {
  const remote = [];
  let segStart = parseDate(sinceDate);
  const today = new Date();

  while (segStart <= today) {
    let segEnd = addDays(segStart, SEGMENT_DAYS);
    if (segEnd > today) segEnd = today;

    const recs = await fetchSegment(segStart, segEnd);
    remote.push(...recs);

    if (recs.length === 0) break; // 区间内无数据，视为已追到最新

    const maxDate = recs.reduce((a, b) => (a.date >= b.date ? a : b)).date;
    const next = addDays(parseDate(maxDate), 1);
    if (next <= segStart) break; // 防御：日期未推进，避免死循环
    segStart = next;
  }
  return remote;
}

function writeOutputs(records) {
  const merged = [...new Map(records.map((r) => [r.date, r])).values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const meta = {
    source: 'chinamoney.com.cn',
    fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  };
  writeFileSync('public/lpr-history.json', JSON.stringify({ ...meta, records: merged }, null, 2));
  writeFileSync('public/lpr-latest.json', JSON.stringify({ ...merged[0], ...meta }, null, 2));
  return merged;
}

async function main() {
  const existing = loadExisting();
  const latest = existing.reduce((a, b) => (a.date >= b.date ? a : b)).date;
  console.log(`Existing latest: ${latest}, fetching since ${latest} ...`);

  const remote = await fetchSince(latest);
  const merged = writeOutputs([...existing, ...remote]);
  const newCount = merged.length - existing.length;
  console.log(`OK: existing=${existing.length} new=${newCount > 0 ? newCount : 0} merged=${merged.length} latest=${merged[0].date}`);
}

main().catch((err) => {
  console.error(`Fetch failed: ${err.message}`);
  if (existsSync('public/lpr-history.json')) {
    console.log('Keeping existing public/lpr-history.json');
    return;
  }
  // 首次构建且抓取失败：用内置数据兜底，保证前端有数据可读
  const merged = writeOutputs(parseBuiltin());
  console.log(`Fallback: wrote ${merged.length} built-in records`);
});
