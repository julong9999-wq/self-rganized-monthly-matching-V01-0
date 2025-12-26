
import React, { useState, useMemo } from 'react';
import { EtfData, CategoryKey, Dividend } from '../types';
import { ArrowUp, ArrowDown, Plus, TrendingUp, CircleAlert, ArrowLeft } from 'lucide-react';

interface Props {
  etfs: EtfData[];
  onAddToPortfolio: (etf: EtfData) => void;
  lastUpdated: Date | null;
}

// 定義分類配置 (兩字，無 "全部")
const CATEGORY_CONFIG: { key: CategoryKey; label: string }[] = [
  { key: 'AA', label: '季一' },
  { key: 'AB', label: '季二' },
  { key: 'AC', label: '季三' },
  { key: 'AD', label: '月配' },
  { key: 'AE', label: '債券' },
];

// 使用者指定的債券排序列表
const BOND_SPECIFIC_ORDER = [
  '00937B', '00772B', '00933B', '00773B', // 月配
  '00720B', '00725B', '00724B',           // 季一
  '00679B', '00761B', '00795B',           // 季二
  '00687B', '00751B', '00792B'            // 季三
];

// 輔助函式：判斷債券的配息週期類型 (用於顏色與詳細頁配息次數判斷)
const getBondType = (code: string): CategoryKey => {
    // 月配 (AD): 00937B, 00772B, 00933B, 00773B
    const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
    if (monthlyBonds.some(b => code.includes(b))) return 'AD';

    // 季一 (AA): 00720B, 00725B, 00724B
    const groupQ1 = ['00720B', '00725B', '00724B'];
    if (groupQ1.some(b => code.includes(b))) return 'AA';

    // 季二 (AB): 00679B, 00761B, 00795B
    const groupQ2 = ['00679B', '00761B', '00795B'];
    if (groupQ2.some(b => code.includes(b))) return 'AB';

    // 季三 (AC): 00687B, 00751B, 00792B
    const groupQ3 = ['00687B', '00751B', '00792B'];
    if (groupQ3.some(b => code.includes(b))) return 'AC';
    
    // 其他未列出的債券預設歸類為季三
    return 'AC'; 
};

const PerformanceView: React.FC<Props> = ({ etfs, onAddToPortfolio, lastUpdated }) => {
  const activeCatState = useState<CategoryKey>('AA');
  const [activeCat, setActiveCat] = activeCatState;
  const [selectedEtf, setSelectedEtf] = useState<EtfData | null>(null);

  // 1. 篩選與排序資料
  const filteredEtfs = useMemo(() => {
    // 先篩選出當前分類的資料
    let result = etfs.filter(e => e.category === activeCat);

    if (activeCat === 'AE') {
        // 債券特殊排序邏輯
        result.sort((a, b) => {
            const indexA = BOND_SPECIFIC_ORDER.indexOf(a.code);
            const indexB = BOND_SPECIFIC_ORDER.indexOf(b.code);

            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return a.code.localeCompare(b.code);
        });
    } else {
        // 一般分類：依照股票代號排序
        result.sort((a, b) => a.code.localeCompare(b.code));
    }

    return result;
  }, [etfs, activeCat]);

  // 顯示用日期
  const displayDate = etfs.length > 0 && etfs[0].dataDate ? etfs[0].dataDate : '最新股價';
  
  // 輔助函式：判斷是否為未來日期
  const isFutureDate = (dateStr: string) => {
    if (!dateStr) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return false; 
    return targetDate > today;
  };

  // --- 顏色樣式邏輯 ---
  const getCardStyle = (etf: EtfData) => {
    let type: CategoryKey = 'AA';
    if (etf.category === 'AE') {
        type = getBondType(etf.code);
    } else {
        type = etf.category;
    }

    switch (type) {
        case 'AA': return 'bg-blue-50 border-blue-200';
        case 'AB': return 'bg-emerald-50 border-emerald-200';
        case 'AC': return 'bg-orange-50 border-orange-200';
        case 'AD': return 'bg-amber-50 border-amber-200';
        default: return 'bg-white border-slate-200';
    }
  };

  // --- 詳細資料頁面 (g. 詳細資料) ---
  if (selectedEtf) {
      // 判斷是否為月配：AD 類別 或 債券(AE)中的月配
      let resolvedCategory = selectedEtf.category;
      if (resolvedCategory === 'AE') {
          resolvedCategory = getBondType(selectedEtf.code);
      }
      
      const isMonthly = resolvedCategory === 'AD';
      const baseLimit = isMonthly ? 12 : 4; // 月配 12 筆，季配 4 筆

      // 排序：近 -> 遠
      const allSortedDividends = [...selectedEtf.dividends].sort((a, b) => {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      // h. 配息資料如有 預計配息資料 (未來日期) 筆數需 N+1 筆
      const hasFuture = allSortedDividends.length > 0 && isFutureDate(allSortedDividends[0].date);
      const displayCount = hasFuture ? baseLimit + 1 : baseLimit;
      
      const displayDividends = allSortedDividends.slice(0, displayCount);

      return (
          <div className={`flex flex-col h-full ${getCardStyle(selectedEtf).split(' ')[0]}`}>
              {/* Header: 詳細資料, 返回按鈕 */}
              <div className="h-16 shrink-0 flex items-center px-4 border-b border-black/5 gap-3 bg-white/60 backdrop-blur-sm">
                  <button onClick={() => setSelectedEtf(null)} className="p-2 hover:bg-black/5 rounded-full">
                      <ArrowLeft className="w-6 h-6 text-slate-700" />
                  </button>
                  <div className="flex-1">
                      <h2 className="text-lg font-bold text-slate-800">{selectedEtf.code} {selectedEtf.name}</h2>
                      <span className="text-xs text-slate-500">配息明細 (近 {displayCount} 次)</span>
                  </div>
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                  <div className="bg-white/80 rounded-xl shadow-sm border border-black/5 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-slate-500 text-xs border-b border-slate-200/50">
                                <th className="py-2 px-4 font-medium">除息日</th>
                                <th className="py-2 px-4 text-right font-medium">金額</th>
                                <th className="py-2 px-4 text-right font-medium">狀態</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayDividends.length > 0 ? (
                                displayDividends.map((div, idx) => {
                                    const isFuture = isFutureDate(div.date);
                                    // 未來配息資料: 底色為淡紅色 (bg-red-50)
                                    return (
                                        <tr key={idx} className={`border-b border-slate-100/50 ${isFuture ? 'bg-red-50' : ''}`}>
                                            <td className="py-3 px-4 text-slate-800 font-medium text-sm">{div.date}</td>
                                            <td className="py-3 px-4 text-right text-slate-800 font-bold text-sm">{div.amount}</td>
                                            <td className="py-3 px-4 text-right text-xs">
                                                {isFuture ? <span className="text-red-500 font-bold">預估/未除息</span> : <span className="text-slate-400">已除息</span>}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400 text-sm">無配息資料</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-6 p-4 bg-white/60 rounded-lg text-xs text-slate-500 leading-relaxed border border-black/5">
                      <p>※ 紅色底色表示為系統判讀之「未來配息資料」或「預估值」。</p>
                  </div>
              </div>
          </div>
      );
  }

  // --- 列表清單頁面 (A1, A2 固定，A3 滑動) ---
  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* 頂部固定區域 (A1 + A2) */}
      <div className="shrink-0 z-10 bg-slate-50 shadow-sm border-b border-slate-200">
          
          {/* A1. "基準日" 與 "資料日期" */}
          <div className="h-16 bg-white px-4 flex justify-between items-center">
            {/* 左側: 基準日 */}
            <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-slate-400 font-light">基準日 (Base)</span>
                <span className="text-[14px] text-slate-600 font-bold">2025/01/02</span>
            </div>
            
            {/* 右側: 資料日期 */}
            <div className="flex items-baseline gap-2">
              <span className="text-[12px] text-slate-400 font-light">資料日期</span>
              <span className="text-[14px] text-blue-900 font-bold">{displayDate}</span>
            </div>
          </div>

          {/* A2. 按鈕功能區 */}
          <div className="bg-white pb-2 px-2 pt-0 flex gap-2 overflow-x-auto scrollbar-hide">
            {CATEGORY_CONFIG.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCat(cat.key)}
                className={`
                  flex-shrink-0 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap border
                  ${activeCat === cat.key 
                    ? 'bg-blue-900 text-white border-blue-900 shadow-sm' 
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}
                `}
              >
                {cat.label}
              </button>
            ))}
          </div>
      </div>

      {/* A3. 表格內容: 可滑動區域 (Flex-1) */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
        {filteredEtfs.length > 0 ? (
            filteredEtfs.map((etf) => {
                const hasFutureData = etf.dividends.some(d => isFutureDate(d.date));
                const estYieldDisplay = hasFutureData && etf.estYield > 0 
                    ? `${etf.estYield}%` 
                    : <span className="text-slate-300">-</span>;

                const cardStyle = getCardStyle(etf);

                return (
                    <div key={etf.code} className={`rounded-lg p-2 shadow-sm border flex flex-col gap-0.5 ${cardStyle}`}>
                        {/* 第 1 行: 股票代碼/名稱 */}
                        <div className="flex items-baseline gap-2 border-b border-black/5 pb-1 mb-0.5">
                            <span className="text-[18px] font-bold text-slate-900">{etf.code}</span>
                            <span className="text-[16px] text-slate-800 font-medium truncate flex-1 leading-tight">{etf.name}</span>
                            <span className={`text-[10px] px-1.5 py-0 rounded border bg-white/50 border-black/10 text-slate-500`}>
                                {etf.marketLabel}
                            </span>
                        </div>

                        {/* 第 2 行: 最近股價, 殖利率, 報酬率, 詳細資料按鈕 */}
                        <div className="grid grid-cols-4 items-center gap-1 leading-tight">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-light text-slate-600">最近股價</span>
                                <span className="text-[16px] font-bold text-slate-900">{etf.priceCurrent}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-light text-slate-600">殖利率</span>
                                <span className="text-[16px] font-bold text-slate-900">{etf.dividendYield}%</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-light text-slate-600">報酬率</span>
                                <span className={`text-[16px] font-bold ${etf.returnRate >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {etf.returnRate}%
                                </span>
                            </div>
                            <div className="text-right flex justify-end">
                                {/* g. 詳細資料按鈕 (加上 stopPropagation 避免冒泡) */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEtf(etf);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-white/60 text-slate-700 rounded-lg hover:bg-white hover:text-black transition-colors border border-black/5"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* 第 3 行: 起始股價, 預估殖利率, 含息報酬, 自組月配按鈕 */}
                        <div className="grid grid-cols-4 items-center gap-1 bg-white/40 -mx-2 px-2 py-1 rounded-b-lg mt-0.5 leading-tight">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-light text-slate-600">起始股價</span>
                                <span className="text-[16px] font-bold text-slate-900">{etf.priceBase}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-light text-slate-600">預估殖利率</span>
                                <span className="text-[16px] font-bold text-slate-900">{estYieldDisplay}</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-light text-slate-600">含息報酬</span>
                                <span className={`text-[16px] font-bold ${etf.totalReturn >= 0 ? 'text-red-700' : 'text-green-700'}`}>
                                    {etf.totalReturn}%
                                </span>
                            </div>
                            <div className="text-right flex justify-end">
                                {/* h. 自組月配按鈕 (加上 stopPropagation 避免觸發詳細資料或其他異常) */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddToPortfolio(etf);
                                    }}
                                    className="w-8 h-8 flex items-center justify-center bg-emerald-100/50 text-emerald-800 rounded-full hover:bg-emerald-200 transition-colors border border-emerald-200/50 shadow-sm"
                                >
                                    <CircleAlert className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })
        ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
                目前分類無資料
            </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceView;
