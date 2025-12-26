
import React, { useState } from 'react';
import { Play, Database } from 'lucide-react';

interface Props {
  defaultUrl1: string;
  defaultUrl2: string;
  onStart: (url1: string, url2: string) => void;
  isLoading: boolean;
}

const SheetConfigView: React.FC<Props> = ({ defaultUrl1, defaultUrl2, onStart, isLoading }) => {
  const [url1, setUrl1] = useState(defaultUrl1);
  const [url2, setUrl2] = useState(defaultUrl2);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(url1, url2);
  };

  return (
    <div className="min-h-full flex flex-col justify-center pb-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 w-full overflow-hidden">
        
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-3">
              <label className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-900" />
                配息資料表單 (Sheet 1)
              </label>
              <input
                type="text"
                value={url1}
                onChange={(e) => setUrl1(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="w-full px-4 py-4 rounded-xl border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all text-lg text-slate-700 bg-slate-50"
              />
            </div>

            <div className="space-y-3">
              <label className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                股價/庫存表單 (Sheet 2)
              </label>
              <input
                type="text"
                value={url2}
                onChange={(e) => setUrl2(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/..."
                className="w-full px-4 py-4 rounded-xl border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-200 transition-all text-lg text-slate-700 bg-slate-50"
              />
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-900 text-white font-bold py-4 rounded-xl hover:bg-blue-800 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-xl"
              >
                {isLoading ? (
                  <>處理中...</>
                ) : (
                  <>
                    <Play className="w-6 h-6 fill-current" />
                    讀取並分析
                  </>
                )}
              </button>
            </div>
            
            <div className="text-center">
                <p className="text-sm text-slate-400 mt-2">
                    系統將自動解析 CSV 格式
                </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SheetConfigView;
