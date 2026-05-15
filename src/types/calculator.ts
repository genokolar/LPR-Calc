// 计算器类型定义

// 利率模式
export type RateMode = "oneYear" | "fiveYear";

// 天数算法
export type DayAlgorithm = "headNotTail" | "bothEnds";

// 天数基准
export type DayBase = 360 | 365;

// 计息方式
export type InterestMethod = 
  | "segmentLPR"      // 分段LPR
  | "maxRateX4"       // 民间借贷法定最高利率(x4)
  | "averageLPR"      // 平均LPR
  | "startMonthLPR"   // 起始月LPR
  | "endMonthLPR";    // 截止月LPR

// 计算参数
export interface CalculationParams {
  startDate: string;
  endDate: string;
  principal: number;
  rateMode: RateMode;
  dayAlgorithm: DayAlgorithm;
  dayBase: DayBase;
  interestMethod: InterestMethod;
  rateMultiplier: number;
}

// LPR分段明细（用于展示）
export interface LPRSegment {
  period: string;           // 期间描述
  startDate: string;        // 开始日期
  endDate: string;          // 结束日期
  days: number;             // 天数
  lprRate: number;          // 原始LPR利率(%)
  appliedRate: number;      // 应用利率(%) = lprRate * multiplier
  principal: number;        // 本金
  interest: number;         // 利息
  formula: string;          // 计算公式
}

// 计算结果明细项
export interface InterestDetail {
  period: string;           // 计息期间
  days: number;             // 天数
  rate: number;             // 适用利率(%)
  principal: number;        // 本金
  interest: number;         // 利息
  formula: string;          // 计算公式
}

// 计算结果
export interface CalculationResult {
  totalDays: number;
  totalInterest: number;
  principal: number;
  effectiveRate: number;
  details: InterestDetail[];
  lprSegments?: LPRSegment[];  // LPR分段明细（用于分段LPR和平均LPR）
  averageLPRRate?: number;     // 平均LPR利率（仅平均LPR模式）
  calculationProcess: string[]; // 计算过程说明
}

// LPR数据项
export interface LPRDataItem {
  date: string;
  oneYear: number;
  fiveYear: number;
}
