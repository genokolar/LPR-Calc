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
  | "averageLPR"      // 平均LPR
  | "startMonthLPR"   // 起始月LPR
  | "endMonthLPR"     // 截止月LPR
  | "customRate";     // 自定义利率

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
  customRate: number;   // 自定义年利率(%)，仅 interestMethod=customRate 时生效
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

// ===== 还款冲抵（超额利息折抵本金） =====

// 单笔还款记录
export interface RepaymentRecord {
  id: string;        // 唯一标识
  date: string;      // 还款日期 YYYY-MM-DD
  amount: number;    // 还款金额
}

// 冲抵参数（在基础计息参数之上扩展）
export interface OffsetParams {
  enabled: boolean;
  repayments: RepaymentRecord[];
  continueDate: string;  // 折抵后继续计息到的截止日
}

// 单笔还款冲抵明细行
export interface OffsetRow {
  period: string;          // 计息期间描述
  startDate: string;
  endDate: string;
  days: number;            // 本期间天数
  rate: number;            // 适用年利率(%)
  openingPrincipal: number;      // 期初本金
  interestAccrued: number;       // 本期间应付利息
  interestOpening: number;       // 期初累计欠息
  totalDue: number;              // 应付合计 = 本期间利息 + 期初欠息
  payment: number;               // 本次还款金额
  interestSettled: number;       // 冲抵利息金额
  principalOffset: number;       // 折抵本金金额
  closingPrincipal: number;      // 期末本金
  interestCarryover: number;     // 期末累计欠息
  lprDate?: string;              // 适用LPR发布日（分段/起始/截止模式）
  formula: string;               // 计算说明
}

// 最终继续计息段
export interface FinalSegment {
  period: string;
  startDate: string;
  endDate: string;
  days: number;
  rate: number;
  principal: number;
  interest: number;
  lprDate?: string;
  formula: string;
}

// 冲抵计算结果
export interface OffsetResult {
  initialPrincipal: number;    // 原始本金
  finalPrincipal: number;      // 折抵后剩余本金
  totalPayments: number;       // 还款总额
  totalInterestSettled: number;  // 累计冲抵利息
  totalPrincipalOffset: number;  // 累计折抵本金
  interestCarryover: number;   // 剩余欠付利息
  finalInterest: number;       // 截止日后续利息
  totalClaim: number;          // 诉请总额 = 剩余本金 + 欠息 + 后续利息
  rows: OffsetRow[];
  finalSegment: FinalSegment;
  process: string[];           // 计算过程说明
}

// LPR数据项
export interface LPRDataItem {
  date: string;
  oneYear: number;
  fiveYear: number;
}
