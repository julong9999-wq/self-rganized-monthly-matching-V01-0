import React from 'react';
import { BookOpen, Database, CheckCircle, Zap, Calendar, Search, ShieldCheck, Target, ListChecks } from 'lucide-react';

const FeasibilityCheck: React.FC = () => {
  return (
    <div className="bg-white border border-indigo-200 rounded-xl shadow-sm mb-8 overflow-hidden">
      <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-700" />
        <h3 className="text-lg font-bold text-indigo-900">專案目標：00888 與 13 檔債券 全面稽核</h3>
      </div>
      
      <div className="p-6 text-slate-700 space-y-6">
        <p>
          系統將執行高強度的歷史數據檢索，目標是驗證 <strong>00888</strong> 以及表單內的 <strong>13 筆債券 ETF</strong> 是否能完整抓取 8 個時間點的股價。
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Rules Display */}
          <div className="bg-white border border-indigo-100 rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-5 h-5 text-indigo-500" />
              <h4 className="font-semibold text-indigo-900">8 大查核時間點</h4>
            </div>
            <ul className="text-xs space-y-1.5 list-decimal pl-4 text-slate-600">
              <li>2025/1/2 (年初開盤)</li>
              <li>上個月月初 (首交易日)</li>
              <li>上個月月底 (末交易日)</li>
              <li>本月月初 (首交易日)</li>
              <li>上週 (首交易日)</li>
              <li>上週 (末交易日)</li>
              <li>本週 (首交易日)</li>
              <li>前一交易日 (昨日)</li>
            </ul>
          </div>

          {/* Action Plan */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 relative overflow-hidden">
             <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded-bl">Deep Scan</div>
            <div className="flex items-center gap-2 mb-3">
              <ListChecks className="w-5 h-5 text-slate-700" />
              <h4 className="font-semibold text-slate-900">執行策略</h4>
            </div>
            <ul className="text-sm space-y-2 list-disc pl-4 text-slate-800">
              <li>
                <strong>00888 壓力測試：</strong> 嘗試抓取全部 8 個時間點，測試 Google 歷史資料的完整性。
              </li>
              <li>
                <strong>債券群組掃描：</strong> 自動從表單中辨識出約 13 檔債券 ETF，並逐一進行 8 點查價。
              </li>
              <li>
                <strong>成功率報告：</strong> 最終報告將顯示「抓取成功率 (例如 8/8)」，若有缺漏將標示為 ❌ 空白。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeasibilityCheck;