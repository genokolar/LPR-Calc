// 还款冲抵计算器：多笔还款按时间顺序滚动冲抵，超法定利率部分折抵本金
// 冲抵利率沿用当前计息设置（起始月LPR/截止月LPR/分段LPR/平均LPR/自定义利率），
// 分段利率下每笔还款前的欠息期间按适用LPR分段精确计算。

import { useState, useCallback } from 'react';
import type {
  CalculationParams,
  OffsetParams,
  OffsetResult,
  OffsetRow,
  FinalSegment,
} from '@/types/calculator';
import type { LPRData } from '@/data/lprData';
import { getAverageLPR } from '@/data/lprData';

const DAY_MS = 24 * 60 * 60 * 1000;

// 归一化到当日 0 点
function norm(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 两个日期之间的天数：遵循所选天数算法
// 冲抵区间天数：区间为 [起, 止)，即含起息端、不含还款端（还款日计入下一段）。
function offsetDays(from: string, toExclusive: string): number {
  return Math.max(0, Math.round((norm(new Date(toExclusive)).getTime() - norm(new Date(from)).getTime()) / DAY_MS));
}

// 格式化金额
function fmt(n: number): string {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 格式化日期
function fmtDate(s: string): string {
  const [y, m, d] = s.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

// 计算某区间的利息（精确到段），段间天数口径与主计算器完全一致。
// 段定义为闭区间 [segStart, segEnd]，天数 = segEnd - segStart + 1（两头都算）或 segEnd - segStart（算头不算尾）。
function interestForRange(
  from: string,
  toExclusive: string,
  principal: number,
  rateDates: RateDate[],
  params: CalculationParams
): { interest: number; segments: RateDate[] } {
  const { dayAlgorithm, dayBase } = params;
  const segs = clip(rateDates, from, toExclusive, dayAlgorithm);
  let total = 0;
  for (const s of segs) {
    total += (principal * s.rate * s.days!) / (dayBase * 100);
  }
  return { interest: total, segments: segs };
}

// 把利率日历裁剪到 [from, toExclusive) 区间。
// 段间边界（LPR调整日）：前一段含末端（闭合），后一段从调整日次日开始（避免重复计息）。
function clip(
  rateDates: RateDate[],
  from: string,
  toExclusive: string,
  dayAlgorithm: 'headNotTail' | 'bothEnds'
): RateDate[] {
  const out: RateDate[] = [];
  for (let i = 0; i < rateDates.length; i++) {
    const rd = rateDates[i];
    const rawStart = rd.date > from ? rd.date : from;
    // 前段末端 = 下一段起始日 - 1（含端点）；最后一段末端 = toExclusive - 1（不含还款端）
    const nextRd = rateDates[i + 1];
    const rawEnd = nextRd && nextRd.date < toExclusive
      ? addDays(nextRd.date, -1)
      : addDays(toExclusive, -1);

    // 含端点（闭合），故 segStart <= segEnd 才有效
    if (rawStart > rawEnd) continue;

    // 段间无缝拼接：前一段含末端（rawEnd，即下段LPR发布日），后一段从该日次日起，
    // 避免边界日重复计息。首段（i=0）已从 cursor 起算，不再后移。
    let segStart = rawStart;
    if (i > 0) segStart = addDays(rawStart, 1);
    if (segStart > rawEnd) continue;

    // 段天数 = segEnd - segStart + 1（两头都算）或 segEnd - segStart（算头不算尾）
    const days = dayAlgorithm === 'bothEnds'
      ? Math.round((norm(new Date(rawEnd)).getTime() - norm(new Date(segStart)).getTime()) / DAY_MS) + 1
      : Math.round((norm(new Date(rawEnd)).getTime() - norm(new Date(segStart)).getTime()) / DAY_MS);

    out.push({
      rate: rd.rate,
      date: segStart,
      endDate: rawEnd,
      days,
      lprDate: rd.lprDate,
    });
  }
  return out;
}

interface RateDate {
  rate: number;
  date: string;        // 本段适用起始日（含）
  endDate?: string;    // 本段适用结束日（含）
  days?: number;       // 本段天数（按天数算法）
  lprDate?: string;    // LPR发布日（用于展示）
}

// 根据当前计息设置，构建利率适用日历（RateDate 数组，按 LPR 实际调整点切分）。
// 冲抵引擎采用"逐笔无缝拼接"口径：总天数 = 还款间隔天数，各段利率取值与主计算器一致。
function buildRateCalendar(
  startDate: string,
  params: CalculationParams,
  lprData: LPRData[]
): RateDate[] {
  const { interestMethod, rateMode, rateMultiplier, customRate } = params;

  if (interestMethod === 'customRate') {
    return [{ rate: customRate, date: startDate }];
  }

  if (interestMethod === 'averageLPR') {
    const { averageRate } = getAverageLPR(
      startDate, params.endDate, rateMode, lprData, params.dayAlgorithm
    );
    return [{ rate: averageRate * rateMultiplier, date: startDate }];
  }

  if (interestMethod === 'startMonthLPR') {
    const entry = lprData.find(d => d.date <= startDate) || lprData[lprData.length - 1];
    return [{ rate: entry[rateMode] * rateMultiplier, date: startDate, lprDate: entry.date }];
  }

  if (interestMethod === 'endMonthLPR') {
    const entry = lprData.find(d => d.date <= params.endDate) || lprData[lprData.length - 1];
    return [{ rate: entry[rateMode] * rateMultiplier, date: startDate, lprDate: entry.date }];
  }

  // segmentLPR：按各 LPR 实际调整点（同利率的连续月份合并）切分。
  // 与主计算器分段利率取值一致，但冲抵按无缝拼接累计（避免主计算器分段模式下的边界日重复）。
  const sorted = [...lprData].sort((a, b) => (a.date < b.date ? -1 : 1));
  const startEntry = sorted.filter(d => d.date <= startDate).pop() || sorted[0];
  const calendar: RateDate[] = [{
    rate: startEntry[rateMode] * rateMultiplier,
    date: startDate,
    lprDate: startEntry.date,
  }];
  let lastRate = startEntry[rateMode];
  for (const item of sorted) {
    if (item.date <= startDate) continue;
    if (item[rateMode] !== lastRate) {
      calendar.push({ rate: item[rateMode] * rateMultiplier, date: item.date, lprDate: item.date });
      lastRate = item[rateMode];
    }
    // 同利率的连续月份不另起段
  }
  return calendar;
}

function addDays(dateStr: string, delta: number): string {
  const d = norm(new Date(dateStr));
  d.setDate(d.getDate() + delta);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * 冲抵计算主函数（纯函数）
 */
export function calculateOffset(
  baseParams: CalculationParams,
  offset: OffsetParams,
  lprData: LPRData[]
): OffsetResult {
  const { startDate, principal, dayAlgorithm, dayBase } = baseParams;

  // —— 校验 ——
  if (!startDate) throw new Error('冲抵计算需要有效的开始日期');
  if (!(principal > 0)) throw new Error('冲抵计算需要有效的计息金额');
  if (!offset.continueDate) throw new Error('请选择折抵后继续计息的截止日');
  if (new Date(offset.continueDate) < new Date(startDate)) {
    throw new Error('继续计息截止日不能早于开始日期');
  }

  const repayments = [...offset.repayments]
    .filter(r => r.date && r.amount > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  if (repayments.length === 0) {
    throw new Error('请至少添加一笔有效还款（填写日期和金额）');
  }

  // 还款日期不能早于起息日（等于起息日意味着当日付息，天数算法决定是否有当期利息）
  for (const r of repayments) {
    if (new Date(r.date) < new Date(startDate)) {
      throw new Error(`还款日期 ${r.date} 早于开始日期，请调整`);
    }
  }
  if (new Date(repayments[0].date) > new Date(offset.continueDate)) {
    throw new Error('首笔还款日期晚于继续计息截止日，请调整');
  }

  const rateCalendar = buildRateCalendar(startDate, baseParams, lprData);
  const process: string[] = [];
  process.push('=== 还款冲抵计算（超额利息折抵本金）===');
  process.push(`原始本金: ¥${fmt(principal)}`);
  process.push(`冲抵利率设置: ${methodName(baseParams.interestMethod)}`);
  process.push(`天数算法: ${dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算'}，天数基准: ${dayBase}天`);
  process.push(`继续计息截止日: ${fmtDate(offset.continueDate)}`);
  process.push('');

  const rows: OffsetRow[] = [];
  let currentPrincipal = principal;
  let carryover = 0; // 累计欠息
  let cursor = startDate; // 下次计息起点
  let totalPayments = 0;
  let totalInterestSettled = 0;
  let totalPrincipalOffset = 0;

  for (let i = 0; i < repayments.length; i++) {
    const rp = repayments[i];

    // 计息区间为 [cursor, rp.date)（含起息端，不含还款端）
    const rangeEndEx = rp.date;

    let interestAccrued = 0;
    let segments: RateDate[] = [];
    const periodDays = offsetDays(cursor, rangeEndEx);

    if (periodDays > 0) {
      const r = interestForRange(cursor, rangeEndEx, currentPrincipal, rateCalendar, baseParams);
      interestAccrued = r.interest;
      segments = r.segments;
    }

    const interestOpening = carryover;
    const totalDue = interestAccrued + interestOpening;

    const settled = Math.min(rp.amount, totalDue);
    let principalOffset = 0;
    let newCarryover = 0;
    if (rp.amount > totalDue) {
      principalOffset = rp.amount - totalDue;
      currentPrincipal = Math.max(0, currentPrincipal - principalOffset);
    } else {
      newCarryover = totalDue - rp.amount;
    }
    carryover = newCarryover;

    totalPayments += rp.amount;
    totalInterestSettled += settled;
    totalPrincipalOffset += principalOffset;

    const periodEndShow = addDays(rangeEndEx, -1); // 展示用含端截止日
    const period = `${fmtDate(cursor)} 至 ${fmtDate(periodEndShow)}`;
    const rateDesc = segments.length > 0
      ? segments.map(s => `${s.rate.toFixed(2)}%(${fmtDate(s.date)}~${fmtDate(s.endDate!)})`).join('，')
      : `${rateCalendar[0]?.rate.toFixed(2) ?? '—'}%`;

    const formula =
      `区间利息: ¥${fmt(currentPrincipal + principalOffset)} × ${rateDesc} × ${periodDays}天 ÷ ${dayBase}` +
      ` = ¥${fmt(interestAccrued)}；期初欠息 ¥${fmt(interestOpening)}，应付合计 ¥${fmt(totalDue)}` +
      (principalOffset > 0
        ? `；还款 ¥${fmt(rp.amount)} 全额付息后折抵本金 ¥${fmt(principalOffset)}`
        : newCarryover > 0
          ? `；还款 ¥${fmt(rp.amount)} 不足付息，期末欠息 ¥${fmt(newCarryover)}`
          : `；还款 ¥${fmt(rp.amount)} 恰好付清`);

    rows.push({
      period,
      startDate: cursor,
      endDate: periodEndShow,
      days: periodDays,
      rate: segments.length === 1 ? segments[0].rate : (rateCalendar[0]?.rate ?? 0),
      openingPrincipal: currentPrincipal + principalOffset,
      interestAccrued: Math.round(interestAccrued * 100) / 100,
      interestOpening: Math.round(interestOpening * 100) / 100,
      totalDue: Math.round(totalDue * 100) / 100,
      payment: rp.amount,
      interestSettled: Math.round(settled * 100) / 100,
      principalOffset: Math.round(principalOffset * 100) / 100,
      closingPrincipal: currentPrincipal,
      interestCarryover: Math.round(carryover * 100) / 100,
      lprDate: segments[0]?.lprDate,
      formula,
    });

    process.push(`【第 ${i + 1} 笔还款】${fmtDate(rp.date)} 还款 ¥${fmt(rp.amount)}`);
    process.push(`  计息区间: ${period}（${periodDays}天）`);
    if (segments.length > 0) {
      for (const s of segments) {
        process.push(
          `    分段: ${fmtDate(s.date)}~${fmtDate(s.endDate!)} ${s.rate.toFixed(2)}% × ${s.days}天 = ¥${fmt((currentPrincipal + principalOffset) * s.rate * s.days! / (dayBase * 100))}`
        );
      }
    }
    process.push(`  区间利息: ¥${fmt(interestAccrued)}，期初欠息: ¥${fmt(interestOpening)}，应付合计: ¥${fmt(totalDue)}`);
    if (principalOffset > 0) {
      process.push(`  折抵本金: ¥${fmt(principalOffset)}，期末剩余本金: ¥${fmt(currentPrincipal)}`);
    }
    if (carryover > 0) {
      process.push(`  期末累计欠息: ¥${fmt(carryover)}`);
    }
    process.push('');

    // 下一区间从还款日开始
    cursor = rp.date;
  }

  // —— 最后一段：从最后一笔还款日（含）继续计息到截止日 ——
  const lastRp = repayments[repayments.length - 1];
  const finalStart = lastRp.date;
  const finalEnd = offset.continueDate;
  const finalDays = offsetDays(finalStart, finalEnd);

  let finalInterest = 0;
  let finalSegs: RateDate[] = [];
  if (finalDays > 0) {
    const r = interestForRange(finalStart, finalEnd, currentPrincipal, rateCalendar, baseParams);
    finalInterest = r.interest;
    finalSegs = r.segments;
  }

  const finalSegment: FinalSegment = {
    period: `${fmtDate(finalStart)} 至 ${fmtDate(finalEnd)}`,
    startDate: finalStart,
    endDate: finalEnd,
    days: finalDays,
    rate: finalSegs.length === 1 ? finalSegs[0].rate : (rateCalendar[0]?.rate ?? 0),
    principal: currentPrincipal,
    interest: Math.round(finalInterest * 100) / 100,
    lprDate: finalSegs[0]?.lprDate,
    formula:
      finalDays > 0
        ? `¥${fmt(currentPrincipal)} × ${finalSegs.map(s => s.rate.toFixed(2) + '%').join('/')} × ${finalDays}天 ÷ ${dayBase} = ¥${fmt(finalInterest)}`
        : '截止日不晚于最后还款日，无后续利息',
  };

  process.push('【最终继续计息段】');
  process.push(`  期间: ${finalSegment.period}（${finalDays}天）`);
  process.push(`  计算: ${finalSegment.formula}`);
  process.push('');
  process.push('=== 汇总 ===');
  process.push(`折抵后剩余本金: ¥${fmt(currentPrincipal)}`);
  process.push(`累计冲抵利息: ¥${fmt(totalInterestSettled)}`);
  process.push(`累计折抵本金: ¥${fmt(totalPrincipalOffset)}`);
  process.push(`剩余欠付利息: ¥${fmt(carryover)}`);
  process.push(`截止日后续利息: ¥${fmt(finalInterest)}`);
  process.push(`诉请总额: ¥${fmt(currentPrincipal + carryover + finalInterest)}`);

  return {
    initialPrincipal: principal,
    finalPrincipal: Math.round(currentPrincipal * 100) / 100,
    totalPayments: Math.round(totalPayments * 100) / 100,
    totalInterestSettled: Math.round(totalInterestSettled * 100) / 100,
    totalPrincipalOffset: Math.round(totalPrincipalOffset * 100) / 100,
    interestCarryover: Math.round(carryover * 100) / 100,
    finalInterest: Math.round(finalInterest * 100) / 100,
    totalClaim: Math.round((currentPrincipal + carryover + finalInterest) * 100) / 100,
    rows,
    finalSegment,
    process,
  };
}

function methodName(m: CalculationParams['interestMethod']): string {
  switch (m) {
    case 'segmentLPR': return '分段LPR';
    case 'averageLPR': return '平均LPR';
    case 'startMonthLPR': return '起始月LPR';
    case 'endMonthLPR': return '截止月LPR';
    case 'customRate': return `自定义利率`;
  }
}

// React Hook
export function useOffsetCalculator(lprData: LPRData[]) {
  const [offsetParams, setOffsetParams] = useState<OffsetParams>({
    enabled: false,
    repayments: [{ id: '1', date: '', amount: 0 }],
    continueDate: '',
  });
  const [offsetResult, setOffsetResult] = useState<OffsetResult | null>(null);
  const [offsetError, setOffsetError] = useState<string | null>(null);

  const updateOffset = useCallback(<K extends keyof OffsetParams>(key: K, value: OffsetParams[K]) => {
    setOffsetParams(prev => ({ ...prev, [key]: value }));
    setOffsetError(null);
  }, []);

  const addRepayment = useCallback(() => {
    setOffsetParams(prev => ({
      ...prev,
      repayments: [
        ...prev.repayments,
        { id: String(Date.now()), date: '', amount: 0 },
      ],
    }));
  }, []);

  const updateRepayment = useCallback((id: string, patch: Partial<OffsetParams['repayments'][0]>) => {
    setOffsetParams(prev => ({
      ...prev,
      repayments: prev.repayments.map(r => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }, []);

  const removeRepayment = useCallback((id: string) => {
    setOffsetParams(prev => ({
      ...prev,
      repayments: prev.repayments.filter(r => r.id !== id),
    }));
  }, []);

  const runOffset = useCallback((baseParams: CalculationParams): OffsetResult | null => {
    try {
      if (!baseParams.startDate) throw new Error('冲抵计算需要先选择开始日期');
      if (baseParams.principal <= 0) throw new Error('冲抵计算需要先输入有效的计息金额');
      const r = calculateOffset(baseParams, offsetParams, lprData);
      setOffsetResult(r);
      setOffsetError(null);
      return r;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '冲抵计算失败';
      setOffsetError(msg);
      setOffsetResult(null);
      return null;
    }
  }, [offsetParams, lprData]);

  const resetOffset = useCallback(() => {
    setOffsetParams({
      enabled: false,
      repayments: [{ id: '1', date: '', amount: 0 }],
      continueDate: '',
    });
    setOffsetResult(null);
    setOffsetError(null);
  }, []);

  return {
    offsetParams,
    offsetResult,
    offsetError,
    updateOffset,
    addRepayment,
    updateRepayment,
    removeRepayment,
    runOffset,
    resetOffset,
  };
}
