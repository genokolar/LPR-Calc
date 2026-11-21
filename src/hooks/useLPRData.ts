import { useState, useEffect, useCallback } from 'react';
import type { LPRData } from '@/data/lprData';
import { lprHistoryData as defaultData } from '@/data/lprData';

const STORAGE_KEY = 'lpr_calculator_data';
const STORAGE_TIMESTAMP = 'lpr_calculator_timestamp';
const STORAGE_VERSION = 'lpr_calculator_version';

// 当前数据版本，用于强制刷新
const CURRENT_VERSION = '1.3';

// 从localStorage读取数据
function loadFromStorage(): LPRData[] | null {
  try {
    const version = localStorage.getItem(STORAGE_VERSION);
    if (version !== CURRENT_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_TIMESTAMP);
      localStorage.setItem(STORAGE_VERSION, CURRENT_VERSION);
      return null;
    }
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as LPRData[];
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

// 保存到localStorage
function saveToStorage(data: LPRData[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIMESTAMP, new Date().toISOString());
    localStorage.setItem(STORAGE_VERSION, CURRENT_VERSION);
  } catch {
    // 忽略存储错误
  }
}

// 获取存储的时间戳
function getStorageTimestamp(): string | null {
  return localStorage.getItem(STORAGE_TIMESTAMP);
}

// 检查数据是否过期（超过30天未更新）
export function isDataStale(): boolean {
  const timestamp = getStorageTimestamp();
  if (!timestamp) return true;
  
  const lastUpdate = new Date(timestamp);
  const now = new Date();
  const diffDays = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  
  return diffDays > 30;
}

// 获取最后更新时间
export function getLastUpdateTime(): string | null {
  return getStorageTimestamp();
}

// 从构建产物中读取预抓取的LPR历史数据（方案一：GitHub Actions构建时嵌入）
// 支持两种格式：{ records: LPRData[] } 或纯数组 LPRData[]
async function loadBuildTimeHistory(): Promise<LPRData[]> {
  try {
    const response = await fetch('./lpr-history.json', {
      method: 'GET',
      cache: 'no-cache',
    });

    if (!response.ok) return [];

    const data = await response.json();
    const records = Array.isArray(data) ? data : data.records;

    if (!Array.isArray(records)) return [];

    // 验证数据格式
    const valid = records.filter(
      (r: LPRData) =>
        r.date &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date) &&
        typeof r.oneYear === 'number' &&
        typeof r.fiveYear === 'number'
    );

    return valid;
  } catch {
    return [];
  }
}

// 将构建时数据合并到现有数据中（批量，构建时数据优先，按日期去重）
function mergeBuildTimeData(existing: LPRData[], buildTimeList: LPRData[]): LPRData[] {
  if (!buildTimeList || buildTimeList.length === 0) return existing;

  const map = new Map<string, LPRData>();
  for (const d of existing) map.set(d.date, d);
  for (const d of buildTimeList) map.set(d.date, d); // 构建时数据覆盖同日期记录

  return [...map.values()].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function useLPRData() {
  // 初始化数据：优先从localStorage加载，否则使用默认数据
  const [lprData, setLprData] = useState<LPRData[]>(() => {
    const stored = loadFromStorage();
    if (stored && stored.length > 0) {
      return stored;
    }
    saveToStorage(defaultData);
    return [...defaultData];
  });

  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckResult, setLastCheckResult] = useState<{
    updated: boolean;
    message: string;
  } | null>(null);

  // 数据变更时自动保存
  useEffect(() => {
    saveToStorage(lprData);
  }, [lprData]);

  // 页面加载时：读取构建时嵌入的LPR数据
  // （数据由 GitHub Actions 每月 20-24 日自动抓取更新，浏览器端不再发起在线请求）
  useEffect(() => {
    async function initData() {
      const buildTimeHistory = await loadBuildTimeHistory();
      if (buildTimeHistory.length > 0) {
        setLprData(prev => mergeBuildTimeData(prev, buildTimeHistory));
      }
    }

    initData();
  }, []);

  // 手动同步：重新读取构建时嵌入的LPR历史数据并与本地合并
  const checkUpdate = async (): Promise<boolean> => {
    if (isChecking) return false;

    setIsChecking(true);
    setLastCheckResult(null);

    try {
      const buildTimeHistory = await loadBuildTimeHistory();
      if (buildTimeHistory.length === 0) {
        setLastCheckResult({ updated: false, message: '未找到构建数据文件' });
        return false;
      }

      const missing = buildTimeHistory.filter(d => {
        const existing = lprData.find(x => x.date === d.date);
        return !existing || existing.oneYear !== d.oneYear || existing.fiveYear !== d.fiveYear;
      });

      if (missing.length > 0) {
        setLprData(prev => mergeBuildTimeData(prev, buildTimeHistory));
        const latest = buildTimeHistory[0];
        setLastCheckResult({
          updated: true,
          message: `已同步 ${missing.length} 条，最新 ${latest.date} 一年期${latest.oneYear}% 五年期${latest.fiveYear}%`,
        });
        return true;
      }

      const latest = buildTimeHistory[0];
      setLastCheckResult({
        updated: false,
        message: `本地数据已是最新（${latest.date}）。数据每月随网站自动构建更新`,
      });
      return false;
    } catch {
      setLastCheckResult({ updated: false, message: '同步失败，请刷新页面重试' });
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // 添加新的LPR记录
  const addLPR = useCallback((date: string, oneYear: number, fiveYear: number) => {
    setLprData(prev => {
      const existingIndex = prev.findIndex(d => d.date === date);
      
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { date, oneYear, fiveYear };
        return updated;
      }
      
      const newData = [...prev, { date, oneYear, fiveYear }];
      newData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return newData;
    });
  }, []);

  // 更新LPR记录
  const updateLPR = useCallback((date: string, oneYear: number, fiveYear: number) => {
    setLprData(prev => {
      const index = prev.findIndex(d => d.date === date);
      if (index < 0) return prev;
      
      const updated = [...prev];
      updated[index] = { date, oneYear, fiveYear };
      return updated;
    });
  }, []);

  // 删除LPR记录
  const deleteLPR = useCallback((date: string) => {
    setLprData(prev => prev.filter(d => d.date !== date));
  }, []);

  // 批量导入LPR数据
  const importLPRData = useCallback((data: LPRData[]) => {
    setLprData(prev => {
      const merged = [...prev];
      
      for (const item of data) {
        const existingIndex = merged.findIndex(d => d.date === item.date);
        if (existingIndex >= 0) {
          merged[existingIndex] = item;
        } else {
          merged.push(item);
        }
      }
      
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return merged;
    });
  }, []);

  // 重置为默认数据
  const resetToDefault = useCallback(() => {
    setLprData([...defaultData]);
    saveToStorage(defaultData);
  }, []);

  // 导出为CSV
  const exportToCSV = useCallback(() => {
    const headers = ['日期', '一年期LPR(%)', '五年期LPR(%)'];
    const rows = lprData.map(d => [d.date, d.oneYear.toFixed(2), d.fiveYear.toFixed(2)]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LPR历史数据_${lprData[0]?.date || ''}.csv`;
    link.click();
  }, [lprData]);

  // 从CSV导入
  const importFromCSV = useCallback((csvContent: string) => {
    const lines = csvContent.split('\n').filter(line => line.trim());
    const imported: LPRData[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      if (columns.length >= 3) {
        const date = columns[0].trim();
        const oneYear = parseFloat(columns[1]);
        const fiveYear = parseFloat(columns[2]);
        
        if (date && !isNaN(oneYear) && !isNaN(fiveYear)) {
          imported.push({ date, oneYear, fiveYear });
        }
      }
    }
    
    if (imported.length > 0) {
      importLPRData(imported);
      return imported.length;
    }
    return 0;
  }, [importLPRData]);

  // 获取最新的LPR
  const getLatestLPR = useCallback((): LPRData => {
    return lprData[0] || defaultData[0];
  }, [lprData]);

  // 获取最早的LPR日期
  const getEarliestLPRDate = useCallback((): string => {
    return lprData[lprData.length - 1]?.date || defaultData[defaultData.length - 1].date;
  }, [lprData]);

  return {
    lprData,
    isChecking,
    lastCheckResult,
    addLPR,
    updateLPR,
    deleteLPR,
    importLPRData,
    resetToDefault,
    exportToCSV,
    importFromCSV,
    getLatestLPR,
    getEarliestLPRDate,
    checkUpdate,
    isStale: isDataStale(),
  };
}
