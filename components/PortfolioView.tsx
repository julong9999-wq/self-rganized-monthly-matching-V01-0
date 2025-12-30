
import React, { useState, useMemo } from 'react';
import { PortfolioItem, Transaction, EtfData } from '../types';
import { Trash2, ChevronDown, ChevronUp, Edit3, Save, Plus, BarChart3, TrendingUp, Wallet, X, Calculator, LineChart, Minus, Check, Coins } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onUpdateTransaction: (etfCode: string, tx: Transaction) => void;
  onDeleteTransaction: (etfCode: string, txId: string) => void;
  onAddTransaction: (etfCode: string, tx: Transaction) => void;
}

// --- Helpers ---

const formatMoney = (val: number) => Math.round(val).toLocaleString('en-US');
const formatShare = (val: number) => Math.round(val).toLocaleString('en-US');
const formatPrice = (val: number) => val.toFixed(2);
const formatPercent = (val: number) => val.toFixed(2);
const formatDateDisplay = (dateStr: string) => {
    if(!dateStr) return '';
    const clean = dateStr.replace(/-/g, '/').replace(/\./g, '/');
    if(clean.length === 8 && !clean.includes('/')) {
        return `${clean.substring(0,4)}/${clean.substring(4,6)}/${clean.substring(6,8)}`;
    }
    return clean;
};

// 判斷債券歸屬的週期類型
const getBondType = (code: string): string => {
    const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
    if (monthlyBonds.some(b => code.includes(b))) return 'AD';
    const groupQ1 = ['00720B', '00725B', '00724B'];
    if (groupQ1.some(b => code.includes(b))) return 'AA';
    const groupQ2 = ['00679B', '00761B', '00795B'];
    if (groupQ2.some(b => code.includes(b))) return 'AB';
    return 'AC'; 
};

const getDividendMonths = (category: string, code: string): number[] => {
    let type = category;
    if (category === 'AE') type = getBondType(code);
    
    const monthlyCodes = ['00929','00939','00940','00934','00936','00943','00944','00946','00952','00961'];
    if (monthlyCodes.some(x => code.includes(x))) type = 'AD';

    switch (type) {
        case 'AA': return [0, 3, 6, 9];
        case 'AB': return [1, 4, 7, 10];
        case 'AC': return [2, 5, 8, 11];
        case 'AD': return Array.from({length: 12}, (_, i) => i);
        default: return [2, 5, 8, 11];
    }
};

// 母表 (主卡片) 樣式 - 淺色
const getCardStyle = (etf: EtfData) => {
    let type = etf.category;
    if (etf.category === 'AE') {
        type = getBondType(etf.code) as any;
    }
    switch (type) {
        case 'AA': return 'bg-blue-50 border-blue-200';     // 季一: 淡藍
        case 'AB': return 'bg-emerald-50 border-emerald-200'; // 季二: 淡綠
        case 'AC': return 'bg-orange-50 border-orange-200';  // 季三: 淡橘
        case 'AD': return 'bg-amber-50 border-amber-200';    // 月配: 茶色(淡琥珀)
        default: return 'bg-white border-slate-200';
    }
};

// 子表 (展開區) 樣式 - 加深色 (Darker)
const getChildStyle = (etf: EtfData) => {
    let type = etf.category;
    if (etf.category === 'AE') {
        type = getBondType(etf.code) as any;
    }
    switch (type) {
        case 'AA': return 'bg-blue-100 border-blue-300';     // 季一 (深一點)
        case 'AB': return 'bg-emerald-100 border-emerald-300'; // 季二 (深一點)
        case 'AC': return 'bg-orange-100 border-orange-300';  // 季三 (深一點)
        case 'AD': return 'bg-[#eaddcf] border-[#d4c5b0]';    // 月配 (茶色加深, 近似拿鐵色)
        default: return 'bg-slate-100 border-slate-300';
    }
};

const parseDateSimple = (dateStr: string): number => {
    if (!dateStr) return 0;
    const cleanStr = dateStr.trim();
    if (/^\d{8}$/.test(cleanStr)) {
         const y = parseInt(cleanStr.substring(0, 4));
         const m = parseInt(cleanStr.substring(4, 6)) - 1;
         const d = parseInt(cleanStr.substring(6, 8));
         return new Date(y, m, d).getTime();
    }
    const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
    return isNaN(standardDate.getTime()) ? 0 : standardDate.getTime();
};

const PortfolioView: React.FC<Props> = ({ portfolio, onUpdateTransaction, onDeleteTransaction, onAddTransaction }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [addingToId, setAddingToId] = useState<string | null>(null);
  
  // Forms
  const [editForm, setEditForm] = useState<Transaction | null>(null);
  const [addForm, setAddForm] = useState<Transaction | null>(null);
  
  // Analysis Expanded State
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

  // --- Add/Edit Logic ---
  const startAdd = (item: PortfolioItem) => {
      const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
      const price = item.etf.priceCurrent || 10;
      
      // 50萬預算計算整張股數 (1000股為一張)
      const budget = 500000;
      const shares = Math.floor(budget / price / 1000) * 1000; 
      const finalShares = shares > 0 ? shares : 1000;
      const totalAmount = Math.round(finalShares * price);

      setAddingToId(item.id);
      setAddForm({ 
          id: Date.now().toString(), 
          date: today, 
          shares: finalShares, 
          price: price, 
          totalAmount: totalAmount 
      });
      // 確保展開以顯示表單
      if (expandedId !== item.id) setExpandedId(item.id);
  };

  const handleFormChange = (
      formType: 'add' | 'edit', 
      field: keyof Transaction, 
      value: string
  ) => {
      const setter = formType === 'add' ? setAddForm : setEditForm;
      const currentForm = formType === 'add' ? addForm : editForm;
      if (!currentForm) return;

      let newVal: string | number = value;
      if (field !== 'date') {
          newVal = Number(value);
      }

      const updated = { ...currentForm, [field]: newVal };

      // 自動連動計算：
      // 如果使用者改了 張數 或 單價，則自動算 總價
      if (field === 'shares' || field === 'price') {
          updated.totalAmount = Math.round(Number(updated.shares) * Number(updated.price));
      }
      // 如果使用者改了 總價，**不** 反算單價或張數 (保留彈性)

      setter(updated);
  };

  const saveAdd = (etfCode: string) => { 
      if (addForm) { 
          if (addForm.shares === 0 || addForm.price === 0) { alert("數值不能為 0"); return; }
          onAddTransaction(etfCode, addForm); 
          setAddingToId(null); setAddForm(null); 
      } 
  };
  
  const startEdit = (tx: Transaction) => { 
      setEditingTxId(tx.id); setEditForm({ ...tx }); setAddingToId(null); 
  };
  
  const saveEdit = (etfCode: string) => { 
      if (editForm) { 
          if (editForm.shares === 0 || editForm.price === 0) { alert("數值不能為 0"); return; }
          onUpdateTransaction(etfCode, editForm); 
          setEditingTxId(null); setEditForm(null); 
      } 
  };

  const handleDeleteClick = (etfCode: string, txId: string) => { 
      if (window.confirm("確定刪除此筆交易?")) onDeleteTransaction(etfCode, txId); 
  };

  // --- Calculations ---
  const grandTotalCost = portfolio.reduce((sum, item) => sum + item.transactions.reduce((t, tx) => t + tx.totalAmount, 0), 0);
  const holdingsCount = portfolio.length;
  // A1: 投資張數 (股數 / 1000)
  const totalPortfolioShares = portfolio.reduce((sum, item) => sum + item.transactions.reduce((t, tx) => t + tx.shares, 0), 0) / 1000;

  const analysisData = useMemo(() => {
    const valueProfitLossList: any[] = [];   // A
    const accumulatedDividendList: any[] = []; // B-b (Detail)
    const estimatedDividendList: any[] = []; // C
    const assetGrowthList: any[] = [];       // D
    
    // B-a (Annual Stats)
    const annualDividendStats: Record<number, number> = {};

    // Charts Data
    const monthlyEstDividends = Array(12).fill(0);
    
    let totalMarketValue = 0;
    let weightedReturnRateSum = 0;
    let totalPortfolioCost = 0;
    let totalAccumulatedDividend = 0; // B總計
    let totalEstAnnualIncome = 0; // C總計
    let totalEstGainLoss = 0; // D總計

    portfolio.forEach(item => {
        const itemTotalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
        const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
        
        totalPortfolioCost += itemTotalCost;
        weightedReturnRateSum += itemTotalCost * (item.etf.returnRate || 0);
        totalMarketValue += (totalShares * item.etf.priceCurrent);

        // --- A. 資產價值損益 ---
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

        // --- B. 股息收益累積 (Historical) ---
        let itemAccumulatedDividend = 0;
        const dividends = item.etf.dividends || [];
        
        item.transactions.forEach(tx => {
            const txDateVal = parseDateSimple(tx.date);
            dividends.forEach(d => {
                const dDateVal = parseDateSimple(d.date);
                // 只有配息日 >= 買入日 才算領到
                if (dDateVal >= txDateVal) {
                    const amount = d.amount * tx.shares;
                    itemAccumulatedDividend += amount;
                    
                    // 統計年度 (B-a)
                    const year = new Date(dDateVal).getFullYear();
                    if (!annualDividendStats[year]) annualDividendStats[year] = 0;
                    annualDividendStats[year] += amount;
                }
            });
        });
        totalAccumulatedDividend += itemAccumulatedDividend;

        const actualYield = itemTotalCost > 0 ? ((itemAccumulatedDividend / itemTotalCost) * 100) : 0;

        accumulatedDividendList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            yield: actualYield,
            income: itemAccumulatedDividend
        });

        // --- C. 預估股息試算 (Projected) ---
        let annualEstIncome = 0;
        if (item.etf.dividendYield > 0) {
            annualEstIncome = itemTotalCost * (item.etf.dividendYield / 100);
        }
        totalEstAnnualIncome += annualEstIncome;
        
        let months = getDividendMonths(item.etf.category, item.etf.code);
        if (!months || months.length === 0) months = [2, 5, 8, 11];
        const frequency = Math.max(months.length, 1);
        
        if (annualEstIncome > 0) {
            const amountPerMonth = annualEstIncome / frequency;
            months.forEach(m => {
                monthlyEstDividends[m] += amountPerMonth;
            });
        }

        estimatedDividendList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            yield: item.etf.dividendYield,
            estAnnualIncome: annualEstIncome
        });

        // --- D. 預估資產增值 (Projected) ---
        const estimatedGainLoss = itemTotalCost * (item.etf.returnRate / 100);
        totalEstGainLoss += estimatedGainLoss;

        assetGrowthList.push({
            id: item.id,
            name: item.etf.name,
            totalCost: itemTotalCost,
            returnRate: item.etf.returnRate,
            estimatedGainLoss: estimatedGainLoss
        });
    });

    // Sort B-a Annual Stats
    const sortedAnnualStats = Object.entries(annualDividendStats)
        .map(([year, income]) => ({ year: parseInt(year), income }))
        .sort((a, b) => b.year - a.year); // 降序

    // Chart D Data Generation
    const portfolioAvgReturnRate = totalPortfolioCost > 0 ? (weightedReturnRateSum / totalPortfolioCost) : 0;
    
    // 1. No Div Growth
    const growthCurveNoDiv = Array(12).fill(0).map((_, idx) => {
        const month = idx + 1;
        const growthFactor = (portfolioAvgReturnRate / 100) * (month / 12);
        return totalMarketValue * (1 + growthFactor);
    });

    // 2. With Div Growth
    let accumulatedDivs = 0;
    const growthCurveWithDiv = growthCurveNoDiv.map((val, idx) => {
        accumulatedDivs += monthlyEstDividends[idx];
        return val + accumulatedDivs;
    });

    const allChartValues = [...growthCurveWithDiv, ...growthCurveNoDiv, totalMarketValue];
    const maxY = Math.max(...allChartValues) * 1.02;
    const minY = Math.min(...allChartValues) * 0.98;
    const maxDivBar = Math.max(...monthlyEstDividends);

    return {
        valueProfitLossList,
        accumulatedDividendList,
        sortedAnnualStats,
        estimatedDividendList,
        assetGrowthList,
        monthlyEstDividends,
        growthCurveNoDiv,
        growthCurveWithDiv,
        maxDivBar,
        maxY,
        minY,
        totalMarketValue,
        totalUnrealizedProfitLoss: totalMarketValue - grandTotalCost,
        totalAccumulatedDividend,
        totalEstAnnualIncome,
        totalEstGainLoss
    };
  }, [portfolio, grandTotalCost]);

  const hasData = portfolio.length > 0;
  
  const getY = (val: number) => {
      const range = (analysisData.maxY - analysisData.minY) || 1;
      return 100 - (((val - analysisData.minY) / range) * 100);
  };

  const getColor = (val: number) => val > 0 ? 'text-red-600' : val < 0 ? 'text-green-600' : 'text-slate-600';

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* A1. 統計畫面 (固定) */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-3 shrink-0 z-20">
          <div className="grid grid-cols-3 gap-1 text-center divide-x divide-slate-100">
              <div className="flex flex-col items-center">
                  <span className="text-[14px] font-light text-slate-500">投資總額</span>
                  <span className="text-[18px] font-bold text-slate-800">${formatMoney(grandTotalCost)}</span>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-[14px] font-light text-slate-500">投資檔數</span>
                  <span className="text-[18px] font-bold text-slate-800">{holdingsCount}</span>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-[14px] font-light text-slate-500">投資張數</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[18px] font-bold text-slate-800">{formatMoney(totalPortfolioShares)}</span>
                    <span className="text-[12px] text-slate-400">張</span>
                  </div>
              </div>
          </div>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-3 scrollbar-hide">
          
          {/* A2. 持股明細 (子母表) */}
          {portfolio.length > 0 && (
            <div className="space-y-2">
                {portfolio.map((item) => {
                    const totalShares = item.transactions.reduce((s, t) => s + t.shares, 0);
                    const totalCost = item.transactions.reduce((s, t) => s + t.totalAmount, 0);
                    const avgCost = totalShares > 0 ? (totalCost / totalShares).toFixed(2) : 0;
                    const isExpanded = expandedId === item.id;
                    const cardStyle = getCardStyle(item.etf);
                    const childStyle = getChildStyle(item.etf);

                    return (
                        <div key={item.id} className={`rounded-lg shadow-sm border overflow-hidden ${cardStyle} ${isExpanded ? 'ring-1 ring-blue-300' : ''}`}>
                            {/* 母表 (Parent) - 修改: 不整個 row 展開，改由箭頭展開 */}
                            <div className="p-3 flex flex-col gap-2 relative">
                                {/* Row 1: 代碼 / 名稱 / 新增按鈕 / 展開按鈕 */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-baseline gap-2 overflow-hidden flex-1">
                                        <span className="text-[20px] font-bold text-blue-700">{item.id}</span>
                                        <span className="text-[18px] font-light text-slate-500 truncate">{item.etf.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); startAdd(item); }} 
                                            className="w-8 h-8 flex justify-center items-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors shadow-sm border border-emerald-200"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => toggleExpand(item.id)}
                                            className="w-8 h-8 flex justify-center items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors shadow-sm"
                                        >
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Row 2: 累計股數 / 平均成本 / 投資金額總計 */}
                                <div className="grid grid-cols-3 gap-2 border-t border-black/5 pt-2">
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-light text-slate-500">累計股數</span>
                                        <span className="text-[18px] font-bold text-slate-800">{formatShare(totalShares)}</span>
                                    </div>
                                    <div className="flex flex-col text-center">
                                        <span className="text-[12px] font-light text-slate-500">平均成本</span>
                                        <span className="text-[18px] font-bold text-slate-800">{avgCost}</span>
                                    </div>
                                    <div className="flex flex-col text-right">
                                        <span className="text-[12px] font-light text-slate-500">投資金額總計</span>
                                        <span className="text-[18px] font-bold text-slate-800">${formatMoney(totalCost)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* 子表 (Transactions) - 使用加深色背景 */}
                            {isExpanded && (
                                <div className={`border-t px-3 py-3 space-y-3 ${childStyle}`}>
                                    
                                    {/* 新增模式 (淡灰色背景) */}
                                    {addingToId === item.id && addForm && (
                                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 mb-2 shadow-sm">
                                            {/* Row 1: 日期, 成交總價 */}
                                            <div className="grid grid-cols-2 gap-3 mb-2">
                                                <div>
                                                    <label className="text-[12px] text-slate-500 block mb-0.5 font-light">日期</label>
                                                    <input value={addForm.date} onChange={(e) => handleFormChange('add', 'date', e.target.value)} className="w-full text-[16px] p-1 border rounded bg-white text-slate-700 font-normal" placeholder="YYYY/MM/DD"/>
                                                </div>
                                                <div>
                                                    <label className="text-[12px] text-slate-500 block mb-0.5 text-right font-light">成交總價</label>
                                                    <input type="number" value={addForm.totalAmount} onChange={(e) => handleFormChange('add', 'totalAmount', e.target.value)} className="w-full text-[16px] p-1 border rounded text-right bg-white text-slate-700 font-normal" />
                                                    <div className="text-[10px] text-slate-400 text-right mt-0.5">${formatMoney(addForm.totalAmount)}</div>
                                                </div>
                                            </div>
                                            {/* Row 2: 股數, 單價 */}
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                <div>
                                                    <label className="text-[12px] text-slate-500 block mb-0.5 font-light">股數</label>
                                                    <input type="number" value={addForm.shares} onChange={(e) => handleFormChange('add', 'shares', e.target.value)} className="w-full text-[16px] p-1 border rounded bg-white text-slate-700 font-normal" />
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{formatShare(addForm.shares)} 股</div>
                                                </div>
                                                <div>
                                                    <label className="text-[12px] text-slate-500 block mb-0.5 text-right font-light">單價</label>
                                                    <input type="number" value={addForm.price} onChange={(e) => handleFormChange('add', 'price', e.target.value)} className="w-full text-[16px] p-1 border rounded text-right bg-white text-slate-700 font-normal" />
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => setAddingToId(null)} className="flex-1 py-1.5 bg-white border border-slate-300 rounded text-slate-600 text-sm">取消</button>
                                                <button onClick={() => saveAdd(item.id)} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-sm font-bold">儲存</button>
                                            </div>
                                        </div>
                                    )}

                                    {/* 交易清單 */}
                                    {item.transactions.map((tx) => {
                                        const isEditing = editingTxId === tx.id && editForm;
                                        
                                        if (isEditing) {
                                            // 編輯模式 (淡紅色背景)
                                            return (
                                                <div key={tx.id} className="bg-red-50 p-3 rounded-lg border border-red-300 shadow-sm">
                                                    {/* Row 1: 日期, 成交總價 */}
                                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                                        <div><label className="text-[12px] text-slate-500 block font-light">日期</label><input value={editForm!.date} onChange={(e) => handleFormChange('edit', 'date', e.target.value)} className="w-full text-[16px] border rounded px-1 bg-white text-slate-700 font-normal" /></div>
                                                        <div>
                                                            <label className="text-[12px] text-slate-500 block text-right font-light">成交總價</label>
                                                            <input type="number" value={editForm!.totalAmount} onChange={(e) => handleFormChange('edit', 'totalAmount', e.target.value)} className="w-full text-[16px] border rounded px-1 text-right bg-white text-slate-700 font-normal" />
                                                            <div className="text-[10px] text-slate-400 text-right mt-0.5">${formatMoney(editForm!.totalAmount)}</div>
                                                        </div>
                                                    </div>
                                                    {/* Row 2: 股數, 單價 */}
                                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                                        <div>
                                                            <label className="text-[12px] text-slate-500 block font-light">股數</label>
                                                            <input type="number" value={editForm!.shares} onChange={(e) => handleFormChange('edit', 'shares', e.target.value)} className="w-full text-[16px] border rounded px-1 bg-white text-slate-700 font-normal" />
                                                            <div className="text-[10px] text-slate-400 mt-0.5">{formatShare(editForm!.shares)} 股</div>
                                                        </div>
                                                        <div><label className="text-[12px] text-slate-500 block text-right font-light">單價</label><input type="number" value={editForm!.price} onChange={(e) => handleFormChange('edit', 'price', e.target.value)} className="w-full text-[16px] border rounded px-1 text-right bg-white text-slate-700 font-normal" /></div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setEditingTxId(null)} className="flex-1 py-1.5 bg-white border border-slate-300 rounded text-slate-600 text-sm">取消</button>
                                                        <button onClick={() => saveEdit(item.id)} className="flex-1 py-1.5 bg-blue-600 text-white rounded text-sm font-bold">儲存</button>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // 顯示模式 (圖示按鈕)
                                        return (
                                            <div key={tx.id} className="border-b border-black/10 last:border-0 pb-2 mb-2 last:pb-0 last:mb-0">
                                                {/* Row 1: 日期 / 成交總價 / 刪除圖示 */}
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[12px] font-light text-slate-500 w-20">日期</span>
                                                    <span className="text-[16px] font-light text-slate-700 flex-1 text-right pr-3 font-mono">{formatDateDisplay(tx.date)}</span>
                                                    <span className="text-[16px] font-light text-slate-700 w-24 text-right">${formatMoney(tx.totalAmount)}</span>
                                                    <button onClick={() => handleDeleteClick(item.id, tx.id)} className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/50 text-slate-400 hover:text-red-500 border border-slate-200"><Trash2 className="w-4 h-4"/></button>
                                                </div>
                                                {/* Row 2: 股數 / 單價 / 修改圖示 */}
                                                <div className="flex justify-between items-center">
                                                    <span className="text-[12px] font-light text-slate-500 w-20">股數</span>
                                                    <span className="text-[16px] font-light text-slate-700 flex-1 text-right pr-3">{formatShare(tx.shares)}</span>
                                                    <span className="text-[16px] font-light text-slate-700 w-24 text-right">@{formatPrice(tx.price)}</span>
                                                    <button onClick={() => startEdit(tx)} className="ml-2 w-7 h-7 flex items-center justify-center rounded-full bg-white/50 text-slate-400 hover:text-blue-500 border border-slate-200"><Edit3 className="w-4 h-4"/></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
          )}

          {hasData && (
            <div className="pt-2 pb-6 space-y-3">
                
                {/* A3-A. 資產價值損益 (標題含總計) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     <div onClick={() => toggleAnalysis('A')} className="p-3 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50">
                         <div className="flex items-center gap-2">
                             <div className="p-1 bg-indigo-100 rounded"><Wallet className="w-4 h-4 text-indigo-600" /></div>
                             <div className="flex items-baseline gap-2">
                                 <h4 className="font-bold text-base text-slate-800">A. 資產價值損益</h4>
                                 <span className={`text-sm font-bold ${getColor(analysisData.totalUnrealizedProfitLoss)}`}>
                                     {analysisData.totalUnrealizedProfitLoss > 0 ? '+' : ''}{formatMoney(analysisData.totalUnrealizedProfitLoss)}
                                 </span>
                             </div>
                         </div>
                         {expandedAnalysis.includes('A') ? <Minus className="w-4 h-4 text-slate-400"/> : <Plus className="w-4 h-4 text-slate-400"/>}
                     </div>
                     {expandedAnalysis.includes('A') && (
                        <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                             {analysisData.valueProfitLossList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                                    {/* Row 1: ETF名稱, 購買總價 */}
                                    <div className="flex justify-between items-center">
                                        <div className="text-[16px] text-slate-600 font-light">{row.name}</div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">購買總價</span>
                                            <span className="text-[16px] text-slate-600 font-light">${formatMoney(row.totalCost)}</span>
                                        </div>
                                    </div>
                                    {/* Row 2: 現值總價, 報酬(報酬率) */}
                                    <div className="flex justify-between items-center border-t border-slate-200/50 pt-1 mt-0.5">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">現值總價</span>
                                            <span className="text-[16px] text-slate-800 font-bold">${formatMoney(row.marketValue)}</span>
                                        </div>
                                        <div className="flex items-center gap-1 items-baseline">
                                            <span className="text-[12px] font-light text-slate-400">報酬</span>
                                            <span className={`text-[16px] font-bold ${getColor(row.profitLoss)}`}>
                                                {row.profitLoss > 0 ? '+' : ''}{formatMoney(row.profitLoss)}
                                            </span>
                                            <span className={`text-[12px] font-light ${getColor(row.profitLoss)}`}>
                                                ({formatPercent(row.profitLossRate)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                     )}
                </div>

                {/* A3-B. 股息收益累積 (標題含總計) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     <div onClick={() => toggleAnalysis('B')} className="p-3 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50">
                         <div className="flex items-center gap-2">
                             <div className="p-1 bg-amber-100 rounded"><Coins className="w-4 h-4 text-amber-600" /></div>
                             <div className="flex items-baseline gap-2">
                                 <h4 className="font-bold text-base text-slate-800">B. 股息收益累積</h4>
                                 <span className="text-sm font-bold text-amber-600">${formatMoney(analysisData.totalAccumulatedDividend)}</span>
                             </div>
                         </div>
                         {expandedAnalysis.includes('B') ? <Minus className="w-4 h-4 text-slate-400"/> : <Plus className="w-4 h-4 text-slate-400"/>}
                     </div>
                     {expandedAnalysis.includes('B') && (
                        <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-4 animate-[fadeIn_0.2s_ease-out]">
                            
                            {/* a. 以年度統計 */}
                            <div>
                                <h5 className="text-[12px] font-bold text-slate-500 mb-2 border-l-2 border-amber-400 pl-2">a. 以年度統計</h5>
                                {analysisData.sortedAnnualStats.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {analysisData.sortedAnnualStats.map((stat) => (
                                            <div key={stat.year} className="bg-amber-50/50 p-2 rounded border border-amber-100 flex justify-between items-center">
                                                <span className="text-[12px] font-light text-slate-600">年度 {stat.year}</span>
                                                <span className="text-[16px] font-bold text-slate-800">${formatMoney(stat.income)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-[12px] text-slate-400 py-2">尚無領息紀錄</div>
                                )}
                            </div>

                            {/* b. 各 ETF 明細 */}
                            <div>
                                <h5 className="text-[12px] font-bold text-slate-500 mb-2 border-l-2 border-blue-400 pl-2">b. 各 ETF 明細</h5>
                                <div className="space-y-2">
                                    {analysisData.accumulatedDividendList.map((row) => (
                                        <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                                <div className="text-[16px] text-slate-500 font-light">{row.name}</div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[12px] font-light text-slate-400">購買總價</span>
                                                    <span className="text-[16px] text-slate-600 font-light">${formatMoney(row.totalCost)}</span>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[12px] font-light text-slate-400">股息利率</span>
                                                    <span className="text-[16px] text-slate-600 font-bold">{formatPercent(row.yield)}%</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[12px] font-light text-slate-400">股息收入</span>
                                                    <span className="text-[16px] text-slate-600 font-bold">${formatMoney(row.income)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                     )}
                </div>

                {/* A3-C. 預估股息試算 (標題含總計) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     <div onClick={() => toggleAnalysis('C')} className="p-3 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50">
                         <div className="flex items-center gap-2">
                             <div className="p-1 bg-blue-100 rounded"><Calculator className="w-4 h-4 text-blue-600" /></div>
                             <div className="flex items-baseline gap-2">
                                 <h4 className="font-bold text-base text-slate-800">C. 預估股息試算</h4>
                                 <span className="text-sm font-bold text-blue-600">${formatMoney(analysisData.totalEstAnnualIncome)}</span>
                             </div>
                         </div>
                         {expandedAnalysis.includes('C') ? <Minus className="w-4 h-4 text-slate-400"/> : <Plus className="w-4 h-4 text-slate-400"/>}
                     </div>
                     {expandedAnalysis.includes('C') && (
                        <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                            {analysisData.estimatedDividendList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                                    {/* Row 1: ETF名稱, 購買總價 */}
                                    <div className="flex justify-between items-center">
                                        <div className="text-[16px] text-slate-500 font-light">{row.name}</div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">購買總價</span>
                                            <span className="text-[16px] text-slate-600 font-light">${formatMoney(row.totalCost)}</span>
                                        </div>
                                    </div>
                                    {/* Row 2: 殖利率, 預估年息 */}
                                    <div className="flex justify-between items-center border-t border-slate-200/50 pt-1 mt-0.5">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">殖利率</span>
                                            <span className="text-[16px] text-slate-500 font-bold">{row.yield}%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">預估年息</span>
                                            <span className="text-[16px] text-slate-600 font-bold">${formatMoney(row.estAnnualIncome)}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            
                            {/* Chart: Monthly Dividends Bar */}
                            <div className="mt-4 pt-2 border-t border-slate-100">
                                <div className="text-[12px] text-slate-400 font-light mb-2 text-center">每月預估股息分佈</div>
                                <div className="flex items-end justify-between gap-1 h-32 pb-2">
                                    {analysisData.monthlyEstDividends.map((val, idx) => {
                                        const heightPct = analysisData.maxDivBar > 0 ? (val / analysisData.maxDivBar) * 100 : 0;
                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                                                <div className="w-full bg-blue-100 rounded-t-sm relative" style={{ height: `${Math.max(heightPct, 1)}%` }}>
                                                    {val > 0 && <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-600 opacity-0 group-hover:opacity-100">{Math.round(val/1000)}k</div>}
                                                </div>
                                                <span className="text-[9px] text-slate-400">{idx + 1}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                     )}
                </div>

                {/* A3-D. 預估資產增值 (標題含總計) */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                     <div onClick={() => toggleAnalysis('D')} className="p-3 flex items-center justify-between cursor-pointer bg-white hover:bg-slate-50">
                         <div className="flex items-center gap-2">
                             <div className="p-1 bg-emerald-100 rounded"><LineChart className="w-4 h-4 text-emerald-600" /></div>
                             <div className="flex items-baseline gap-2">
                                 <h4 className="font-bold text-base text-slate-800">D. 預估資產增值</h4>
                                 <span className={`text-sm font-bold ${getColor(analysisData.totalEstGainLoss)}`}>
                                     {analysisData.totalEstGainLoss > 0 ? '+' : ''}{formatMoney(analysisData.totalEstGainLoss)}
                                 </span>
                             </div>
                         </div>
                         {expandedAnalysis.includes('D') ? <Minus className="w-4 h-4 text-slate-400"/> : <Plus className="w-4 h-4 text-slate-400"/>}
                     </div>
                     {expandedAnalysis.includes('D') && (
                        <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2 animate-[fadeIn_0.2s_ease-out]">
                            {analysisData.assetGrowthList.map((row) => (
                                <div key={row.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex flex-col gap-1">
                                    <div className="flex justify-between items-center">
                                        <div className="text-[16px] text-slate-500 font-normal">{row.name}</div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">購買總價</span>
                                            <span className="text-[16px] text-slate-600 font-light">${formatMoney(row.totalCost)}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">報酬率(參考)</span>
                                            <span className="text-[16px] text-slate-600 font-bold">{formatPercent(row.returnRate)}%</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[12px] font-light text-slate-400">預估增減</span>
                                            <span className={`text-[16px] font-bold ${getColor(row.estimatedGainLoss)}`}>
                                                {row.estimatedGainLoss > 0 ? '+' : ''}{formatMoney(row.estimatedGainLoss)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Chart: Growth Line */}
                            <div className="mt-4 pt-2 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="text-[12px] text-slate-400 font-light">每月預估績效成長</span>
                                    <div className="flex gap-2">
                                        <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-emerald-500"></div><span className="text-[9px] text-slate-400">含息</span></div>
                                        <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-blue-400"></div><span className="text-[9px] text-slate-400">不含息</span></div>
                                    </div>
                                </div>
                                <div className="h-32 w-full relative">
                                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <line x1="0" y1="0" x2="100" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                                        <line x1="0" y1="100" x2="100" y2="100" stroke="#f1f5f9" strokeWidth="1" />
                                        
                                        {analysisData.growthCurveNoDiv.length > 0 && <polyline fill="none" stroke="#60a5fa" strokeWidth="1.5" points={analysisData.growthCurveNoDiv.map((val, idx) => `${(idx/11)*100},${getY(val)}`).join(' ')} />}
                                        {analysisData.growthCurveWithDiv.length > 0 && <polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={analysisData.growthCurveWithDiv.map((val, idx) => `${(idx/11)*100},${getY(val)}`).join(' ')} />}
                                    </svg>
                                </div>
                            </div>
                        </div>
                     )}
                </div>
            </div>
          )}
      </div>
    </div>
  );
};
export default PortfolioView;
