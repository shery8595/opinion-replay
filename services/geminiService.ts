
import { GoogleGenAI } from "@google/genai";
import { BacktestResult, Market, StrategyConfig } from "../types";

export const getAIBacktestInsight = async (
  market: Market,
  config: StrategyConfig,
  result: BacktestResult
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    Analyze the following prediction market backtest result:
    Market: ${market.name}
    Strategy: ${config.type} with params ${JSON.stringify(config.params)}
    Result:
    - Total PnL: $${result.totalPnL.toFixed(2)}
    - Return: ${result.returnPercentage.toFixed(2)}%
    - Max Drawdown: ${result.maxDrawdown.toFixed(2)}%
    - Win Rate: ${result.winRate.toFixed(2)}%
    - Number of Trades: ${result.trades.length}

    Provide a professional, concise executive summary (3-4 sentences) on why this strategy performed this way and suggest one improvement.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No insights available at this time.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating AI insights. Please try again later.";
  }
};
