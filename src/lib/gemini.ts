import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || "";

// We use the modern GoogleGenAI SDK as per skill guidelines
export const ai = new GoogleGenAI({ apiKey });

export const MODELS = {
  FLASH: "gemini-3-flash-preview",
  PRO: "gemini-3.1-pro-preview",
};

/**
 * Basic helper to generate text content using Gemini.
 */
export async function generateText(prompt: string, model: string = MODELS.FLASH): Promise<string> {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add GEMINI_API_KEY to your secrets.");
  }

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate AI response");
  }
}

/**
 * Helper to generate a summary or assistant response for students.
 */
export async function getStudentAssistantResponse(query: string, context?: string): Promise<string> {
  const systemPrompt = `You are a helpful student assistant for a university platform. 
    ${context ? `Use the following context to help answer: ${context}` : ""}
    Be concise, encouraging, and focused on helping students collaborate on projects and study notes.`;
    
  return generateText(`${systemPrompt}\n\nStudent Query: ${query}`);
}
