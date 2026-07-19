// LPR数据获取工具
// 通过CORS代理从中国货币网获取最新LPR数据

import type { LPRData } from '@/data/lprData';

// CORS代理列表（按优先级排列）
// 注：公共CORS代理服务可能随时不可用，如获取失败请通过LPR数据管理界面手动更新
const CORS_PROXIES = [
  'https://cors.eu.org/',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.allorigins.win/raw?url=',
];

// 中国货币网LPR数据API
const LPR_API_URL = 'https://www.chinamoney.com.cn/r/cms/www/chinamoney/data/currency/bk-lpr.json';

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
  // 处理两种代理格式：
  // 1. cors.eu.org/ 格式：直接拼接URL
  // 2. ?quest= 或 ?url= 格式：需要encodeURIComponent
  let fullUrl: string;
  if (proxyUrl.endsWith('/')) {
    fullUrl = proxyUrl + url;
  } else {
    fullUrl = proxyUrl + encodeURIComponent(url);
  }
  
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
      if (data && data.records && Array.isArray(data.records) && data.records.length > 0) {
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
