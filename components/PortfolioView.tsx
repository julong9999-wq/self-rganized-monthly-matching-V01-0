
import React, { useState } from 'react';
import { PortfolioItem, Transaction } from '../types';
import { Trash2, Wallet, ChevronDown, ChevronUp, Edit3, Save, X, Calculator, TrendingUp } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onUpdateTransaction: (etfCode: string, tx: Transaction) => void;
  onDeleteTransaction: (etfCode: string, txId: string) => void;
}

const PortfolioView: React.FC<Props> = ({ portfolio, onUpdateTransaction, onDeleteTransaction }) => {
  // UI State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  
  // Edit Buffer State
  const [editForm, setEditForm] = useState<Transaction | null>(null);

  // Toggle Expansion
  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
    // Close any active edit when switching rows
    setEditingTxId(null);
    setEditForm(null);
  };

  // Start Editing
  const startEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditForm({ ...tx });
  };

  // Handle Input Change
  const handleEditChange = (field: keyof Transaction, value: string | number) => {
    if (!editForm) return;
    
    let newVal = value;
    if (field === 'price' || field === 'shares' || field === 'totalAmount') {
         newVal = Number(value);
    }

    const updated = { ...editForm, [field]: newVal };

    // Auto-calculate totalAmount if shares or price changes (optional UX)
    if (field === 'shares' || field === 'price') {
        updated.totalAmount = Number(updated.shares) * Number(updated.price);
    }

    setEditForm(updated);
  };

  // Save Edit
  const saveEdit = (etfCode: string) => {
      if (editForm) {
          onUpdateTransaction(etfCode, editForm);
          setEditingTxId(null);
          setEditForm(null);
      }
  };

  // Cancel Edit
  const cancelEdit = () => {
      setEditingTxId(null);
      setEditForm(null);
  };

  // --- Aggregate Calculations ---
  // 1. Total Investment
  const grandTotalCost = portfolio.reduce((sum, item) => {
      return sum + item.transactions.reduce((tSum, tx) => tSum + tx.totalAmount, 0);
  }, 0);

  // 2. Estimated Monthly Income (Simplified logic)
  const totalMonthlyIncome = portfolio.reduce((sum, item) => {
      const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
      return sum + (item.etf.priceCurrent * totalShares * item.etf.dividendYield / 100 / 12); 
  }, 0);
  
  // 3. Estimated Growth (Mockup Logic for "Monthly Performance Growth")
  // In a real app, this would compare current value vs cost.
  // Here we use the ETF's `returnRate` (Yearly) / 12 as a rough monthly proxy
  const estimatedMonthlyGrowth = portfolio.reduce((sum, item) => {
       const itemCost = item.transactions.reduce((tSum, tx) => tSum + tx.totalAmount, 0);
       return sum + (itemCost * (item.etf.returnRate / 100 / 12));
  }, 0);


  return (
    <div className="space-y-6 pb-6">
      
      {/* 1. Analysis / Summary Card (分析資料) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-blue-900" />
            <span className="font-bold text-slate-700 text-sm">分析資料</span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">每月預估股息</span>
                <span className="text-2xl font-bold text-yellow-600 font-mono tracking-tight">
                    ${Math.round(totalMonthlyIncome).toLocaleString()}
                </span>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">每月預估績效成長</span>
                 <div className="flex items-center gap-1">
                    <TrendingUp className={`w-4 h-4 ${estimatedMonthlyGrowth >= 0 ? 'text-red-500' : 'text-green-500'}`} />
                    <span className={`text-2xl font-bold font-mono tracking-tight ${estimatedMonthlyGrowth >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ${Math.round(Math.abs(estimatedMonthlyGrowth)).toLocaleString()}
                    </span>
                 </div>
            </div>
             <div className="col-span-2 pt-2 border-t border-slate-100 flex justify-between items-baseline">
                <span className="text-xs text-slate-400">總投資金額</span>
                <span className="text-lg font-bold text-slate-800 font-mono">
                    ${grandTotalCost.toLocaleString()}
                </span>
            </div>
        </div>
      </div>

      {/* 2. Portfolio List (Master-Detail) */}
      <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                 <Wallet className="w-5 h-5 text-blue-900" /> 持股明細
            </h3>
            <span className="text-xs text-slate-400">點擊卡片展開交易紀錄</span>
          </div>

          {portfolio.length > 0 ? (
            portfolio.map((item) => {
                // Calculate Aggregates for Master Row
                const totalShares = item.transactions.reduce((sum, tx) => sum + tx.shares, 0);
                const totalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
                const avgCost = totalShares > 0 ? (totalCost / totalShares).toFixed(2) : 0;
                
                const isExpanded = expandedId === item.id;

                return (
                    <div key={item.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'}`}>
                        
                        {/* A. 母表 (Master Row) */}
                        <div 
                            onClick={() => toggleExpand(item.id)}
                            className="p-4 flex flex-col gap-2 cursor-pointer active:bg-slate-50"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-blue-900">{item.id}</span>
                                    <span className="text-base text-slate-600 font-medium">{item.etf.name}</span>
                                </div>
                                <div className="text-slate-400">
                                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-sm mt-1">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-400">累計張數</span>
                                    <span className="font-bold text-slate-800">{totalShares.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-center">
                                    <span className="text-[10px] text-slate-400">平均成本</span>
                                    <span className="font-bold text-slate-800">{avgCost}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] text-slate-400">投資金額總計</span>
                                    <span className="font-bold text-slate-800">${totalCost.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* B. 子表 (Child Table - Transactions) */}
                        {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/50 p-3 rounded-b-xl">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="text-[10px] text-slate-400 border-b border-slate-200">
                                            <th className="pb-2 pl-1">日期</th>
                                            <th className="pb-2 text-right">張數</th>
                                            <th className="pb-2 text-right">單價</th>
                                            <th className="pb-2 text-right">成交總價</th>
                                            <th className="pb-2 text-right w-16">修改</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {item.transactions.map((tx) => {
                                            const isEditing = editingTxId === tx.id;
                                            
                                            if (isEditing && editForm) {
                                                // --- Edit Mode Row ---
                                                return (
                                                    <tr key={tx.id} className="bg-white">
                                                        <td className="p-1">
                                                            <input 
                                                                type="text" 
                                                                value={editForm.date}
                                                                onChange={(e) => handleEditChange('date', e.target.value)}
                                                                className="w-full text-xs p-1 border rounded"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="number" 
                                                                value={editForm.shares}
                                                                onChange={(e) => handleEditChange('shares', e.target.value)}
                                                                className="w-full text-right text-xs p-1 border rounded"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="number" 
                                                                value={editForm.price}
                                                                onChange={(e) => handleEditChange('price', e.target.value)}
                                                                className="w-full text-right text-xs p-1 border rounded"
                                                            />
                                                        </td>
                                                        <td className="p-1">
                                                            <input 
                                                                type="number" 
                                                                value={editForm.totalAmount}
                                                                onChange={(e) => handleEditChange('totalAmount', e.target.value)}
                                                                className="w-full text-right text-xs p-1 border rounded bg-slate-100"
                                                            />
                                                        </td>
                                                        <td className="p-1 text-right whitespace-nowrap">
                                                            <button onClick={() => saveEdit(item.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4"/></button>
                                                            <button onClick={cancelEdit} className="p-1 text-red-400 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                                                        </td>
                                                    </tr>
                                                );
                                            }

                                            // --- View Mode Row ---
                                            return (
                                                <tr key={tx.id} className="border-b border-slate-100 last:border-0 hover:bg-white transition-colors">
                                                    <td className="py-3 pl-1 text-slate-600 text-xs">{tx.date}</td>
                                                    <td className="py-3 text-right font-medium">{tx.shares.toLocaleString()}</td>
                                                    <td className="py-3 text-right text-slate-500">{tx.price}</td>
                                                    <td className="py-3 text-right font-medium text-slate-800">${tx.totalAmount.toLocaleString()}</td>
                                                    <td className="py-3 text-right whitespace-nowrap">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); startEdit(tx); }} 
                                                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); onDeleteTransaction(item.id, tx.id); }} 
                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded ml-1"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
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
            })
          ) : (
            <div className="bg-white p-8 rounded-xl text-center border border-slate-200">
                <p className="text-lg text-slate-400">目前無自組清單，請從「績效查詢」頁面加入</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default PortfolioView;
