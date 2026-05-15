// LPR历史数据 - 从2019年8月到2026年2月
// 数据来源：全国银行间同业拆借中心、中国货币网

export interface LPRData {
  date: string; // YYYY-MM-DD
  oneYear: number; // 一年期LPR (%)
  fiveYear: number; // 五年期以上LPR (%)
}

// 默认LPR历史数据列表（按日期降序排列，最新的在前面）
// 这些数据会在首次使用时存入localStorage，之后可从管理界面更新
export const lprHistoryData: LPRData[] = [
  { date: "2026-02-24", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2026-01-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-12-22", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-11-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-10-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-09-22", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-08-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-07-21", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-06-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-05-20", oneYear: 3.00, fiveYear: 3.50 },
  { date: "2025-04-21", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2025-03-20", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2025-02-20", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2025-01-20", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2024-12-20", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2024-11-20", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2024-10-21", oneYear: 3.10, fiveYear: 3.60 },
  { date: "2024-09-20", oneYear: 3.35, fiveYear: 3.85 },
  { date: "2024-08-20", oneYear: 3.35, fiveYear: 3.85 },
  { date: "2024-07-22", oneYear: 3.35, fiveYear: 3.85 },
  { date: "2024-06-20", oneYear: 3.45, fiveYear: 3.95 },
  { date: "2024-05-20", oneYear: 3.45, fiveYear: 3.95 },
  { date: "2024-04-22", oneYear: 3.45, fiveYear: 3.95 },
  { date: "2024-03-20", oneYear: 3.45, fiveYear: 3.95 },
  { date: "2024-02-20", oneYear: 3.45, fiveYear: 3.95 },
  { date: "2024-01-22", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-12-20", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-11-20", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-10-20", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-09-20", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-08-21", oneYear: 3.45, fiveYear: 4.20 },
  { date: "2023-07-20", oneYear: 3.55, fiveYear: 4.20 },
  { date: "2023-06-20", oneYear: 3.55, fiveYear: 4.20 },
  { date: "2023-05-22", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2023-04-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2023-03-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2023-02-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2023-01-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-12-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-11-21", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-10-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-09-20", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-08-22", oneYear: 3.65, fiveYear: 4.30 },
  { date: "2022-07-20", oneYear: 3.70, fiveYear: 4.45 },
  { date: "2022-06-20", oneYear: 3.70, fiveYear: 4.45 },
  { date: "2022-05-20", oneYear: 3.70, fiveYear: 4.45 },
  { date: "2022-04-20", oneYear: 3.70, fiveYear: 4.60 },
  { date: "2022-03-21", oneYear: 3.70, fiveYear: 4.60 },
  { date: "2022-02-21", oneYear: 3.70, fiveYear: 4.60 },
  { date: "2022-01-20", oneYear: 3.70, fiveYear: 4.60 },
  { date: "2021-12-20", oneYear: 3.80, fiveYear: 4.65 },
  { date: "2021-11-22", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-10-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-09-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-08-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-07-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-06-21", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-05-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-04-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-03-22", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-02-22", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2021-01-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-12-21", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-11-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-10-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-09-21", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-08-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-07-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-06-22", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-05-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-04-20", oneYear: 3.85, fiveYear: 4.65 },
  { date: "2020-03-20", oneYear: 4.05, fiveYear: 4.75 },
  { date: "2020-02-20", oneYear: 4.05, fiveYear: 4.75 },
  { date: "2020-01-20", oneYear: 4.15, fiveYear: 4.80 },
  { date: "2019-12-20", oneYear: 4.15, fiveYear: 4.80 },
  { date: "2019-11-20", oneYear: 4.15, fiveYear: 4.80 },
  { date: "2019-10-21", oneYear: 4.20, fiveYear: 4.85 },
  { date: "2019-09-20", oneYear: 4.20, fiveYear: 4.85 },
  { date: "2019-08-20", oneYear: 4.25, fiveYear: 4.85 },
];

// LPR分段数据接口
export interface LPRSegmentData {
  lprDate: string;      // LPR发布日期
  startDate: string;    // 该LPR适用的开始日期
  endDate: string;      // 该LPR适用的结束日期
  rate: number;         // LPR利率
  days: number;         // 天数
}

// 获取指定日期适用的LPR利率（返回该日期之前最新的LPR）
export function getLPRByDate(
  date: string, 
  type: "oneYear" | "fiveYear",
  data: LPRData[]
): number {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  // 找到第一个小于等于目标日期的LPR数据（data是按降序排列的）
  for (const item of data) {
    const dataDate = new Date(item.date);
    dataDate.setHours(0, 0, 0, 0);
    if (dataDate <= targetDate) {
      return type === "oneYear" ? item.oneYear : item.fiveYear;
    }
  }
  
  // 如果日期早于最早的数据，返回最早的数据
  const earliest = data[data.length - 1];
  return type === "oneYear" ? earliest.oneYear : earliest.fiveYear;
}

// 获取两个日期之间的所有LPR分段数据（用于分段计算）
export function getLPRBetweenDates(
  startDate: string,
  endDate: string,
  type: "oneYear" | "fiveYear",
  data: LPRData[],
  dayAlgorithm: "headNotTail" | "bothEnds" = "headNotTail"
): LPRSegmentData[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const result: LPRSegmentData[] = [];
  
  // 将数据按升序排列（从旧到新）
  const sortedData = [...data].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  // 找到开始日期之前最新的LPR
  let startLPR: LPRData | null = null;
  const relevantData: LPRData[] = [];
  
  for (const item of sortedData) {
    const dataDate = new Date(item.date);
    dataDate.setHours(0, 0, 0, 0);
    
    if (dataDate <= start) {
      startLPR = item;
    } else if (dataDate > start && dataDate <= end) {
      relevantData.push(item);
    }
  }
  
  // 构建分段数据
  const allSegments: { lpr: LPRData; start: Date; end: Date }[] = [];
  
  if (startLPR) {
    // 第一段：从开始日期到第一个LPR调整点
    const firstSegmentEnd = relevantData.length > 0 
      ? new Date(relevantData[0].date)
      : end;
    
    allSegments.push({
      lpr: startLPR,
      start: new Date(start),
      end: new Date(firstSegmentEnd)
    });
    
    // 后续段：每个LPR调整点后的区间
    for (let i = 0; i < relevantData.length; i++) {
      const currentLPR = relevantData[i];
      const nextLPR = relevantData[i + 1];
      
      const segmentStart = new Date(currentLPR.date);
      const segmentEnd = nextLPR 
        ? new Date(nextLPR.date)
        : end;
      
      allSegments.push({
        lpr: currentLPR,
        start: segmentStart,
        end: segmentEnd
      });
    }
  }
  
  // 计算每段的天数
  for (const segment of allSegments) {
    let days: number;
    
    if (dayAlgorithm === "headNotTail") {
      days = Math.round((segment.end.getTime() - segment.start.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      days = Math.round((segment.end.getTime() - segment.start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    
    if (days > 0) {
      result.push({
        lprDate: segment.lpr.date,
        startDate: segment.start.toISOString().split('T')[0],
        endDate: segment.end.toISOString().split('T')[0],
        rate: type === "oneYear" ? segment.lpr.oneYear : segment.lpr.fiveYear,
        days: days
      });
    }
  }
  
  return result;
}

// 计算平均LPR（加权平均）
export function getAverageLPR(
  startDate: string,
  endDate: string,
  type: "oneYear" | "fiveYear",
  data: LPRData[],
  dayAlgorithm: "headNotTail" | "bothEnds" = "headNotTail"
): { averageRate: number; segments: LPRSegmentData[] } {
  const segments = getLPRBetweenDates(startDate, endDate, type, data, dayAlgorithm);
  
  if (segments.length === 0) {
    return { averageRate: 0, segments: [] };
  }
  
  const totalDays = segments.reduce((sum, s) => sum + s.days, 0);
  const weightedSum = segments.reduce((sum, s) => sum + s.rate * s.days, 0);
  
  const averageRate = totalDays > 0 ? weightedSum / totalDays : 0;
  
  return { averageRate, segments };
}
