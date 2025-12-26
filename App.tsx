
import React, { useState, useEffect, useCallback } from 'react';
import { EtfData, PortfolioItem, Dividend, CategoryKey, Transaction } from './types';
import { convertToCsvUrl, parseEtfData, parseDividendData } from './utils/sheetHelpers';
import { analyzeSheets } from './services/geminiService';
import PerformanceView from './components/PerformanceView';
import PortfolioView from './components/PortfolioView';
import SheetConfigView from './components/SheetConfigView';
import AnnouncementView from './components/AnnouncementView';
import PlanningView from './components/PlanningView'; // Import the new view
import { LayoutDashboard, PieChart, BrainCircuit, Bot, Megaphone, CheckCircle, AlertTriangle, Loader2, BarChart3, Settings } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Default URLs
const DEFAULT_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1Vpn2SSkcf7QLqoMoAsdyusxtydfgIQD8pyoV6XojGFnf0zGu_WWuRnI4N3U-Hu0iGRzTrR7N-OD9/pub?output=csv";
const DEFAULT_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdHAXZ0A9Uno0bztIwJbuYSmLUAXUR8SDeHn-Z6GWkuwx1PGkUppejuytX2fjB33kRO1hV35Ku31fl/pub?output=csv";

// Base Date for calculations (2025/01/02)
const BASE_DATE_STR = "2025/01/02";

type Tab = 'performance' | 'portfolio' | 'analysis' | 'planning' | 'diagnosis' | 'announcement';

const CACHE_KEY_DATA_1 = 'sheet_data_1_v6';
const CACHE_KEY_DATA_2 = 'sheet_data_2_v6';
const CACHE_KEY_TIME = 'sheet_last_fetch_time_v6';
const CACHE_KEY_PORTFOLIO = 'user_portfolio_v1'; // 新增 Portfolio 儲存 Key
const CACHE_DURATION = 15 * 60 * 1000; // 15 分鐘

const App: React.FC = () => {
  // App State
  const [isConfigured, setIsConfigured] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('performance');
  
  // Data State
  const [etfs, setEtfs] = useState<EtfData[]>([]);
  
  // 修改: 初始化時從 localStorage 讀取 portfolio
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>(() => {
    try {
        const saved = localStorage.getItem(CACHE_KEY_PORTFOLIO);
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error("Failed to load portfolio", e);
        return [];
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // AI State
  const [diagnosis, setDiagnosis] = useState("");
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // Notification State
  const [toast, setToast] = useState<{visible: boolean, message: string, type: 'success' | 'warning'}>({ visible: false, message: '', type: 'success' });

  // 新增: 當 portfolio 變動時，自動存入 localStorage
  useEffect(() => {
    localStorage.setItem(CACHE_KEY_PORTFOLIO, JSON.stringify(portfolio));
  }, [portfolio]);

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
    }, 3000); 
  }, []);

  // --- Date Parsing Helper ---
  const parseSmartDate = (dateStr: string): Date | null => {
      if (!dateStr) return null;
      const cleanStr = dateStr.trim();
      
      // 1. YYYYMM format
      if (/^\d{6}$/.test(cleanStr)) {
          const y = parseInt(cleanStr.substring(0, 4));
          const m = parseInt(cleanStr.substring(4, 6)) - 1; 
          return new Date(y, m, 1);
      }

      // 2. Separator format (Slash, Dot, Dash)
      // Check for ROC year (e.g. 113/01/01)
      const parts = cleanStr.split(/[\/\.\-]/);
      if (parts.length === 3) {
          let y = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          const d = parseInt(parts[2]);
          
          if (y < 1911 && y > 10) {
              y += 1911;
          }
          
          const dt = new Date(y, m, d);
          return isNaN(dt.getTime()) ? null : dt;
      }

      const standardDate = new Date(cleanStr.replace(/\./g, '/').replace(/-/g, '/'));
      if (!isNaN(standardDate.getTime())) {
          return standardDate;
      }

      return null;
  };

  // --- Yield Calculation Logic ---
  const calculateAnnualYield = (dividends: Dividend[], currentPrice: number): number => {
      if (!currentPrice || currentPrice === 0) return 0;
      if (!dividends || dividends.length === 0) return 0;

      const today = new Date();
      today.setHours(0,0,0,0);
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      const ttmDividends = dividends.filter(d => {
          const dDate = parseSmartDate(d.date);
          if (!dDate) return false;
          return dDate >= oneYearAgo && dDate <= today; 
      });
      
      const totalAmount = ttmDividends.reduce((sum, d) => sum + d.amount, 0);
      return parseFloat(((totalAmount / currentPrice) * 100).toFixed(2));
  };

  const calculateEstimatedYield = (dividends: Dividend[], currentPrice: number, category: CategoryKey, code: string): number => {
      if (!currentPrice || currentPrice === 0) return 0;
      if (!dividends || dividends.length === 0) return 0;

      const sortedDivs = [...dividends].sort((a, b) => {
          const dA = parseSmartDate(a.date);
          const dB = parseSmartDate(b.date);
          return (dB?.getTime() || 0) - (dA?.getTime() || 0);
      });

      const latestDiv = sortedDivs[0];
      const latestDate = parseSmartDate(latestDiv.date);
      const today = new Date();
      today.setHours(0,0,0,0);

      if (!latestDate || latestDate <= today) {
          return 0;
      }

      let targetCount = 4;
      const isMonthlyBond = ['00937B', '00772B', '00933B', '00773B'].some(c => code.includes(c));
      if (category === 'AD' || isMonthlyBond) {
          targetCount = 12;
      }

      const targetDivs = sortedDivs.slice(0, targetCount);
      const totalEstimatedAmount = targetDivs.reduce((sum, d) => sum + d.amount, 0);

      return parseFloat(((totalEstimatedAmount / currentPrice) * 100).toFixed(2));
  };

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

          const totalDividends = Object.keys(dividendMap).length;
          if (parsedEtfs.length > 0 && totalDividends === 0) {
            showToast("警告：抓不到配息資料", 'warning');
          }

          const mergedEtfs = parsedEtfs.map(etf => {
              const divs = dividendMap[etf.code] || [];
              
              let finalYield = etf.dividendYield;
              const calculatedYield = calculateAnnualYield(divs, etf.priceCurrent);
              if (calculatedYield > 0) {
                  finalYield = calculatedYield;
              }

              const estYield = calculateEstimatedYield(divs, etf.priceCurrent, etf.category, etf.code);

              let finalTotalReturn = etf.totalReturn;
              if (etf.priceBase > 0) {
                  const dividendsSinceBase = divs.filter(d => {
                      const dDate = parseSmartDate(d.date);
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
          setIsConfigured(true);
      } catch (e) {
          console.error("Error processing data:", e);
          alert("資料解析發生錯誤");
          setIsConfigured(false);
      }
  }, [showToast]);

  const handleStartDataLoad = useCallback(async (url1: string, url2: string, forceRefresh = false) => {
    setIsLoading(true);
    try {
        const cachedTimeStr = localStorage.getItem(CACHE_KEY_TIME);
        const cachedData1 = localStorage.getItem(CACHE_KEY_DATA_1);
        const cachedData2 = localStorage.getItem(CACHE_KEY_DATA_2);
        
        const now = Date.now();
        const isCacheValid = cachedTimeStr && (now - Number(cachedTimeStr) < CACHE_DURATION);

        if (!forceRefresh && isCacheValid && cachedData1 && cachedData2) {
            console.log("Using Cached Data");
            try {
              processData(cachedData1, cachedData2);
              setLastUpdated(new Date(Number(cachedTimeStr)));
              setIsLoading(false);
              return;
            } catch (e) {
               console.warn("Cache parse failed, fetching fresh data.");
            }
        }

        const csvUrl1 = convertToCsvUrl(url1);
        const csvUrl2 = convertToCsvUrl(url2);

        const [txt1, txt2] = await Promise.all([
            smartFetch(csvUrl1),
            smartFetch(csvUrl2)
        ]);

        if (txt1.trim().startsWith("<!DOCTYPE") || txt2.trim().startsWith("<!DOCTYPE")) {
            throw new Error("抓取到的不是 CSV 資料");
        }

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

  useEffect(() => {
    const cachedData1 = localStorage.getItem(CACHE_KEY_DATA_1);
    const cachedData2 = localStorage.getItem(CACHE_KEY_DATA_2);
    const cachedTimeStr = localStorage.getItem(CACHE_KEY_TIME);

    if (cachedData1 && cachedData2 && cachedTimeStr) {
        try {
            processData(cachedData1, cachedData2);
            setLastUpdated(new Date(Number(cachedTimeStr)));
        } catch(e) {
            handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
        }
    } else {
        handleStartDataLoad(DEFAULT_URL_1, DEFAULT_URL_2, true);
    }
  }, [processData, handleStartDataLoad]);

  useEffect(() => {
    // 當 ETF 資料更新時，同步更新 Portfolio 中的即時數據，但不覆蓋用戶儲存的交易紀錄
    if (etfs.length > 0 && portfolio.length > 0) {
      setPortfolio(prev => {
        const next = prev.map(item => {
          const latest = etfs.find(e => e.code === item.id);
          if (latest && (
             latest.priceCurrent !== item.etf.priceCurrent || 
             latest.dividendYield !== item.etf.dividendYield ||
             latest.dividends !== item.etf.dividends
          )) {
             return { ...item, etf: latest };
          }
          return item;
        });
        // 只有當真的有變動時才更新狀態，避免不必要的重新渲染
        if (next.some((item, i) => item !== prev[i])) {
            return next;
        }
        return prev;
      });
    }
  }, [etfs, portfolio.length]); // 移除 portfolio 依賴，避免與上方存檔邏輯衝突，這裡主要依賴 etfs 更新

  const handleReset = () => {
      setIsConfigured(false);
  };

  const handleAddToPortfolio = useCallback((etf: EtfData) => {
    const BUDGET = 500000;
    const price = etf.priceCurrent || 10;
    const rawShares = Math.floor(BUDGET / price);
    const calculatedShares = Math.floor(rawShares / 1000) * 1000;
    const finalShares = calculatedShares > 0 ? calculatedShares : 1000; 

    const newTransaction: Transaction = {
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
        shares: finalShares,
        price: price,
        totalAmount: finalShares * price
    };

    setPortfolio(prev => {
        const existingItemIndex = prev.findIndex(p => p.id === etf.code);
        let updatedPortfolio;
        if (existingItemIndex >= 0) {
            updatedPortfolio = [...prev];
            updatedPortfolio[existingItemIndex] = {
                ...updatedPortfolio[existingItemIndex],
                transactions: [newTransaction, ...updatedPortfolio[existingItemIndex].transactions]
            };
        } else {
            updatedPortfolio = [...prev, {
                id: etf.code,
                etf: etf,
                transactions: [newTransaction]
            }];
        }
        return updatedPortfolio;
    });
    
    showToast(`成功加入！\n${etf.name}\n${finalShares}股`, 'success');
  }, [showToast]);

  const handleUpdateTransaction = (etfCode: string, updatedTx: Transaction) => {
      setPortfolio(prev => prev.map(item => {
          if (item.id !== etfCode) return item;
          return {
              ...item,
              transactions: item.transactions.map(t => t.id === updatedTx.id ? updatedTx : t)
          };
      }));
  };
  
  const handleAddTransaction = (etfCode: string, newTx: Transaction) => {
      setPortfolio(prev => prev.map(item => {
          if (item.id !== etfCode) return item;
          return {
              ...item,
              transactions: [newTx, ...item.transactions].sort((a,b) => b.date.localeCompare(a.date))
          };
      }));
      showToast('已新增交易紀錄', 'success');
  };

  const handleDeleteTransaction = (etfCode: string, txId: string) => {
      setPortfolio(prev => {
          return prev.map(item => {
              if (item.id !== etfCode) return item;
              return {
                  ...item,
                  transactions: item.transactions.filter(t => t.id !== txId)
              };
          }).filter(item => item.transactions.length > 0); 
      });
  };

  const handleAIDiagnosis = async () => {
    setIsDiagnosing(true);
    setDiagnosis("");
    try {
        // AI now analyzes the PORTFOLIO, not raw CSV data
        await analyzeSheets(portfolio, (text) => {
            setDiagnosis(prev => prev + text);
        });
    } catch(e) {
        setDiagnosis("AI 診斷連線失敗。");
    } finally {
        setIsDiagnosing(false);
    }
  };

  const getHeaderTitle = () => {
      if (!isConfigured) return '設定資料來源';
      switch(activeTab) {
          case 'performance': return '績效查詢';
          case 'portfolio': return '自組月配';
          case 'analysis': return '分析資料';
          case 'planning': return '智慧規劃';
          case 'diagnosis': return 'AI診斷';
          case 'announcement': return '配息公告';
          default: return '投資助理';
      }
  };

  const renderContent = () => {
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
                <div className="h-full overflow-hidden">
                    <PortfolioView 
                        portfolio={portfolio} 
                        onUpdateTransaction={handleUpdateTransaction}
                        onDeleteTransaction={handleDeleteTransaction}
                        onAddTransaction={handleAddTransaction}
                    />
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
          
          case 'planning':
            return (
                <div className="h-full overflow-hidden">
                    <PlanningView etfs={etfs} />
                </div>
            );

          case 'diagnosis': 
            return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    {/* 使用與 PlanningView 一致的卡片樣式 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[400px]">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
                                <Bot className="w-6 h-6 text-blue-600" /> AI 智能診斷
                            </h3>
                            <button 
                                onClick={handleAIDiagnosis}
                                disabled={isDiagnosing}
                                className="text-base bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-all"
                            >
                                {isDiagnosing ? '診斷中...' : '開始診斷'}
                            </button>
                        </div>
                        <div className="prose prose-slate max-w-none">
                            {diagnosis ? (
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        // 強制設定文字大小為 16px (text-base)
                                        p: ({node, ...props}) => <p className="text-base text-slate-700 leading-relaxed mb-4" {...props} />,
                                        li: ({node, ...props}) => <li className="text-base text-slate-700 leading-relaxed" {...props} />,
                                        strong: ({node, ...props}) => <strong className="font-bold text-blue-900" {...props} />,

                                        // 讓表格可以左右滑動的容器
                                        table: ({node, ...props}) => (
                                            <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg shadow-sm">
                                                <table className="min-w-full divide-y divide-slate-200" {...props} />
                                            </div>
                                        ),
                                        thead: ({node, ...props}) => <thead className="bg-blue-50 text-blue-900 font-bold" {...props} />,
                                        tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-200 bg-white" {...props} />,
                                        tr: ({node, ...props}) => <tr className="hover:bg-slate-50/50 transition-colors" {...props} />,
                                        th: ({node, ...props}) => <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b border-blue-100" {...props} />,
                                        td: ({node, ...props}) => <td className="px-3 py-3 text-base text-slate-700 whitespace-nowrap border-b border-slate-100" {...props} />,
                                        
                                        // 標題樣式
                                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                                        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1 border-slate-100" {...props} />,
                                        h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-800 mt-4 mb-2" {...props} />,
                                    }}
                                >
                                    {diagnosis}
                                </ReactMarkdown>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <Bot className="w-16 h-16 mx-auto mb-4 text-slate-200" />
                                    <p className="text-lg">點擊上方按鈕，讓 AI 分析您的投資組合數據。</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            );

          case 'announcement':
            return (
                <div className="h-full overflow-hidden">
                    <AnnouncementView etfs={etfs} />
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
      <header className="bg-blue-900 text-white h-20 shrink-0 flex items-center justify-between px-4 shadow-md z-20 relative">
        <div className="z-10 w-10"></div>
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
            <h1 className="text-xl font-bold tracking-wide pointer-events-auto shadow-sm">{getHeaderTitle()}</h1>
        </div>
        <div className="flex items-center gap-3 z-10">
            <span className="text-[13px] font-bold text-yellow-300 tracking-wider border border-yellow-400/30 px-2 py-1 rounded bg-yellow-400/10">測試版</span>
            {isConfigured && (
                <button 
                    onClick={handleReset}
                    disabled={isLoading}
                    className={`p-2 rounded-full hover:bg-blue-800 transition-all text-blue-100 hover:text-white ${isLoading ? 'opacity-50' : ''}`}
                    title="設定資料來源"
                >
                    <Settings className="w-6 h-6" />
                </button>
            )}
        </div>
      </header>

      <main className="flex-grow overflow-hidden bg-slate-50 relative">
        {renderContent()}
      </main>

      {toast.visible && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none">
            <div className={`backdrop-blur-md px-8 py-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 min-w-[240px] animate-[fadeIn_0.2s_ease-out] ${toast.type === 'warning' ? 'bg-yellow-900/90 text-white' : 'bg-blue-50/95 text-blue-900 border border-blue-200 shadow-xl'}`}>
                {toast.type === 'warning' ? <AlertTriangle className="w-12 h-12 text-yellow-400" /> : <CheckCircle className="w-12 h-12 text-blue-600" />}
                <span className="font-bold text-xl text-center whitespace-pre-wrap leading-relaxed">{toast.message}</span>
                {toast.type === 'success' && <span className="text-xs text-blue-800/70">已加入自選清單</span>}
            </div>
        </div>
      )}

      {isConfigured && (
          <nav className="bg-blue-900 text-white h-20 shrink-0 grid grid-cols-6 items-center text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
            <button onClick={() => setActiveTab('performance')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'performance' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <LayoutDashboard className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">績效查詢</span>
            </button>
            <button onClick={() => setActiveTab('portfolio')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'portfolio' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <PieChart className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">自組月配</span>
            </button>
            <button onClick={() => setActiveTab('analysis')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'analysis' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <BarChart3 className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">分析資料</span>
            </button>
            <button onClick={() => setActiveTab('planning')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'planning' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <BrainCircuit className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">智慧規劃</span>
            </button>
            <button onClick={() => setActiveTab('diagnosis')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'diagnosis' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <Bot className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">AI診斷</span>
            </button>
            <button onClick={() => setActiveTab('announcement')} className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${activeTab === 'announcement' ? 'text-yellow-400' : 'text-slate-300 hover:text-white'}`}>
                <Megaphone className="w-5 h-5" /><span className="text-[10px] font-medium whitespace-nowrap">配息公告</span>
            </button>
          </nav>
      )}
    </div>
  );
};

export default App;
