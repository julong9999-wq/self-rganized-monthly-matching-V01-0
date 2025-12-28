
import React, { useState, useEffect, useRef } from 'react';
import { EtfData } from '../types';
import { generateSmartPlan } from '../services/geminiService';
import { BrainCircuit, Mic, MicOff, Play, RefreshCcw, Coins, Key, CircleHelp, Eraser } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  etfs: EtfData[];
  hasKey: boolean;
  onOpenKeySettings: () => void;
  onOpenHelp: () => void;
}

const DEFAULT_PROMPT = "股債配置 80 : 20 , 股票產業分散 ,季配型各季 * 1 , 月配 * 2 , 均衡股息收入";

const PlanningView: React.FC<Props> = ({ etfs, hasKey, onOpenKeySettings, onOpenHelp }) => {
  // Input State
  const [budget, setBudget] = useState<number>(500); // Unit: 萬
  const [prompt, setPrompt] = useState<string>(DEFAULT_PROMPT);
  
  // Interaction State
  const [isListening, setIsListening] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string>("");
  
  // Refs (用來儲存當前的辨識物件，方便中斷)
  const recognitionInstance = useRef<any>(null);

  // Component Unmount 時確保停止錄音
  useEffect(() => {
    return () => {
      if (recognitionInstance.current) {
        try {
            recognitionInstance.current.stop();
        } catch(e) {}
      }
    };
  }, []);

  // 清除文字功能
  const handleClearPrompt = () => {
      if (window.confirm("確定要清除目前的規劃需求文字嗎？")) {
          setPrompt("");
      }
  };

  const toggleListening = () => {
    // 1. 停止目前的錄音 (如果正在錄)
    if (isListening) {
        if (recognitionInstance.current) {
            try {
                recognitionInstance.current.stop();
            } catch (e) {
                console.warn("Stop failed", e);
            }
        }
        setIsListening(false);
        return;
    }

    // 2. 檢查瀏覽器支援
    if (typeof window === 'undefined') return;
    
    // 擴充型別定義以支援不同瀏覽器前綴
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("您的瀏覽器不支援語音輸入功能 (Web Speech API)，請嘗試使用 Chrome, Safari 或 Edge 瀏覽器。");
      return;
    }

    // 3. 建立新的辨識實例 (每次重新建立比較穩定)
    try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-TW'; // 設定語言為繁體中文
        recognition.continuous = false; // 手機上 false 比較穩定，講完一句自動停止
        recognition.interimResults = false; // 不顯示過程，只顯示結果
        
        recognition.onstart = () => {
            setIsListening(true);
        };

        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
                setPrompt(prev => {
                    const cleanPrev = prev.trim();
                    // 如果原本沒字，直接取代；有字則加逗號
                    if (!cleanPrev) return transcript;
                    // 簡單判斷結尾是否有標點
                    const lastChar = cleanPrev.slice(-1);
                    if ([',', '，', '.', '。', ' '].includes(lastChar)) {
                        return `${cleanPrev}${transcript}`;
                    }
                    return `${cleanPrev}，${transcript}`;
                });
            }
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                alert("請允許麥克風權限以使用語音輸入。");
            } else if (event.error === 'no-speech') {
                // 沒講話自動停止，不需報錯
            } else {
                // 其他錯誤
                // alert("語音辨識發生錯誤: " + event.error);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionInstance.current = null;
        };

        // 儲存實例並開始
        recognitionInstance.current = recognition;
        recognition.start();

    } catch (e) {
        console.error("Failed to initialize speech recognition", e);
        alert("語音功能初始化失敗，請重新整理頁面再試。");
        setIsListening(false);
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
            <BrainCircuit className="w-8 h-8 text-blue-600" />
            <h2 className="text-3xl font-bold text-slate-800">AI 智慧規劃</h2>
          </div>
          <div className="flex items-center gap-1">
             <button 
                onClick={onOpenKeySettings}
                className={`p-2 rounded-full transition-all ${!hasKey ? 'bg-yellow-100 text-yellow-600 animate-pulse ring-2 ring-yellow-300' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
                title={!hasKey ? "請設定 API Key" : "設定 API Key"}
             >
                <Key className="w-5 h-5" />
             </button>
             <button 
                onClick={onOpenHelp}
                className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-all"
                title="說明文件"
             >
                <CircleHelp className="w-5 h-5" />
             </button>
          </div>
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
            <div className="flex justify-between items-end mb-2">
                <label className="text-sm font-bold text-slate-600">規劃需求 (Prompt)</label>
                <div className="flex gap-2">
                    {/* 清除按鈕 */}
                    <button 
                        onClick={handleClearPrompt}
                        className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 px-2 py-1 rounded-full transition-colors"
                        title="清除內容"
                    >
                        <Eraser className="w-3 h-3" /> 清除
                    </button>
                    {/* 語音提示 */}
                    <span className={`text-xs font-normal px-2 py-1 rounded-full transition-colors ${isListening ? 'text-white bg-red-500 animate-pulse' : 'text-blue-600 bg-blue-50'}`}>
                        {isListening ? '正在聆聽...' : '可語音輸入'}
                    </span>
                </div>
            </div>
            
            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full p-4 pr-12 bg-slate-50 border border-slate-300 rounded-xl text-base text-slate-700 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 transition-all min-h-[120px] resize-none leading-relaxed"
                placeholder="請輸入您的投資策略..."
              />
              {/* 語音按鈕 (放在輸入框內右下角) */}
              <button
                onClick={toggleListening}
                className={`absolute right-3 bottom-3 p-3 rounded-full transition-all shadow-sm flex items-center justify-center ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200 scale-110' 
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
                    // 修正：文字大小改為 text-lg (18px)
                    p: ({node, ...props}) => <p className="text-lg text-slate-700 leading-relaxed mb-4" {...props} />,
                    
                    // 清單樣式
                    ul: ({node, ...props}) => <ul className="space-y-3 mb-6" {...props} />,
                    li: ({node, ...props}) => <li className="text-lg text-slate-700 pl-2 border-l-2 border-blue-200 ml-1 leading-relaxed" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold text-blue-900" {...props} />,
                    
                    // 標題樣式
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1 border-slate-100" {...props} />,
                    // H3 改為卡片式標籤
                    h3: ({node, ...props}) => <h3 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded-lg mt-6 mb-3 shadow-sm inline-block" {...props} />,
                    
                    hr: ({node, ...props}) => <hr className="my-6 border-slate-200 border-dashed" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 py-3 rounded-r-lg italic text-slate-700 my-4 text-lg" {...props} />
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
