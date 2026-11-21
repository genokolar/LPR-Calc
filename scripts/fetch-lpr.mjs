#!/usr/bin/env node
/**
 * 构建时从东方财富抓取 LPR 历史数据，与已有数据合并去重，生成：
 *   - public/lpr-history.json  完整历史数据（构建时嵌入，前端优先读取）
 *   - public/lpr-latest.json   仅最新一期（向后兼容）
 *
 * 关键点：起点是"已有数据的最新日期"而非固定最近一年，
 * 因此即使超过一年没有更新，也能补齐期间所有缺失期次。
 *
 * 数据源说明：
 *   - 东方财富 datacenter-web API（主源）。境内服务，不封境外/CI 出口 IP。
 *   - 该接口本身就是"每月一期"口径（一次公布一条，利率未变的月份也有记录），
 *     与 chinamoney 期次一一对应。
 *   - 不选用 chinamoney：其实验室级 WAF 按出口 IP 封禁全部境外数据中心
 *     （GitHub Actions / Cloudflare Worker / 公共代理网段均已实测被 403），
 *     自建转发代理无解，故移除相关链路，不再保留。
 *
 * 全部请求失败时：保留已有 public/lpr-history.json 并以退出码 1 结束，
 * 供 CI 外层重试；首次构建无历史文件时，用代码内置数据兜底保证前端可读。
 *
 * 本地手动执行：node scripts/fetch-lpr.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const EM_API = 'https://datacenter-web.eastmoney.com/api/data/v1/get';

// 重试轮次之间的等待（毫秒），第一轮不等待；eastmoney 本身重试两轮
const ROUND_DELAYS = [0, 15000];
const REQ_TIMEOUT = 20000;
const MAX_PAGES = 30; // 30×100 个交易日 ≈ 12 年，覆盖全量历史

// LPR 新机制首期，防止全量重建时混入 2019-08 之前的旧机制报价数据
const LPR_EPOCH = '2019-08-20';

const pad = (n) => String(n).padStart(2, '0');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// 抓单页；失败抛错供重试逻辑捕获
async function fetchPage(page) {
  const u = `${EM_API}?reportName=RPTA_WEB_RATE&columns=ALL&pageNumber=${page}&pageSize=100`
    + `&sortColumns=SHOWDATE&sortDirection=-1&source=WEB&client=WEB`;
  const res = await fetch(u, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const rows = j && j.result && j.result.data;
  if (!Array.isArray(rows)) throw new Error('响应格式无效');
  return rows;
}

function parseRow(r) {
  const date = String(r.TRADE_DATE || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || r.LPR1Y == null || r.LPR5Y == null) return null;
  return { date, oneYear: Number(r.LPR1Y), fiveYear: Number(r.LPR5Y) };
}

/**
 * 从东方财富抓取 sinceDate（含）之后的全部 LPR 期次。
 * 按 SHOWDATE 倒序分页，翻到包含早于起点的记录即停。
 * 返回按日期降序；某一轮全部失败则等待后重试，最终失败抛错。
 */
async function fetchSince(sinceDate) {
  const out = [];
  let lastErr = null;

  for (let round = 0; round < ROUND_DELAYS.length; round++) {
    if (ROUND_DELAYS[round] > 0) {
      console.log(`  请求失败，${ROUND_DELAYS[round] / 1000}s 后重试（第 ${round + 1}/${ROUND_DELAYS.length} 轮）…`);
      await sleep(ROUND_DELAYS[round]);
    }
    try {
      out.length = 0;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const rows = await fetchPage(page);

        let oldest = null;
        for (const r of rows) {
          const rec = parseRow(r);
          if (!rec) continue;
          if (oldest === null || rec.date < oldest) oldest = rec.date;
          if (rec.date >= sinceDate) out.push(rec);
        }

        if (oldest !== null && oldest < sinceDate) break; // 本页已含起点之前的记录，停止翻页
        if (rows.length < 100) break; // 已到最后一页
      }
      if (round > 0) console.log('  [重试成功]');
      return out;
    } catch (err) {
      lastErr = err;
      const msg = err && err.name === 'TimeoutError' ? '请求超时' : (err instanceof Error ? err.message : String(err));
      console.log(`  [失败] 第 ${round + 1} 轮: ${msg}`);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function writeOutputs(records) {
  const merged = [...new Map(records.map((r) => [r.date, r])).values()]
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const meta = {
    source: 'eastmoney.com',
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

  const remote = (await fetchSince(latest)).filter((r) => r.date >= LPR_EPOCH);
  console.log(`  [OK] eastmoney: ${remote.length} 期（含最新 ${remote[0]?.date || '无'}）`);

  // 远端无新期次也是正常结果（起点已是最新），直接用已有数据写回
  const merged = writeOutputs([...existing, ...remote]);
  const newCount = merged.length - existing.length;
  console.log(`OK: existing=${existing.length} new=${newCount > 0 ? newCount : 0} merged=${merged.length} latest=${merged[0].date}`);
}

main().catch((err) => {
  console.error(`Fetch failed: ${err instanceof Error ? err.message : err}`);
  if (existsSync('public/lpr-history.json')) {
    console.log('Keeping existing public/lpr-history.json');
    process.exitCode = 1; // 通知 CI 抓取失败，触发外层重试；同时保留旧数据继续构建
    return;
  }
  // 首次构建且抓取失败：用内置数据兜底，保证前端有数据可读
  const merged = writeOutputs(parseBuiltin());
  console.log(`Fallback: wrote ${merged.length} built-in records`);
  process.exitCode = 1;
});
