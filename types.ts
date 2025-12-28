
export interface SheetData {
  id: string;
  url: string;
  name: string;
  content: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  errorMsg?: string;
}

export type CategoryKey = 'AA' | 'AB' | 'AC' | 'AD' | 'AE';

export interface EtfData {
  code: string;           // 代號 (0056)
  name: string;           // 名稱 (元大高股息)
  category: CategoryKey;  // 分類 (AA, AB...)
  marketLabel: string;    // 上市 or 上櫃
  priceBase: number;      // 2025/1/2 收盤價
  priceCurrent: number;   // 最近收盤價
  dataDate?: string;      // 實際抓取到的資料日期 (新增)
  dividendYield: number;  // 殖利率
  estYield: number;       // 預估殖利率
  returnRate: number;     // 報酬率
  totalReturn: number;    // 含息報酬率
  dividends: Dividend[];  // 配息紀錄
  priceHistory: { date: string; price: number }[]; // 新增：歷史股價序列
}

export interface Dividend {
  date: string;
  amount: number;
  period: string; // Q1, Q2, M1, M2...
}

// 新增交易紀錄介面
export interface Transaction {
  id: string;
  date: string;         // 交易日期
  shares: number;       // 張數 (股數)
  price: number;        // 單價
  totalAmount: number;  // 成交總價 (通常是 shares * price，但允許使用者修改)
}

export interface PortfolioItem {
  id: string;           // 投資組合 ID (通常用 ETF code)
  etf: EtfData;
  transactions: Transaction[]; // 交易紀錄列表 (子表)
}

export interface AnalysisResult {
  text: string;
  isStreaming: boolean;
}
