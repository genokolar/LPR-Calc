import { useState } from 'react';
import { Calculator, RotateCcw, Download, Info, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/DatePicker';
import { LPRHistoryDialog } from '@/components/LPRHistoryDialog';
import { LPRManager } from '@/components/LPRManager';
import { useCalculator } from '@/hooks/useCalculator';
import { useLPRData } from '@/hooks/useLPRData';
import { format } from 'date-fns';
import { toast } from 'sonner';

function App() {
  const { 
    lprData, 
    getLatestLPR, 
    getEarliestLPRDate,
    isStale 
  } = useLPRData();
  
  const { 
    params, 
    result, 
    error, 
    updateParam, 
    calculate, 
    reset 
  } = useCalculator(lprData);
  
  const [showHistory, setShowHistory] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const latestLPR = getLatestLPR();
  const earliestDate = getEarliestLPRDate();

  // 导出计算结果为CSV
  const exportToCSV = () => {
    if (!result) return;

    const headers = ['计息期间', '天数', '适用利率(%)', '本金(元)', '利息(元)', '计算公式'];
    const rows = result.details.map(d => [
      d.period,
      d.days,
      d.rate.toFixed(4),
      d.principal.toFixed(2),
      d.interest.toFixed(2),
      d.formula
    ]);
    
    let lprRows: string[][] = [];
    if (result.lprSegments && result.lprSegments.length > 0) {
      lprRows = [
        [''],
        ['LPR分段明细'],
        ['期间', '天数', 'LPR利率(%)', '应用利率(%)', ''],
        ...result.lprSegments.map(s => [
          s.period,
          s.days.toString(),
          s.lprRate.toFixed(2),
          s.appliedRate.toFixed(2),
          ''
        ])
      ];
    }
    
    const summaryRows = [
      [''],
      ['合计', result.totalDays.toString(), '', '', result.totalInterest.toFixed(2), ''],
      [''],
      ['计算参数'],
      ['开始日期', params.startDate, '', '', '', ''],
      ['截止日期', params.endDate, '', '', '', ''],
      ['计息金额', params.principal.toString(), '', '', '', ''],
      ['利率模式', params.rateMode === 'oneYear' ? '一年期LPR' : '五年期LPR', '', '', '', ''],
      ['利率倍数', params.rateMultiplier.toString(), '', '', '', ''],
      ['天数算法', params.dayAlgorithm === 'headNotTail' ? '算头不算尾' : '两头都算', '', '', '', ''],
      ['天数基准', params.dayBase.toString(), '', '', '', ''],
      ['计息方式', params.interestMethod, '', '', '', '']
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
      ...lprRows.map(r => r.join(',')),
      ...summaryRows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LPR利息计算结果_${params.startDate}_${params.endDate}.csv`;
    link.click();
    
    toast.success('计算结果已导出');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* 标题区域 */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">LPR利息计算器</h1>
          </div>
          <p className="text-gray-600">
            法律LPR司法利息计算器，基于每月LPR利率分段计算、明细一键下载、司法认可
          </p>
          
          {/* 最新LPR信息 - 可点击查看历史 */}
          <button 
            onClick={() => setShowHistory(true)}
            className="mt-3 inline-flex items-center gap-4 text-sm bg-white px-4 py-2 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-blue-200"
          >
            <span className="text-gray-500">最新LPR（{latestLPR.date}）：</span>
            <span className="text-blue-600 font-medium">一年期 {latestLPR.oneYear}%</span>
            <span className="text-blue-600 font-medium">五年期 {latestLPR.fiveYear}%</span>
            <span className="text-xs text-blue-500 ml-1 underline">点击查看历史</span>
            {isStale && (
              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                待更新
              </Badge>
            )}
          </button>
          
          {/* 数据管理入口 */}
          <div className="mt-2">
            <button
              onClick={() => setShowManager(true)}
              className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1 mx-auto transition-colors"
            >
              <Database className="w-3 h-3" />
              LPR数据管理（{lprData.length}条记录）
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* 左侧输入区域 */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Info className="w-5 h-5" />
                输入信息
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* 日期选择 */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">开始日期</Label>
                  <DatePicker
                    value={params.startDate}
                    onChange={(date) => updateParam('startDate', date)}
                    placeholder="点击选择开始日期"
                    minDate={earliestDate}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700 font-medium">截止日期</Label>
                  <DatePicker
                    value={params.endDate}
                    onChange={(date) => updateParam('endDate', date)}
                    placeholder="点击选择截止日期"
                    minDate={earliestDate}
                    maxDate={format(new Date(), 'yyyy-MM-dd')}
                  />
                </div>
              </div>

              {/* 计息金额 */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">计息金额</Label>
                <div className="relative">
                  <Input
                    type="number"
                    placeholder="请输入计息金额"
                    value={params.principal || ''}
                    onChange={(e) => updateParam('principal', parseFloat(e.target.value) || 0)}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">元</span>
                </div>
              </div>

              <Separator />

              {/* 利率模式 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">利率模式</Label>
                <RadioGroup
                  value={params.rateMode}
                  onValueChange={(v) => updateParam('rateMode', v as 'oneYear' | 'fiveYear')}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="oneYear" id="oneYear" />
                    <Label htmlFor="oneYear" className="cursor-pointer">一年期LPR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="fiveYear" id="fiveYear" />
                    <Label htmlFor="fiveYear" className="cursor-pointer">五年期LPR</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 天数算法 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">天数算法</Label>
                <RadioGroup
                  value={params.dayAlgorithm}
                  onValueChange={(v) => updateParam('dayAlgorithm', v as 'headNotTail' | 'bothEnds')}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="bothEnds" id="bothEnds" />
                    <Label htmlFor="bothEnds" className="cursor-pointer">两头都算</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="headNotTail" id="headNotTail" />
                    <Label htmlFor="headNotTail" className="cursor-pointer">算头不算尾</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 天数基准 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">天数基准</Label>
                <RadioGroup
                  value={params.dayBase.toString()}
                  onValueChange={(v) => updateParam('dayBase', parseInt(v) as 360 | 365)}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="365" id="base365" />
                    <Label htmlFor="base365" className="cursor-pointer">365天</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="360" id="base360" />
                    <Label htmlFor="base360" className="cursor-pointer">360天</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 计息方式 - 已删除民间借贷法定最高利率 */}
              <div className="space-y-3">
                <Label className="text-gray-700 font-medium">计息方式</Label>
                <RadioGroup
                  value={params.interestMethod}
                  onValueChange={(v) => updateParam('interestMethod', v as typeof params.interestMethod)}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="startMonthLPR" id="startMonthLPR" />
                    <Label htmlFor="startMonthLPR" className="cursor-pointer text-sm">起始月LPR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="endMonthLPR" id="endMonthLPR" />
                    <Label htmlFor="endMonthLPR" className="cursor-pointer text-sm">截止月LPR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="segmentLPR" id="segmentLPR" />
                    <Label htmlFor="segmentLPR" className="cursor-pointer text-sm">分段LPR</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="averageLPR" id="averageLPR" />
                    <Label htmlFor="averageLPR" className="cursor-pointer text-sm">平均LPR</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 利率倍数 */}
              <div className="space-y-2">
                <Label className="text-gray-700 font-medium">利率倍数</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateParam('rateMultiplier', Math.max(0.1, params.rateMultiplier - 0.1))}
                    className="h-10 w-10"
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    step="0.1"
                    value={params.rateMultiplier}
                    onChange={(e) => updateParam('rateMultiplier', parseFloat(e.target.value) || 1)}
                    className="w-24 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => updateParam('rateMultiplier', params.rateMultiplier + 0.1)}
                    className="h-10 w-10"
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={calculate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-lg"
                >
                  <Calculator className="w-5 h-5 mr-2" />
                  开始计算
                </Button>
                <Button
                  variant="outline"
                  onClick={reset}
                  className="h-12 px-6"
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  重置
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 右侧结果区域 */}
          <Card className="shadow-lg border-0">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white rounded-t-lg">
              <CardTitle className="text-lg">计算结果</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {result ? (
                <div className="space-y-6">
                  {/* 主要结果 */}
                  <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl">
                    <p className="text-gray-600 mb-2">应付利息总额</p>
                    <p className="text-4xl font-bold text-green-600">
                      ¥{result.totalInterest.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* 详细信息 */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600">计息天数</span>
                      <span className="font-medium">{result.totalDays} 天</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600">计息本金</span>
                      <span className="font-medium">
                        ¥{result.principal.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-gray-600">有效年利率</span>
                      <span className="font-medium">{result.effectiveRate.toFixed(4)}%</span>
                    </div>
                  </div>

                  {/* 结果标签页 */}
                  <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="details">计算明细</TabsTrigger>
                      <TabsTrigger value="process">计算过程</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="mt-4">
                      {/* 分段LPR或平均LPR的LPR明细表 */}
                      {result.lprSegments && result.lprSegments.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">
                            {params.interestMethod === 'segmentLPR' ? 'LPR分段明细' : 'LPR加权平均明细'}
                          </h4>
                          <div className="overflow-x-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-gray-50">
                                  <TableHead className="text-xs">期间</TableHead>
                                  <TableHead className="text-xs text-center">天数</TableHead>
                                  <TableHead className="text-xs text-center">LPR利率</TableHead>
                                  {params.interestMethod === 'segmentLPR' && (
                                    <TableHead className="text-xs text-center">应用利率</TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {result.lprSegments.map((segment, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="text-xs">
                                      <div className="max-w-[140px] truncate" title={segment.period}>
                                        {segment.period}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-center">{segment.days}</TableCell>
                                    <TableCell className="text-xs text-center">{segment.lprRate.toFixed(2)}%</TableCell>
                                    {params.interestMethod === 'segmentLPR' && (
                                      <TableCell className="text-xs text-center">{segment.appliedRate.toFixed(2)}%</TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          
                          {/* 平均LPR显示加权平均结果 */}
                          {params.interestMethod === 'averageLPR' && result.details.length > 0 && (
                            <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                              <span className="text-gray-600">加权平均LPR: </span>
                              <span className="font-medium text-blue-700">
                                {(result.details[0].rate / params.rateMultiplier).toFixed(4)}%
                              </span>
                              <span className="text-gray-500 mx-2">×</span>
                              <span className="font-medium">{params.rateMultiplier}</span>
                              <span className="text-gray-500 mx-2">=</span>
                              <span className="font-medium text-blue-700">{result.details[0].rate.toFixed(4)}%</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 利息计算明细 */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2">利息计算明细</h4>
                        <div className="overflow-x-auto border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-gray-50">
                                <TableHead className="text-xs">期间</TableHead>
                                <TableHead className="text-xs text-center">天数</TableHead>
                                <TableHead className="text-xs text-center">利率</TableHead>
                                <TableHead className="text-xs text-right">利息</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {result.details.map((detail, index) => (
                                <TableRow key={index}>
                                  <TableCell className="text-xs">
                                    <div className="max-w-[140px] truncate" title={detail.period}>
                                      {detail.period}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-center">{detail.days}</TableCell>
                                  <TableCell className="text-xs text-center">{detail.rate.toFixed(4)}%</TableCell>
                                  <TableCell className="text-xs text-right font-medium">
                                    ¥{detail.interest.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="process" className="mt-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-3">详细计算过程</h4>
                        <div className="space-y-1 text-xs font-mono text-gray-600 whitespace-pre-wrap max-h-80 overflow-y-auto">
                          {result.calculationProcess.map((line, index) => (
                            <div key={index} className={line.startsWith('===') ? 'font-bold text-gray-800 mt-2' : ''}>
                              {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  {/* 导出按钮 */}
                  <Button
                    variant="outline"
                    onClick={exportToCSV}
                    className="w-full"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出计算结果
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Calculator className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>请输入计算参数后点击"开始计算"</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 底部说明 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>数据来源于全国银行间同业拆借中心，本计算器结果仅供参考</p>
          <p className="mt-1">LPR数据范围：{earliestDate} 至 {latestLPR.date}</p>
          <p className="mt-1 text-xs">
            提示：可通过"LPR数据管理"功能手动更新最新利率数据
          </p>
        </div>
      </div>

      {/* LPR历史数据弹窗 */}
      <LPRHistoryDialog
        open={showHistory}
        onClose={() => setShowHistory(false)}
        lprData={lprData}
        onManage={() => {
          setShowHistory(false);
          setShowManager(true);
        }}
      />

      {/* LPR数据管理弹窗 */}
      <LPRManager
        open={showManager}
        onClose={() => setShowManager(false)}
      />
    </div>
  );
}

export default App;
