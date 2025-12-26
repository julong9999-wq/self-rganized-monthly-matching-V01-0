
import React, { useState, useEffect, useCallback } from 'react';
import { EtfData, PortfolioItem, Dividend, CategoryKey } from './types';
import { convertToCsvUrl, parseEtfData, parseDividendData } from './utils/sheetHelpers';
import { analyzeSheets } from './services/geminiService';
import PerformanceView from './components/PerformanceView';
import PortfolioView from './components/PortfolioView';
import SheetConfigView from './components/SheetConfigView';
import { LayoutDashboard, PieChart, BrainCircuit, Bot, Megaphone, ArrowLeft, RotateCw, CheckCircle, AlertTriangle, Loader2, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Default URLs (Updated by User Request)
const DEFAULT_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1Vpn2SSkcf7QLqoMoAsdyusxtydfgIQD8pyoV6XojGFnf0zGu_WWuRnI4N3U-Hu0iGRzTrR7N-OD9/pub?output=csv";
const DEFAULT_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdHAXZ0A9Uno0bztIwJbuYSmLUAXUR8SDeHn-Z6GWkuwx1PGkUppejuytX2fjB33kRO1hV35Ku31fl/pub?output=csv";

// Base Date for calculations (2025/01/02)
const BASE_DATE_STR = "2025/01/02";

// 新增 'analysis' 頁籤
type Tab = 'performance' | 'portfolio' | 'analysis' | 'planning' | 'diagnosis' | 'announcement';

const CACHE_KEY_DATA_1 = 'sheet_data_1_v6'; // Updated version key
const CACHE_KEY_DATA_2 = 'sheet_data_2_v6'; // Updated version key
const CACHE_KEY_TIME = 'sheet_last_fetch_time_v6';
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

  // Notification State
  const [toast, setToast] = useState<{visible: boolean, message: string, type: 'success' | 'warning'}>({ visible: false, message: '', type: 'success' });

  // Helper to prevent infinite loading
  const fetchWithTimeout = async (url: string, timeout = 10000) => {
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

  // Smart Fetch: Tries Direct first, then Proxy
  const smartFetch = async (url: string): Promise<string> => {
      // 1. Try Direct Fetch
      try {
          const res = await fetchWithTimeout(url, 8000);
          if (res.ok) {
              return await res.text();
          }
      } catch (e) {
          console.warn(`Direct fetch failed for ${url}, trying proxy...`, e);
      }

      // 2. Try Proxy (AllOrigins)
      try {
          const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
          const res = await fetchWithTimeout(proxyUrl, 15000);
          if (res.ok) {
              return await res.text();
          }
      } catch (e) {
          console.warn(`Proxy fetch failed for ${url}`, e);
      }

      throw new Error("無法讀取資料，請檢查網址權限或網路連線。");
  };

  const showToast = useCallback((message: string, type: 'success' | 'warning' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
    }, 3000); // 3秒後消失
  }, []);

  // --- Date Parsing Helper ---
  // Handles: "202601" (YYYYMM), "2024/01/01", "2024-01-01"
  const parseSmartDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const cleanStr = dateStr.trim();
      
      // Handle YYYYMM (6 digits)
      if (/^\d{6}$/.test(cleanStr)) {
          const y = parseInt(cleanStr.substring(0, 4));
          const m = parseInt(cleanStr.substring(4, 6)) - 1; // Month is 0-indexed
          return new Date(y, m, 1); // Assume 1st of the month
      }

      // Handle Standard Date
      const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
      if (!isNaN(standardDate.getTime())) {
          return standardDate;
      }

      return null;
  };

  // --- Yield Calculation Logic ---

  // 1. TTM Yield (Past 365 Days)
  const calculateAnnualYield = (dividends: Dividend[], currentPrice: number): number => {
      if (!currentPrice || currentPrice === 0) return 0;
      if (!dividends || dividends.length === 0) return 0;

      const today = new Date();
      today.setHours(0,0,0,0);
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      // Filter: Date >= One Year Ago AND Date <= Today (Exclude Future)
      const ttmDividends = dividends.filter(d => {
          const dDate = parseSmartDate(d.date);
          if (!dDate) return false;
          return dDate >= oneYearAgo && dDate <= today; 
      });
      
      const totalAmount = ttmDividends.reduce((sum, d) => sum + d.amount, 0);
      return parseFloat(((totalAmount / currentPrice) * 100).toFixed(2));
  };

  // 2. Estimated Yield (Triggered only if FUTURE data exists)
  const calculateEstimatedYield = (dividends: Dividend[], currentPrice: number, category: CategoryKey, code: string): number => {
      if (!currentPrice || currentPrice === 0) return 0;
      if (!dividends || dividends.length === 0) return 0;

      // Sort Descending (Newest First)
      const sortedDivs = [...dividends].sort((a, b) => {
          const dA = parseSmartDate(a.date);
          const dB = parseSmartDate(b.date);
          return (dB?.getTime() || 0) - (dA?.getTime() || 0);
      });

      const latestDiv = sortedDivs[0];
      const latestDate = parseSmartDate(latestDiv.date);
      const today = new Date();
      today.setHours(0,0,0,0);

      // Rule: "有未來配息之料才計算 , 否則 輸入 空值 (0)"
      if (!latestDate || latestDate <= today) {
          return 0;
      }

      // Determine Target Count (4 for Quarterly, 12 for Monthly)
      let targetCount = 4; // Default Quarterly

      // Identify Monthly
      const isMonthlyBond = ['00937B', '00772B', '00933B', '00773B'].some(c => code.includes(c));
      if (category === 'AD' || isMonthlyBond) {
          targetCount = 12;
      }

      // Sum the latest N dividends (including the future one)
      const targetDivs = sortedDivs.slice(0, targetCount);
      const totalEstimatedAmount = targetDivs.reduce((sum, d) => sum + d.amount, 0);

      return parseFloat(((totalEstimatedAmount / currentPrice) * 100).toFixed(2));
  };

  // 處理資料解析與狀態設定 (共用邏輯)
  const processData = useCallback((txt1: string, txt2: string) => {
      try {
          const parsedEtfs = parseEtfData(txt2);
          const dividendMap = parseDividendData(txt1);
          const baseDate = new Date(BASE_DATE_STR);
          const today = new Date();
          today.setHours(0,0,0,0);

          if (parsedEtfs.length === 0) {
              console.warn("No ETFs parsed.");
          }

          // Check if dividends are missing
          const totalDividends = Object.keys(dividendMap).length;
          if (parsedEtfs.length > 0 && totalDividends === 0) {
            showToast("警告：抓不到配息資料\n請確認表單欄位名稱包含：「ETF 代碼」、「除息金額」、「除息日期」", 'warning');
          }

          const mergedEtfs = parsedEtfs.map(etf => {
              const divs = dividendMap[etf.code] || [];
              
              // 1. Calculate TTM Yield (Actual Past Year)
              let finalYield = etf.dividendYield;
              const calculatedYield = calculateAnnualYield(divs, etf.priceCurrent);
              if (calculatedYield > 0) {
                  finalYield = calculatedYield;
              }

              // 2. Calculate Estimated Yield (Future Based)
              const estYield = calculateEstimatedYield(divs, etf.priceCurrent, etf.category, etf.code);

              // 3. Calculate Total Return (含息報酬率)
              // 邏輯: (最新股價 + 基準日後的配息總和 - 基準股價) / 基準股價
              let finalTotalReturn = etf.totalReturn;
              if (etf.priceBase > 0) {
                  const dividendsSinceBase = divs.filter(d => {
                      const dDate = parseSmartDate(d.date);
                      // 條件：配息日在基準日之後，且不晚於今天(排除未來)
                      return dDate && dDate >= baseDate && dDate <= today;
                  }).reduce((sum, d) => sum + d.amount, 0);

                  finalTotalReturn = parseFloat((((etf.priceCurrent + dividendsSinceBase - etf.priceBase) / etf.priceBase) * 100).toFixed(2));
              }

              return {
                ...etf,
                dividends: divs,
                dividendYield: finalYield,
                estYield: estYield,
                totalReturn: finalTotalReturn
              };
          });

          setEtfs(mergedEtfs);
          setRawData1(txt1);
          setRawData2(txt2);
          setIsConfigured(true);
      } catch (e) {
          console.error("Error processing data:", e);
          alert("資料解析發生錯誤，請檢查欄位格式。");
          setIsConfigured(false);
      }
  }, [showToast]);

  const handleStartDataLoad = useCallback(async (url1: string, url2: string, forceRefresh = false) => {
    setIsLoading(true);
    try {
        // 1. 檢查快取 (僅在非強制重新整理時檢查有效性)
        const cachedTimeStr = localStorage.getItem(CACHE_KEY_TIME);
        const cachedData1 = localStorage.getItem(CACHE_KEY_DATA_1);
        const cachedData2 = localStorage.getItem(CACHE_KEY_DATA_2);
        
        const now = Date.now();
        const isCacheValid = cachedTimeStr && (now - Number(cachedTimeStr) < CACHE_DURATION);

        // 如果不是強制重新整理，且快取有效，直接使用快取
        if (!forceRefresh && isCacheValid && cachedData1 && cachedData2) {
            console.log("Using Cached Data");
            try {
              processData(cachedData1, cachedData2);
              setLastUpdated(new Date(Number(cachedTimeStr)));
              setIsLoading(false);
              return;
            } catch (e) {
               console.warn("Cache parse failed, fetching fresh data.");
               // fall through to fetch
            }
        }

        // 2. 執行網路請求 (Smart Fetch)
        const csvUrl1 = convertToCsvUrl(url1);
        const csvUrl2 = convertToCsvUrl(url2);

        const [txt1, txt2] = await Promise.all([
            smartFetch(csvUrl1),
            smartFetch(csvUrl2)
        ]);

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
  }, [processData]);

  // 應用程式啟動時：1. 嘗試快取 2. 若無快取則自動讀取預設網址
  useEffect(() => {
    const cachedData1 = localStorage.getItem(CACHE_KEY_DATA_1);
    const cachedData2 = localStorage.getItem(CACHE_KEY_DATA_2);
    const cachedTimeStr = localStorage.getItem(CACHE_KEY_TIME);

    if (cachedData1 && cachedData2 && cachedTimeStr) {
        // 有快取：直接載入
        console.log("Auto-loading cached data on mount...");
        try {
            processData(cachedData1, cachedData2);
            setLastUpdated(new Date(Number(cachedTimeStr)));
        } catch(e) {
            handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
        }
    } else {
        // 無快取：自動執行第一次讀取 (Auto Start)
        console.log("No cache found, auto-starting data load...");
        handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
    }
  }, [processData, handleStartDataLoad]); // Added dependency to suppress lint warning, using useCallback to stabilize

  const handleForceRefresh = () => {
      handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
  };

  const handleReset = () => {
      // 僅切換回設定模式，不一定要刪除快取，讓使用者可以修改網址
      // 但為了體驗一致，這裡暫時不刪資料，只是切換 UI 狀態
      setIsConfigured(false);
  };

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
    showToast(`成功加入！\n${etf.name}`, 'success');
  }, [showToast]);

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
      // Loading State (FullScreen or Overlay)
      if (isLoading && !isConfigured) {
          return (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <Loader2 className="w-12 h-12 text-blue-900 animate-spin" />
                  <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-800">資料讀取中...</h2>
                      <p className="text-slate-500">正在分析最新股價與配息資訊</p>
                  </div>
              </div>
          );
      }

      if (!isConfigured) {
          return (
            <div className="h-full p-4 overflow-y-auto">
                <SheetConfigView 
                    defaultUrl1={DEFAULT_URL_1} 
                    defaultUrl2={DEFAULT_URL_2} 
                    onStart={(u1, u2) => handleStartDataLoad(u1, u2, true)} 
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

          case 'analysis':
             return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    <div className="bg-white rounded-xl p-8 text-center text-slate-400 shadow-sm text-lg">
                        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-blue-200" />
                        <h3 className="font-bold text-slate-600 mb-2">分析資料</h3>
                        <p className="text-sm">進階分析功能開發中...</p>
                    </div>
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
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 max-w-md mx-auto shadow-2xl overflow-hidden border-x border-slate-200 relative">
      
      <header className="bg-blue-900 text-white h-20 shrink-0 flex items-center justify-between px-4 shadow-md z-20">
        <div className="flex items-center gap-3">
            {/* 左側按鈕邏輯：如果已設定，顯示返回箭頭(去設定頁)。如果未設定(在設定頁)，不顯示。 */}
            {isConfigured ? (
                 <button onClick={handleReset} className="p-1 hover:bg-blue-800 rounded-full" title="手動設定表單">
                    <ArrowLeft className="w-6 h-6" />
                 </button>
            ) : (
                <div className="w-8"></div> // Placeholder for alignment
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

      {/* Toast Notification Overlay */}
      {toast.visible && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className={`
                backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 min-w-[240px] animate-[fadeIn_0.2s_ease-out]
                ${toast.type === 'warning' 
                    ? 'bg-yellow-900/90 text-white' 
                    : 'bg-blue-50/95 text-blue-900 border border-blue-200 shadow-xl' /* Light Blue Success Toast */}
            `}>
                {toast.type === 'warning' ? (
                    <AlertTriangle className="w-12 h-12 text-yellow-400" />
                ) : (
                    <CheckCircle className="w-12 h-12 text-blue-600" />
                )}
                
                <span className="font-bold text-xl text-center whitespace-pre-wrap leading-relaxed">{toast.message}</span>
                
                {toast.type === 'success' && (
                    <span className="text-xs text-blue-800/70">已加入自選清單</span>
                )}
            </div>
        </div>
      )}

      {isConfigured && (
          // 6個項目的導覽列，使用 grid-cols-6 並縮小文字以確保不跑版
          <nav className="bg-blue-900 text-white h-20 shrink-0 grid grid-cols-6 items-center text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
            {/* 1. 績效查詢 */}
            <button 
                onClick={() => setActiveTab('performance')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'performance' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <LayoutDashboard className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">績效查詢</span>
            </button>
            
            {/* 2. 自組月配 */}
            <button 
                onClick={() => setActiveTab('portfolio')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'portfolio' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <PieChart className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">自組月配</span>
            </button>
            
            {/* 3. 分析資料 (新增) */}
            <button 
                onClick={() => setActiveTab('analysis')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'analysis' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <BarChart3 className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">分析資料</span>
            </button>

            {/* 4. 智慧規劃 */}
            <button 
                onClick={() => setActiveTab('planning')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'planning' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <BrainCircuit className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">智慧規劃</span>
            </button>

            {/* 5. AI診斷 */}
            <button 
                onClick={() => setActiveTab('diagnosis')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'diagnosis' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <Bot className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">AI診斷</span>
            </button>

            {/* 6. 配息公告 */}
            <button 
                onClick={() => setActiveTab('announcement')}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'announcement' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}
            >
                <Megaphone className="w-5 h-5" />
                <span className="text-[10px] font-medium whitespace-nowrap">配息公告</span>
            </button>
          </nav>
      )}
    </div>
  );
};

export default App;
