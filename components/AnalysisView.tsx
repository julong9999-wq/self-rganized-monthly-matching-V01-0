
import React, { useState, useMemo } from 'react';
import { EtfData, CategoryKey, Dividend } from '../types';
import { LineChart, ArrowLeft, BarChart3, CircleAlert, X } from 'lucide-react';

interface Props {
  etfs: EtfData[];
  lastUpdated: Date | null;
}

// 定義過濾器按鈕 (新增 '主動')
const FILTERS = [
  { key: '高息', label: '高息' },
  { key: '市值', label: '市值' },
  { key: '主題', label: '主題' },
  { key: '主動', label: '主動' },
  { key: '國外', label: '國外' },
  { key: '月配', label: '月配' },
  { key: '債券', label: '債券' },
];

// 硬編碼分類對照表 (依照使用者需求更新)
const CATEGORY_MAPPING: Record<string, string[]> = {
  '高息': ['0056', '00713', '00731', '00878', '00915', '00918', '00919', '00932'],
  '市值': ['00690', '00850', '00888', '00894', '00905', '00912', '00938', '009808'],
  '主題': ['00728', '00891', '00896', '00903', '00904', '00921', '00927', '00947', '009802', '009803'], // 加入 00728
  '主動': ['00980A', '00981A', '00982A', '00983A', '00984A', '00985A', '00986A'], 
  '國外': ['00712', '00771', '00908', '00956', '00960', '00972'],
  // '月配' 與 '債券' 直接透過 CategoryKey 判斷
};

// 輔助：判斷是否為未來日期
const isFutureDate = (dateStr: string) => {
    if (!dateStr) return false;
    const cleanStr = dateStr.trim();
    let dateVal = 0;
    if (/^\d{6}$/.test(cleanStr)) {
        const y = parseInt(cleanStr.substring(0, 4));
        const m = parseInt(cleanStr.substring(4, 6)) - 1;
        dateVal = new Date(y, m, 1).getTime();
    } else {
        const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
        if (!isNaN(standardDate.getTime())) dateVal = standardDate.getTime();
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dateVal > today.getTime();
};

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

// 輔助：格式化日期 yyyy/MM/dd (強制補零)
const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.trim();
    let y = '', m = '', d = '';

    // 處理純數字 YYYYMMDD
    if (/^\d{8}$/.test(cleanStr)) {
         y = cleanStr.substring(0, 4);
         m = cleanStr.substring(4, 6);
         d = cleanStr.substring(6, 8);
         return `${y}/${m}/${d}`;
    }

    // 處理 YYYYMM
    if (/^\d{6}$/.test(cleanStr)) {
        y = cleanStr.substring(0, 4);
        m = cleanStr.substring(4, 6);
        d = '01'; // Default day for monthly data
        return `${y}/${m}/${d}`;
    } 
    
    // 處理分隔符
    const parts = cleanStr.split(/[\/\.\-]/);
    if (parts.length >= 2) {
        y = parts[0];
        m = parts[1].padStart(2, '0');
        d = parts[2] ? parts[2].padStart(2, '0') : '01';
        return `${y}/${m}/${d}`;
    }
    
    return cleanStr;
};

// 輔助：取得卡片顏色樣式 (沿用)
const getCardStyle = (etf: EtfData) => {
    const code = etf.code;
    let type = etf.category;
    
    // 債券細分顏色
    if (etf.category === 'AE') {
        const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
        if (monthlyBonds.some(b => code.includes(b))) type = 'AD'; // 用月配顏色
        else if (['00720B', '00725B', '00724B'].some(b => code.includes(b))) type = 'AA';
        else if (['00679B', '00761B', '00795B'].some(b => code.includes(b))) type = 'AB';
        else type = 'AC';
    }

    switch (type) {
        case 'AA': return 'bg-blue-50 border-blue-200';
        case 'AB': return 'bg-emerald-50 border-emerald-200';
        case 'AC': return 'bg-orange-50 border-orange-200';
        case 'AD': return 'bg-amber-50 border-amber-200';
        default: return 'bg-white border-slate-200';
    }
  };

const AnalysisView: React.FC<Props> = ({ etfs, lastUpdated }) => {
  const [activeFilter, setActiveFilter] = useState('高息');
  const [selectedEtf, setSelectedEtf] = useState<EtfData | null>(null); // 詳細資料
  const [chartEtf, setChartEtf] = useState<EtfData | null>(null); // 分析圖表

  // 資料過濾邏輯
  const filteredEtfs = useMemo(() => {
      if (activeFilter === '月配') {
          return etfs.filter(e => e.category === 'AD').sort((a,b) => a.code.localeCompare(b.code));
      }
      if (activeFilter === '債券') {
          return etfs.filter(e => e.category === 'AE').sort((a,b) => a.code.localeCompare(b.code));
      }
      
      // 其他自訂分類 (只篩選季配息商品 AA/AB/AC)
      const targetCodes = CATEGORY_MAPPING[activeFilter] || [];
      return etfs.filter(e => 
          ['AA', 'AB', 'AC'].includes(e.category) && targetCodes.some(code => e.code.includes(code))
      ).sort((a,b) => a.code.localeCompare(b.code));
  }, [etfs, activeFilter]);

  const displayDate = etfs.length > 0 && etfs[0].dataDate ? etfs[0].dataDate : '最新股價';

  // --- 彈跳視窗：h. 分析圖表 (使用真實歷史數據 + 含息曲線) ---
  const renderChartModal = () => {
    if (!chartEtf) return null;

    // 1. 取得歷史數據，並依照日期 舊 -> 新 排序 (為了畫圖)
    const historyAsc = [...(chartEtf.priceHistory || [])].sort((a, b) => getDateValue(a.date) - getDateValue(b.date));
    
    // Fallback data
    const dataPoints = historyAsc.length > 0 
        ? historyAsc 
        : [
            { date: '2025/01/02', price: chartEtf.priceBase }, 
            { date: 'Latest', price: chartEtf.priceCurrent }
          ];

    // 2. 計算含息股價 (Price + 累積配息)
    const startDateVal = getDateValue(dataPoints[0].date);
    
    const chartData = dataPoints.map(pt => {
        const ptDateVal = getDateValue(pt.date);
        
        // 累加所有 (除息日 >= 圖表起始日 且 <= 當下股價日期) 的配息
        const accumulatedDivs = chartEtf.dividends
            .filter(d => {
                const dVal = getDateValue(d.date);
                return dVal >= startDateVal && dVal <= ptDateVal;
            })
            .reduce((sum, d) => sum + d.amount, 0);

        return {
            ...pt,
            totalPrice: pt.price + accumulatedDivs
        };
    });

    // 3. SVG 繪圖計算
    const allPrices = chartData.flatMap(d => [d.price, d.totalPrice]);
    const maxY = Math.max(...allPrices) * 1.02; // 上下留白
    const minY = Math.min(...allPrices) * 0.98;
    const rangeY = maxY - minY || 1;
    const count = chartData.length;

    const getX = (index: number) => {
        if (count <= 1) return 50;
        return (index / (count - 1)) * 100;
    }
    const getY = (val: number) => 100 - ((val - minY) / rangeY) * 100;

    const pointsPrice = chartData.map((d, i) => `${getX(i)},${getY(d.price)}`).join(' ');
    const pointsTotal = chartData.map((d, i) => `${getX(i)},${getY(d.totalPrice)}`).join(' ');

    // 4. 準備表格數據 (倒序: 新 -> 舊)
    const tableData = [...chartData].reverse().map((curr, idx, arr) => {
        // arr 是反轉過的 chartData，所以下一個元素 (idx + 1) 是時間上的「上個月」
        const prev = arr[idx + 1];
        let rate = 0;

        if (prev && prev.price > 0) {
            rate = ((curr.price - prev.price) / prev.price) * 100;
        }

        return {
            date: curr.date,
            price: curr.price,
            rate: rate
        };
    });

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-white animate-[fadeIn_0.2s_ease-out]">
            {/* Header */}
            <div className="h-12 bg-white flex items-center justify-between px-4 border-b border-slate-100">
                 <h3 className="font-bold text-slate-800 text-lg">{chartEtf.code} 股價趨勢分析</h3>
                 <button onClick={() => setChartEtf(null)} className="p-2 bg-slate-100 rounded-full text-slate-500">
                    <X className="w-5 h-5" />
                 </button>
            </div>

            {/* Area 1: Chart (比例 2:1 = 4:2) */}
            <div className="w-full bg-white border-b border-slate-100 relative" style={{ aspectRatio: '2/1' }}>
                <div className="absolute top-2 right-4 flex flex-col items-end text-[10px] text-slate-500 gap-1 z-10">
                    <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-red-500"></div>含息股價</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-blue-500"></div>股價</div>
                </div>
                <div className="w-full h-full p-4 relative">
                     <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                        {/* Grid Lines */}
                        <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="25" x2="100" y2="25" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="75" x2="100" y2="75" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                        
                        {/* Total Price Line (Red) - strokeWidth 1.5 */}
                        <polyline 
                            fill="none" 
                            stroke="#ef4444" 
                            strokeWidth="1.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsTotal} 
                        />

                        {/* Price Line (Blue) - strokeWidth 1.5 */}
                        <polyline 
                            fill="none" 
                            stroke="#3b82f6" 
                            strokeWidth="1.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            points={pointsPrice} 
                        />
                     </svg>
                     <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                         <span>{formatDate(chartData[0]?.date)}</span>
                         <span>{formatDate(chartData[chartData.length-1]?.date)}</span>
                     </div>
                </div>
            </div>

            {/* Area 2: Table */}
            <div className="flex-1 bg-slate-50 p-4 overflow-y-auto">
                <table className="w-full text-left">
                    <thead>
                        {/* 標題文字 12 px 細字 */}
                        <tr className="text-[12px] font-light text-slate-500 border-b border-slate-200">
                            <th className="py-2 text-left font-light">日期</th>
                            <th className="py-2 text-right font-light">股價</th>
                            <th className="py-2 text-right font-light">報酬率(不含息)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-200/50">
                                {/* 內容文字 : 18 px 細字 (font-light) */}
                                <td className="py-3 text-[18px] text-slate-800 font-light">{formatDate(row.date)}</td>
                                <td className="py-3 text-[18px] text-slate-800 font-light text-right">{row.price.toFixed(2)}</td>
                                <td className={`py-3 text-[18px] font-light text-right ${row.rate > 0 ? 'text-red-600' : row.rate < 0 ? 'text-green-600' : 'text-slate-800'}`}>
                                    {row.rate !== 0 ? `${row.rate.toFixed(2)}%` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };

  // --- 彈跳視窗：g. 詳細資料 ---
  const renderDetailModal = () => {
      if (!selectedEtf) return null;

      const cardColorClass = getCardStyle(selectedEtf).split(' ')[0]; // 只取 bg color
      
      // 判斷月配/季配
      // 若是債券，需判斷是否為月配債
      let isMonthly = selectedEtf.category === 'AD';
      if (selectedEtf.category === 'AE') {
          const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
          if (monthlyBonds.some(b => selectedEtf.code.includes(b))) isMonthly = true;
      }
      
      const count = isMonthly ? 12 : 4;

      // 排序配息：近 -> 遠
      const allDivs = [...selectedEtf.dividends].sort((a, b) => getDateValue(b.date) - getDateValue(a.date));
      
      // 檢查是否有未來配息
      const hasFuture = allDivs.length > 0 && isFutureDate(allDivs[0].date);
      const displayCount = hasFuture ? count + 1 : count;
      const displayDivs = allDivs.slice(0, displayCount);

      return (
        <div className={`fixed inset-0 z-50 flex flex-col ${cardColorClass} animate-[slideIn_0.2s_ease-out]`}>
            {/* Header */}
            <div className="h-16 shrink-0 flex items-center px-4 border-b border-black/5 gap-3 bg-white/60 backdrop-blur-sm">
                  <button onClick={() => setSelectedEtf(null)} className="p-2 hover:bg-black/5 rounded-full">
                      <ArrowLeft className="w-6 h-6 text-slate-700" />
                  </button>
                  <div className="flex-1">
                      <h2 className="text-lg font-bold text-slate-800">{selectedEtf.code} {selectedEtf.name}</h2>
                      <span className="text-xs text-slate-500">
                          {isMonthly ? '近 12 次配息 (月配)' : '近 4 次配息 (季配)'}
                      </span>
                  </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                 <div className="bg-white/80 rounded-xl shadow-sm border border-black/5 overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-slate-500 text-xs border-b border-slate-200/50">
                                <th className="py-3 px-3 text-left font-medium">配息日期</th>
                                <th className="py-3 px-3 text-right font-medium">配息金額</th>
                                <th className="py-3 px-3 text-right font-medium">單次殖利率</th>
                                <th className="py-3 px-3 text-right font-medium">股利發放</th>
                            </tr>
                        </thead>
                        <tbody>
                             {displayDivs.length > 0 ? (
                                displayDivs.map((div, idx) => {
                                    const isFuture = isFutureDate(div.date);
                                    const yieldVal = selectedEtf.priceCurrent > 0 
                                        ? ((div.amount / selectedEtf.priceCurrent) * 100).toFixed(2) 
                                        : "0.00";

                                    return (
                                        <tr key={idx} className={`border-b border-slate-100/50 ${isFuture ? 'bg-red-50' : ''}`}>
                                            <td className="py-3 px-3 text-slate-800 font-medium text-sm">{div.date}</td>
                                            <td className="py-3 px-3 text-right text-slate-800 font-bold text-sm">{div.amount}</td>
                                            <td className="py-3 px-3 text-right text-blue-600 font-medium text-sm">{yieldVal}%</td>
                                            <td className="py-3 px-3 text-right text-xs">
                                                {div.paymentDate ? (
                                                    <span className={`font-medium ${isFuture ? 'text-red-600' : 'text-slate-600'}`}>
                                                        {div.paymentDate}
                                                    </span>
                                                ) : (
                                                    isFuture ? <span className="text-red-600 font-bold">預估</span> : <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                             ) : (
                                <tr><td colSpan={4} className="py-8 text-center text-slate-400">無配息資料</td></tr>
                             )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* A1 + A2 Fixed Header */}
      <div className="shrink-0 z-10 bg-slate-50 shadow-sm border-b border-slate-200">
         {/* A1: Base Date & Data Date */}
         <div className="h-16 bg-white px-4 flex justify-between items-center">
             <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-slate-400 font-light">基準日 (Base)</span>
                <span className="text-[14px] text-slate-600 font-bold">2025/01/02</span>
             </div>
             <div className="flex items-baseline gap-2">
                <span className="text-[12px] text-slate-400 font-light">資料日期</span>
                <span className="text-[14px] text-blue-900 font-bold">{displayDate}</span>
             </div>
         </div>

         {/* A2: Filter Buttons (No 'All') */}
         <div className="bg-white pb-2 px-2 pt-0 flex gap-2 overflow-x-auto scrollbar-hide">
            {FILTERS.map((f) => (
                <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`
                      flex-shrink-0 px-5 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap border
                      ${activeFilter === f.key 
                        ? 'bg-blue-900 text-white border-blue-900 shadow-sm' 
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}
                `}
                >
                    {f.label}
                </button>
            ))}
         </div>
      </div>

      {/* A3: List Content */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
         {filteredEtfs.length > 0 ? (
             filteredEtfs.map(etf => {
                 const cardStyle = getCardStyle(etf);
                 const estYieldDisplay = etf.estYield > 0 
                    ? `${etf.estYield}%` 
                    : <span className="text-slate-300">-</span>;
                 
                 return (
                     <div key={etf.code} className={`rounded-lg p-2 shadow-sm border flex flex-col gap-0.5 ${cardStyle}`}>
                         {/* Row 1 */}
                         <div className="flex items-baseline gap-2 border-b border-black/5 pb-1 mb-0.5">
                            <span className="text-[20px] font-bold text-blue-700">{etf.code}</span>
                            <span className="text-[18px] font-light text-slate-500 truncate flex-1 leading-tight">{etf.name}</span>
                         </div>

                         {/* Row 2: 佈局優化 (Grid 改為 [32% 22% 30% 16%]) */}
                         <div className="grid grid-cols-[32%_22%_30%_16%] items-center gap-0 leading-tight py-1 divide-x divide-slate-200/60">
                            <div className="text-left flex flex-col px-1">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">最近股價</span>
                                <span className="text-[18px] font-bold text-slate-900 leading-none">{etf.priceCurrent}</span>
                            </div>
                            <div className="text-center flex flex-col px-1">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">殖利率</span>
                                <span className="text-[18px] font-bold text-slate-900 leading-none">{etf.dividendYield}%</span>
                            </div>
                            {/* 調整：報酬率靠右對齊 (text-right) */}
                            <div className="text-right flex flex-col px-1 pr-2">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">報酬率</span>
                                <span className={`text-[18px] font-bold leading-none ${etf.returnRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {etf.returnRate}%
                                </span>
                            </div>
                            <div className="text-right flex justify-end px-1">
                                {/* Button h: Chart */}
                                <button 
                                    onClick={() => setChartEtf(etf)}
                                    className="flex flex-col items-center justify-center bg-white/80 border border-slate-300 rounded-lg px-1 py-1 hover:bg-slate-50 w-10 h-9"
                                >
                                    <BarChart3 className="w-4 h-4 text-slate-600" />
                                    <span className="text-[9px] text-slate-600 font-light leading-none mt-0.5">圖表</span>
                                </button>
                            </div>
                         </div>

                         {/* Row 3: 佈局優化 (Grid 改為 [32% 22% 30% 16%]) */}
                         <div className="grid grid-cols-[32%_22%_30%_16%] items-center gap-0 bg-white/40 -mx-2 px-2 py-1.5 rounded-b-lg mt-0.5 leading-tight divide-x divide-slate-200/60">
                            <div className="text-left flex flex-col px-1">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">起始股價</span>
                                <span className="text-[16px] font-medium text-slate-700 leading-none">{etf.priceBase}</span>
                            </div>
                            <div className="text-center flex flex-col px-1">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">預估殖利率</span>
                                <span className="text-[16px] font-medium text-slate-700 leading-none">{estYieldDisplay}</span>
                            </div>
                            {/* 調整：含息報酬靠右對齊 (text-right) */}
                            <div className="text-right flex flex-col px-1 pr-2">
                                <span className="text-[10px] font-light text-slate-500 mb-0.5">含息報酬</span>
                                <span className={`text-[16px] font-medium leading-none ${etf.totalReturn >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {etf.totalReturn}%
                                </span>
                            </div>
                            <div className="text-right flex justify-end px-1">
                                {/* Button g: Detail - 純圖示按鈕 (CircleAlert) */}
                                <button 
                                    onClick={() => setSelectedEtf(etf)}
                                    className="w-10 h-9 flex items-center justify-center bg-white/60 text-slate-700 rounded-lg hover:bg-white hover:text-black transition-colors border border-black/10 shadow-sm"
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

      {/* Modals */}
      {renderDetailModal()}
      {renderChartModal()}

    </div>
  );
};

export default AnalysisView;
