
import React, { useState, useRef, useEffect } from 'react';
import { EtfData } from '../types';
import { generateSmartPlan } from '../services/geminiService';
import { BrainCircuit, Mic, MicOff, Play, RefreshCcw, Coins, Key } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  etfs: EtfData[];
  hasKey: boolean;
  onOpenKeySettings: () => void;
}

const DEFAULT_PROMPT = "股債配置 80 : 20 , 股票產業分散 ,季配型各季 * 1 , 月配 * 2 , 均衡股息收入";

const PlanningView: React.FC<Props> = ({ etfs, hasKey, onOpenKeySettings }) => {
  // Input State
  const [budget, setBudget] = useState<number>(500); // Unit: 萬
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  
  // Interaction State
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>("");
  
  // Refs
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize Speech Recognition if available
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = 'zh-TW';
        recognitionRef.current.interimResults = false;

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setPrompt(prev => prev ? `${prev} , ${transcript}` : transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("您的瀏覽器不支援語音輸入功能");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleStartPlanning = async () => {
    if (!prompt.trim()) {
      alert("請輸入規劃需求");
      return;
    }
    if (etfs.length === 0) {
      alert("目前無 ETF 資料，無法進行規劃，請先至「設定資料來源」讀取資料。");
      return;
    }

    setIsGenerating(true);
    setResult(""); // Clear previous result

    try {
      await generateSmartPlan(etfs, budget, prompt, (text) => {
        setResult(prev => prev + text);
      });
    } catch (e) {
      setResult("規劃過程發生錯誤，請稍後再試。");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 p-4 overflow-y-auto scrollbar-hide">
      
      {/* Input Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 shrink-0">
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800">AI 智慧規劃</h2>
          </div>
          <button 
             onClick={onOpenKeySettings}
             className={`p-2 rounded-full transition-all ${!hasKey ? 'bg-yellow-100 text-yellow-600 animate-pulse ring-2 ring-yellow-300' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
             title={!hasKey ? "請設定 API Key" : "設定 API Key"}
          >
             <Key className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Budget Input */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center gap-1">
              <Coins className="w-4 h-4 text-amber-500" />
              規劃金額 (萬元)
            </label>
            <div className="relative">
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-300 rounded-xl text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all text-right"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">萬</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 text-right">
              約 {(budget * 10000).toLocaleString()} TWD
            </p>
          </div>

          {/* Prompt Input */}
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2 flex justify-between items-center">
              <span>規劃提示詞 (Prompt)</span>
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                可語音輸入
              </span>
            </label>
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-4 pr-12 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all min-h-[120px] resize-none leading-relaxed"
                placeholder="請輸入您的投資策略..."
              />
              <button
                onClick={toggleListening}
                className={`absolute right-3 bottom-3 p-2 rounded-full transition-all shadow-sm ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-white text-slate-400 border border-slate-200 hover:text-blue-600 hover:border-blue-200'
                }`}
                title="語音輸入"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartPlanning}
            disabled={isGenerating}
            className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 text-lg transition-all active:scale-[0.98] ${
              isGenerating 
                ? 'bg-blue-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCcw className="w-5 h-5 animate-spin" />
                規劃運算中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                開始規劃
              </>
            )}
          </button>
        </div>
      </div>

      {/* Result Area */}
      {result && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 animate-[fadeIn_0.5s_ease-out] mb-6">
          <div className="prose prose-slate max-w-none">
             <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                    // 強制設定文字大小為 16px (text-base)
                    p: ({node, ...props}) => <p className="text-base text-slate-700 leading-relaxed mb-4" {...props} />,
                    li: ({node, ...props}) => <li className="text-base text-slate-700 leading-relaxed" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-blue-900" {...props} />,
                    
                    // 表格樣式優化: 手機直向閱讀
                    table: ({node, ...props}) => <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg shadow-sm"><table className="min-w-full divide-y divide-slate-200" {...props} /></div>,
                    thead: ({node, ...props}) => <thead className="bg-blue-50 text-blue-900 font-bold" {...props} />,
                    tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-200 bg-white" {...props} />,
                    tr: ({node, ...props}) => <tr className="hover:bg-slate-50/50 transition-colors" {...props} />,
                    // th: 標題保持不換行，確保寬度足夠
                    th: ({node, ...props}) => <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b border-blue-100 min-w-[60px]" {...props} />,
                    // td: 內容允許換行，增加 min-w 防止過度擠壓，align-top 讓長文對齊頂部
                    td: ({node, ...props}) => <td className="px-3 py-3 text-base text-slate-700 border-b border-slate-100 min-w-[80px] align-top leading-relaxed" {...props} />,
                    
                    // 標題樣式
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1 border-slate-100" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-800 mt-4 mb-2" {...props} />,
                }}
             >
                {result}
             </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanningView;
