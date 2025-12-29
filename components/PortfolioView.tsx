
import React, { useState, useMemo } from 'react';
import { PortfolioItem, Transaction, EtfData } from '../types';
import { Trash2, ChevronDown, ChevronUp, Edit3, Save, Plus, BarChart3, TrendingUp, Wallet, X, Calculator, LineChart, Minus } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onUpdateTransaction: (etfCode: string, tx: Transaction) => void;
  onDeleteTransaction: (etfCode: string, txId: string) => void;
  onAddTransaction: (etfCode: string, tx: Transaction) => void;
}

// 輔助：判斷債券細分類
const getBondType = (code: string): string => {
    const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
    if (monthlyBonds.some(b => code.includes(b))) return 'AD';
    const groupQ1 = ['00720B', '00725B', '00724B'];
    if (groupQ1.some(b => code.includes(b))) return 'AA';
    const groupQ2 = ['00679B', '00761B', '00795B'];
    if (groupQ2.some(b => code.includes(b))) return 'AB';
    return 'AC'; 
};

// 輔助：取得配息月份 (0-11 代表 1-12月)
const getDividendMonths = (category: string, code: string): number[] => {
    let type = category;
    
    // 1. 若為債券，先解析其細分類
    if (category === 'AE') {
         type = getBondType(code);
    }
    
    // 2. 強制檢查常見月配股票/債券，避免 Category 漏標
    const monthlyCodes = ['00929','00939','00940','00934','00936','00943','00944','00946','00952','00961'];
    if (monthlyCodes.some(x => code.includes(x))) {
        type = 'AD';
    }

    // 3. 依照代號回傳月份索引 (0 = 1月, 11 = 12月)
    switch (type) {
        case 'AA': return [0, 3, 6, 9];   // 季一: 1, 4, 7, 10 月
        case 'AB': return [1, 4, 7, 10];  // 季二: 2, 5, 8, 11 月
        case 'AC': return [2, 5, 8, 11];  // 季三: 3, 6, 9, 12 月
        case 'AD': return Array.from({length: 12}, (_, i) => i); // 月配: 1-12 月
        default: return [2, 5, 8, 11];    // 防呆預設 (季三)
    }
};

const getCardStyle = (etf: EtfData) => {
    let type = etf.category;
    if (etf.category === 'AE') type = getBondType(etf.code) as any;
    switch (type) {
        case 'AA': return 'bg-blue-50 border-blue-200';
        case 'AB': return 'bg-emerald-50 border-emerald-200';
        case 'AC': return 'bg-orange-50 border-orange-200';
        case 'AD': return 'bg-amber-50 border-amber-200';
        default: return 'bg-white border-slate-200';
    }
};

// 強化版日期解析 (支援 YYYYMMDD, YYYY/MM/DD, YYYY-MM-DD)
const parseDateSimple = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const cleanStr = dateStr.trim();
    
    // YYYYMMDD
    if (/^\d{8}$/.test(cleanStr)) {
         const y = parseInt(cleanStr.substring(0, 4));
         const m = parseInt(cleanStr.substring(4, 6)) - 1;
         const d = parseInt(cleanStr.substring(6, 8));
         return new Date(y, m, d);
    }
    
    // YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
    const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
    return isNaN(standardDate.getTime()) ? null : standardDate;
};

const PortfolioView: React.FC<Props> = ({ portfolio, onUpdateTransaction, onDeleteTransaction, onAddTransaction }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [addForm, setAddForm] = useState<Transaction | null>(null);
  
  // 新增：控制三個分析表格展開狀態 (預設全關閉)
  const [expandedAnalysis, setExpandedAnalysis] = useState<string[]>([]);

  const toggleAnalysis = (key: string) => {
      setExpandedAnalysis(prev => 
          prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
      );
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setEditingTxId(null); setEditForm(null); setAddingToId(null); setAddForm(null);
  };

  const startAdd = (item: PortfolioItem) => {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      setAddingToId(item.id);
      setAddForm({ id: Date.now().toString(), date: today, shares: 1000, price: item.etf.priceCurrent || 0, totalAmount: 1000 * (item.etf.priceCurrent || 0) });
      setExpandedId(item.id);
  };

  const handleAddChange = (field: keyof Transaction, value: string | number) => {
      if (!addForm) return;
      let newVal = Number(value);
      if (field === 'date') newVal = value as any;
      const updated = { ...addForm, [field]: newVal };
      if (field === 'shares' || field === 'price') updated.totalAmount = Number(updated.shares) * Number(updated.price);
      setAddForm(updated);
  };

  const saveAdd = (etfCode: string) => { if (addForm) { onAddTransaction(etfCode, addForm); setAddingToId(null); setAddForm(null); } };
  const cancelAdd = () => { setAddingToId(null); setAddForm(null); };

  const startEdit = (tx: Transaction) => { setEditingTxId(tx.id); setEditForm({ ...tx }); setAddingToId(null); };
  
  const handleEditChange = (field: keyof Transaction, value: string | number) => {
    if (!editForm) return;
    let newVal = Number(value);
    if (field === 'date') newVal = value as any;
    const updated = { ...editForm, [field]: newVal };
    if (field === 'shares' || field === 'price') {
        updated.totalAmount = Number(updated.shares) * Number(updated.price);
    }
    setEditForm(updated);
  };

  const saveEdit = (etfCode: string) => { if (editForm) { onUpdateTransaction(etfCode, editForm); setEditingTxId(null); setEditForm(null); } };
  const cancelEdit = () => { setEditingTxId(null); setEditForm(null); };
  const handleDeleteClick = (etfCode: string, txId: string) => { if (window.confirm("確定刪除?")) onDeleteTransaction(etfCode, txId); };

  const grandTotalCost = portfolio.reduce((sum, item) => sum + item.transactions.reduce((t, tx) => t + tx.totalAmount, 0), 0);
  const holdingsCount = portfolio.length;

  // --- 分析邏輯核心 (Updated Logic) ---
  const analysisData = useMemo(() => {
    const monthlyDividends = Array(12).fill(0);
    const breakdownList: any[] = []; // B. 股息明細
    const assetGrowthList: any[] = []; // C. 資產增值明細
    const valueProfitLossList: any[] = []; // A. 資產價值損益明細 (New)

    let weightedReturnRateSum = 0;
    let totalPortfolioCost = 0;
    
    // 1. 計算目前的總市值
    const currentMarketValue = portfolio.reduce((sum, item) => {
        const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
        return sum + (totalShares * item.etf.priceCurrent);
    }, 0);

    // 2. 遍歷每個 ETF 計算配息與報酬
    portfolio.forEach(item => {
        const itemTotalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
        
        totalPortfolioCost += itemTotalCost;
        weightedReturnRateSum += itemTotalCost * (item.etf.returnRate || 0);

        // --- A. 計算資產價值損益 (New) ---
        const itemMarketValue = totalShares * item.etf.priceCurrent;
        const itemProfitLoss = itemMarketValue - itemTotalCost;
        const itemProfitLossRate = itemTotalCost > 0 ? (itemProfitLoss / itemTotalCost) * 100 : 0;
        
        valueProfitLossList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            marketValue: itemMarketValue,
            profitLoss: itemProfitLoss,
            profitLossRate: itemProfitLossRate
        });

        // 取得配息月份
        let months = getDividendMonths(item.etf.category, item.etf.code);
        if (!months || months.length === 0) {
            months = [2, 5, 8, 11];
        }
        const frequency = Math.max(months.length, 1);

        // --- B. 股息計算邏輯 ---
        let annualDividend = 0;
        let usedYield = item.etf.dividendYield;
        let isCalculated = false;

        if (item.etf.dividendYield > 0) {
            annualDividend = itemTotalCost * (item.etf.dividendYield / 100);
        }
        
        // Fallback 機制
        if (annualDividend === 0 && item.etf.dividends && item.etf.dividends.length > 0) {
            const sortedDivs = [...item.etf.dividends].sort((a,b) => {
                const dA = parseDateSimple(a.date)?.getTime() || 0;
                const dB = parseDateSimple(b.date)?.getTime() || 0;
                return dB - dA;
            });

            if (sortedDivs[0] && sortedDivs[0].amount > 0) {
                const latestAmount = sortedDivs[0].amount;
                annualDividend = latestAmount * frequency * totalShares;
                
                if (itemTotalCost > 0) {
                    usedYield = parseFloat(((annualDividend / itemTotalCost) * 100).toFixed(2));
                    isCalculated = true;
                }
            }
        }

        breakdownList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            yield: usedYield,
            isCalculated: isCalculated,
            estimatedIncome: annualDividend
        });

        // --- C. 資產增值預估邏輯 ---
        const estimatedGainLoss = itemTotalCost * (item.etf.returnRate / 100);
        assetGrowthList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            returnRate: item.etf.returnRate,
            estimatedGainLoss: estimatedGainLoss
        });

        // 分配到各月份 (長條圖數據)
        if (annualDividend > 0) {
            const amountPerDistribution = annualDividend / frequency;
            months.forEach(idx => {
                monthlyDividends[idx] += amountPerDistribution;
            });
        }
    });

    const portfolioAvgReturnRate = totalPortfolioCost > 0 ? (weightedReturnRateSum / totalPortfolioCost) : 0;
    
    // 3. 預估績效成長
    const currentMarketValueLine = Array(12).fill(0).map((_, idx) => {
        const month = idx + 1;
        const growthFactor = (portfolioAvgReturnRate / 100) * (month / 12);
        return currentMarketValue * (1 + growthFactor);
    });

    let accumulatedDivs = 0;
    const totalAssetLine = currentMarketValueLine.map((val, idx) => {
        accumulatedDivs += monthlyDividends[idx];
        return val + accumulatedDivs;
    });

    const allValues = [grandTotalCost, currentMarketValue, ...totalAssetLine].filter(v => v > 0);
    const maxY = Math.max(...allValues) * 1.05;
    const minY = Math.min(...allValues) * 0.95;
    const estimatedAnnualIncome = monthlyDividends.reduce((a, b) => a + b, 0);

    const totalEstimatedAssetGain = assetGrowthList.reduce((sum, item) => sum + item.estimatedGainLoss, 0);
    
    // 總未實現損益
    const totalUnrealizedProfitLoss = currentMarketValue - grandTotalCost;

    return { 
        monthlyDividends, 
        currentMarketValueLine, 
        totalAssetLine, 
        maxMonthDiv: Math.max(...monthlyDividends), 
        maxY, 
        minY, 
        estimatedAnnualIncome, 
        finalProjectedValue: totalAssetLine[11], 
        portfolioAvgReturnRate, 
        currentMarketValue,
        breakdownList, // B
        assetGrowthList, // C
        valueProfitLossList, // A (New)
        totalEstimatedAssetGain,
        totalUnrealizedProfitLoss
    };
  }, [portfolio, grandTotalCost]);

  const hasData = analysisData.estimatedAnnualIncome > 0 || portfolio.length > 0;
  
  const getY = (val: number) => {
      const range = (analysisData.maxY - analysisData.minY) || 1;
      return 100 - (((val - analysisData.minY) / range) * 100);
  };

  // 顏色輔助：台股紅漲綠跌
  const getColor = (val: number) => val > 0 ? 'text-red-600' : val < 0 ? 'text-green-600' : 'text-slate-600';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* A1: Statistics */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-2 shrink-0 z-20">
          <div className="grid grid-cols-3 gap-1 text-center">
              <div className="flex flex-col items-center">
                  <span className="text-[14px] font-light text-slate-500">投資總額</span>
                  <span className="text-[18px] font-bold text-slate-800">${grandTotalCost.toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[14px] font-light text-slate-500">預估年息</span>
                  <span className="text-[18px] font-bold text-yellow-600">${Math.round(analysisData.estimatedAnnualIncome).toLocaleString()}</span>
              </div>
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[14px] font-light text-slate-500">投資檔數</span>
                  <span className="text-[18px] font-bold text-slate-800">{holdingsCount}</span>
              </div>
          </div>
      </div>

      {/* Main Scrollable Area (加入 overflow-x-hidden 防止左右搖晃) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 pt-1 scrollbar-hide space-y-2">
          
          {/* A2: Holdings (投資組合列表) */}
          {portfolio.length > 0 && (
            <div className="space-y-1">
                {portfolio.map((item) => {
                    const totalShares = item.transactions.reduce((s, t) => s + t.shares, 0);
                    const totalCost = item.transactions.reduce((s, t) => s + t.totalAmount, 0);
                    const avgCost = totalShares > 0 ? (totalCost / totalShares).toFixed(2) : 0;
                    const isExpanded = expandedId === item.id;
                    const style = getCardStyle(item.etf);

                    return (
                        <div key={item.id} className={`rounded-lg shadow-sm border ${style} ${isExpanded ? 'ring-1 ring-blue-200' : ''}`}>
                            <div onClick={() => toggleExpand(item.id)} className="p-2 flex flex-col gap-1 cursor-pointer">
                                {/* 第一行 */}
                                <div className="flex justify-between items-center border-b border-black/5 pb-1">
                                    <div className="flex items-baseline gap-2 overflow-hidden flex-1">
                                        <span className="text-[20px] font-bold text-blue-900">{item.id}</span>
                                        <span className="text-[18px] font-light text-slate-500 truncate">{item.etf.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => { e.stopPropagation(); startAdd(item); }} className="w-6 h-6 flex justify-center items-center rounded-full bg-white text-blue-800 border border-blue-100 shadow-sm"><Plus className="w-4 h-4" /></button>
                                        <div className="text-slate-400">{isExpanded ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</div>
                                    </div>
                                </div>
                                
                                {/* 第二行 */}
                                <div className="grid grid-cols-4 gap-1">
                                    <div className="text-center">
                                        <div className="text-[12px] text-slate-500 font-light">累計張數</div>
                                        <div className="text-[16px] font-bold text-slate-800">{totalShares.toLocaleString()}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[12px] text-slate-500 font-light">平均成本</div>
                                        <div className="text-[16px] font-bold text-slate-800">{avgCost}</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[12px] text-slate-500 font-light">殖利率</div>
                                        <div className="text-[16px] font-bold text-slate-800">{item.etf.dividendYield}%</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-[12px] text-slate-500 font-light">總計</div>
                                        <div className="text-[16px] font-bold text-slate-800">${Math.round(totalCost).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 子表: 交易明細 */}
                            {isExpanded && (
                                <div className="border-t border-black/5 bg-white/60 p-2 rounded-b-lg">
                                    {/* Add Form */}
                                    {addingToId === item.id && addForm && (
                                        <div className="bg-white rounded p-2 mb-2 border border-blue-200 shadow-sm">
                                            <div className="text-xs font-bold text-blue-800 mb-1">新增交易</div>
                                            <div className="grid grid-cols-2 gap-2 mb-2">
                                                <div className="flex flex-col">
                                                    <label className="text-[12px] font-light text-slate-500">日期</label>
                                                    <input value={addForm.date} onChange={(e) => handleAddChange('date', e.target.value)} className="border rounded px-2 py-1 text-[16px] font-bold text-slate-800" placeholder="YYYY/MM/DD" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <label className="text-[12px] font-light text-slate-500">張數</label>
                                                     <input type="number" value={addForm.shares} onChange={(e) => handleAddChange('shares', e.target.value)} className="border rounded px-2 py-1 text-[16px] font-bold text-slate-800 text-right" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <label className="text-[12px] font-light text-slate-500">單價</label>
                                                     <input type="number" value={addForm.price} onChange={(e) => handleAddChange('price', e.target.value)} className="border rounded px-2 py-1 text-[16px] font-bold text-slate-800 text-right" />
                                                </div>
                                                <div className="flex flex-col">
                                                     <label className="text-[12px] font-light text-slate-500">成交總價</label>
                                                     <input type="number" value={addForm.totalAmount} onChange={(e) => handleAddChange('totalAmount', e.target.value)} className="border rounded px-2 py-1 text-[16px] font-bold text-slate-800 text-right" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={cancelAdd} className="px-3 py-1 text-sm bg-slate-100 rounded text-slate-600">取消</button>
                                                <button onClick={() => saveAdd(item.id)} className="px-3 py-1 text-sm bg-blue-600 text-white rounded">儲存</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Transaction Table */}
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="border-b border-black/5 text-[12px] font-light text-slate-500">
                                                <th className="py-1 font-light w-[25%]">日期</th>
                                                <th className="py-1 text-right font-light w-[30%]">張數 / 單價</th>
                                                <th className="py-1 text-right font-light w-[30%]">成交總價</th>
                                                <th className="py-1 text-right font-light w-[15%]">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {item.transactions.map((tx) => {
                                                // 編輯模式
                                                if (editingTxId === tx.id && editForm) {
                                                    return (
                                                        <tr key={tx.id} className="bg-blue-50/50">
                                                            <td colSpan={4} className="py-2">
                                                                <div className="p-2 border border-blue-200 rounded-lg bg-white shadow-sm flex flex-col gap-2">
                                                                    <div className="flex justify-between items-center border-b border-blue-100 pb-1 mb-1">
                                                                        <span className="text-xs font-bold text-blue-800">編輯交易</span>
                                                                        <button onClick={cancelEdit}><X className="w-4 h-4 text-slate-400"/></button>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                        <div className="flex flex-col">
                                                                            <label className="text-[12px] font-light text-slate-500 mb-0.5">日期</label>
                                                                            <input value={editForm.date} onChange={(e) => handleEditChange('date', e.target.value)} className="w-full border rounded px-2 py-1.5 text-[16px] font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none" />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <label className="text-[12px] font-light text-slate-500 mb-0.5 text-right">張數</label>
                                                                            <input type="number" value={editForm.shares} onChange={(e) => handleEditChange('shares', e.target.value)} className="w-full border rounded px-2 py-1.5 text-[16px] font-bold text-slate-800 text-right bg-slate-50 focus:bg-white outline-none" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-3">
                                                                         <div className="flex flex-col">
                                                                            <label className="text-[12px] font-light text-slate-500 mb-0.5">單價</label>
                                                                            <input type="number" value={editForm.price} onChange={(e) => handleEditChange('price', e.target.value)} className="w-full border rounded px-2 py-1.5 text-[16px] font-bold text-slate-800 bg-slate-50 focus:bg-white outline-none" />
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <label className="text-[12px] font-light text-slate-500 mb-0.5 text-right">成交總價</label>
                                                                            <input type="number" value={editForm.totalAmount} onChange={(e) => handleEditChange('totalAmount', e.target.value)} className="w-full border rounded px-2 py-1.5 text-[16px] font-bold text-slate-800 text-right bg-slate-50 focus:bg-white outline-none" />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex justify-end pt-2 border-t border-slate-100 mt-1">
                                                                        <button onClick={() => saveEdit(item.id)} className="flex items-center gap-1 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-sm hover:bg-blue-700 active:scale-95 transition-all">
                                                                            <Save className="w-4 h-4" />
                                                                            <span className="text-sm font-bold">儲存修改</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                // 顯示模式
                                                return (
                                                    <tr key={tx.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                                                        <td className="py-2 text-[14px] font-bold text-slate-700">{tx.date}</td>
                                                        <td className="py-2 text-right">
                                                            <div className="flex flex-col items-end">
                                                                <span className="text-[16px] font-bold text-slate-900 leading-none">{tx.shares}</span>
                                                                <span className="text-[12px] font-light text-slate-400 mt-0.5">@{tx.price}</span>
                                                            </div>
                                                        </td>
                                                        <td className="py-2 text-right text-[16px] font-bold text-slate-900">
                                                            ${Math.round(tx.totalAmount).toLocaleString()}
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <button onClick={(e)=>{e.stopPropagation(); startEdit(tx);}} className="p-1.5 bg-slate-100 rounded text-blue-600 hover:bg-blue-100 transition-colors"><Edit3 className="w-4 h-4"/></button>
                                                                <button onClick={(e)=>{e.stopPropagation(); handleDeleteClick(item.id, tx.id);}} className="p-1.5 bg-slate-100 rounded text-red-400 hover:bg-red-100 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
          )}

          {hasData && (
            <div className="pt-2 pb-4 space-y-3">
                
                {/* A. 資產價值損益 (New: 放在最上方) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     {/* Header (Accordion) */}
                     <div 
                        onClick={() => toggleAnalysis('PL')}
                        className="p-4 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50 transition-colors"
                     >
                         <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-indigo-100 rounded"><Wallet className="w-5 h-5 text-indigo-600" /></div>
                             <h4 className="font-bold text-xl text-slate-800">A. 資產價值損益</h4>
                         </div>
                         <div className="flex items-center gap-3">
                             {/* 總結顯示 */}
                             <div className="flex flex-col items-end">
                                 <span className={`font-bold text-lg ${getColor(analysisData.totalUnrealizedProfitLoss)}`}>
                                     {analysisData.totalUnrealizedProfitLoss > 0 ? '+' : ''}{Math.round(analysisData.totalUnrealizedProfitLoss).toLocaleString()}
                                 </span>
                             </div>
                             {expandedAnalysis.includes('PL') ? <Minus className="w-5 h-5 text-slate-400"/> : <Plus className="w-5 h-5 text-slate-400"/>}
                         </div>
                     </div>
                     
                     {/* Content */}
                     {expandedAnalysis.includes('PL') && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                             <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                計算邏輯：(目前股價 × 股數) - 總成本
                             </p>
                             {analysisData.valueProfitLossList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-200/50 pb-1">
                                        <div className="font-bold text-lg text-slate-800">{row.name}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] text-slate-500 font-light">總成本</span>
                                            <span className="text-[16px] font-bold text-slate-700">${Math.round(row.totalCost).toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col text-center">
                                            <span className="text-[12px] text-slate-500 font-light">現值</span>
                                            <span className="text-[16px] font-bold text-slate-700">${Math.round(row.marketValue).toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[12px] text-slate-500 font-light">損益</span>
                                            <span className={`text-[16px] font-bold ${getColor(row.profitLoss)}`}>
                                                {row.profitLoss > 0 ? '+' : ''}{Math.round(row.profitLoss).toLocaleString()}
                                                <span className="text-xs ml-1 font-normal opacity-80">({row.profitLossRate.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>

                {/* B. 預估股息試算 (原: 預估股息試算明細) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     {/* Header */}
                     <div 
                        onClick={() => toggleAnalysis('DIV')}
                        className="p-4 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50 transition-colors"
                     >
                         <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-amber-100 rounded"><Calculator className="w-5 h-5 text-amber-600" /></div>
                             <h4 className="font-bold text-xl text-slate-800">B. 預估股息試算</h4>
                         </div>
                         <div className="flex items-center gap-3">
                             {/* 總結顯示 */}
                             <div className="flex flex-col items-end">
                                 <span className="font-bold text-lg text-amber-600">
                                     ${Math.round(analysisData.estimatedAnnualIncome).toLocaleString()}
                                 </span>
                             </div>
                             {expandedAnalysis.includes('DIV') ? <Minus className="w-5 h-5 text-slate-400"/> : <Plus className="w-5 h-5 text-slate-400"/>}
                         </div>
                     </div>

                     {/* Content */}
                     {expandedAnalysis.includes('DIV') && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                            {analysisData.breakdownList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-200/50 pb-1">
                                        <div className="font-bold text-lg text-slate-800">{row.name}</div>
                                        <div className="text-xs text-slate-400 font-mono">{row.id}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] text-slate-500 font-light">購買總價</span>
                                            <span className="text-[16px] font-bold text-slate-700">${Math.round(row.totalCost).toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col text-center">
                                            <span className="text-[12px] text-slate-500 font-light">殖利率</span>
                                            <div className="flex items-center justify-center gap-1">
                                                <span className="text-[16px] font-bold text-slate-700">{row.yield}%</span>
                                                {row.isCalculated && <span className="text-[9px] text-red-400 bg-red-50 px-1 rounded">推算</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[12px] text-slate-500 font-light">預估年息</span>
                                            <span className="text-[16px] font-bold text-amber-600">${Math.round(row.estimatedIncome).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>

                {/* C. 資產增值預估 (原: 資產增值預估分析) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     {/* Header */}
                     <div 
                        onClick={() => toggleAnalysis('GAIN')}
                        className="p-4 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50 transition-colors"
                     >
                         <div className="flex items-center gap-2">
                             <div className="p-1.5 bg-emerald-100 rounded"><LineChart className="w-5 h-5 text-emerald-600" /></div>
                             <h4 className="font-bold text-xl text-slate-800">C. 資產增值預估</h4>
                         </div>
                         <div className="flex items-center gap-3">
                             <div className="flex flex-col items-end">
                                 <span className={`font-bold text-lg ${getColor(analysisData.totalEstimatedAssetGain)}`}>
                                     {analysisData.totalEstimatedAssetGain > 0 ? '+' : ''}{Math.round(analysisData.totalEstimatedAssetGain).toLocaleString()}
                                 </span>
                             </div>
                             {expandedAnalysis.includes('GAIN') ? <Minus className="w-5 h-5 text-slate-400"/> : <Plus className="w-5 h-5 text-slate-400"/>}
                         </div>
                     </div>
                    
                     {/* Content */}
                     {expandedAnalysis.includes('GAIN') && (
                        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 animate-[fadeIn_0.2s_ease-out]">
                            <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded">
                                計算邏輯：總成本 × (今年報酬率)
                             </p>
                            {analysisData.assetGrowthList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex justify-between items-center mb-2 border-b border-slate-200/50 pb-1">
                                        <div className="font-bold text-lg text-slate-800">{row.name}</div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[12px] text-slate-500 font-light">購買總價</span>
                                            <span className="text-[16px] font-bold text-slate-700">${Math.round(row.totalCost).toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col text-center">
                                            <span className="text-[12px] text-slate-500 font-light">年報酬(參考)</span>
                                            <span className={`text-[16px] font-bold ${getColor(row.returnRate)}`}>
                                                {row.returnRate}%
                                            </span>
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <span className="text-[12px] text-slate-500 font-light">預估增減</span>
                                            <span className={`text-[16px] font-bold ${getColor(row.estimatedGainLoss)}`}>
                                                {row.estimatedGainLoss > 0 ? '+' : ''}{Math.round(row.estimatedGainLoss).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>

                {/* 4. Charts (放在表格之後) */}
                {/* Monthly Dividends Chart */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center gap-1.5 mb-4">
                        <div className="p-1 bg-blue-100 rounded"><BarChart3 className="w-3 h-3 text-blue-600" /></div>
                        <div className="flex flex-col"><h4 className="font-bold text-sm text-slate-800">每月預估股息</h4></div>
                    </div>
                    {/* 增加容器高度至 h-48 以確保顯示空間 */}
                    <div className="flex items-end justify-between gap-1 h-48 pt-4 pb-2">
                        {analysisData.monthlyDividends.map((val, idx) => {
                            // 計算高度百分比，如果 maxMonthDiv 為 0，則高度為 0
                            const heightPct = analysisData.maxMonthDiv > 0 ? (val / analysisData.maxMonthDiv) * 100 : 0;
                            // 只要數值大於 0，強制給予至少 2px 的高度，避免看不見
                            const displayHeight = val > 0 ? Math.max(heightPct, 1) : 0;

                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group h-full justify-end">
                                    <div className="relative w-full flex items-end justify-center rounded-t-sm bg-slate-50 h-full">
                                        {/* 只有當有值的時候才渲染 bar */}
                                        {val > 0 && (
                                            <div 
                                                className="w-full mx-0.5 bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600" 
                                                style={{ height: `${displayHeight}%` }}
                                            ></div>
                                        )}
                                        {/* Tooltip: 數值顯示 */}
                                        {val > 0 && <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow pointer-events-none">${Math.round(val).toLocaleString()}</div>}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 scale-90">{idx + 1}月</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Growth Chart (With Div vs Without Div) */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-1.5">
                            <div className="p-1 bg-emerald-100 rounded"><TrendingUp className="w-3 h-3 text-emerald-600" /></div>
                            <div className="flex flex-col"><h4 className="font-bold text-sm text-slate-800">每月預估績效成長</h4></div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-emerald-500 rounded-full"></div><span className="text-[10px] text-slate-500">含息報酬</span></div>
                            <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-blue-400 rounded-full"></div><span className="text-[10px] text-slate-500">不含息報酬</span></div>
                        </div>
                    </div>
                    
                    <div className="h-40 w-full relative pt-1">
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                            {(() => { const costY = getY(grandTotalCost); return <line x1="0" y1={costY} x2="100" y2={costY} stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3" opacity="0.5" />; })()}
                            
                            {/* Blue Line: 不含息 (Market Value) - 修正線條寬度為 2 */}
                            {analysisData.currentMarketValueLine.length > 0 && <polyline fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={analysisData.currentMarketValueLine.map((val, idx) => `${(idx/11)*100},${getY(val)}`).join(' ')} />}
                            
                            {/* Green Line: 含息 (Total Asset) - 修正線條寬度為 2.5 */}
                            {analysisData.totalAssetLine.length > 0 && <polyline fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={analysisData.totalAssetLine.map((val, idx) => `${(idx/11)*100},${getY(val)}`).join(' ')} />}
                        </svg>
                        <div className="flex justify-between mt-1 text-[10px] text-slate-400 font-bold px-1"><span>1月</span><span>6月</span><span>12月</span></div>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};
export default PortfolioView;
