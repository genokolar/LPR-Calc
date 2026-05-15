// LPR数据获取工具
// 通过CORS代理从中国货币网获取最新LPR数据

import type { LPRData } from '@/data/lprData';

// CORS代理列表（按优先级排列）
const CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
];

// 中国货币网LPR数据API
const LPR_API_URL = 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/bk-lpr.json';

// 历史数据API（用于获取更多历史数据）
const LPR_HISTORY_API_URL = 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/bk-lpr-2.json';

// LPR数据响应格式
interface LPRApiResponse {
  data: {
    showDateCN: string;
    showDateEN: string;
  };
  head: {
    rep_code: string;
    rep_message: string;
  };
  records: Array<{
    shibIdUpDown: string;
    shibor: string;
    termCode: string;
  }>;
}

// 使用代理获取数据
async function fetchWithProxy(url: string, proxyUrl: string): Promise<Response> {
  const fullUrl = proxyUrl + encodeURIComponent(url);
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: {
      'Accept': 'application/json, text/plain, */*',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response;
}

// 尝试多个代理获取数据
async function fetchWithFallback(url: string): Promise<any> {
  const errors: string[] = [];
  
  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetchWithProxy(url, proxy);
      const data = await response.json();
      
      // 验证数据格式
      if (data && data.records && Array.isArray(data.records)) {
        return data;
      }
      
      throw new Error('Invalid data format');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`${proxy}: ${errorMsg}`);
    }
  }
  
  throw new Error(`All proxies failed: ${errors.join('; ')}`);
}

// 解析API响应为LPRData
function parseLPRResponse(response: LPRApiResponse): { date: string; oneYear: number; fiveYear: number } | null {
  try {
    // 解析日期 (格式: "2026-04-20 9:00")
    const dateMatch = response.data.showDateCN.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) return null;
    
    const date = dateMatch[1];
    let oneYear = 0;
    let fiveYear = 0;
    
    // 解析利率
    for (const record of response.records) {
      const rate = parseFloat(record.shibor);
      if (isNaN(rate)) continue;
      
      if (record.termCode === '1Y') {
        oneYear = rate;
      } else if (record.termCode === '5Y') {
        fiveYear = rate;
      }
    }
    
    if (oneYear === 0 || fiveYear === 0) return null;
    
    return { date, oneYear, fiveYear };
  } catch {
    return null;
  }
}

/**
 * 获取最新LPR数据
 * @returns 最新LPR数据，如果获取失败返回null
 */
export async function fetchLatestLPR(): Promise<LPRData | null> {
  try {
    const data = await fetchWithFallback(LPR_API_URL);
    const parsed = parseLPRResponse(data);
    
    if (!parsed) {
      throw new Error('Failed to parse LPR data');
    }
    
    return {
      date: parsed.date,
      oneYear: parsed.oneYear,
      fiveYear: parsed.fiveYear,
    };
  } catch (err) {
    console.error('Failed to fetch latest LPR:', err);
    return null;
  }
}

/**
 * 获取历史LPR数据（获取更多历史记录）
 * @returns LPR数据数组，如果获取失败返回空数组
 */
export async function fetchLPRHistory(): Promise<LPRData[]> {
  try {
    const data = await fetchWithFallback(LPR_HISTORY_API_URL);
    
    if (!data.records || !Array.isArray(data.records)) {
      throw new Error('Invalid history data format');
    }
    
    // 历史数据格式可能不同，需要解析
    const result: LPRData[] = [];
    
    // 如果返回的是单个最新数据格式
    if (data.records.length === 2 && data.records[0].termCode) {
      const parsed = parseLPRResponse(data);
      if (parsed) {
        result.push({
          date: parsed.date,
          oneYear: parsed.oneYear,
          fiveYear: parsed.fiveYear,
        });
      }
      return result;
    }
    
    // 如果返回的是历史数据数组
    for (const item of data.records) {
      if (item.date && item.oneYear && item.fiveYear) {
        result.push({
          date: item.date,
          oneYear: parseFloat(item.oneYear),
          fiveYear: parseFloat(item.fiveYear),
        });
      }
    }
    
    return result;
  } catch (err) {
    console.error('Failed to fetch LPR history:', err);
    return [];
  }
}

/**
 * 检查并更新LPR数据
 * @param currentData 当前存储的LPR数据
 * @returns 更新后的数据，以及是否发生了更新
 */
export async function checkAndUpdateLPR(currentData: LPRData[]): Promise<{
  updated: boolean;
  data: LPRData[];
  newEntry?: LPRData;
}> {
  const latest = await fetchLatestLPR();
  
  if (!latest) {
    return { updated: false, data: currentData };
  }
  
  // 检查是否已有该日期的数据
  const existingIndex = currentData.findIndex(d => d.date === latest.date);
  
  if (existingIndex >= 0) {
    // 检查数据是否有变化
    const existing = currentData[existingIndex];
    if (existing.oneYear !== latest.oneYear || existing.fiveYear !== latest.fiveYear) {
      // 更新现有数据
      const updated = [...currentData];
      updated[existingIndex] = latest;
      return { updated: true, data: updated, newEntry: latest };
    }
    // 数据相同，无需更新
    return { updated: false, data: currentData };
  }
  
  // 添加新数据
  const updated = [latest, ...currentData];
  updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { updated: true, data: updated, newEntry: latest };
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
