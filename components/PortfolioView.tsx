
import React from 'react';
import { PortfolioItem } from '../types';
import { Trash2, Wallet } from 'lucide-react';

interface Props {
  portfolio: PortfolioItem[];
  onRemove: (id: string) => void;
}

const PortfolioView: React.FC<Props> = ({ portfolio, onRemove }) => {
  // Summary Calculations
  const totalCost = portfolio.reduce((sum, item) => sum + item.totalCost, 0);
  const totalMonthlyIncome = portfolio.reduce((sum, item) => {
    return sum + (item.etf.priceCurrent * item.shares * item.etf.dividendYield / 100 / 12); 
  }, 0);

  return (
    <div className="space-y-6 pb-6">
      {/* Summary Card - Dark Blue */}
      <div className="bg-blue-900 rounded-xl p-6 text-white shadow-lg">
        <h3 className="text-blue-200 text-base font-bold mb-4 flex items-center gap-2 uppercase tracking-wider">
          <Wallet className="w-5 h-5" /> 投資組合總覽
        </h3>
        
        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          <div>
            <div className="text-blue-300 text-sm mb-1">投資金額總計</div>
            <div className="text-3xl font-bold font-mono tracking-tight text-white">
              ${totalCost.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-blue-300 text-sm mb-1">預估每月領息</div>
            <div className="text-3xl font-bold font-mono text-yellow-400 tracking-tight">
              ${Math.round(totalMonthlyIncome).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-blue-300 text-sm mb-1">平均殖利率</div>
            <div className="text-2xl font-bold">
              {portfolio.length > 0 
                ? (portfolio.reduce((sum, i) => sum + i.etf.dividendYield, 0) / portfolio.length).toFixed(2) 
                : 0}%
            </div>
          </div>
          <div>
             <div className="text-blue-300 text-sm mb-1">持有檔數</div>
             <div className="text-2xl font-bold">{portfolio.length} 檔</div>
          </div>
        </div>
      </div>

      {/* Details List (Card Style for Mobile) */}
      <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="font-bold text-xl text-slate-800">持股明細</h3>
            <button className="text-sm bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold hover:bg-blue-200">
               + 新增
            </button>
          </div>

          {portfolio.length > 0 ? (
            portfolio.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex justify-between items-center">
                    {/* Left: Info */}
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl font-bold text-slate-900">{item.etf.code}</span>
                            <span className="text-lg text-slate-600">{item.etf.name}</span>
                        </div>
                        <div className="flex gap-4 text-slate-500 text-base">
                            <span>{item.shares} 股</span>
                            <span>均價 {item.avgCost}</span>
                        </div>
                         <div className="text-lg font-bold text-slate-800 mt-2">
                             總額 ${Math.round(item.totalCost).toLocaleString()}
                        </div>
                    </div>

                    {/* Right: Action */}
                    <button 
                        onClick={() => onRemove(item.id)}
                        className="p-3 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-full transition-colors"
                    >
                        <Trash2 className="w-6 h-6" />
                    </button>
                </div>
            ))
          ) : (
            <div className="bg-white p-8 rounded-xl text-center border border-slate-200">
                <p className="text-lg text-slate-400">目前無自組清單</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default PortfolioView;
