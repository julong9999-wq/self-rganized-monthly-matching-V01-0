
import { GoogleGenAI } from "@google/genai";

export const analyzeSheets = async (
  sheet1Content: string, 
  sheet2Content: string,
  onStream: (text: string) => void
): Promise<void> => {
  const modelId = 'gemini-3-flash-preview'; 
  const today = new Date().toLocaleDateString('zh-TW');

  // 安全獲取 API Key，防止在無 process 的環境 (如瀏覽器) 中崩潰導致白屏
  let apiKey = '';
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || '';
    }
  } catch (e) {
    console.warn("Unable to access process.env");
  }

  // 初始化 AI (移至函式內部)
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    你現在是一個**高強度的金融數據稽核員**。
    今天的日期是：${today}。
    
    【使用者核心提問】：**「00888 這 8 個數據都抓得到嗎？表單裡的 13 筆債券股價正確嗎？上櫃股票資料有顯示嗎？」**
    
    【重要提示】：使用者表示他**故意將日期前推或後推了一天 (非標準的 12/24)**，可能是 12/23 或 12/25。請在查核第 8 點時，接受這個範圍內的日期數據，只要有數據即視為成功。

    你的任務是盡全力去「抓取」並「驗證」，絕對不要造假。

    **步驟一：日期鎖定**
    請先推算下列 8 個時間點：
    1. 2025/1/2
    2. 上個月月初 (首交易日)
    3. 上個月月底 (末交易日)
    4. 本月月初 (首交易日)
    5. 上週 (首交易日)
    6. 上週 (末交易日)
    7. 本週 (首交易日)
    8. **前一交易日 (T-1)**：請檢查 2025/12/23 ~ 2025/12/25 這幾天的數據。

    **步驟二：標的識別與搜尋 (Grounding)**
    請分析【表單 2】：
    1. **鎖定 00888 (上市)**：務必搜尋它在上述時間點的收盤價。
    2. **識別債券 ETF (上櫃 TPEx)**：請找出約 13 檔債券 ETF。
       *   **關鍵檢查**：確認介面或數據中是否標示為「上櫃 (OTC/TPEx)」。
    3. **執行搜尋**：針對找到的這些債券，查核數據完整性。

    **步驟三：輸出報告**
    請產出詳細的 Markdown 報告。

    **表格 A：日期推算表**
    列出你算出的 8 個具體日期。

    **表格 B：00888 與債券查價結果 (重點報告)**
    格式範例：
    | 股票代號 | 市場 | 股票名稱 | 成功抓取數 (x/8) | 2025/1/2 | ... | T-1 (近日) | 狀態 |
    |---|---|---|---|---|---|---|---|
    | 00888 | 上市 | 國泰永續高股息 | 8/8 | 23.5 | ... | 23.8 | ✅ 完整 |
    | 00679B | 上櫃 | 元大美債20年 | 7/8 | 29.1 | ... | 29.5 | ⚠️ 缺 1 筆 |
    
    **總結**：
    直接回答：「00888 能抓到嗎？」、「13 筆債券能抓到嗎？」、「上櫃資料是否正確標示？」。
    
    ---
    【表單 1 (配息資訊)】:
    ${sheet1Content.substring(0, 30000)} ...

    ---
    【表單 2 (庫存/股價)】:
    ${sheet2Content.substring(0, 50000)} ...
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        // Critical: Google Search allows finding historical stock prices
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
