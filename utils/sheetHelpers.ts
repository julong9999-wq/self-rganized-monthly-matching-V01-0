
import { EtfData, CategoryKey, Dividend } from '../types';

/**
 * Robust CSV Row Parser
 * Handles quoted fields containing commas correctly.
 * Example: '2024/01/01,"1,200",0056' -> ['2024/01/01', '1,200', '0056']
 */
const parseCSVRow = (text: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map(col => col.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
};

/**
 * Converts a Google Sheet URL to a CSV export URL.
 */
export const convertToCsvUrl = (url: string, gid?: string): string => {
  if (!url) return '';
  
  if (url.includes('output=csv') && !gid) return url;
  
  let baseUrl = url;
  if (url.includes('/pubhtml')) {
    baseUrl = url.replace('/pubhtml', '/pub');
    const separator = baseUrl.includes('?') ? '&' : '?';
    let csvUrl = `${baseUrl}${separator}output=csv`;
    if (gid) csvUrl += `&gid=${gid}`;
    return csvUrl;
  }

  if (url.includes('/edit')) {
      const parts = url.split('/edit');
      baseUrl = parts[0]; 
      
      let targetGid = gid || '0'; 
      const gidMatch = url.match(/[#&]gid=(\d+)/);
      if (gidMatch) {
          targetGid = gidMatch[1];
      }
      
      return `${baseUrl}/export?format=csv&gid=${targetGid}`;
  }

  if (url.includes('docs.google.com/spreadsheets/d/')) {
      baseUrl = url.replace(/\/+$/, '');
      const separator = baseUrl.includes('?') ? '&' : '?';
      return `${baseUrl}${separator}export?format=csv`;
  }

  return url;
};

export const isValidGoogleSheetUrl = (url: string): boolean => {
  return url.includes('docs.google.com/spreadsheets');
};

export const extractTabsFromHtml = (html: string): { name: string; gid: string }[] => {
  const tabs: { name: string; gid: string }[] = [];
  const regex = /name:"([^"]+)",gid:"(\d+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!tabs.find(t => t.gid === match![2])) {
      tabs.push({ name: match![1], gid: match![2] });
    }
  }
  return tabs;
};

// --- Strict Parsing Logic ---

const CATEGORY_MAP: Record<string, CategoryKey> = {
  // AA. 季一
  '0056': 'AA', '00888': 'AA', '00904': 'AA', '00905': 'AA', '00908': 'AA', '00912': 'AA',
  '00927': 'AA', '00947': 'AA', '00956': 'AA', '00960': 'AA', '00984A': 'AA',
  // AB. 季二
  '00690': 'AB', '00731': 'AB', '00771': 'AB', '00850': 'AB', '00878': 'AB', '00891': 'AB',
  '00894': 'AB', '00932': 'AB', '00938': 'AB', '009808': 'AB', '00980A': 'AB', '00982A': 'AB',
  // AC. 季三
  '00712': 'AC', '00713': 'AC', '00728': 'AC', '00896': 'AC', '00903': 'AC', '00915': 'AC',
  '00918': 'AC', '00919': 'AC', '00921': 'AC', '00972': 'AC', '009802': 'AC', '009803': 'AC',
  // AD. 月配
  '00730': 'AD', '00900': 'AD', '00929': 'AD', '00934': 'AD', '00936': 'AD', '00939': 'AD',
  '00940': 'AD', '00943': 'AD', '00944': 'AD', '00946': 'AD', '00952': 'AD', '00961': 'AD',
  '00962': 'AD', '00963': 'AD', '00964': 'AD',
  // AE. 債券
  '00937B': 'AE', '00772B': 'AE', '00933B': 'AE', '00773B': 'AE', '00720B': 'AE', '00725B': 'AE',
  '00724B': 'AE', '00679B': 'AE', '00761B': 'AE', '00795B': 'AE', '00687B': 'AE', '00751B': 'AE', '00792B': 'AE'
};

/**
 * Parses the Dividend CSV content.
 */
export const parseDividendData = (csvContent: string): Record<string, Dividend[]> => {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return {};

  const dividendMap: Record<string, Dividend[]> = {};
  
  // 1. Header Detection
  let headerRowIndex = 0;
  // Use parseCSVRow for header as well
  let header = parseCSVRow(lines[0]).map(c => c.trim().toLowerCase());

  // Scan for header if first row isn't it
  if (!header.some(h => h.includes('代號') || h.includes('code') || h.includes('etf 代碼') || h.includes('symbol'))) {
      for(let i=0; i<Math.min(lines.length, 5); i++) {
          const rowValues = parseCSVRow(lines[i]);
          const rowLower = rowValues.map(c => c.toLowerCase());
          
          if (rowLower.some(c => c.includes('代號') || c.includes('code') || c.includes('etf 代碼') || c.includes('symbol'))) {
              headerRowIndex = i;
              header = rowLower;
              break;
          }
      }
  }

  const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

  const idxCode = findCol(['etf 代碼', '股號', '代號', 'code', '股票代號', 'symbol', '代碼']);
  const idxDate = findCol(['除息日期', '除息日', 'date', '配息日', '日期', '除息交易日', '發放日', '除息']);
  const idxAmount = findCol(['除息金額', '配息', '金額', 'amount', '現金股利', '分配金額', '現金', '股利', 'distribution']);

  if (idxCode === -1 || idxAmount === -1) {
      console.warn("Parse Dividend Failed: Missing required columns (Code or Amount). Header:", header);
      return {};
  }

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const row = parseCSVRow(lines[i]);
      if (row.length <= idxCode) continue;

      const rawCode = row[idxCode];
      const code = rawCode ? rawCode.replace(/['"]/g, '').trim() : '';
      
      if (code) {
          const amountStr = row[idxAmount]?.replace(/[^0-9.]/g, '') || '0';
          const amount = parseFloat(amountStr);
          let date = idxDate !== -1 ? row[idxDate] : '';
          
          if (date) date = date.replace(/['"]/g, '').trim();

          if (amount > 0) {
              if (!dividendMap[code]) {
                  dividendMap[code] = [];
              }
              dividendMap[code].push({
                  date: date,
                  amount: amount,
                  period: '' 
              });
          }
      }
  }
  return dividendMap;
};

/**
 * Parses the CSV content strictly with robust header detection.
 */
export const parseEtfData = (csvContent: string): EtfData[] => {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const etfs: EtfData[] = [];
  
  // --- 1. Robust Header Row Detection ---
  let headerRowIndex = -1;
  let header: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
     const rowValues = parseCSVRow(lines[i]);
     const rowLower = rowValues.map(c => c.toLowerCase());
     
     if (rowLower.some(c => c.includes('代碼') || c.includes('代號') || c.includes('code') || c.includes('etf 代碼') || c.includes('symbol'))) {
         headerRowIndex = i;
         header = rowLower;
         break;
     }
  }

  if (headerRowIndex === -1) {
     headerRowIndex = 0;
     header = parseCSVRow(lines[0]).map(c => c.toLowerCase());
  }
  
  const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

  const idxCode = findCol(['etf 代碼', '股號', '代碼', '代號', 'code', 'symbol', '股票代號']);
  const idxName = findCol(['etf 名稱', '股名', '股票名稱', 'etf名稱', '名稱', 'name']); 
  const idxMarket = findCol(['上市/ 上櫃', '市場', 'market', '類別', '上市', '上櫃', 'type', '掛牌']); 
  
  // --- 2. Dynamic Price Column Detection ---
  // 修改：捕捉所有日期欄位作為歷史數據
  const dateColIndices = header.map((h, index) => {
      // Matches YYYY/MM/DD, YYYY-MM-DD, MM/DD, YYYYMM (6 digits), YYYY/MM (for monthly data)
      const isDate = /(\d{1,4}[-./]\d{1,2}[-./]\d{1,2})|(\d{1,2}[-./]\d{1,2})|(\d{4}[-./]\d{1,2})/.test(h) || /^\d{6}$/.test(h.replace(/\//g,''));
      
      if (isDate) {
          const originalHeader = parseCSVRow(lines[headerRowIndex])[index];
          return { index, text: originalHeader.trim() };
      }
      return null;
  }).filter((item): item is { index: number, text: string } => item !== null);

  let idxPriceCurrent = -1;
  let currentPriceDateLabel = '';

  // 排序日期欄位 (假設越後面的欄位日期越新)
  // 如果能解析日期值會更好，這裡假設表格是由左至右為舊到新
  if (dateColIndices.length > 0) {
      const lastDateCol = dateColIndices[dateColIndices.length - 1];
      idxPriceCurrent = lastDateCol.index;
      currentPriceDateLabel = lastDateCol.text;
  } else {
      idxPriceCurrent = findCol(['收盤價', '收盤', '現價', '成交', 'price', 'current', '最近', 'close', 'last']);
      currentPriceDateLabel = '最新股價';
  }

  const idxPriceBase = findCol(['成本', '1/2', '01/02', '起始', 'base', 'open', 'start']); 
  const idxYield = findCol(['殖利率', 'yield', '配息率']);
  const idxReturn = findCol(['報酬', '損益', 'return']);

  // --- 3. Parse Data Rows ---
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    
    if (idxCode !== -1 && row.length <= idxCode) continue;

    let code = '';
    let name = '';
    
    if (idxCode !== -1 && row[idxCode]) code = row[idxCode];
    if (idxName !== -1 && row[idxName]) name = row[idxName];

    if (!code) {
        if (row[0] && /^[0-9]{4,6}[A-Z]?$/.test(row[0])) code = row[0];
        else if (row[1] && /^[0-9]{4,6}[A-Z]?$/.test(row[1])) code = row[1];
    }
    
    code = code ? code.replace(/['"]/g, '').trim() : '';
    
    if (!code) continue;

    const category = CATEGORY_MAP[code];

    if (category) {
        if ((!name || name.includes('商品')) && idxCode !== -1 && row.length > idxCode + 1) {
            name = row[idxCode + 1];
        }

        let marketLabel = '上市';
        if (category === 'AE' || code.includes('B') || (name && name.includes('債'))) {
            marketLabel = '上櫃';
        }

        if (idxMarket !== -1 && row[idxMarket]) {
            const val = row[idxMarket].trim();
            if (val.includes('上櫃') || val.toLowerCase().includes('otc')) {
                marketLabel = '上櫃';
            } else if (val.includes('上市') || val.toLowerCase().includes('listed')) {
                marketLabel = '上市';
            }
        }

        const parseNum = (val: string) => {
            if (!val) return 0;
            const clean = val.replace(/[%$,]/g, '');
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        // 收集歷史股價
        const priceHistory: { date: string; price: number }[] = [];
        dateColIndices.forEach(col => {
            if (row[col.index]) {
                const p = parseNum(row[col.index]);
                if (p > 0) {
                    priceHistory.push({ date: col.text, price: p });
                }
            }
        });

        let priceCurrent = 0;
        let priceBase = 0;
        let dividendYield = 0;
        let returnRate = 0;

        if (idxPriceCurrent !== -1 && row[idxPriceCurrent]) {
            priceCurrent = parseNum(row[idxPriceCurrent]);
        }
        
        if (idxPriceBase !== -1 && row[idxPriceBase]) {
            priceBase = parseNum(row[idxPriceBase]);
        } else if (priceHistory.length > 0) {
            // 如果抓不到指定的 Base 欄位，嘗試用歷史數據的第一筆當 Base
            priceBase = priceHistory[0].price;
        }

        if (idxYield !== -1 && row[idxYield]) {
            dividendYield = parseNum(row[idxYield]);
        }

        if (idxReturn !== -1 && row[idxReturn]) {
            returnRate = parseNum(row[idxReturn]);
        } else if (priceBase > 0 && priceCurrent > 0) {
            returnRate = ((priceCurrent - priceBase) / priceBase) * 100;
        }

        if (priceCurrent === 0 && priceHistory.length > 0) {
             priceCurrent = priceHistory[priceHistory.length - 1].price;
        }

        etfs.push({
            code,
            name: name || code, 
            category,
            marketLabel, 
            priceBase: Number(priceBase.toFixed(2)),
            priceCurrent: Number(priceCurrent.toFixed(2)),
            dataDate: currentPriceDateLabel,
            dividendYield: Number(dividendYield.toFixed(2)),
            estYield: 0, 
            returnRate: Number(returnRate.toFixed(2)),
            totalReturn: Number(returnRate.toFixed(2)), 
            dividends: [],
            priceHistory // 寫入歷史資料
        });
    }
  }

  etfs.sort((a, b) => a.code.localeCompare(b.code));
  return etfs;
};
