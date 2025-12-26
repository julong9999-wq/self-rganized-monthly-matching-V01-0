
import React, { useState, useEffect, useCallback } from 'react';
import { EtfData, PortfolioItem } from './types';
import { convertToCsvUrl, parseEtfData, parseDividendData } from './utils/sheetHelpers';
import { analyzeSheets } from './services/geminiService';
import PerformanceView from './components/PerformanceView';
import PortfolioView from './components/PortfolioView';
import SheetConfigView from './components/SheetConfigView';
import { LayoutDashboard, PieChart, BrainCircuit, Bot, Megaphone, ArrowLeft, RotateCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Default URLs
const DEFAULT_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1Vpn2SSkcf7QLqoMoAsdyusxtydfgIQD8pyoV6XojGFnf0zGu_WWuRnI4N3U-Hu0iGRzTrR7N-OD9/pub?output=csv";
const DEFAULT_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdHAXZ0A9Uno0bztIwJbuYSmLUAXUR8SDeHn-Z6GWkuwx1PGkUppejuytX2fjB33kRO1hV35Ku31fl/pub?output=csv";

type Tab = 'performance' | 'portfolio' | 'planning' | 'diagnosis' | 'announcement';

const CACHE_KEY_DATA_1 = 'sheet_data_1';
const CACHE_KEY_DATA_2 = 'sheet_data_2';
const CACHE_KEY_TIME = 'sheet_last_fetch_time';
const CACHE_DURATION = 15 * 60 * 1000; // 15 分鐘 (毫秒)

const App: React.FC = () => {
  // App State
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('performance');
  
  // Data State
  const [etfs, setEtfs] = useState<EtfData[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rawData1, setRawData1] = useState("");
  const [rawData2, setRawData2] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // AI State
  const [diagnosis, setDiagnosis] = useState("");
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Helper to prevent infinite loading
  const fetchWithTimeout = async (url: string, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  // 處理資料解析與狀態設定 (共用邏輯)
  const processData = (txt1: string, txt2: string) => {
      const parsedEtfs = parseEtfData(txt2);
      const dividendMap = parseDividendData(txt1);

      if (parsedEtfs.length === 0) {
           console.warn("No ETFs parsed.");
      }

      const mergedEtfs = parsedEtfs.map(etf => ({
          ...etf,
          dividends: dividendMap[etf.code] || []
      }));

      setEtfs(mergedEtfs);
      setRawData1(txt1);
      setRawData2(txt2);
      setIsConfigured(true);
  };

  const handleStartDataLoad = async (url1: string, url2: string, forceRefresh = false) => {
    setIsLoading(true);
    try {
        // 1. 檢查快取
        const cachedTimeStr = localStorage.getItem(CACHE_KEY_TIME);
        const cachedData1 = localStorage.getItem(CACHE_KEY_DATA_1);
        const cachedData2 = localStorage.getItem(CACHE_KEY_DATA_2);
        
        const now = Date.now();
        const isCacheValid = cachedTimeStr && (now - Number(cachedTimeStr) < CACHE_DURATION);

        // 如果不是強制重新整理，且快取有效，直接使用快取
        if (!forceRefresh && isCacheValid && cachedData1 && cachedData2) {
            console.log("Using Cached Data");
            processData(cachedData1, cachedData2);
            setLastUpdated(new Date(Number(cachedTimeStr)));
            setIsLoading(false);
            return;
        }

        // 2. 執行網路請求
        const csvUrl1 = convertToCsvUrl(url1);
        const csvUrl2 = convertToCsvUrl(url2);

        const [res1, res2] = await Promise.all([
            fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl1)}`),
            fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(csvUrl2)}`)
        ]);
        
        if (!res1.ok || !res2.ok) throw new Error("無法讀取 Google Sheet (網路回應錯誤)");

        const txt1 = await res1.text();
        const txt2 = await res2.text();

        if (txt1.trim().startsWith("<!DOCTYPE") || txt2.trim().startsWith("<!DOCTYPE")) {
            throw new Error("抓取到的不是 CSV 資料，請檢查試算表權限是否已公開。");
        }

        // 3. 儲存快取
        localStorage.setItem(CACHE_KEY_DATA_1, txt1);
        localStorage.setItem(CACHE_KEY_DATA_2, txt2);
        localStorage.setItem(CACHE_KEY_TIME, now.toString());

        processData(txt1, txt2);
        setLastUpdated(new Date(now));

    } catch (err: any) {
        console.error("Failed to load data", err);
        let msg = "資料讀取失敗，請檢查網址或權限。";
        if (err.name === 'AbortError') {
            msg = "連線逾時，請檢查網路狀況。";
        } else if (err.message) {
            msg = err.message;
        }
        alert(msg);
        setIsConfigured(false);
    } finally {
        setIsLoading(false);
    }
  };

  const handleForceRefresh = () => {
      handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
  };

  const handleReset = () => {
      setIsConfigured(false);
      setEtfs([]);
  };

  // 使用 useCallback 避免不必要的 re-render
  const handleAddToPortfolio = useCallback((etf: EtfData) => {
    const budget = 500000;
    const price = etf.priceCurrent || 10;
    const shares = Math.floor(budget / (price * 1000));
    const actualShares = Math.max(shares * 1000, 1000);
    
    const newItem: PortfolioItem = {
      id: Date.now().toString(),
      etf,
      shares: actualShares,
      avgCost: price,
      totalCost: actualShares * price,
      fee: Math.round(actualShares * price * 0.001425)
    };
    
    setPortfolio(prev => [...prev, newItem]);
    // 移除 alert，避免在移動端造成點擊事件穿透或焦點問題
    console.log(`Added ${etf.name} to portfolio`);
  }, []);

  const handleRemoveFromPortfolio = (id: string) => {
    setPortfolio(prev => prev.filter(p => p.id !== id));
  };

  const handleAIDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosis("");
    try {
        await analyzeSheets(rawData1, rawData2, (text) => {
            setDiagnosis(prev => prev + text);
        });
    } catch(e) {
        setDiagnosis("AI 診斷連線失敗。");
    } finally {
        setIsDiagnosing(false);
    }
  };

  // --- Layout Components ---

  const renderContent = () => {
      if (!isConfigured) {
          return (
            <div className="h-full p-4 overflow-y-auto">
                <SheetConfigView 
                    defaultUrl1={DEFAULT_URL_1} 
                    defaultUrl2={DEFAULT_URL_2} 
                    onStart={(u1, u2) => handleStartDataLoad(u1, u2, false)}
                    isLoading={isLoading}
                />
            </div>
          );
      }

      switch (activeTab) {
          case 'performance': 
            return (
                <PerformanceView 
                    etfs={etfs} 
                    onAddToPortfolio={handleAddToPortfolio} 
                    lastUpdated={lastUpdated}
                />
            );
          
          case 'portfolio': 
            return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    <PortfolioView portfolio={portfolio} onRemove={handleRemoveFromPortfolio} />
                </div>
            );
          
          case 'diagnosis': 
            return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    <div className="bg-white rounded-xl shadow-sm p-6 min-h-[400px]">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-xl flex items-center gap-2 text-slate-800">
                                <Bot className="w-6 h-6 text-blue-900" /> AI 智能診斷
                            </h3>
                            <button 
                                onClick={handleAIDiagnosis}
                                disabled={isDiagnosing}
                                className="text-base bg-blue-900 text-white px-4 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-50"
                            >
                                {isDiagnosing ? '診斷中...' : '開始診斷'}
                            </button>
                        </div>
                        <div className="prose prose-lg prose-slate text-lg leading-relaxed">
                            {diagnosis ? <ReactMarkdown>{diagnosis}</ReactMarkdown> : <p className="text-slate-400 text-lg">點擊上方按鈕，讓 AI 分析您的投資組合數據。</p>}
                        </div>
                    </div>
                </div>
            );
            
          default:
            return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm text-lg">
                        此功能開發中 (Mockup)
                    </div>
                </div>
            );
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden border-x border-slate-200">
      
      <header className="bg-blue-900 text-white h-20 shrink-0 flex items-center justify-between px-4 shadow-md z-20">
        <div className="flex items-center gap-3">
            {isConfigured && (
                 <button onClick={handleReset} className="p-1 hover:bg-blue-800 rounded-full">
                    <ArrowLeft className="w-6 h-6" />
                 </button>
            )}
            <h1 className="text-xl font-bold tracking-wide">
                {isConfigured ? '投資助理' : '設定資料來源'}
            </h1>
        </div>
        <div className="flex items-center gap-2">
            {isConfigured && (
                <>
                    <button 
                        onClick={handleForceRefresh}
                        disabled={isLoading}
                        className={`p-2 rounded-full hover:bg-blue-800 transition-all text-blue-100 hover:text-white ${isLoading ? 'animate-spin' : ''}`}
                        title="更新資料"
                    >
                        <RotateCw className="w-5 h-5" />
                    </button>
                    <span className="text-sm bg-blue-800 px-2 py-1 rounded text-blue-200">測試版</span>
                </>
            )}
        </div>
      </header>

      <main className="flex-grow overflow-hidden bg-slate-50 relative">
        {renderContent()}
      </main>

      {isConfigured && (
          <nav className="bg-blue-900 text-white h-20 shrink-0 grid grid-cols-5 items-center text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
            <button 
                onClick={() => setActiveTab('performance')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'performance' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <LayoutDashboard className="w-6 h-6" />
                <span className="text-sm font-medium">績效</span>
            </button>
            <button 
                onClick={() => setActiveTab('portfolio')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'portfolio' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <PieChart className="w-6 h-6" />
                <span className="text-sm font-medium">自組</span>
            </button>
            <button 
                onClick={() => setActiveTab('planning')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'planning' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <BrainCircuit className="w-6 h-6" />
                <span className="text-sm font-medium">規劃</span>
            </button>
            <button 
                onClick={() => setActiveTab('diagnosis')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'diagnosis' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <Bot className="w-6 h-6" />
                <span className="text-sm font-medium">診斷</span>
            </button>
            <button 
                onClick={() => setActiveTab('announcement')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'announcement' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <Megaphone className="w-6 h-6" />
                <span className="text-sm font-medium">公告</span>
            </button>
          </nav>
      )}
    </div>
  );
};

export default App;
