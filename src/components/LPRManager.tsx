import { useState, useRef } from 'react';
import { 
  X, Plus, Trash2, Edit2, Download, Upload, RefreshCw, 
  AlertTriangle, Check, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import type { LPRData } from '@/data/lprData';
import { useLPRData } from '@/hooks/useLPRData';
import { toast } from 'sonner';

interface LPRManagerProps {
  open: boolean;
  onClose: () => void;
}

export function LPRManager({ open, onClose }: LPRManagerProps) {
  const { 
    lprData, 
    isChecking,
    lastCheckResult,
    addLPR, 
    updateLPR, 
    deleteLPR, 
    exportToCSV, 
    importFromCSV,
    resetToDefault,
    checkUpdate,
    forceRefresh,
    isStale 
  } = useLPRData();
  
  const [editMode, setEditMode] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editOneYear, setEditOneYear] = useState('');
  const [editFiveYear, setEditFiveYear] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const startEdit = (item: LPRData) => {
    setEditMode(true);
    setEditDate(item.date);
    setEditOneYear(item.oneYear.toString());
    setEditFiveYear(item.fiveYear.toString());
  };

  const startAdd = () => {
    setEditMode(true);
    setEditDate('');
    setEditOneYear('');
    setEditFiveYear('');
  };

  const handleSave = () => {
    if (!editDate || !editOneYear || !editFiveYear) {
      toast.error('请填写完整信息');
      return;
    }
    
    const oneYear = parseFloat(editOneYear);
    const fiveYear = parseFloat(editFiveYear);
    
    if (isNaN(oneYear) || isNaN(fiveYear)) {
      toast.error('利率必须是数字');
      return;
    }
    
    const exists = lprData.some(d => d.date === editDate);
    
    if (exists) {
      updateLPR(editDate, oneYear, fiveYear);
      toast.success('更新成功');
    } else {
      addLPR(editDate, oneYear, fiveYear);
      toast.success('添加成功');
    }
    
    setEditMode(false);
    setEditDate('');
    setEditOneYear('');
    setEditFiveYear('');
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditDate('');
    setEditOneYear('');
    setEditFiveYear('');
  };

  const handleDelete = (date: string) => {
    deleteLPR(date);
    setShowDeleteConfirm(null);
    toast.success('删除成功');
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const count = importFromCSV(content);
        if (count > 0) {
          toast.success(`成功导入 ${count} 条记录`);
        } else {
          toast.error('未能导入任何记录，请检查文件格式');
        }
      }
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    resetToDefault();
    setShowResetConfirm(false);
    toast.success('已重置为默认数据');
  };

  const handleCheckUpdate = async () => {
    toast.promise(checkUpdate(), {
      loading: '正在检查更新...',
      success: (updated) => updated ? '发现新数据并已更新' : '当前已是最新数据',
      error: '检查失败，请稍后重试',
    });
  };

  const handleForceRefresh = async () => {
    toast.promise(forceRefresh(), {
      loading: '正在获取最新数据...',
      success: (updated) => updated ? '获取成功' : '获取失败',
      error: '获取失败，请稍后重试',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">LPR数据管理</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              共 {lprData.length} 条记录
              {isStale && (
                <span className="text-amber-600 ml-2 flex items-center gap-1 inline-flex">
                  <AlertTriangle className="w-3 h-3" />
                  数据超过30天未手动更新
                </span>
              )}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 在线获取区域 */}
        <div className="p-4 border-b bg-blue-50">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">在线获取最新LPR</span>
          </div>
          <p className="text-xs text-blue-700 mb-3">
            从中国货币网(chinamoney.com.cn)自动获取最新LPR数据
          </p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              onClick={handleCheckUpdate}
              disabled={isChecking}
              className="gap-1 bg-blue-600 hover:bg-blue-700"
            >
              {isChecking ? <Spinner className="w-3 h-3" /> : <RefreshCw className="w-3.5 h-3.5" />}
              检查更新
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleForceRefresh}
              disabled={isChecking}
              className="gap-1"
            >
              <Globe className="w-3.5 h-3.5" />
              强制获取
            </Button>
          </div>
          
          {/* 检查结果 */}
          {lastCheckResult && (
            <div className={`mt-2 p-2 rounded text-xs ${
              lastCheckResult.updated 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-600'
            }`}>
              {lastCheckResult.updated ? '✓ ' : '• '}
              {lastCheckResult.message}
            </div>
          )}
        </div>

        {/* 操作栏 */}
        <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
          <Button size="sm" onClick={startAdd} className="gap-1">
            <Plus className="w-4 h-4" />
            新增
          </Button>
          <Button size="sm" variant="outline" onClick={exportToCSV} className="gap-1">
            <Download className="w-4 h-4" />
            导出
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => fileInputRef.current?.click()} 
            className="gap-1"
          >
            <Upload className="w-4 h-4" />
            导入
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setShowResetConfirm(true)}
            className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <RefreshCw className="w-4 h-4" />
            重置
          </Button>
        </div>

        {/* 编辑表单 */}
        {editMode && (
          <div className="p-4 border-b bg-amber-50">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs mb-1 block">日期</Label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">一年期LPR (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editOneYear}
                  onChange={(e) => setEditOneYear(e.target.value)}
                  placeholder="3.00"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">五年期LPR (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editFiveYear}
                  onChange={(e) => setEditFiveYear(e.target.value)}
                  placeholder="3.50"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                <Check className="w-3 h-3 mr-1" />
                保存
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} className="h-7 text-xs">
                取消
              </Button>
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
                <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">五年期LPR</th>
                <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lprData.map((item) => (
                <tr key={item.date} className="hover:bg-gray-50">
                  <td className="py-2 px-4 text-sm font-medium">{item.date}</td>
                  <td className="py-2 px-4 text-sm text-right">{item.oneYear.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-sm text-right">{item.fiveYear.toFixed(2)}%</td>
                  <td className="py-2 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 hover:bg-blue-100 rounded transition-colors"
                        title="编辑"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                      </button>
                      {showDeleteConfirm === item.date ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDelete(item.date)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="确认删除"
                          >
                            <Check className="w-3.5 h-3.5 text-red-600" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(null)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="取消"
                          >
                            <X className="w-3.5 h-3.5 text-gray-500" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(item.date)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 底部提示 */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500 rounded-b-xl">
          数据存储在浏览器本地，更换浏览器或清除缓存后数据将丢失。建议定期导出备份。
          <br />
          每月20日（遇节假日顺延）9:00后公布新一期LPR，可点击"检查更新"获取。
        </div>
      </div>

      {/* 重置确认弹窗 */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">确认重置</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              此操作将删除所有自定义数据，恢复到默认的LPR历史数据。此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowResetConfirm(false)}
              >
                取消
              </Button>
              <Button 
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleReset}
              >
                确认重置
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
