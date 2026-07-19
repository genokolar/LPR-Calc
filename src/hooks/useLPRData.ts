import { useState, useEffect, useCallback } from 'react';
import type { LPRData } from '@/data/lprData';
import { lprHistoryData as defaultData } from '@/data/lprData';
import { 
  checkAndUpdateLPR, 
  fetchLatestLPR,
  shouldAutoCheck, 
  setLastCheckTime 
} from '@/utils/lprFetcher';

const STORAGE_KEY = 'lpr_calculator_data';
const STORAGE_TIMESTAMP = 'lpr_calculator_timestamp';
const STORAGE_VERSION = 'lpr_calculator_version';

// 当前数据版本，用于强制刷新
const CURRENT_VERSION = '1.2';

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

// 从构建产物中读取预抓取的LPR数据（方案一：GitHub Actions构建时嵌入）
async function loadBuildTimeLPR(): Promise<LPRData | null> {
  try {
    const response = await fetch('./lpr-latest.json', {
      method: 'GET',
      cache: 'no-cache',
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // 验证数据格式
    if (data.date && typeof data.oneYear === 'number' && typeof data.fiveYear === 'number') {
      return {
        date: data.date,
        oneYear: data.oneYear,
        fiveYear: data.fiveYear,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

// 将构建时数据合并到现有数据中
function mergeBuildTimeData(existing: LPRData[], buildTime: LPRData): LPRData[] {
  const index = existing.findIndex(d => d.date === buildTime.date);
  
  if (index >= 0) {
    // 更新已有记录
    const updated = [...existing];
    updated[index] = buildTime;
    return updated;
  }
  
  // 插入新记录，保持降序
  const updated = [buildTime, ...existing];
  updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return updated;
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

  // 页面加载时：先读取构建时嵌入的LPR数据，再尝试在线获取
  useEffect(() => {
    async function initData() {
      // 步骤1：读取构建时嵌入的数据（方案一，最可靠）
      const buildTimeLPR = await loadBuildTimeLPR();
      
      if (buildTimeLPR) {
        setLprData(prev => {
          const merged = mergeBuildTimeData(prev, buildTimeLPR);
          return merged;
        });
      }
      
      // 步骤2：尝试CORS代理在线获取（补充方案）
      if (shouldAutoCheck()) {
        try {
          const result = await checkAndUpdateLPR(lprData);
          if (result.updated && result.newEntry) {
            setLprData(result.data);
          }
          setLastCheckTime();
        } catch {
          // 静默失败，构建时数据已足够
        }
      }
    }
    
    initData();
  }, []);

  // 手动检查更新
  const checkUpdate = async (): Promise<boolean> => {
    if (isChecking) return false;
    
    setIsChecking(true);
    setLastCheckResult(null);
    
    // 先尝试方案一：重新读取构建时数据
    try {
      const buildTimeLPR = await loadBuildTimeLPR();
      if (buildTimeLPR) {
        const existing = lprData.find(d => d.date === buildTimeLPR.date);
        if (!existing || existing.oneYear !== buildTimeLPR.oneYear || existing.fiveYear !== buildTimeLPR.fiveYear) {
          setLprData(prev => mergeBuildTimeData(prev, buildTimeLPR));
          setLastCheckResult({
            updated: true,
            message: `已更新：${buildTimeLPR.date} 一年期${buildTimeLPR.oneYear}% 五年期${buildTimeLPR.fiveYear}%`,
          });
          setIsChecking(false);
          return true;
        }
      }
    } catch {
      // 忽略
    }
    
    // 再尝试方案二：CORS代理在线获取
    try {
      const result = await checkAndUpdateLPR(lprData);
      setLastCheckTime();
      
      if (result.updated && result.newEntry) {
        setLprData(result.data);
        setLastCheckResult({
          updated: true,
          message: `在线获取成功！${result.newEntry.date} 一年期${result.newEntry.oneYear}% 五年期${result.newEntry.fiveYear}%`,
        });
        return true;
      } else {
        setLastCheckResult({
          updated: false,
          message: '当前已是最新数据',
        });
        return false;
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setLastCheckResult({
        updated: false,
        message: `检查失败：${errorMsg}`,
      });
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // 直接获取最新（强制刷新）
  const forceRefresh = async (): Promise<boolean> => {
    if (isChecking) return false;
    
    setIsChecking(true);
    setLastCheckResult(null);
    
    try {
      const latest = await fetchLatestLPR();
      
      if (!latest) {
        setLastCheckResult({
          updated: false,
          message: '获取失败，请检查网络连接',
        });
        return false;
      }
      
      setLprData(prev => mergeBuildTimeData(prev, latest));
      
      setLastCheckTime();
      setLastCheckResult({
        updated: true,
        message: `已获取最新数据：${latest.date} 一年期${latest.oneYear}% 五年期${latest.fiveYear}%`,
      });
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setLastCheckResult({
        updated: false,
        message: `获取失败：${errorMsg}`,
      });
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
    forceRefresh,
    isStale: isDataStale(),
  };
}
