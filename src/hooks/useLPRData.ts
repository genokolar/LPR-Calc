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

const CURRENT_VERSION = '1.1'; // 版本更新以触发数据刷新

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

export function useLPRData() {
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

  // 自动检查更新（页面加载时）
  useEffect(() => {
    if (shouldAutoCheck()) {
      handleAutoCheck();
    }
  }, []);

  // 自动检查（静默）
  const handleAutoCheck = async () => {
    try {
      const result = await checkAndUpdateLPR(lprData);
      if (result.updated && result.newEntry) {
        setLprData(result.data);
        setLastCheckResult({
          updated: true,
          message: `已自动更新LPR数据：${result.newEntry.date} 一年期${result.newEntry.oneYear}% 五年期${result.newEntry.fiveYear}%`,
        });
      }
      setLastCheckTime();
    } catch {
      // 静默失败
    }
  };

  // 手动检查更新
  const checkUpdate = async (): Promise<boolean> => {
    if (isChecking) return false;
    
    setIsChecking(true);
    setLastCheckResult(null);
    
    try {
      const result = await checkAndUpdateLPR(lprData);
      setLastCheckTime();
      
      if (result.updated && result.newEntry) {
        setLprData(result.data);
        setLastCheckResult({
          updated: true,
          message: `更新成功！${result.newEntry.date} 一年期${result.newEntry.oneYear}% 五年期${result.newEntry.fiveYear}%`,
        });
        return true;
      } else {
        setLastCheckResult({
          updated: false,
          message: '当前已是最新数据，无需更新',
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
      
      const existingIndex = lprData.findIndex(d => d.date === latest.date);
      
      if (existingIndex >= 0) {
        const updated = [...lprData];
        updated[existingIndex] = latest;
        setLprData(updated);
      } else {
        const updated = [latest, ...lprData];
        updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setLprData(updated);
      }
      
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
