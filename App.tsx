
import React, { useState, useEffect, useCallback } from 'react';
import { EtfData, PortfolioItem, Dividend, CategoryKey, Transaction } from './types';
import { convertToCsvUrl, parseEtfData, parseDividendData } from './utils/sheetHelpers';
import { analyzeSheets } from './services/geminiService';
import PerformanceView from './components/PerformanceView';
import PortfolioView from './components/PortfolioView';
import SheetConfigView from './components/SheetConfigView';
import AnnouncementView from './components/AnnouncementView';
import PlanningView from './components/PlanningView';
import AnalysisView from './components/AnalysisView'; // Import the new view
import { LayoutDashboard, PieChart, BrainCircuit, Bot, Megaphone, CheckCircle, AlertTriangle, Loader2, BarChart3, Settings, Key, CircleHelp, X, ExternalLink, ShieldCheck, Tag, Trash2, LogIn, Play, RefreshCcw, Info, BookOpen, Fingerprint, Mic, Plus, MousePointerClick, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Default URLs
const DEFAULT_URL_1 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT1Vpn2SSkcf7QLqoMoAsdyusxtydfgIQD8pyoV6XojGFnf0zGu_WWuRnI4N3U-Hu0iGRzTrR7N-OD9/pub?output=csv";
const DEFAULT_URL_2 = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdHAXZ0A9Uno0bztIwJbuYSmLUAXUR8SDeHn-Z6GWkuwx1PGkUppejuytX2fjB33kRO1hV35Ku31fl/pub?output=csv";

// Base Date for calculations (2025/01/02)
const BASE_DATE_STR = "2025/01/02";
const LOCAL_STORAGE_KEY_API = 'gemini_api_key';

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
  
  // Key State
  const [apiKey, setApiKey] = useState<string>('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showBetaModal, setShowBetaModal] = useState(false); // 新增測試版說明視窗狀態
  const [tempKeyInput, setTempKeyInput] = useState('');

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

  // Init Key
  useEffect(() => {
    const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY_API);
    if (storedKey) setApiKey(storedKey);
  }, []);

  // 新增: 當 portfolio 變動時，自動存入 localStorage
  useEffect(() => {
    localStorage.setItem(CACHE_KEY_PORTFOLIO, JSON.stringify(portfolio));
  }, [portfolio]);

  // Key Handlers
  const handleSaveKey = () => {
      if (tempKeyInput.trim()) {
          const key = tempKeyInput.trim();
          localStorage.setItem(LOCAL_STORAGE_KEY_API, key);
          setApiKey(key);
          setShowKeyModal(false);
          showToast('API Key 設定成功', 'success');
      } else {
          showToast('請輸入有效的 API Key', 'warning');
      }
  };

  const handleDeleteKey = () => {
      if(window.confirm("確定要刪除儲存的 API Key 嗎？\n刪除後將無法使用 AI 功能。")) {
          localStorage.removeItem(LOCAL_STORAGE_KEY_API);
          setApiKey('');
          setTempKeyInput('');
          setShowKeyModal(false);
          showToast('API Key 已刪除', 'warning');
      }
  };

  const openKeyModal = () => {
      setTempKeyInput(apiKey);
      setShowKeyModal(true);
  };

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
    if (!apiKey) {
        setDiagnosis("### 🔑 需要設定 API 金鑰\n\n請點擊上方鑰匙按鈕進行設定，即可開始使用 AI 診斷功能。");
        return;
    }

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
                <AnalysisView 
                    etfs={etfs}
                    lastUpdated={lastUpdated}
                />
             );
          
          case 'planning':
            return (
                <div className="h-full overflow-hidden">
                    <PlanningView 
                        etfs={etfs} 
                        hasKey={!!apiKey}
                        onOpenKeySettings={openKeyModal}
                        onOpenHelp={() => setShowHelpModal(true)}
                    />
                </div>
            );

          case 'diagnosis': 
            return (
                <div className="h-full p-4 overflow-y-auto scrollbar-hide">
                    {/* Control Card: 標題、金鑰設定、開始按鈕 */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 mb-6 shrink-0">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <div className="flex items-center gap-2">
                                <Bot className="w-8 h-8 text-blue-600" />
                                {/* 修改: 字體加大至 text-3xl */}
                                <h3 className="text-3xl font-bold text-slate-800">AI 智能診斷</h3>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={openKeyModal}
                                    className={`p-2 rounded-full transition-all ${!apiKey ? 'bg-yellow-100 text-yellow-600 animate-pulse ring-2 ring-yellow-300' : 'text-slate-400 hover:bg-slate-100 hover:text-blue-600'}`}
                                    title={!apiKey ? "請設定 API Key" : "設定 API Key"}
                                >
                                    <Key className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setShowHelpModal(true)}
                                    className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition-all"
                                    title="說明文件"
                                >
                                    <CircleHelp className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <p className="text-slate-600 leading-relaxed text-base">
                                AI 將針對您的「自組月配」投資組合進行深度分析，提供產業分散性、收益均衡度與防禦能力的專業診斷建議。
                            </p>

                            <button
                                onClick={handleAIDiagnosis}
                                disabled={isDiagnosing}
                                className={`w-full py-3.5 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 text-lg transition-all active:scale-[0.98] ${
                                    isDiagnosing 
                                        ? 'bg-blue-400 cursor-not-allowed' 
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isDiagnosing ? (
                                    <>
                                        <RefreshCcw className="w-5 h-5 animate-spin" />
                                        診斷運算中...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5 fill-current" />
                                        開始診斷
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Result Area */}
                    {diagnosis && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[200px] animate-[fadeIn_0.5s_ease-out] mb-6">
                            <div className="prose prose-slate max-w-none">
                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        // 修正：文字大小改為 text-lg (18px)
                                        p: ({node, ...props}) => <p className="text-lg text-slate-700 leading-relaxed mb-4" {...props} />,
                                        li: ({node, ...props}) => <li className="text-lg text-slate-700 leading-relaxed border-l-2 border-blue-200 pl-2 ml-1" {...props} />,
                                        strong: ({node, ...props}) => <strong className="font-bold text-blue-900" {...props} />,

                                        // 讓表格可以左右滑動的容器 (保留表格支援但 Prompt 要求 AI 不用)
                                        table: ({node, ...props}) => (
                                            <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg shadow-sm">
                                                <table className="min-w-full divide-y divide-slate-200" {...props} />
                                            </div>
                                        ),
                                        thead: ({node, ...props}) => <thead className="bg-blue-50 text-blue-900 font-bold" {...props} />,
                                        tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-200 bg-white" {...props} />,
                                        tr: ({node, ...props}) => <tr className="hover:bg-slate-50/50 transition-colors" {...props} />,
                                        th: ({node, ...props}) => <th className="px-3 py-3 text-left text-sm font-bold uppercase tracking-wider whitespace-nowrap border-b border-blue-100 min-w-[60px]" {...props} />,
                                        td: ({node, ...props}) => <td className="px-3 py-3 text-lg text-slate-700 border-b border-slate-100 min-w-[120px] align-top leading-relaxed" {...props} />,
                                        
                                        // 標題樣式
                                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-slate-900 mt-6 mb-4" {...props} />,
                                        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 mt-5 mb-3 border-b pb-1 border-slate-100" {...props} />,
                                        // H3 改為卡片式標籤
                                        h3: ({node, ...props}) => <h3 className="text-xl font-bold text-white bg-blue-600 px-4 py-2 rounded-lg mt-6 mb-3 shadow-sm inline-block" {...props} />,
                                    }}
                                >
                                    {diagnosis}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}
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
        <div className="flex items-center justify-start z-10 w-20">
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
        
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none">
            <h1 className="text-xl font-bold tracking-wide pointer-events-auto shadow-sm">{getHeaderTitle()}</h1>
        </div>

        <div className="flex items-center justify-end z-10 w-20">
             <button
                onClick={() => setShowBetaModal(true)}
                className="text-[13px] font-bold text-yellow-300 tracking-wider border border-yellow-400/30 px-2 py-1 rounded bg-yellow-400/10 whitespace-nowrap hover:bg-yellow-400/20 transition-colors cursor-pointer active:scale-95"
            >
                測試版
            </button>
        </div>
      </header>

      <main className="flex-grow overflow-hidden bg-slate-50 relative">
        {renderContent()}
      </main>

      {/* --- Beta Modal (免責聲明) --- */}
      {showBetaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="bg-amber-50 px-6 py-4 border-b border-amber-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-amber-800 flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6" /> 免責聲明
                    </h3>
                    <button onClick={() => setShowBetaModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-7 h-7" />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4 text-slate-600 text-base leading-relaxed">
                    <p>
                        <strong>「2026 自組月配 投資助理」</strong> 是一個輔助分析工具，旨在協助使用者整合公開資訊與進行試算。
                    </p>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                        <h4 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" /> 重要提醒
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            <li>本系統所有數據僅供參考，實際數值請以官方公告為準。</li>
                            <li>AI 分析結果基於語言模型生成，可能存在誤差，不代表專業投資建議。</li>
                            <li>歷史績效不代表未來獲利保證。</li>
                            <li>投資一定有風險，投資有賺有賠，申購前應詳閱公開說明書。</li>
                        </ul>
                    </div>
                    <p>
                        開發者不對任何因使用本系統而造成的直接或間接損失負責。請使用者根據自身風險承受能力，審慎做出投資決策。
                    </p>
                </div>
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 text-center">
                    <button onClick={() => setShowBetaModal(false)} className="w-full bg-blue-900 text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-800 text-lg">
                        我瞭解並同意
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- Help Modal (軟體操作手冊) --- */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-blue-50 px-6 py-4 border-b border-blue-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-blue-900 flex items-center gap-2">
                        <BookOpen className="w-6 h-6" /> 軟體操作手冊
                    </h3>
                    <button onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-7 h-7" /></button>
                </div>
                
                <div className="p-6 overflow-y-auto space-y-8 scrollbar-hide text-slate-600">
                    
                    {/* 1. 系統簡介 */}
                    <div className="space-y-3">
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-l-4 border-blue-500 pl-2">
                            <Info className="w-5 h-5 text-blue-500" /> 系統簡介
                        </h4>
                        <p className="text-sm leading-relaxed">
                            本系統是專為台股 ETF 投資人設計的輔助工具，整合 Google Sheets 公開數據，提供「即時股價」、「配息試算」與「AI 智慧規劃」功能，協助您打造專屬的月配息投資組合。
                        </p>
                    </div>

                    {/* 2. 初始設定 */}
                    <div className="space-y-3">
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-l-4 border-emerald-500 pl-2">
                            <Settings className="w-5 h-5 text-emerald-500" /> 初始設定 (必讀)
                        </h4>
                        <ul className="text-sm space-y-2 list-decimal pl-4">
                            <li>
                                <strong>設定資料來源</strong>：首次使用需輸入 Google Sheet 發布的 CSV 網址。點擊左上角 <Settings className="w-3 h-3 inline" /> 即可修改。
                            </li>
                            <li>
                                <strong>設定 AI 金鑰</strong>：若要使用「智慧規劃」與「AI 診斷」，請點擊右上角 <Key className="w-3 h-3 inline" /> 設定 Gemini API Key (免費申請)。
                            </li>
                        </ul>
                    </div>

                    {/* 3. 核心功能操作 */}
                    <div className="space-y-4">
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-l-4 border-amber-500 pl-2">
                            <MousePointerClick className="w-5 h-5 text-amber-500" /> 五大核心功能
                        </h4>
                        
                        {/* 功能 1 */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                <LayoutDashboard className="w-4 h-4 text-blue-600" /> 1. 績效查詢
                            </h5>
                            <p className="text-xs text-slate-500 ml-6">
                                瀏覽各類 ETF (季配/月配/債券) 的最新行情。
                                <br/>• <strong>加入自選</strong>：點擊右側 <Plus className="w-3 h-3 inline bg-emerald-100 text-emerald-600 rounded p-0.5" /> 按鈕。
                                <br/>• <strong>詳細資料</strong>：點擊卡片左下的 <CircleHelp className="w-3 h-3 inline" /> 查看歷史配息。
                            </p>
                        </div>

                        {/* 功能 2 */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                <PieChart className="w-4 h-4 text-blue-600" /> 2. 自組月配 (Portfolio)
                            </h5>
                            <p className="text-xs text-slate-500 ml-6">
                                您的投資記帳本。系統會自動計算「每月預估股息」與「資產成長曲線」。
                                <br/>• <strong>新增交易</strong>：展開卡片後點擊 <Plus className="w-3 h-3 inline" /> 輸入買入紀錄。
                                <br/>• <strong>編輯/刪除</strong>：可修改或刪除錯誤的交易紀錄。
                            </p>
                        </div>

                        {/* 功能 3 */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                <BrainCircuit className="w-4 h-4 text-blue-600" /> 3. 智慧規劃 (AI)
                            </h5>
                            <p className="text-xs text-slate-500 ml-6">
                                輸入預算與需求 (支援語音 <Mic className="w-3 h-3 inline" />)，AI 會從資料庫中推薦適合的配置組合，並計算預估殖利率。
                            </p>
                        </div>

                        {/* 功能 4 */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" /> 4. 分析資料
                            </h5>
                            <p className="text-xs text-slate-500 ml-6">
                                提供進階篩選功能 (如：高息、市值、主題型 ETF)。
                                <br/>• <strong>股價走勢圖</strong>：點擊列表中的「圖表」按鈕，可查看含息報酬走勢。
                            </p>
                        </div>

                        {/* 功能 5 */}
                        <div className="bg-slate-50 p-3 rounded-xl space-y-1">
                            <h5 className="font-bold text-slate-700 flex items-center gap-2">
                                <Bot className="w-4 h-4 text-blue-600" /> 5. AI 診斷
                            </h5>
                            <p className="text-xs text-slate-500 ml-6">
                                AI 會針對您「自組月配」中的持股進行健檢，分析產業分散性與抗跌能力。
                            </p>
                        </div>
                    </div>

                    {/* 4. 常見問題 */}
                    <div className="space-y-3">
                        <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-l-4 border-slate-400 pl-2">
                            <CircleHelp className="w-5 h-5 text-slate-500" /> 常見問題
                        </h4>
                        <div className="text-sm space-y-2">
                            <p><strong>Q: 資料多久更新一次？</strong><br/><span className="text-slate-500">系統會自動快取資料 15 分鐘。若需強制更新，請重新整理頁面。</span></p>
                            <p><strong>Q: 手機上語音輸入沒反應？</strong><br/><span className="text-slate-500">請確認瀏覽器 (Safari/Chrome) 已授權麥克風存取權限。</span></p>
                        </div>
                    </div>

                </div>
                
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 text-center">
                    <button onClick={() => setShowHelpModal(false)} className="w-full bg-blue-900 text-white py-3.5 rounded-xl font-bold shadow-sm hover:bg-blue-800 text-lg">
                        關閉手冊
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- API Key Modal --- */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Settings className="w-5 h-5" /> 設定 API 金鑰
                    </h3>
                    <button onClick={() => setShowKeyModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
                </div>
                
                <div className="p-6 space-y-6">
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-800 flex gap-3 items-start">
                        <LogIn className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-bold mb-1">還沒有金鑰嗎？</p>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800 flex items-center gap-1">
                                前往 Google AI Studio 申請 <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">貼上您的 API Key</label>
                        <input 
                            type="password" 
                            value={tempKeyInput}
                            onChange={(e) => setTempKeyInput(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-200 focus:border-blue-500 outline-none transition-all font-mono text-slate-600"
                        />
                         <p className="text-xs text-slate-400 mt-2 text-right">
                            Key 將被加密儲存在此裝置
                        </p>
                    </div>

                    <div className="flex gap-3">
                        {apiKey && (
                            <button 
                                onClick={handleDeleteKey}
                                className="flex-1 bg-red-50 text-red-600 py-3 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2 border border-red-100"
                            >
                                <Trash2 className="w-4 h-4" /> 刪除
                            </button>
                        )}
                        <button 
                            onClick={handleSaveKey}
                            className={`flex-[2] bg-blue-900 text-white py-3 rounded-xl font-bold shadow-md hover:bg-blue-800 transition-all active:scale-[0.98]`}
                        >
                            儲存設定
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

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
