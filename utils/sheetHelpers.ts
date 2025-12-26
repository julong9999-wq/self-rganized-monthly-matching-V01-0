
import { EtfData, CategoryKey, Dividend } from '../types';

/**
 * Converts a Google Sheet URL to a CSV export URL.
 * Handles both 'pubhtml' and standard 'edit' URLs.
 */
export const convertToCsvUrl = (url: string, gid?: string): string => {
  if (!url) return '';
  
  // 1. Handle "Published to Web" URLs
  if (url.includes('output=csv') && !gid) return url;
  
  let baseUrl = url;
  if (url.includes('/pubhtml')) {
    baseUrl = url.replace('/pubhtml', '/pub');
    const separator = baseUrl.includes('?') ? '&' : '?';
    let csvUrl = `${baseUrl}${separator}output=csv`;
    if (gid) csvUrl += `&gid=${gid}`;
    return csvUrl;
  }

  // 2. Handle standard "Edit" URLs (Browser address bar copy-paste)
  // Format: https://docs.google.com/spreadsheets/d/KEY/edit#gid=123
  if (url.includes('/edit')) {
      const parts = url.split('/edit');
      baseUrl = parts[0]; // Gets part before /edit
      
      let targetGid = gid || '0'; // Default to first sheet
      // Try to extract gid from the original URL hash or query
      const gidMatch = url.match(/[#&]gid=(\d+)/);
      if (gidMatch) {
          targetGid = gidMatch[1];
      }
      
      return `${baseUrl}/export?format=csv&gid=${targetGid}`;
  }

  // 3. Fallback: try appending export param if it looks like a sheet root
  if (url.includes('docs.google.com/spreadsheets/d/')) {
      // Remove trailing slashes
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
 * Returns a map of Code -> Dividend[].
 */
export const parseDividendData = (csvContent: string): Record<string, Dividend[]> => {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return {};

  const dividendMap: Record<string, Dividend[]> = {};
  
  // 1. Header Detection
  let headerRowIndex = 0;
  let header = lines[0].split(',').map(c => c.trim().toLowerCase());

  // Simple scan for header if first row isn't it
  if (!header.some(h => h.includes('代號') || h.includes('code'))) {
      for(let i=0; i<Math.min(lines.length, 5); i++) {
          const rowLower = lines[i].toLowerCase();
          if (rowLower.includes('代號') || rowLower.includes('code')) {
              headerRowIndex = i;
              header = lines[i].split(',').map(c => c.trim().toLowerCase());
              break;
          }
      }
  }

  const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

  const idxCode = findCol(['代號', 'code', '股票代號']);
  const idxDate = findCol(['除息日', 'date', '配息日', '日期']);
  const idxAmount = findCol(['配息', '金額', 'amount', '現金股利']);

  if (idxCode === -1 || idxAmount === -1) {
      console.warn("Could not find Code or Amount columns in Dividend Sheet");
      return {};
  }

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
      const row = lines[i].split(',').map(c => c.trim());
      // Safety check for row length
      if (row.length <= idxCode) continue;

      const code = row[idxCode]?.replace(/['"]/g, '').trim();
      
      if (code && CATEGORY_MAP[code]) {
          const amountStr = row[idxAmount]?.replace(/[^0-9.]/g, '') || '0';
          const amount = parseFloat(amountStr);
          const date = idxDate !== -1 ? row[idxDate] : '';

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
     const rowLower = lines[i].toLowerCase();
     if ((rowLower.includes('代碼') || rowLower.includes('代號') || rowLower.includes('code') || rowLower.includes('symbol'))) {
         headerRowIndex = i;
         header = lines[i].split(',').map(c => c.trim().toLowerCase());
         break;
     }
  }

  if (headerRowIndex === -1) {
     headerRowIndex = 0;
     header = lines[0].split(',').map(c => c.trim().toLowerCase());
  }
  
  const findCol = (keywords: string[]) => header.findIndex(h => keywords.some(k => h.includes(k)));

  const idxCode = findCol(['代碼', '代號', 'code', 'symbol', '股票代號']);
  
  // 修正：嚴格尋找名稱欄位，排除 "商品" (Product) 避免抓到 "季配商品"
  // 優先順序：股票名稱 > ETF名稱 > 名稱 > Name
  const idxName = findCol(['股票名稱', 'etf名稱', '名稱', 'name']);
  
  const idxMarket = findCol(['市場', 'market', '類別', '上市', '上櫃', 'type', '掛牌']);
  
  // --- 2. Dynamic Price Column Detection ---
  const dateColIndices = header.map((h, index) => {
      if (/(\d{1,4}[-./]\d{1,2}[-./]\d{1,2})|(\d{1,2}[-./]\d{1,2})/.test(h)) {
          return { index, text: lines[headerRowIndex].split(',')[index].trim() };
      }
      return null;
  }).filter((item): item is { index: number, text: string } => item !== null);

  let idxPriceCurrent = -1;
  let currentPriceDateLabel = '';

  if (dateColIndices.length > 0) {
      const lastDateCol = dateColIndices[dateColIndices.length - 1];
      idxPriceCurrent = lastDateCol.index;
      currentPriceDateLabel = lastDateCol.text;
  } else {
      idxPriceCurrent = findCol(['收盤', '現價', '成交', 'price', 'current', '最近', 'close', 'last']);
      currentPriceDateLabel = '最新股價';
  }

  // Base Price (Cost/Base)
  const idxPriceBase = findCol(['成本', '1/2', '01/02', '起始', 'base', 'open', 'start']); 
  const idxYield = findCol(['殖利率', 'yield', '配息率']);
  const idxReturn = findCol(['報酬', '損益', 'return']);

  // --- 3. Parse Data Rows ---
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(c => c.trim());
    
    // Safety: ensure row has enough columns for code
    if (idxCode !== -1 && row.length <= idxCode) continue;

    let code = '';
    let name = '';
    
    if (idxCode !== -1 && row[idxCode]) code = row[idxCode];
    if (idxName !== -1 && row[idxName]) name = row[idxName];

    // Fallback Code detection
    if (!code) {
        if (row[0] && /^[0-9]{4,6}[A-Z]?$/.test(row[0])) code = row[0];
        else if (row[1] && /^[0-9]{4,6}[A-Z]?$/.test(row[1])) code = row[1];
    }
    
    code = code.replace(/['"]/g, '').trim();
    const category = CATEGORY_MAP[code];

    if (category) {
        // Fallback Name detection: 如果名稱欄位沒抓到，或者抓到的名稱包含 "商品" (表示抓錯欄位)，嘗試代碼右邊那欄
        if ((!name || name.includes('商品')) && idxCode !== -1 && row.length > idxCode + 1) {
            name = row[idxCode + 1];
        }

        // --- Determine Market Label (上市 vs 上櫃) ---
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

        let priceCurrent = 0;
        let priceBase = 0;
        let dividendYield = 0;
        let returnRate = 0;

        const parseNum = (val: string) => {
            if (!val) return 0;
            const clean = val.replace(/[%$,]/g, '');
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        if (idxPriceCurrent !== -1 && row[idxPriceCurrent]) {
            priceCurrent = parseNum(row[idxPriceCurrent]);
        }
        
        if (idxPriceBase !== -1 && row[idxPriceBase]) {
            priceBase = parseNum(row[idxPriceBase]);
        }

        if (idxYield !== -1 && row[idxYield]) {
            dividendYield = parseNum(row[idxYield]);
        }

        if (idxReturn !== -1 && row[idxReturn]) {
            returnRate = parseNum(row[idxReturn]);
        } else if (priceBase > 0 && priceCurrent > 0) {
            returnRate = ((priceCurrent - priceBase) / priceBase) * 100;
        }

        // Ultimate Fallback
        if (priceCurrent === 0) {
             const nums = row.map((val, index) => ({ val: parseNum(val), index }))
                             .filter(({ val, index }) => !isNaN(val) && val > 0 && index !== idxCode);
             if (nums.length > 0) {
                 const possiblePrice = nums.find(n => n.val > 5); 
                 if (possiblePrice) priceCurrent = possiblePrice.val;
             }
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
            dividends: [] 
        });
    }
  }

  // 排序：強制依照股票代碼排序
  etfs.sort((a, b) => a.code.localeCompare(b.code));

  return etfs;
};
