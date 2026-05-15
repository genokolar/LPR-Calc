import { X, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { LPRData } from '@/data/lprData';

interface LPRHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  lprData: LPRData[];
  onManage: () => void;
}

export function LPRHistoryDialog({ open, onClose, lprData, onManage }: LPRHistoryDialogProps) {
  if (!open) return null;

  // 计算变化趋势
  const getChangeIcon = (current: number, previous: number | null) => {
    if (previous === null) return <Minus className="w-3 h-3 text-gray-400" />;
    if (current < previous) return <TrendingDown className="w-3 h-3 text-green-500" />;
    if (current > previous) return <TrendingUp className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const getChangeText = (current: number, previous: number | null) => {
    if (previous === null) return '-';
    const diff = current - previous;
    if (diff === 0) return '持平';
    return diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">LPR历史数据</h2>
            <p className="text-xs text-gray-500 mt-0.5">共 {lprData.length} 条记录</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onManage}
              className="text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
            >
              管理数据
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 最新LPR摘要 */}
        {lprData.length > 0 && (
          <div className="p-4 bg-blue-50 border-b">
            <p className="text-xs text-gray-500 mb-2">最新LPR（{lprData[0].date}）</p>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold text-blue-700">{lprData[0].oneYear.toFixed(2)}%</span>
                <span className="text-xs text-gray-500 ml-2">一年期</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-700">{lprData[0].fiveYear.toFixed(2)}%</span>
                <span className="text-xs text-gray-500 ml-2">五年期</span>
              </div>
            </div>
          </div>
        )}

        {/* 数据列表 */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 py-2 px-4">日期</th>
                <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">一年期LPR</th>
                <th className="text-center text-xs font-medium text-gray-500 py-2 px-2">变化</th>
                <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">五年期LPR</th>
                <th className="text-center text-xs font-medium text-gray-500 py-2 px-2">变化</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lprData.map((item, index) => {
                const prevItem = index < lprData.length - 1 ? lprData[index + 1] : null;
                
                return (
                  <tr key={item.date} className={index === 0 ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
                    <td className="py-2 px-4 text-sm font-medium">{item.date}</td>
                    <td className="py-2 px-4 text-sm text-right">{item.oneYear.toFixed(2)}%</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        {getChangeIcon(item.oneYear, prevItem?.oneYear ?? null)}
                        <span className={`text-xs ${
                          prevItem && item.oneYear !== prevItem.oneYear 
                            ? item.oneYear < prevItem.oneYear ? 'text-green-600' : 'text-red-600'
                            : 'text-gray-400'
                        }`}>
                          {getChangeText(item.oneYear, prevItem?.oneYear ?? null)}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-4 text-sm text-right">{item.fiveYear.toFixed(2)}%</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center justify-center gap-1">
                        {getChangeIcon(item.fiveYear, prevItem?.fiveYear ?? null)}
                        <span className={`text-xs ${
                          prevItem && item.fiveYear !== prevItem.fiveYear
                            ? item.fiveYear < prevItem.fiveYear ? 'text-green-600' : 'text-red-600'
                        : 'text-gray-400'
                        }`}>
                          {getChangeText(item.fiveYear, prevItem?.fiveYear ?? null)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 底部 */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 rounded-b-xl">
          数据来源：全国银行间同业拆借中心 | 绿色表示下降，红色表示上升
        </div>
      </div>
    </div>
  );
}
