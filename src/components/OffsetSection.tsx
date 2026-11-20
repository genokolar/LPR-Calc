import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/DatePicker';
import type { OffsetParams, OffsetResult } from '@/types/calculator';

interface OffsetSectionProps {
  repayments: OffsetParams['repayments'];
  continueDate: string;
  baseStartDate: string;
  onAddRepayment: () => void;
  onUpdateRepayment: (id: string, patch: { date?: string; amount?: number }) => void;
  onRemoveRepayment: (id: string) => void;
  onContinueDateChange: (date: string) => void;
}

// 还款冲抵模式的输入区：还款明细 + 继续计息截止日
// （作为独立模式渲染，无勾选开关）
export function OffsetSection({
  repayments,
  continueDate,
  baseStartDate,
  onAddRepayment,
  onUpdateRepayment,
  onRemoveRepayment,
  onContinueDateChange,
}: OffsetSectionProps) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-amber-900">还款明细</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onAddRepayment}
          className="h-7 gap-1 text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          添加还款
        </Button>
      </div>
      <p className="text-xs text-amber-700 leading-relaxed">
        按时间顺序逐笔冲抵：每笔还款先冲抵当期利息及累计欠息，超出部分折抵本金；
        不足部分累计为欠息。最后按折抵后剩余本金继续计息到截止日。
      </p>

      {/* 还款明细列表 */}
      <div className="space-y-2">
        {repayments.map((rp, idx) => (
          <div key={rp.id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-gray-400 shrink-0">{idx + 1}.</span>
            <div className="flex-1">
              <DatePicker
                value={rp.date}
                onChange={(d) => onUpdateRepayment(rp.id, { date: d })}
                placeholder="还款日期"
                minDate={baseStartDate || undefined}
              />
            </div>
            <div className="relative flex-1">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={rp.amount || ''}
                onChange={(e) =>
                  onUpdateRepayment(rp.id, { amount: parseFloat(e.target.value) || 0 })
                }
                placeholder="还款金额"
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">元</span>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onRemoveRepayment(rp.id)}
              disabled={repayments.length === 1}
              className="h-8 w-8 shrink-0 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* 继续计息截止日 */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-gray-600 w-28 shrink-0">继续计息至</Label>
        <div className="flex-1">
          <DatePicker
            value={continueDate}
            onChange={onContinueDateChange}
            placeholder="选择截止日（如起诉日）"
            minDate={baseStartDate || undefined}
          />
        </div>
      </div>
    </div>
  );
}

// ============ 结果展示 ============

interface OffsetResultProps {
  result: OffsetResult;
}

export function OffsetResultPanel({ result }: OffsetResultProps) {
  const fmt = (n: number) =>
    n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SummaryItem label="折抵后剩余本金" value={result.finalPrincipal} highlight />
        <SummaryItem label="剩余欠付利息" value={result.interestCarryover} warn={result.interestCarryover > 0} />
        <SummaryItem label="截止日后续利息" value={result.finalInterest} />
        <SummaryItem label="累计冲抵利息" value={result.totalInterestSettled} />
        <SummaryItem label="累计折抵本金" value={result.totalPrincipalOffset} warn={result.totalPrincipalOffset > 0} />
        <SummaryItem label="还款总额" value={result.totalPayments} />
      </div>

      {/* 冲抵明细表 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-2">还款冲抵明细</h4>
        <div className="overflow-x-auto border rounded-lg bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="p-2 text-left font-medium">期间</th>
                <th className="p-2 text-center font-medium">天数</th>
                <th className="p-2 text-right font-medium">期初本金</th>
                <th className="p-2 text-right font-medium">区间利息</th>
                <th className="p-2 text-right font-medium">期初欠息</th>
                <th className="p-2 text-right font-medium">应付合计</th>
                <th className="p-2 text-right font-medium">还款</th>
                <th className="p-2 text-right font-medium">冲本</th>
                <th className="p-2 text-right font-medium">期末本金</th>
                <th className="p-2 text-right font-medium">期末欠息</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="p-2">
                    <div className="max-w-[170px] truncate" title={row.period}>{row.period}</div>
                    {row.lprDate && (
                      <div className="text-[10px] text-gray-400">LPR:{row.lprDate}</div>
                    )}
                  </td>
                  <td className="p-2 text-center">{row.days}</td>
                  <td className="p-2 text-right">{fmt(row.openingPrincipal)}</td>
                  <td className="p-2 text-right">{fmt(row.interestAccrued)}</td>
                  <td className="p-2 text-right">{row.interestOpening > 0 ? fmt(row.interestOpening) : '-'}</td>
                  <td className="p-2 text-right font-medium">{fmt(row.totalDue)}</td>
                  <td className="p-2 text-right">{fmt(row.payment)}</td>
                  <td className={`p-2 text-right ${row.principalOffset > 0 ? 'font-medium text-amber-700' : ''}`}>
                    {row.principalOffset > 0 ? fmt(row.principalOffset) : '-'}
                  </td>
                  <td className="p-2 text-right font-medium">{fmt(row.closingPrincipal)}</td>
                  <td className={`p-2 text-right ${row.interestCarryover > 0 ? 'text-red-600' : ''}`}>
                    {row.interestCarryover > 0 ? fmt(row.interestCarryover) : '-'}
                  </td>
                </tr>
              ))}
              {/* 最终段 */}
              <tr className="border-t bg-green-50/60">
                <td className="p-2">
                  <div className="max-w-[170px] truncate" title={result.finalSegment.period}>
                    {result.finalSegment.period}（后续）
                  </div>
                  {result.finalSegment.lprDate && (
                    <div className="text-[10px] text-gray-400">LPR:{result.finalSegment.lprDate}</div>
                  )}
                </td>
                <td className="p-2 text-center">{result.finalSegment.days}</td>
                <td className="p-2 text-right">{fmt(result.finalSegment.principal)}</td>
                <td className="p-2 text-right font-medium text-green-700">{fmt(result.finalSegment.interest)}</td>
                <td className="p-2 text-center text-gray-400" colSpan={6}>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 计算过程 */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">详细计算过程</h4>
        <div className="space-y-1 text-xs font-mono text-gray-600 whitespace-pre-wrap max-h-80 overflow-y-auto">
          {result.process.map((line, index) => (
            <div key={index} className={line.startsWith('===') ? 'font-bold text-gray-800 mt-2' : ''}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryItem({
  label, value, highlight, warn,
}: { label: string; value: number; highlight?: boolean; warn?: boolean }) {
  const fmt = (n: number) =>
    n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div
      className={`rounded-lg p-2 text-center ${
        highlight ? 'bg-green-100' : warn ? 'bg-amber-100' : 'bg-white'
      }`}
    >
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-green-700' : warn ? 'text-amber-700' : 'text-gray-800'}`}>
        ¥{fmt(value)}
      </p>
    </div>
  );
}
