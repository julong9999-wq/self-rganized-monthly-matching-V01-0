
import React, { useState } from 'react';
import { PortfolioItem, Transaction, EtfData } from '../types';
import { Trash2, Wallet, ChevronDown, ChevronUp, Edit3, Save, Plus, Calculator, TrendingUp } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onUpdateTransaction: (etfCode: string, tx: Transaction) => void;
  onDeleteTransaction: (etfCode: string, txId: string) => void;
  onAddTransaction: (etfCode: string, tx: Transaction) => void;
}

// 輔助函式：判斷債券類型 (複製自 PerformanceView 以保持一致性)
const getBondType = (code: string): string => {
    // 月配 (AD)
    const monthlyBonds = ['00937B', '00772B', '00933B', '00773B'];
    if (monthlyBonds.some(b => code.includes(b))) return 'AD';

    // 季一 (AA)
    const groupQ1 = ['00720B', '00725B', '00724B'];
    if (groupQ1.some(b => code.includes(b))) return 'AA';

    // 季二 (AB)
    const groupQ2 = ['00679B', '00761B', '00795B'];
    if (groupQ2.some(b => code.includes(b))) return 'AB';

    // 季三 (AC)
    const groupQ3 = ['00687B', '00751B', '00792B'];
    if (groupQ3.some(b => code.includes(b))) return 'AC';
    
    return 'AC'; 
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
    // Close any active edit/add when switching rows
    setEditingTxId(null);
    setEditForm(null);
    setAddingToId(null);
    setAddForm(null);
  };

  // --- Add Mode ---
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
      // Ensure row is expanded
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

  // --- Edit Mode ---
  const startEdit = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setEditForm({ ...tx });
    setAddingToId(null); // Close add mode if open
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
  
  // --- Delete Handler with Confirmation ---
  const handleDeleteClick = (etfCode: string, txId: string) => {
      if (window.confirm("確定要刪除此筆交易紀錄嗎？")) {
          onDeleteTransaction(etfCode, txId);
      }
  };

  // --- Aggregates ---
  const grandTotalCost = portfolio.reduce((sum, item) => {
      return sum + item.transactions.reduce((tSum, tx) => tSum + tx.totalAmount, 0);
  }, 0);

  // 計算月配息 (預估)
  const totalMonthlyIncome = portfolio.reduce((sum, item) => {
      const totalShares = item.transactions.reduce((s, tx) => s + tx.shares, 0);
      return sum + (item.etf.priceCurrent * totalShares * item.etf.dividendYield / 100 / 12); 
  }, 0);
  
  // 預估年息 = 月配 * 12
  const estimatedAnnualIncome = totalMonthlyIncome * 12;

  // 投資檔數
  const holdingsCount = portfolio.length;


  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* A1: Statistics (Fixed at Top) - Section 2 */}
      <div className="bg-white shadow-sm border-b border-slate-200 p-4 shrink-0 z-10">
          <div className="grid grid-cols-3 gap-2 text-center items-center">
              
              {/* Col 1: 投資總額 */}
              <div className="flex flex-col items-center">
                  <span className="text-[14px] font-light text-slate-500 mb-1">
                      投資總額
                  </span>
                  <span className="text-[18px] font-bold text-slate-800">
                      ${grandTotalCost.toLocaleString()}
                  </span>
              </div>

              {/* Col 2: 預估年息 */}
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[14px] font-light text-slate-500 mb-1">
                      預估年息
                  </span>
                  <span className="text-[18px] font-bold text-yellow-600">
                      ${Math.round(estimatedAnnualIncome).toLocaleString()}
                  </span>
              </div>

              {/* Col 3: 投資檔數 */}
              <div className="flex flex-col items-center border-l border-slate-100">
                  <span className="text-[14px] font-light text-slate-500 mb-1">
                      投資檔數
                  </span>
                  <span className="text-[18px] font-bold text-slate-800">
                      {holdingsCount}
                  </span>
              </div>
          </div>
      </div>

      {/* A2: Holdings List (Scrollable Area) - Section 3 */}
      <div className="flex-1 overflow-y-auto p-4 pt-2 scrollbar-hide">
          {portfolio.length > 0 ? (
            <div className="space-y-3 pb-20">
                {portfolio.map((item) => {
                    // Aggregates for Master Row
                    const totalShares = item.transactions.reduce((sum, tx) => sum + tx.shares, 0);
                    const totalCost = item.transactions.reduce((sum, tx) => sum + tx.totalAmount, 0);
                    const avgCost = totalShares > 0 ? (totalCost / totalShares).toFixed(2) : 0;
                    
                    const isExpanded = expandedId === item.id;
                    const cardStyle = getCardStyle(item.etf);

                    return (
                        <div key={item.id} className={`rounded-xl shadow-sm border transition-all ${cardStyle} ${isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : ''}`}>
                            
                            {/* A. 母表 (Master Row) - 大字體 */}
                            <div 
                                onClick={() => toggleExpand(item.id)}
                                className="p-4 flex flex-col gap-3 cursor-pointer active:opacity-90"
                            >
                                {/* Line 1: Code (Blue 20px Bold), Name (Gray 18px Light), Add Button (+ Only), Arrow */}
                                <div className="flex justify-between items-center border-b border-black/5 pb-2">
                                    <div className="flex items-baseline gap-2 overflow-hidden flex-1">
                                        <span className="text-[20px] font-bold text-blue-900">{item.id}</span>
                                        <span className="text-[18px] font-light text-slate-600 truncate">{item.etf.name}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* 1. Add Button: Icon Only (+) */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); startAdd(item); }}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-blue-800 hover:bg-blue-50 transition-colors shadow-sm border border-blue-100"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                        
                                        <div className="text-slate-400">
                                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Line 2: Stats (Label 12px Light, Value 16px Normal) */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[12px] font-light text-slate-500">累計張數</span>
                                        {/* 修改為 16px 正常 (非粗體) */}
                                        <span className="text-[16px] font-normal text-slate-800">{totalShares.toLocaleString()}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[12px] font-light text-slate-500">平均成本</span>
                                        {/* 修改為 16px 正常 (非粗體) */}
                                        <span className="text-[16px] font-normal text-slate-800">{avgCost}</span>
                                    </div>
                                    <div className="flex flex-col items-center text-center">
                                        <span className="text-[12px] font-light text-slate-500">投資金額總計</span>
                                        {/* 修改為 16px 正常 (非粗體) */}
                                        <span className="text-[16px] font-normal text-slate-800">${totalCost.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* B. 子表 (Child Table - Transactions) - 小字體 (14px) */}
                            {isExpanded && (
                                <div className="border-t border-black/5 bg-white/60 p-3 rounded-b-xl">
                                    
                                    {/* 1. Add Form */}
                                    {addingToId === item.id && addForm && (
                                        <div className="bg-white rounded-lg p-4 mb-4 border border-blue-200 shadow-sm">
                                            <div className="flex justify-between items-center pb-2 border-b border-blue-100 mb-2">
                                                <span className="text-sm font-bold text-blue-800 flex items-center gap-1">
                                                    <Plus className="w-4 h-4" /> 新增交易
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[12px] font-light text-slate-500">日期</label>
                                                    <input 
                                                        type="text" value={addForm.date} onChange={(e) => handleAddChange('date', e.target.value)}
                                                        className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full bg-slate-50" placeholder="YYYY/MM/DD"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[12px] font-light text-slate-500">成交總價</label>
                                                    <input 
                                                        type="number" value={addForm.totalAmount} onChange={(e) => handleAddChange('totalAmount', e.target.value)}
                                                        className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-100"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[12px] font-light text-slate-500">張數</label>
                                                    <input 
                                                        type="number" value={addForm.shares} onChange={(e) => handleAddChange('shares', e.target.value)}
                                                        className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-50"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[12px] font-light text-slate-500">單價</label>
                                                    <input 
                                                        type="number" value={addForm.price} onChange={(e) => handleAddChange('price', e.target.value)}
                                                        className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex gap-3 justify-end">
                                                <button onClick={cancelAdd} className="px-4 py-2 text-slate-500 text-sm font-bold bg-slate-100 border border-slate-200 rounded-lg">取消</button>
                                                <button onClick={() => saveAdd(item.id)} className="px-4 py-2 text-white text-sm font-bold bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700">儲存</button>
                                            </div>
                                        </div>
                                    )}

                                    <table className="w-full text-left border-collapse table-fixed">
                                        {/* Header: 12px Light Gray */}
                                        {!editingTxId && (
                                            <thead>
                                                <tr className="text-[12px] font-light text-slate-500 border-b border-black/5">
                                                    {/* 4. 子表寬度 三欄位均分 (約30%), 剩餘給按鈕 */}
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
                                                    // --- Edit Mode ---
                                                    return (
                                                        <tr key={tx.id} className="bg-orange-50 rounded-lg overflow-hidden border border-orange-200 shadow-sm block md:table-row my-2">
                                                            <td colSpan={4} className="p-4 block md:table-cell">
                                                                <div className="flex flex-col gap-4">
                                                                    <div className="flex justify-between items-center pb-2 border-b border-orange-100 mb-1">
                                                                        <span className="text-sm font-bold text-orange-800">編輯交易紀錄</span>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[12px] font-light text-slate-500">日期</label>
                                                                            <input 
                                                                                type="text" value={editForm.date} onChange={(e) => handleEditChange('date', e.target.value)}
                                                                                className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full bg-white" placeholder="YYYY/MM/DD"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[12px] font-light text-slate-500">成交總價</label>
                                                                            <input 
                                                                                type="number" value={editForm.totalAmount} onChange={(e) => handleEditChange('totalAmount', e.target.value)}
                                                                                className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-slate-100"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[12px] font-light text-slate-500">張數</label>
                                                                            <input 
                                                                                type="number" value={editForm.shares} onChange={(e) => handleEditChange('shares', e.target.value)}
                                                                                className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-white"
                                                                            />
                                                                        </div>
                                                                        <div className="flex flex-col gap-1.5">
                                                                            <label className="text-[12px] font-light text-slate-500">單價</label>
                                                                            <input 
                                                                                type="number" value={editForm.price} onChange={(e) => handleEditChange('price', e.target.value)}
                                                                                className="text-[16px] font-bold text-slate-900 border border-slate-300 rounded-lg px-3 py-2 w-full text-right bg-white"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-3 justify-end pt-3 border-t border-orange-100 mt-2">
                                                                        <button onClick={cancelEdit} className="px-6 py-2.5 text-slate-500 text-sm font-bold bg-white border border-slate-200 rounded-xl">取消</button>
                                                                        <button onClick={() => saveEdit(item.id)} className="px-6 py-2.5 text-white text-sm font-bold bg-orange-600 rounded-xl flex items-center gap-2 shadow-sm">
                                                                            <Save className="w-4 h-4"/> 儲存
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                }

                                                // --- View Mode Row (14px Normal) ---
                                                return (
                                                    <tr key={tx.id} className="border-b border-black/5 last:border-0 hover:bg-black/5 transition-colors">
                                                        <td className="py-4 pl-1 text-slate-800 text-[14px] font-normal align-middle">{tx.date}</td>
                                                        
                                                        {/* Stacked Shares / Price */}
                                                        <td className="py-4 text-right align-middle">
                                                            <div className="flex flex-col">
                                                                <span className="text-[14px] font-normal text-slate-800">{tx.shares.toLocaleString()} 股</span>
                                                                {/* 5. 單價字體大小 14px, 灰色 */}
                                                                <span className="text-[14px] font-normal text-slate-500">@ {tx.price}</span>
                                                            </div>
                                                        </td>
                                                        
                                                        <td className="py-4 text-right text-slate-800 text-[14px] font-normal align-middle">${tx.totalAmount.toLocaleString()}</td>
                                                        
                                                        <td className="py-4 text-right whitespace-nowrap align-middle">
                                                            {/* 3. 刪除與修改 上下排列 */}
                                                            <div className="flex flex-col gap-2 items-end justify-center">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); startEdit(tx); }} 
                                                                    className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded"
                                                                    title="修改資料"
                                                                >
                                                                    <Edit3 className="w-4 h-4" />
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(item.id, tx.id); }} 
                                                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-100 rounded"
                                                                    title="刪除"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
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
            <div className="bg-white p-8 rounded-xl text-center border border-slate-200 mt-4">
                <p className="text-lg text-slate-400">目前無自組清單，請從「績效查詢」頁面加入</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default PortfolioView;
