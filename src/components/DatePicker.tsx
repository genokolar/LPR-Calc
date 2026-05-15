import { useState, useEffect } from 'react';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, getYear, getMonth, setYear, setMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, isAfter } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: (date: Date) => boolean;
  minDate?: string;
  maxDate?: string;
}

// 中文月份
const MONTHS = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

// 中文星期
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function DatePicker({ 
  value, 
  onChange, 
  placeholder = '选择日期',
  disabled,
  minDate,
  maxDate
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(value ? new Date(value) : new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value ? new Date(value) : undefined);

  // 当value变化时更新selectedDate
  useEffect(() => {
    if (value) {
      const date = new Date(value);
      setSelectedDate(date);
      setViewDate(date);
    } else {
      setSelectedDate(undefined);
    }
  }, [value]);

  const currentYear = getYear(viewDate);
  const currentMonth = getMonth(viewDate);

  // 生成年份选项（从2019到当前年份+1）
  const currentYearNum = getYear(new Date());
  const yearOptions = Array.from({ length: currentYearNum - 2018 + 2 }, (_, i) => 2019 + i);

  // 生成月份选项
  const monthOptions = Array.from({ length: 12 }, (_, i) => i);

  // 获取当前月份的所有日期
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // 获取第一天是星期几，用于填充前面的空白
  const firstDayOfWeek = monthStart.getDay();

  // 检查日期是否被禁用
  const isDateDisabled = (date: Date): boolean => {
    if (minDate && isBefore(date, new Date(minDate))) return true;
    if (maxDate && isAfter(date, new Date(maxDate))) return true;
    if (disabled) return disabled(date);
    return false;
  };

  // 选择日期
  const handleSelectDate = (date: Date) => {
    if (isDateDisabled(date)) return;
    
    setSelectedDate(date);
    onChange(format(date, 'yyyy-MM-dd'));
    setOpen(false);
  };

  // 切换到上一年
  const handlePrevYear = () => {
    setViewDate(setYear(viewDate, currentYear - 1));
  };

  // 切换到下一年
  const handleNextYear = () => {
    setViewDate(setYear(viewDate, currentYear + 1));
  };

  // 切换到上个月
  const handlePrevMonth = () => {
    const newDate = new Date(viewDate);
    newDate.setMonth(currentMonth - 1);
    setViewDate(newDate);
  };

  // 切换到下个月
  const handleNextMonth = () => {
    const newDate = new Date(viewDate);
    newDate.setMonth(currentMonth + 1);
    setViewDate(newDate);
  };

  // 处理年份选择
  const handleYearChange = (year: number) => {
    setViewDate(setYear(viewDate, year));
  };

  // 处理月份选择
  const handleMonthChange = (month: number) => {
    setViewDate(setMonth(viewDate, month));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(new Date(value), "yyyy年MM月dd日", { locale: zhCN })
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3">
          {/* 头部：年份和月份选择 */}
          <div className="flex items-center justify-between mb-4">
            {/* 年份选择 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevYear}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <select
                value={currentYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="h-7 px-2 text-sm font-medium bg-transparent border rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {yearOptions.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextYear}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* 月份选择 */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <select
                value={currentMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="h-7 px-2 text-sm font-medium bg-transparent border rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {monthOptions.map(month => (
                  <option key={month} value={month}>{MONTHS[month]}</option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 星期标题 */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map(day => (
              <div 
                key={day} 
                className="text-center text-xs font-medium text-gray-500 py-1"
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 空白填充 */}
            {Array.from({ length: firstDayOfWeek }, (_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            
            {/* 日期 */}
            {daysInMonth.map(date => {
              const isSelected = selectedDate && isSameDay(date, selectedDate);
              const isCurrentMonth = isSameMonth(date, viewDate);
              const isTodayDate = isToday(date);
              const isDisabled = isDateDisabled(date);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleSelectDate(date)}
                  disabled={isDisabled}
                  className={cn(
                    "h-8 w-8 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isSelected && "bg-blue-600 text-white hover:bg-blue-700",
                    !isSelected && isTodayDate && "bg-blue-50 text-blue-600 border border-blue-300",
                    !isSelected && !isTodayDate && "text-gray-700",
                    isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
                    !isCurrentMonth && "text-gray-400"
                  )}
                >
                  {format(date, 'd')}
                </button>
              );
            })}
          </div>

          {/* 底部快捷操作 */}
          <div className="flex justify-between items-center mt-4 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const today = new Date();
                if (!isDateDisabled(today)) {
                  handleSelectDate(today);
                }
              }}
              disabled={isDateDisabled(new Date())}
              className="text-xs"
            >
              今天
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              className="text-xs"
            >
              取消
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
