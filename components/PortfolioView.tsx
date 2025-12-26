import React, { useState, useMemo } from 'react';
import { PortfolioItem, Transaction, EtfData } from '../types';
import { Trash2, ChevronDown, ChevronUp, Edit3, Save, Plus, BarChart3, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Target, Layers, Calculator } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onUpdateTransaction: (etfCode: string, tx: Transaction) => void;
  onDeleteTransaction: (etfCode: string, txId: string) => void;
  onAddTransaction: (etfCode: string, tx: Transaction) => void;
}

// 輔助函式：判斷債券類型 (回傳對應的股票分類 AA/AB/AC/AD)
const getBondType = (code: string): string => {
    // 月配 (AD)
    const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
    if (monthlyBonds.some(b => code.includes(b))) return 'AD';

    // 季一 (AA): 1, 4, 7, 10
    const groupQ1 = ['00720B', '00725B', '00724B'];
    if (groupQ1.some(b => code.includes(b))) return 'AA';

    // 季二 (AB): 2, 5, 8, 11
    const groupQ2 = ['00679B', '00761B', '00795B'];
    if (groupQ2.some(b => code.includes(b))) return 'AB';

    // 季三 (AC): 3, 6, 9, 12
    const groupQ3 = ['00687B', '00751B', '00792B'];
    if (groupQ3.some(b => code.includes(b))) return 'AC';
    
    return 'AC'; // 預設季三
};

// 取得卡片顏色樣式
const getCardStyle = (etf: EtfData) => {
    let type = etf.category;
    if (etf.category === 'AE') {
        type = getBondType(etf.code) as any;
    }

    switch (type) {
        case 'AA': return 'bg-blue-50 border-blue-200';
        case 'AB': return 'bg-emerald-50 border-emerald-200';
        case 'AC': return 'bg-orange-50 border-orange-200';
        case 'AD': return 'bg-amber-50 border-amber-200';
        default: return 'bg-white border-slate-200';
    }
};

const PortfolioView: React.FC<Props> = ({ portfolio, onUpdateTransaction, onDeleteTransaction, onAddTransaction }) => {
  // UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  
  // Forms
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [addForm, setAddForm] = useState<Transaction | null>(null);

  // Toggle Expansion
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
    setEditingTxId(null);
    setEditForm(null);
    setAddingToId(null);
    setAddForm(null);
  };

  // --- Add/Edit/Delete Handlers ---
  const startAdd = (item: PortfolioItem) => {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      const defaultPrice = item.etf.priceCurrent || 0;
      setAddingToId(item.id);
      setAddForm({
          id: Date.now().toString(),
          date: today,
          shares: 1000,
          price: defaultPrice,
          totalAmount: 1000 * defaultPrice
      });
      setExpandedId(item.id);
      setEditingTxId(null);
  };

  const handleAddChange = (field: keyof Transaction, value: string | number) => {
      if (!addForm) return;
      let newVal = value;
      if (field === 'price' || field === 'shares' || field === 'totalAmount') {
           newVal = Number(value);
      }
      const updated = { ...addForm, [field]: newVal };
      if (field === 'shares' || field === 'price') {
          updated.totalAmount = Number(updated.shares) * Number(updated.price);
      }
      setAddForm(updated);
  };

  const saveAdd = (etfCode: string) => {
      if (addForm) {
          onAddTransaction(etfCode, addForm);
          setAddingToId(null);
          setAddForm(null);
      }
  };

  const cancelAdd = () => {
      setAddingToId(null);
      setAddForm(null);
  };

  const startEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditForm({ ...tx });
    setAddingToId(null);
  };

  const handleEditChange = (field: keyof Transaction, value: string | number) => {
    if (!editForm) return;
    let newVal = value;
    if (field === 'price' || field === 'shares' || field === 'totalAmount') {
         newVal = Number(value);
    }
    const updated = { ...editForm, [field]: newVal };
    if (field === 'shares' || field === 'price') {
        updated.totalAmount = Number(updated.shares) * Number(updated.price);
    }
    setEditForm(updated);
  };

  const saveEdit = (etfCode: string) => {
      if (editForm) {
          onUpdateTransaction(etfCode, editForm);
          setEditingTxId(null);
          setEditForm(null);
      }
  };

  const cancelEdit = () => {
      setEditingTxId(null);
      setEditForm(null);
  };
  
  const handleDeleteClick = (etfCode: string, txId: string) => {
      if (window.confirm("確定要刪除此筆交易紀錄嗎？")) {
          onDeleteTransaction(etfCode, txId);
      }
  };

  // --- Aggregates for A1 (Statistics) ---
  const grandTotalCost = portfolio.reduce((sum, item) => {
      return sum + item.transactions.reduce((tSum, tx) => tSum + tx.totalAmount, 0);
  }, 0);

  const holdingsCount = portfolio.length;

  // --- A3 Analysis Data Calculation (The Core Logic) ---
  const analysisData = useMemo(() => {
    const monthlyDividends = Array(12).fill(0); // Index 0 = Jan
    let weightedReturnRateSum = 0;
    let totalPortfolioCost = 0;
    
    // 1. 計算目前的總市值
    const currentMarketValue = portfolio.reduce((sum, item) => {
        const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
        return sum + (totalShares * item.etf.priceCurrent);
    }, 0);

    portfolio.forEach(item => {
        const itemTotalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
        
        // --- 修正 1: 強制計算殖利率 (若抓不到則用歷史配息回推) ---
        let effectiveYield = item.etf.dividendYield;
        
        // 如果殖利率是 0，嘗試用近一年配息計算
        if (!effectiveYield || effectiveYield === 0) {
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            const pastYearDivs = item.etf.dividends.filter(d => {
                const dDate = new Date(d.date.replace(/\./g, '/').replace(/-/g, '/'));
                return dDate >= oneYearAgo;
            }).reduce((sum, d) => sum + d.amount, 0);

            if (pastYearDivs > 0 && item.etf.priceCurrent > 0) {
                effectiveYield = (pastYearDivs / item.etf.priceCurrent) * 100;
            }
        }
        // 如果還是 0，給一個極低值避免計算錯誤，或者就真的是 0 (如不配息)
        
        // 依照使用者需求：每月預估股息 = 投資總價 * 殖利率 (並非面額或股數)
        // 使用者原話：「以(購買總價 * 殖利率) / 季(4次) or 月(12次) ,等於單次配息」
        const estimatedAnnualDivAmount = itemTotalCost * (effectiveYield / 100);

        // --- 修正 2: 精準配息週期分配 ---
        let type = item.etf.category;
        if (type === 'AE') {
            type = getBondType(item.etf.code) as any;
        }

        if (estimatedAnnualDivAmount > 0) {
            let targetMonths: number[] = [];

            if (type === 'AD') { // 月配: 1~12月
                targetMonths = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
            } else if (type === 'AA') { // 季一: 1, 4, 7, 10
                targetMonths = [0, 3, 6, 9];
            } else if (type === 'AB') { // 季二: 2, 5, 8, 11
                targetMonths = [1, 4, 7, 10];
            } else { // 季三: 3, 6, 9, 12
                targetMonths = [2, 5, 8, 11];
            }

            const amountPerPeriod = estimatedAnnualDivAmount / targetMonths.length;
            targetMonths.forEach(m => {
                monthlyDividends[m] += amountPerPeriod;
            });
        }

        // --- 計算加權平均報酬率 ---
        // 使用 ETF 本身的 returnRate (含息或不含息皆可，這裡假設是 price return)
        // 若 returnRate 為 0 (新上市)，假設為 5% 成長 (避免線條是平的)
        const rate = item.etf.returnRate !== 0 ? item.etf.returnRate : 0;
        weightedReturnRateSum += itemTotalCost * rate;
        totalPortfolioCost += itemTotalCost;
    });

    // 投資組合的加權平均年報酬率 (%)
    // 如果沒有成本 (未投資)，則為 0
    const portfolioAvgReturnRate = totalPortfolioCost > 0 ? (weightedReturnRateSum / totalPortfolioCost) : 0;
    
    // --- Line Chart Data: 兩條曲線 ---
    
    // 1. 藍線 (不含息資產成長): 本金 + 資本利得
    // 使用目前市值作為起點 (Month 0)，依據報酬率預估未來走勢
    // 公式: MonthVal = CurrentMarketVal * (1 + (AnnualRate * Month/12))
    const projectedMarketValueLine = Array(12).fill(0).map((_, idx) => {
        const monthFactor = (idx + 1) / 12; // 1/12, 2/12 ... 12/12
        // 線性成長預估
        const growthAmount = currentMarketValue * (portfolioAvgReturnRate / 100) * monthFactor;
        return currentMarketValue + growthAmount;
    });

    // 2. 綠線 (含息總資產): 藍線 + 累積股息
    let accumulatedDivs = 0;
    const projectedTotalAssetLine = projectedMarketValueLine.map((marketVal, idx) => {
        accumulatedDivs += monthlyDividends[idx];
        return marketVal + accumulatedDivs;
    });

    // Chart Scaling
    const allValues = [
        grandTotalCost, 
        currentMarketValue, 
        ...projectedTotalAssetLine, 
        ...projectedMarketValueLine
    ].filter(v => v > 0);
    
    const maxY = Math.max(...allValues) * 1.05;
    const minY = Math.min(...allValues) * 0.95;

    // 計算預估總年息
    const estimatedAnnualIncome = monthlyDividends.reduce((a, b) => a + b, 0);

    return { 
        monthlyDividends, 
        projectedMarketValueLine, // Blue Line
        projectedTotalAssetLine,  // Green Line
        maxMonthDiv: Math.max(...monthlyDividends), 
        maxY,
        minY,
        estimatedAnnualIncome,
        finalProjectedValue: projectedTotalAssetLine[11],
        portfolioAvgReturnRate,
        currentMarketValue
    };
  }, [portfolio, grandTotalCost]);

  const hasAnalysisData = analysisData.estimatedAnnualIncome > 0 || portfolio.length > 0;

  // New Metrics for Chart Description
  const unrealizedPL = analysisData.currentMarketValue - grandTotalCost;
  const plRate = grandTotalCost > 0 ? (unrealizedPL / grandTotalCost) * 100 : 0;
  
  // Future Metrics
  const estimatedFutureProfit = analysisData.finalProjectedValue - grandTotalCost;
  const estimatedFutureReturnRate = grandTotalCost > 0 ? (estimatedFutureProfit / grandTotalCost) * 100 : 0;

  // Helper for Chart Coordinates
  const getY = (val: number) => {
      const range = (analysisData.maxY - analysisData.minY) || 1;
      const relative = (val - analysisData.minY) / range;
      return 100 - (relative * 100);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* ======================= */}
      {/* A1: Statistics (Fixed)  */}
      {/* ======================= */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 shrink-0 z-20 relative">
          <div className="grid grid-cols-3 gap-2 text-center items-center">
              
              {/* Col 1 */}
              <div className="flex flex-col items-center">
                  <span className="text-[12px] font-light text-slate-500 mb-1">投資總額</span>
                  <span className="text-[18px] font-bold text-slate-800">${grandTotalCost.toLocaleString()}</span>
              </div>

              {/* Col 2 */}
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[12px] font-light text-slate-500 mb-1">預估年息</span>
                  <span className="text-[18px] font-bold text-yellow-600">${Math.round(analysisData.estimatedAnnualIncome).toLocaleString()}</span>
              </div>

              {/* Col 3 */}
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[12px] font-light text-slate-500 mb-1">投資檔數</span>
                  <span className="text-[18px] font-bold text-slate-800">{holdingsCount}</span>
              </div>
          </div>
      </div>

      {/* ========================================= */}
      {/* Scrollable Container (A2 + A3)            */}
      {/* ========================================= */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 scrollbar-hide space-y-6">
          
          {/* ======================= */}
          {/* A2: Holdings List       */}
          {/* ======================= */}
          <div>
            <h3 className="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider px-1">持股明細</h3>
            {portfolio.length > 0 ? (
                <div className="space-y-3">
                    {portfolio.map((item) => {
                        const totalShares = item.transactions.reduce((sum, tx) => sum + tx.shares, 0);
                        const totalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
                        const avgCost = totalShares > 0 ? (totalCost / totalShares).toFixed(2) : 0;
                        const isExpanded = expandedId === item.id;
                        const cardStyle = getCardStyle(item.etf);
                        
                        // 這裡也加入防呆顯示，若 etf.dividendYield 為 0 但有配息紀錄，可提示
                        const displayYield = item.etf.dividendYield;

                        return (
                            <div key={item.id} className={`rounded-xl shadow-sm border transition-all ${cardStyle} ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}>
                                {/* Master Row */}
                                <div onClick={() => toggleExpand(item.id)} className="p-4 flex flex-col gap-3 cursor-pointer active:opacity-90">
                                    <div className="flex justify-between items-center border-b border-black/5 pb-2">
                                        <div className="flex items-baseline gap-2 overflow-hidden flex-1">
                                            <span className="text-[20px] font-bold text-blue-900">{item.id}</span>
                                            <span className="text-[18px] font-light text-slate-600 truncate">{item.etf.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={(e) => { e.stopPropagation(); startAdd(item); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-blue-800 hover:bg-blue-50 transition-colors shadow-sm border border-blue-100">
                                                <Plus className="w-5 h-5" />
                                            </button>
                                            <div className="text-slate-400">
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </div>
                                        </div>
                                    </div>
                                    {/* 資訊列：4 欄 */}
                                    <div className="grid grid-cols-4 gap-1 mt-1">
                                        {/* 1. 累計張數 */}
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[12px] font-light text-slate-500">累計張數</span>
                                            <span className="text-[16px] font-bold text-slate-800">{totalShares.toLocaleString()}</span>
                                        </div>
                                        {/* 2. 平均成本 */}
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[12px] font-light text-slate-500">平均成本</span>
                                            <span className="text-[16px] font-bold text-slate-800">{avgCost}</span>
                                        </div>
                                        {/* 3. 殖利率 */}
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[12px] font-light text-slate-500">殖利率</span>
                                            <span className="text-[16px] font-bold text-slate-800">{displayYield}%</span>
                                        </div>
                                        {/* 4. 投資金額總計 */}
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-[12px] font-light text-slate-500">投資金額總計</span>
                                            <span className="text-[16px] font-bold text-slate-800">${Math.round(totalCost).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Child Table (Add/Edit Form) - 省略細節保持不變，僅需保留結構 */}
                                {isExpanded && (
                                    <div className="border-t border-black/5 bg-white/60 p-3 rounded-b-xl">
                                        {/* Add Form */}
                                        {addingToId === item.id && addForm && (
                                            <div className="bg-white rounded-lg p-4 mb-4 border border-blue-200 shadow-sm">
                                                <div className="flex justify-between items-center pb-2 border-b border-blue-100 mb-2">
                                                    <span className="text-sm font-bold text-blue-800 flex items-center gap-1"><Plus className="w-4 h-4" /> 新增交易</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 mb-4">
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[12px] font-light text-slate-500">日期</label>
                                                        <input type="text" value={addForm.date} onChange={(e) => handleAddChange('date', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full bg-slate-50" placeholder="YYYY/MM/DD" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[12px] font-light text-slate-500">成交總價</label>
                                                        <input type="number" value={addForm.totalAmount} onChange={(e) => handleAddChange('totalAmount', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-100" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[12px] font-light text-slate-500">張數</label>
                                                        <input type="number" value={addForm.shares} onChange={(e) => handleAddChange('shares', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-50" />
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[12px] font-light text-slate-500">單價</label>
                                                        <input type="number" value={addForm.price} onChange={(e) => handleAddChange('price', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-50" />
                                                    </div>
                                                </div>
                                                <div className="flex gap-3 justify-end">
                                                    <button onClick={cancelAdd} className="px-4 py-2 text-slate-500 text-sm font-bold bg-slate-100 border border-slate-200 rounded-lg">取消</button>
                                                    <button onClick={() => saveAdd(item.id)} className="px-4 py-2 text-white text-sm font-bold bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700">儲存</button>
                                                </div>
                                            </div>
                                        )}
                                        {/* Table */}
                                        <table className="w-full text-left border-collapse table-fixed">
                                            {!editingTxId && (
                                                <thead>
                                                    <tr className="text-[12px] font-light text-slate-500 border-b border-black/5">
                                                        <th className="pb-2 pl-1 font-light w-[30%]">日期</th>
                                                        <th className="pb-2 text-right font-light w-[30%]">張數/單價</th>
                                                        <th className="pb-2 text-right font-light w-[30%]">成交總價</th>
                                                        <th className="pb-2 text-right font-light w-auto">操作</th>
                                                    </tr>
                                                </thead>
                                            )}
                                            <tbody className="text-sm">
                                                {item.transactions.map((tx) => {
                                                    const isEditing = editingTxId === tx.id;
                                                    if (isEditing && editForm) {
                                                        return (
                                                            <tr key={tx.id} className="bg-orange-50 rounded-lg overflow-hidden border border-orange-200 shadow-sm block md:table-row my-2">
                                                                <td colSpan={4} className="p-4 block md:table-cell">
                                                                    <div className="flex flex-col gap-4">
                                                                        <div className="flex justify-between items-center pb-2 border-b border-orange-100 mb-1"><span className="text-sm font-bold text-orange-800">編輯交易紀錄</span></div>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                             <div className="flex flex-col gap-1.5"><label className="text-[12px] font-light text-slate-500">日期</label><input type="text" value={editForm.date} onChange={(e) => handleEditChange('date', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full bg-white" /></div>
                                                                             <div className="flex flex-col gap-1.5"><label className="text-[12px] font-light text-slate-500">成交總價</label><input type="number" value={editForm.totalAmount} onChange={(e) => handleEditChange('totalAmount', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-100" /></div>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                             <div className="flex flex-col gap-1.5"><label className="text-[12px] font-light text-slate-500">張數</label><input type="number" value={editForm.shares} onChange={(e) => handleEditChange('shares', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-white" /></div>
                                                                             <div className="flex flex-col gap-1.5"><label className="text-[12px] font-light text-slate-500">單價</label><input type="number" value={editForm.price} onChange={(e) => handleEditChange('price', e.target.value)} className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-white" /></div>
                                                                        </div>
                                                                        <div className="flex gap-3 justify-end pt-3 border-t border-orange-100 mt-2">
                                                                            <button onClick={cancelEdit} className="px-6 py-2.5 text-slate-500 text-sm font-bold bg-white border border-slate-200 rounded-xl">取消</button>
                                                                            <button onClick={() => saveEdit(item.id)} className="px-6 py-2.5 text-white text-sm font-bold bg-orange-600 rounded-xl flex items-center gap-2 shadow-sm"><Save className="w-4 h-4"/> 儲存</button>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
                                                    return (
                                                        <tr key={tx.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                                                            <td className="py-4 pl-1 text-slate-800 text-[14px] font-normal align-middle">{tx.date}</td>
                                                            <td className="py-4 text-right align-middle">
                                                                <div className="flex flex-col">
                                                                    <span className="text-[14px] font-normal text-slate-800">{tx.shares.toLocaleString()} 股</span>
                                                                    <span className="text-[14px] font-normal text-slate-500">@ {tx.price}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 text-right text-slate-800 text-[14px] font-normal align-middle">${tx.totalAmount.toLocaleString()}</td>
                                                            <td className="py-4 text-right whitespace-nowrap align-middle">
                                                                <div className="flex flex-col gap-2 items-end justify-center">
                                                                    <button onClick={(e) => { e.stopPropagation(); startEdit(tx); }} className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded" title="修改資料"><Edit3 className="w-4 h-4" /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id, tx.id); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-100 rounded" title="刪除"><Trash2 className="w-4 h-4" /></button>
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
            ) : (
                <div className="bg-white p-8 rounded-xl text-center border border-slate-200 mt-2">
                    <p className="text-lg text-slate-400">目前無自組清單</p>
                </div>
            )}
          </div>

          {/* ======================= */}
          {/* A3: Analysis View       */}
          {/* ======================= */}
          {hasAnalysisData && (
            <div className="pt-6 pb-12">
                <h3 className="text-slate-400 text-xs font-bold mb-4 uppercase tracking-wider px-1">分析畫面</h3>
                
                {/* 0. Asset Analysis (P/L) - 資產損益分析 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
                         <div className="p-1.5 bg-indigo-100 rounded-lg">
                            <Wallet className="w-5 h-5 text-indigo-600" />
                        </div>
                        <h4 className="font-bold text-slate-800">資產損益分析</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-2">
                         <div className="flex flex-col">
                             <span className="text-xs text-slate-500">目前市值 (Total Value)</span>
                             <span className="text-lg font-bold text-slate-900">${Math.round(analysisData.currentMarketValue).toLocaleString()}</span>
                         </div>
                         <div className="flex flex-col text-right">
                             <span className="text-xs text-slate-500">投入總成本 (Cost)</span>
                             <span className="text-lg font-bold text-slate-600">${grandTotalCost.toLocaleString()}</span>
                         </div>
                         <div className="flex flex-col col-span-2 border-t border-dashed border-slate-200 pt-3">
                             <div className="flex justify-between items-end">
                                 <span className="text-xs text-slate-500">帳面損益 (Unrealized P/L)</span>
                                 <div className={`flex items-center gap-1 font-bold text-xl ${unrealizedPL >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                     {unrealizedPL >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                                     ${Math.abs(Math.round(unrealizedPL)).toLocaleString()}
                                     <span className="text-sm ml-1">({plRate.toFixed(2)}%)</span>
                                 </div>
                             </div>
                         </div>
                    </div>
                </div>

                {/* 1. Bar Chart: Monthly Income */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex flex-col">
                             <h4 className="font-bold text-slate-800">每月預估股息</h4>
                             <span className="text-[10px] text-slate-400">總成本 x 殖利率 (精準分配至月份)</span>
                        </div>
                    </div>
                    
                    <div className="flex items-end justify-between gap-1.5 h-48 pt-4">
                        {analysisData.monthlyDividends.map((val, idx) => {
                            const heightPct = analysisData.maxMonthDiv > 0 ? (val / analysisData.maxMonthDiv) * 100 : 0;
                            return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                                    <div className="relative w-full flex items-end justify-center h-full bg-slate-50 rounded-t-sm">
                                        <div 
                                            className="w-full mx-0.5 bg-blue-500 rounded-t-sm transition-all duration-500 group-hover:bg-blue-600"
                                            style={{ height: `${val > 0 ? Math.max(heightPct, 4) : 0}%` }} // Ensure visible if > 0
                                        ></div>
                                        {/* Tooltip */}
                                        {val > 0 && (
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 shadow-lg pointer-events-none">
                                                ${Math.round(val).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400">{idx + 1}月</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 2. Line Chart: Cumulative Growth of Asset */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 rounded-lg">
                                <TrendingUp className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex flex-col">
                                <h4 className="font-bold text-slate-800">每月預估績效成長</h4>
                                <span className="text-[10px] text-slate-400">投入總價 vs 資產增值</span>
                            </div>
                        </div>
                        {/* Legend */}
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1 bg-emerald-500 rounded-full"></div>
                                <span className="text-[10px] text-slate-500">含息資產</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-1 bg-blue-400 rounded-full"></div>
                                <span className="text-[10px] text-slate-500">市值成長(不含息)</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="h-48 w-full relative pt-2">
                        {/* Simple SVG Line Chart */}
                        <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                            {/* Grid Lines */}
                            <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                            <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" />

                            {/* 1. Cost Line (Gray Dashed) - The Baseline */}
                            {(() => {
                                const costY = getY(grandTotalCost);
                                return (
                                    <>
                                        <line 
                                            x1="0" y1={costY} x2="100" y2={costY} 
                                            stroke="#94a3b8" strokeWidth="2" strokeDasharray="4" opacity="0.5" 
                                        />
                                        <text x="1" y={costY - 3} fontSize="4" fill="#64748b" opacity="0.6">成本</text>
                                    </>
                                );
                            })()}

                            {/* 2. Market Value Line (Blue - Excl. Divs) - now CURVED based on return rate */}
                            {analysisData.projectedMarketValueLine.length > 0 && (
                                <polyline 
                                    fill="none" 
                                    stroke="#60a5fa" // Blue-400
                                    strokeWidth="2.5" 
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={
                                        analysisData.projectedMarketValueLine.map((val, idx) => {
                                            const x = (idx / 11) * 100;
                                            const y = getY(val);
                                            return `${x},${y}`;
                                        }).join(' ')
                                    }
                                />
                            )}

                            {/* 3. Total Asset Line (Green - Incl. Divs) */}
                            {analysisData.projectedTotalAssetLine.length > 0 && (
                                <polyline 
                                    fill="none" 
                                    stroke="#10b981" // Emerald-500
                                    strokeWidth="3" 
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    points={
                                        analysisData.projectedTotalAssetLine.map((val, idx) => {
                                            const x = (idx / 11) * 100;
                                            const y = getY(val);
                                            return `${x},${y}`;
                                        }).join(' ')
                                    }
                                />
                            )}
                            
                            {/* Points for Total Asset */}
                            {analysisData.projectedTotalAssetLine.map((val, idx) => {
                                const x = (idx / 11) * 100;
                                const y = getY(val);
                                return (
                                    <circle key={`green-${idx}`} cx={x} cy={y} r="2" fill="white" stroke="#10b981" strokeWidth="2" />
                                );
                            })}
                        </svg>
                        
                        {/* X-Axis Labels */}
                        <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold px-1">
                            <span>1月</span>
                            <span>6月</span>
                            <span>12月</span>
                        </div>
                    </div>
                    
                    {/* Summary Metrics */}
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400">目前加權報酬率</span>
                            <span className={`font-bold text-sm ${analysisData.portfolioAvgReturnRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {analysisData.portfolioAvgReturnRate.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-slate-200">
                            <span className="text-[10px] text-slate-400">一年後預估獲利</span>
                            <span className={`font-bold text-sm ${estimatedFutureProfit >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {estimatedFutureProfit > 0 ? '+' : ''}{Math.round(estimatedFutureProfit).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-1 border-l border-slate-200">
                            <span className="text-[10px] text-slate-400">一年後預估總報酬</span>
                            <span className={`font-bold text-sm ${estimatedFutureReturnRate >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {estimatedFutureReturnRate.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default PortfolioView;