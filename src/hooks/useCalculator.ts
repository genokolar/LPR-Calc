import { useState, useCallback } from 'react';
import type { 
  CalculationParams, 
  CalculationResult, 
  InterestDetail,
  LPRSegment,
  DayAlgorithm
} from '@/types/calculator';
import type { LPRData } from '@/data/lprData';
import { 
  getLPRByDate, 
  getLPRBetweenDates, 
  getAverageLPR
} from '@/data/lprData';

// 格式化日期显示
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

// 格式化金额
function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 计算两个日期之间的天数
function calculateDays(
  startDate: string, 
  endDate: string, 
  algorithm: DayAlgorithm
): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  let days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  if (algorithm === 'bothEnds') {
    days += 1;
  }
  
  return Math.max(0, days);
}

// 主计算函数 - 需要传入lprData
export function calculateInterest(
  params: CalculationParams, 
  lprData: LPRData[]
): CalculationResult {
  const { 
    startDate, 
    endDate, 
    principal, 
    rateMode, 
    dayAlgorithm, 
    dayBase, 
    interestMethod,
    rateMultiplier 
  } = params;

  // 验证日期
  if (new Date(startDate) > new Date(endDate)) {
    throw new Error('开始日期不能晚于截止日期');
  }

  if (principal <= 0) {
    throw new Error('计息金额必须大于0');
  }

  const details: InterestDetail[] = [];
  const lprSegments: LPRSegment[] = [];
  const calculationProcess: string[] = [];
  let totalInterest = 0;
  let totalDays = 0;

  // 根据不同计息方式计算
  switch (interestMethod) {
    case 'segmentLPR': {
      calculationProcess.push('=== 分段LPR计算 ===');
      calculationProcess.push(`本金: ¥${formatMoney(principal)}`);
      calculationProcess.push(`利率模式: ${rateMode === 'oneYear' ? '一年期LPR' : '五年期LPR'}`);
      calculationProcess.push(`利率倍数: ${rateMultiplier}`);
      calculationProcess.push(`天数算法: ${dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算'}`);
      calculationProcess.push(`天数基准: ${dayBase}天`);
      calculationProcess.push('');
      
      const segments = getLPRBetweenDates(startDate, endDate, rateMode, lprData, dayAlgorithm);
      
      calculationProcess.push(`共涉及 ${segments.length} 个LPR时间段:`);
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const appliedRate = segment.rate * rateMultiplier;
        const interest = (principal * appliedRate * segment.days) / (dayBase * 100);
        
        const formula = `¥${formatMoney(principal)} × ${appliedRate.toFixed(2)}% × ${segment.days}天 ÷ ${dayBase}天 = ¥${(interest).toFixed(2)}`;
        
        lprSegments.push({
          period: `${formatDate(segment.startDate)} 至 ${formatDate(segment.endDate)}`,
          startDate: segment.startDate,
          endDate: segment.endDate,
          days: segment.days,
          lprRate: segment.rate,
          appliedRate: appliedRate,
          principal,
          interest: Math.round(interest * 100) / 100,
          formula
        });
        
        details.push({
          period: `${formatDate(segment.startDate)} 至 ${formatDate(segment.endDate)}`,
          days: segment.days,
          rate: appliedRate,
          principal,
          interest: Math.round(interest * 100) / 100,
          formula
        });
        
        calculationProcess.push(`\n第 ${i + 1} 段:`);
        calculationProcess.push(`  LPR发布日期: ${segment.lprDate}`);
        calculationProcess.push(`  期间: ${formatDate(segment.startDate)} 至 ${formatDate(segment.endDate)}`);
        calculationProcess.push(`  天数: ${segment.days}天`);
        calculationProcess.push(`  LPR利率: ${segment.rate.toFixed(2)}%`);
        calculationProcess.push(`  应用利率: ${segment.rate.toFixed(2)}% × ${rateMultiplier} = ${appliedRate.toFixed(2)}%`);
        calculationProcess.push(`  计算: ${formula}`);
        
        totalInterest += interest;
        totalDays += segment.days;
      }
      
      calculationProcess.push('\n=== 汇总 ===');
      calculationProcess.push(`总天数: ${totalDays}天`);
      calculationProcess.push(`总利息: ¥${(Math.round(totalInterest * 100) / 100).toFixed(2)}`);
      break;
    }

    case 'averageLPR': {
      calculationProcess.push('=== 平均LPR计算 ===');
      calculationProcess.push(`本金: ¥${formatMoney(principal)}`);
      calculationProcess.push(`利率模式: ${rateMode === 'oneYear' ? '一年期LPR' : '五年期LPR'}`);
      calculationProcess.push(`利率倍数: ${rateMultiplier}`);
      calculationProcess.push(`天数算法: ${dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算'}`);
      calculationProcess.push(`天数基准: ${dayBase}天`);
      calculationProcess.push('');
      
      const { averageRate, segments } = getAverageLPR(startDate, endDate, rateMode, lprData, dayAlgorithm);
      const appliedAvgRate = averageRate * rateMultiplier;
      const days = calculateDays(startDate, endDate, dayAlgorithm);
      const interest = (principal * appliedAvgRate * days) / (dayBase * 100);
      
      calculationProcess.push('=== LPR加权平均计算 ===');
      calculationProcess.push(`共涉及 ${segments.length} 个LPR时间段:`);
      
      let totalWeightedDays = 0;
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        totalWeightedDays += segment.days;
        
        lprSegments.push({
          period: `${formatDate(segment.startDate)} 至 ${formatDate(segment.endDate)}`,
          startDate: segment.startDate,
          endDate: segment.endDate,
          days: segment.days,
          lprRate: segment.rate,
          appliedRate: segment.rate,
          principal,
          interest: 0,
          formula: `权重: ${segment.days}天，LPR: ${segment.rate.toFixed(2)}%`
        });
        
        calculationProcess.push(`\n第 ${i + 1} 段:`);
        calculationProcess.push(`  期间: ${formatDate(segment.startDate)} 至 ${formatDate(segment.endDate)}`);
        calculationProcess.push(`  天数: ${segment.days}天`);
        calculationProcess.push(`  LPR利率: ${segment.rate.toFixed(2)}%`);
      }
      
      const weightedSum = segments.reduce((sum, s) => sum + s.rate * s.days, 0);
      
      calculationProcess.push('\n=== 加权平均计算 ===');
      calculationProcess.push(`加权总和: ${segments.map(s => `(${s.rate.toFixed(2)}% × ${s.days}天)`).join(' + ')} = ${weightedSum.toFixed(2)}`);
      calculationProcess.push(`总天数: ${totalWeightedDays}天`);
      calculationProcess.push(`平均LPR: ${weightedSum.toFixed(2)} ÷ ${totalWeightedDays} = ${averageRate.toFixed(4)}%`);
      calculationProcess.push(`应用利率: ${averageRate.toFixed(4)}% × ${rateMultiplier} = ${appliedAvgRate.toFixed(4)}%`);
      
      const formula = `¥${formatMoney(principal)} × ${appliedAvgRate.toFixed(4)}% × ${days}天 ÷ ${dayBase}天 = ¥${(interest).toFixed(2)}`;
      
      calculationProcess.push('\n=== 利息计算 ===');
      calculationProcess.push(`计息天数: ${days}天`);
      calculationProcess.push(`计算: ${formula}`);
      
      details.push({
        period: `${formatDate(startDate)} 至 ${formatDate(endDate)}`,
        days,
        rate: Math.round(appliedAvgRate * 100) / 100,
        principal,
        interest: Math.round(interest * 100) / 100,
        formula
      });
      
      totalInterest = interest;
      totalDays = days;
      break;
    }

    case 'startMonthLPR': {
      calculationProcess.push('=== 起始月LPR计算 ===');
      calculationProcess.push(`本金: ¥${formatMoney(principal)}`);
      calculationProcess.push(`利率模式: ${rateMode === 'oneYear' ? '一年期LPR' : '五年期LPR'}`);
      calculationProcess.push(`利率倍数: ${rateMultiplier}`);
      calculationProcess.push(`天数算法: ${dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算'}`);
      calculationProcess.push(`天数基准: ${dayBase}天`);
      calculationProcess.push('');
      
      const startLPR = getLPRByDate(startDate, rateMode, lprData);
      const appliedRate = startLPR * rateMultiplier;
      const days = calculateDays(startDate, endDate, dayAlgorithm);
      const interest = (principal * appliedRate * days) / (dayBase * 100);
      
      const formula = `¥${formatMoney(principal)} × ${appliedRate.toFixed(2)}% × ${days}天 ÷ ${dayBase}天 = ¥${(interest).toFixed(2)}`;
      
      calculationProcess.push(`起始日期LPR: ${startLPR.toFixed(2)}%`);
      calculationProcess.push(`应用利率: ${startLPR.toFixed(2)}% × ${rateMultiplier} = ${appliedRate.toFixed(2)}%`);
      calculationProcess.push(`计息天数: ${days}天`);
      calculationProcess.push(`计算: ${formula}`);
      
      details.push({
        period: `${formatDate(startDate)} 至 ${formatDate(endDate)}`,
        days,
        rate: appliedRate,
        principal,
        interest: Math.round(interest * 100) / 100,
        formula
      });
      
      totalInterest = interest;
      totalDays = days;
      break;
    }

    case 'endMonthLPR': {
      calculationProcess.push('=== 截止月LPR计算 ===');
      calculationProcess.push(`本金: ¥${formatMoney(principal)}`);
      calculationProcess.push(`利率模式: ${rateMode === 'oneYear' ? '一年期LPR' : '五年期LPR'}`);
      calculationProcess.push(`利率倍数: ${rateMultiplier}`);
      calculationProcess.push(`天数算法: ${dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算'}`);
      calculationProcess.push(`天数基准: ${dayBase}天`);
      calculationProcess.push('');
      
      const endLPR = getLPRByDate(endDate, rateMode, lprData);
      const appliedRate = endLPR * rateMultiplier;
      const days = calculateDays(startDate, endDate, dayAlgorithm);
      const interest = (principal * appliedRate * days) / (dayBase * 100);
      
      const formula = `¥${formatMoney(principal)} × ${appliedRate.toFixed(2)}% × ${days}天 ÷ ${dayBase}天 = ¥${(interest).toFixed(2)}`;
      
      calculationProcess.push(`截止日期LPR: ${endLPR.toFixed(2)}%`);
      calculationProcess.push(`应用利率: ${endLPR.toFixed(2)}% × ${rateMultiplier} = ${appliedRate.toFixed(2)}%`);
      calculationProcess.push(`计息天数: ${days}天`);
      calculationProcess.push(`计算: ${formula}`);
      
      details.push({
        period: `${formatDate(startDate)} 至 ${formatDate(endDate)}`,
        days,
        rate: appliedRate,
        principal,
        interest: Math.round(interest * 100) / 100,
        formula
      });
      
      totalInterest = interest;
      totalDays = days;
      break;
    }
  }

  // 计算有效年利率
  const effectiveRate = totalDays > 0 
    ? (totalInterest * dayBase * 100) / (principal * totalDays)
    : 0;

  return {
    totalDays,
    totalInterest: Math.round(totalInterest * 100) / 100,
    principal,
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    details,
    lprSegments: lprSegments.length > 0 ? lprSegments : undefined,
    calculationProcess
  };
}

// 计算器Hook - 需要传入lprData
export function useCalculator(lprData: LPRData[]) {
  const [params, setParams] = useState<CalculationParams>({
    startDate: '',
    endDate: '',
    principal: 0,
    rateMode: 'oneYear',
    dayAlgorithm: 'headNotTail',
    dayBase: 360,
    interestMethod: 'segmentLPR',
    rateMultiplier: 1
  });

  const [result, setResult] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateParam = useCallback(<K extends keyof CalculationParams>(
    key: K,
    value: CalculationParams[K]
  ) => {
    setParams(prev => ({ ...prev, [key]: value }));
    setError(null);
  }, []);

  const calculate = useCallback(() => {
    try {
      if (!params.startDate) {
        throw new Error('请选择开始日期');
      }
      if (!params.endDate) {
        throw new Error('请选择截止日期');
      }
      if (params.principal <= 0) {
        throw new Error('请输入有效的计息金额');
      }

      const calcResult = calculateInterest(params, lprData);
      setResult(calcResult);
      setError(null);
      return calcResult;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '计算失败';
      setError(errorMsg);
      setResult(null);
      return null;
    }
  }, [params, lprData]);

  const reset = useCallback(() => {
    setParams({
      startDate: '',
      endDate: '',
      principal: 0,
      rateMode: 'oneYear',
      dayAlgorithm: 'headNotTail',
      dayBase: 360,
      interestMethod: 'segmentLPR',
      rateMultiplier: 1
    });
    setResult(null);
    setError(null);
  }, []);

  return {
    params,
    result,
    error,
    updateParam,
    calculate,
    reset
  };
}
