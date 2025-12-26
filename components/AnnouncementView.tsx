
import React, { useState, useMemo } from 'react';
import { EtfData, CategoryKey } from '../types';
import { Megaphone, Calendar, DollarSign, Percent, Info } from 'lucide-react';

interface Props {
  etfs: EtfData[];
}

type FilterType = 'quarterly' | 'monthly' | 'bond';

// Date Parsing Helper (與 PerformanceView 保持一致)
const getDateValue = (dateStr: string): number => {
    if (!dateStr) return 0;
    const cleanStr = dateStr.trim();
    if (/^\d{6}$/.test(cleanStr)) {
        const y = parseInt(cleanStr.substring(0, 4));
        const m = parseInt(cleanStr.substring(4, 6)) - 1;
        return new Date(y, m, 1).getTime();
    }
    const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
    if (!isNaN(standardDate.getTime())) {
        return standardDate.getTime();
    }
    return 0;
};

const isFutureDate = (dateStr: string) => {
    const dateVal = getDateValue(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateVal > today.getTime();
};

const AnnouncementView: React.FC<Props> = ({ etfs }) => {
  const [filter, setFilter] = useState<FilterType>('quarterly');

  // 1. 扁平化並篩選出未來的配息資料
  const upcomingDividends = useMemo(() => {
    const list: Array<{
        etfCode: string;
        etfName: string;
        category: CategoryKey;
        priceCurrent: number;
        date: string;
        amount: number;
        singleYield: string;
    }> = [];

    etfs.forEach(etf => {
        etf.dividends.forEach(div => {
            if (isFutureDate(div.date)) {
                // 計算單次殖利率
                const yieldVal = etf.priceCurrent > 0 
                    ? ((div.amount / etf.priceCurrent) * 100).toFixed(2) 
                    : "0.00";

                list.push({
                    etfCode: etf.code,
                    etfName: etf.name,
                    category: etf.category,
                    priceCurrent: etf.priceCurrent,
                    date: div.date,
                    amount: div.amount,
                    singleYield: yieldVal
                });
            }
        });
    });

    // 依照日期排序 (最近的在前)
    return list.sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
  }, [etfs]);

  // 2. 根據按鈕過濾顯示
  const filteredList = useMemo(() => {
      return upcomingDividends.filter(item => {
          if (filter === 'bond') {
              return item.category === 'AE';
          }
          if (filter === 'monthly') {
              // 月配股票 (AD)
              return item.category === 'AD';
          }
          if (filter === 'quarterly') {
              // 季配股票 (AA, AB, AC)
              return ['AA', 'AB', 'AC'].includes(item.category);
          }
          return false;
      });
  }, [upcomingDividends, filter]);

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Header & Filter Buttons */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 shrink-0 z-10">
          <div className="flex items-center gap-2 mb-4 text-slate-800">
              <Megaphone className="w-6 h-6 text-red-500" />
              <h2 className="text-xl font-bold">即將配息公告</h2>
          </div>

          <div className="flex gap-2">
              <button
                  onClick={() => setFilter('quarterly')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                      filter === 'quarterly' 
                      ? 'bg-blue-900 text-white border-blue-900 shadow-md' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                  季配息
              </button>
              <button
                  onClick={() => setFilter('monthly')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                      filter === 'monthly' 
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                  月配息
              </button>
              <button
                  onClick={() => setFilter('bond')}
                  className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border ${
                      filter === 'bond' 
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                      : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                  }`}
              >
                  債券型
              </button>
          </div>
      </div>

      {/* Content List */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {filteredList.length > 0 ? (
              <div className="space-y-3">
                  {filteredList.map((item, idx) => (
                      <div key={`${item.etfCode}-${idx}`} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                          {/* Card Header: Code & Name */}
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                              <div className="flex items-baseline gap-2">
                                  <span className="text-lg font-bold text-blue-900">{item.etfCode}</span>
                                  <span className="text-sm text-slate-600 truncate max-w-[150px]">{item.etfName}</span>
                              </div>
                              <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">
                                  即將除息
                              </span>
                          </div>

                          {/* Card Body: 4 Columns Grid */}
                          <div className="p-4">
                              <div className="grid grid-cols-4 gap-2 text-center items-center">
                                  
                                  {/* Col 1: 配息日期 */}
                                  <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                          <Calendar className="w-3 h-3" /> 日期
                                      </span>
                                      <span className="text-sm font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded">
                                          {item.date}
                                      </span>
                                  </div>

                                  {/* Col 2: 配息金額 */}
                                  <div className="flex flex-col items-center border-l border-slate-100">
                                      <span className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                          <DollarSign className="w-3 h-3" /> 金額
                                      </span>
                                      <span className="text-base font-bold text-slate-900">
                                          {item.amount}
                                      </span>
                                  </div>

                                  {/* Col 3: 單次殖利率 */}
                                  <div className="flex flex-col items-center border-l border-slate-100">
                                      <span className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                          <Percent className="w-3 h-3" /> 殖利率
                                      </span>
                                      <span className="text-base font-bold text-red-600">
                                          {item.singleYield}%
                                      </span>
                                  </div>

                                  {/* Col 4: 狀態 */}
                                  <div className="flex flex-col items-center border-l border-slate-100">
                                      <span className="text-[10px] text-slate-400 mb-1 flex items-center gap-1">
                                          <Info className="w-3 h-3" /> 狀態
                                      </span>
                                      <span className="text-xs font-bold text-white bg-red-400 px-2 py-1 rounded shadow-sm">
                                          預估
                                      </span>
                                  </div>
                              </div>
                              
                              {/* Reference Price Row */}
                              <div className="mt-3 pt-2 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                                  <span>參考股價: {item.priceCurrent}</span>
                                  <span>* 單次殖利率為預估值</span>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="bg-slate-100 p-6 rounded-full">
                    <Calendar className="w-12 h-12 text-slate-300" />
                  </div>
                  <p>目前此分類無即將配息資料</p>
              </div>
          )}
      </div>
    </div>
  );
};

export default AnnouncementView;
