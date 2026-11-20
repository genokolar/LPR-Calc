// LPR数据获取工具
// 通过自建 Cloudflare Worker 或公共CORS代理访问中国货币网 LprHis 接口
// LprHis 接口一次返回最近一年全部期次，可自动补齐缺失月份
// 注意：公共CORS代理服务不稳定，主要依赖GitHub Actions构建时嵌入的数据

import type { LPRData } from '@/data/lprData';

// 中国货币网LPR历史数据API（返回最近一年全部期次）
const LPR_HISTORY_API = 'https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/LprHis';

// 自建Worker地址存储键
const WORKER_URL_KEY = 'lpr_worker_url';

// 公共CORS代理列表（按优先级排列）
// 这些公共代理随时可能失效或限流，仅作为自建Worker不可用时的备份
const CORS_PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
  'https://cors.eu.org/',
];

// LprHis接口响应格式
interface LprHisResponse {
  head?: { rep_code?: string };
  records?: Array<{
    showDateCN: string;
    '1Y': string;
    '5Y': string;
  }>;
}

/** 获取用户自建Worker地址 */
export function getWorkerUrl(): string {
  try {
    return (localStorage.getItem(WORKER_URL_KEY) || '').trim();
  } catch {
    return '';
  }
}

/** 保存用户自建Worker地址（空字符串表示清除） */
export function setWorkerUrl(url: string) {
  try {
    const trimmed = url.trim();
    if (trimmed) {
      localStorage.setItem(WORKER_URL_KEY, trimmed);
    } else {
      localStorage.removeItem(WORKER_URL_KEY);
    }
  } catch {
    // 忽略存储错误
  }
}

/** 测试Worker地址是否可用 */
export async function testWorkerUrl(url: string): Promise<boolean> {
  try {
    const probe = `${LPR_HISTORY_API}?lang=CN&startDate=2020-01-01&endDate=2020-01-31&pageNum=1&pageSize=5`;
    const response = await fetchWithProxy(probe, url);
    const data = await response.json();
    return !!(data && Array.isArray(data.records));
  } catch {
    return false;
  }
}

// 每段最大跨度（天），避免触发服务端对单次请求跨度的限制
const SEGMENT_DAYS = 366;

const pad2 = (n: number) => String(n).padStart(2, '0');
const fmtD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseD = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

// 构建单段 LprHis 请求 URL
function buildSegmentUrl(start: Date, end: Date): string {
  return `${LPR_HISTORY_API}?lang=CN&startDate=${fmtD(start)}&endDate=${fmtD(end)}&pageNum=1&pageSize=100`;
}

// 使用代理获取数据
async function fetchWithProxy(url: string, proxyUrl: string): Promise<Response> {
  // 两种代理格式：
  // 1. 自建Worker或 ?quest=/?url= 格式：proxyUrl + encodeURIComponent(url)
  // 2. cors.eu.org/ 格式：直接拼接URL
  let fullUrl: string;
  if (proxyUrl.endsWith('/')) {
    fullUrl = proxyUrl + url;
  } else {
    fullUrl = proxyUrl + encodeURIComponent(url);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw err;
  }
}

// 依次尝试自建Worker和公共代理获取单个URL的JSON
async function fetchJsonWithFallback(url: string): Promise<LprHisResponse> {
  const errors: string[] = [];

  // 1. 优先使用用户自建Worker
  const worker = getWorkerUrl();
  if (worker) {
    try {
      const response = await fetchWithProxy(url, worker);
      const data = await response.json();
      if (data && Array.isArray(data.records)) {
        return data;
      }
      throw new Error('Worker returned invalid data');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`Worker(${worker}): ${msg}`);
    }
  }

  // 2. 公共代理兜底
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetchWithProxy(url, proxy);
      const data = await response.json();
      if (data && Array.isArray(data.records)) {
        return data;
      }
      throw new Error('Invalid data format');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${proxy}: ${msg}`);
    }
  }

  throw new Error(errors.join('; '));
}

// 从 sinceDate（含）起分段拉取至今天；某段无数据即停止。
// 起点是已有数据的最新日期，因此断更任意久都能补齐，不会缺中间月份。
async function fetchAllSegments(sinceDate?: string): Promise<NonNullable<LprHisResponse['records']>> {
  const today = new Date();
  let segStart = sinceDate ? parseD(sinceDate) : addD(today, -365);
  const all: NonNullable<LprHisResponse['records']> = [];

  while (segStart <= today) {
    let segEnd = addD(segStart, SEGMENT_DAYS);
    if (segEnd > today) segEnd = today;

    const data = await fetchJsonWithFallback(buildSegmentUrl(segStart, segEnd));
    const recs = data.records || [];
    all.push(...recs);

    if (recs.length === 0) break; // 区间内无数据，视为已追到最新

    const maxDate = recs.reduce((a, b) => (a.showDateCN >= b.showDateCN ? a : b)).showDateCN;
    const next = addD(parseD(maxDate), 1);
    if (next <= segStart) break; // 防御：日期未推进，避免死循环
    segStart = next;
  }

  return all;
}

// 解析LprHis记录数组为LPRData数组（降序，最新在前）
function parseHistoryRecords(records: NonNullable<LprHisResponse['records']>): LPRData[] {
  const out: LPRData[] = [];
  for (const r of records) {
    const oneYear = parseFloat(r['1Y']);
    const fiveYear = parseFloat(r['5Y']);
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.showDateCN) && !isNaN(oneYear) && !isNaN(fiveYear)) {
      out.push({ date: r.showDateCN, oneYear, fiveYear });
    }
  }
  out.sort((a, b) => (a.date < b.date ? 1 : -1));
  return out;
}

// 合并远程数据到本地数据（按日期去重，远程优先）
function mergeRemoteData(currentData: LPRData[], remote: LPRData[]): {
  data: LPRData[];
  newEntries: LPRData[];
} {
  const map = new Map<string, LPRData>();
  for (const d of currentData) map.set(d.date, d);
  const newEntries: LPRData[] = [];
  let changed = false;

  for (const r of remote) {
    const existing = map.get(r.date);
    if (!existing) {
      map.set(r.date, r);
      newEntries.push(r);
      changed = true;
    } else if (existing.oneYear !== r.oneYear || existing.fiveYear !== r.fiveYear) {
      map.set(r.date, r);
      newEntries.push(r);
      changed = true;
    }
  }

  const merged = [...map.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  return { data: changed ? merged : currentData, newEntries };
}

/**
 * 获取LPR历史数据
 * @param sinceDate 起点日期（含），通常传已有数据的最新日期；
 *                  缺省则拉取最近一年
 * @returns LPRData数组（降序），获取失败返回null
 */
export async function fetchLPRHistory(sinceDate?: string): Promise<LPRData[] | null> {
  try {
    const records = await fetchAllSegments(sinceDate);
    const parsed = parseHistoryRecords(records);
    return parsed.length > 0 ? parsed : null;
  } catch (err) {
    console.error('Failed to fetch LPR history:', err);
    return null;
  }
}

/**
 * 获取最新一期LPR数据
 * @returns 最新LPR数据，获取失败返回null
 */
export async function fetchLatestLPR(): Promise<LPRData | null> {
  const history = await fetchLPRHistory();
  return history ? history[0] : null;
}

/**
 * 检查并更新LPR数据
 * 从当前数据最新日期起拉至今天，断更任意久都能补齐中间所有缺失月份
 * @param currentData 当前存储的LPR数据
 * @returns 合并后的数据、新增/更新的条目、是否发生更新
 */
export async function checkAndUpdateLPR(currentData: LPRData[]): Promise<{
  updated: boolean;
  data: LPRData[];
  newEntries: LPRData[];
  error?: string;
}> {
  try {
    const remote = await fetchLPRHistory(currentData[0]?.date);

    if (!remote) {
      return {
        updated: false,
        data: currentData,
        newEntries: [],
        error: '无法连接到LPR数据源。可检查网络、在「LPR数据管理」中配置自建Worker代理，或手动更新数据',
      };
    }

    const { data, newEntries } = mergeRemoteData(currentData, remote);
    return { updated: newEntries.length > 0, data, newEntries };
  } catch (err) {
    return {
      updated: false,
      data: currentData,
      newEntries: [],
      error: err instanceof Error ? err.message : '未知错误',
    };
  }
}

// 上次检查时间存储键
const LAST_CHECK_KEY = 'lpr_last_check';

/**
 * 获取上次检查时间
 */
export function getLastCheckTime(): string | null {
  return localStorage.getItem(LAST_CHECK_KEY);
}

/**
 * 设置上次检查时间
 */
export function setLastCheckTime() {
  localStorage.setItem(LAST_CHECK_KEY, new Date().toISOString());
}

/**
 * 是否需要自动检查更新
 * 每天最多检查一次
 */
export function shouldAutoCheck(): boolean {
  const lastCheck = getLastCheckTime();
  if (!lastCheck) return true;

  const last = new Date(lastCheck);
  const now = new Date();

  // 如果不是同一天，则需要检查
  return last.getDate() !== now.getDate() ||
         last.getMonth() !== now.getMonth() ||
         last.getFullYear() !== now.getFullYear();
}
