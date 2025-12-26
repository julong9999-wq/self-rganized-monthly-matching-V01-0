
import { GoogleGenAI } from "@google/genai";
import { PortfolioItem, EtfData } from "../types";

// 安全獲取 API Key 的輔助函式
const getSafeApiKey = (): string => {
  try {
    // 1. 優先檢查 Local Storage (使用者自行設定的 Key)
    if (typeof window !== 'undefined' && window.localStorage) {
        const localKey = localStorage.getItem('gemini_api_key');
        if (localKey && localKey.trim() !== '') {
            return localKey.trim();
        }
    }

    // 2. 其次檢查環境變數 (開發環境或預設)
    if (typeof process !== 'undefined' && process && process.env) {
      return process.env.API_KEY || '';
    }
  } catch (e) {
    console.warn("API Key access failed gracefully.");
  }
  return '';
};

const MISSING_KEY_MSG = `
### 🔑 需要設定 API 金鑰

為了啟動 AI 投資顧問，請點擊畫面標題列右側的 **「金鑰圖示 🔑」** 進行設定。

*   **免費使用**：Google 提供充足的免費額度。
*   **隱私安全**：您的金鑰僅儲存在您的瀏覽器中，不會上傳至其他伺服器。
*   **設定簡單**：點擊圖示後有完整教學。
`;

// 更新函式簽章以接收 PortfolioItem[]
export const analyzeSheets = async (
  portfolio: PortfolioItem[],
  onStream: (text: string) => void
): Promise<void> => {
  const modelId = 'gemini-3-flash-preview'; 
  const apiKey = getSafeApiKey();

  if (!apiKey) {
      onStream(MISSING_KEY_MSG);
      return;
  }

  const ai = new GoogleGenAI({ apiKey });

  // 將 Portfolio 物件轉換為簡化的 JSON 字串供 AI 閱讀
  const portfolioSummary = portfolio.map(item => ({
      code: item.id,
      name: item.etf.name,
      category: item.etf.category,
      totalCost: item.transactions.reduce((s, t) => s + t.totalAmount, 0),
      currentPrice: item.etf.priceCurrent,
      dividendYield: item.etf.dividendYield
  }));

  const prompt = `
    你現在是一位專業的 ETF 投資組合顧問。
    以下是使用者目前的「自組月配」投資組合清單：
    ${JSON.stringify(portfolioSummary, null, 2)}

    請針對這份清單進行深入診斷。

    **⚠️ 重要格式規範 (Mobile-First)：**
    1. **絕對禁止使用 Markdown 表格 (Do NOT use Tables)**：手機直向閱讀無法完整顯示表格。
    2. 請務必使用 **「標題 + 條列式清單」** 的方式呈現。
    3. 每一個診斷項目請使用 ### 標題，內容使用 * 項目符號。

    **請依照下方範本結構輸出 (請嚴格遵守)：**

    ### 📌 產業分散性診斷
    *   **分析**: (你的分析內容...)
    *   **建議**: (你的優化建議...)

    ### 📌 收益均衡度診斷
    *   **分析**: (你的分析內容...)
    *   **建議**: (你的優化建議...)

    ### 📌 抗跌與防禦力
    *   **分析**: (你的分析內容...)
    *   **建議**: (你的優化建議...)

    ### 💡 總結建議
    *   (重點 1)
    *   (重點 2)
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    if (error.toString().includes("400") || error.toString().includes("403") || error.toString().includes("API key")) {
        onStream(MISSING_KEY_MSG);
    } else {
        onStream(`### ⚠️ AI 連線發生錯誤 \n\n 請稍後再試，或檢查您的網路連線。\n\n錯誤訊息: ${error.message || 'Unknown error'}`);
    }
  }
};

// 新增：智慧規劃功能
export const generateSmartPlan = async (
  etfs: EtfData[],
  budgetWan: number,
  userRequest: string,
  onStream: (text: string) => void
): Promise<void> => {
  const modelId = 'gemini-3-flash-preview';
  const apiKey = getSafeApiKey();

  if (!apiKey) {
      onStream(MISSING_KEY_MSG);
      return;
  }

  const ai = new GoogleGenAI({ apiKey });

  const totalBudget = budgetWan * 10000;

  // 簡化 ETF 資料，減少 Token 使用並聚焦重點
  const etfSummary = etfs.map(e => ({
    code: e.code,
    name: e.name,
    category: e.category,
    price: e.priceCurrent,
    yield: e.dividendYield,
    estYield: e.estYield,
    type: e.category === 'AE' ? '債券' : (e.category === 'AD' ? '股票(月配)' : '股票(季配)')
  }));

  const prompt = `
    你是一位專業的投資理財顧問。
    使用者想要進行 ETF 投資規劃。

    **投資參數：**
    1. 總預算：${totalBudget.toLocaleString()} 台幣 (TWD)
    2. 使用者需求描述：${userRequest}

    **可用 ETF 清單 (只能從這裡選擇)：**
    ${JSON.stringify(etfSummary)}

    **任務：**
    請根據使用者的預算與需求，從「可用 ETF 清單」中挑選適合的標的，建立一個投資組合。
    
    **計算規則：**
    1. 請精確計算每檔 ETF 的購買「股數」與「預估成本」。
    2. 股數建議以 1000 股 (一張) 為單位，若預算不足可配零股，但盡量以整張為主。
    3. 總成本不能超過總預算。
    4. 必須嚴格遵守使用者對於「股債比」、「配息頻率(季配/月配)」的要求。

    **⚠️ 重要格式規範 (Mobile-First)：**
    1. **絕對禁止使用 Markdown 表格 (Do NOT use Tables)**：手機直向閱讀無法完整顯示表格。
    2. 請將每一檔推薦的 ETF 呈現為一張 **「資訊卡片」** (使用標題與清單)。

    **請依照下方範本結構輸出每一檔 ETF：**

    ### 🎯 [代號] 名稱
    *   **類型**: (例如：季配 AA)
    *   **建議股數**: xxx 股
    *   **預估成本**: $xxx
    *   **預估殖利率**: xx%
    *   **推薦理由**: (簡短說明)

    ---

    (列出所有 ETF 後，請在最後提供總結)
    
    ### 📊 規劃總結
    *   **預估總成本**: $xxx
    *   **預估年領股息**: $xxx
    *   **配置分析**: (簡短說明此配置如何滿足使用者需求)
  `;

  try {
    const response = await ai.models.generateContentStream({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    for await (const chunk of response) {
      if (chunk.text) {
        onStream(chunk.text);
      }
    }
  } catch (error: any) {
    console.error("Gemini Planning Error:", error);
    if (error.toString().includes("400") || error.toString().includes("403") || error.toString().includes("API key")) {
        onStream(MISSING_KEY_MSG);
    } else {
        onStream(`### ⚠️ AI 連線發生錯誤 \n\n 請稍後再試，或檢查您的網路連線。\n\n錯誤訊息: ${error.message || 'Unknown error'}`);
    }
  }
};
