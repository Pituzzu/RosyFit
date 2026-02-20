
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Use process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper per eseguire chiamate asincrone con retry in caso di errore transienti (500/503)
 */
const withRetry = async <T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error?.message?.includes('500') || 
                        error?.message?.includes('xhr') || 
                        error?.message?.includes('ProxyUnaryCall');
    
    if (retries <= 0 || !isRetryable) throw error;
    
    console.warn(`Tentativo fallito. Riprovo tra ${delay}ms... (Rimasti: ${retries})`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
};

export const getRecipeAdvice = async (dietContext: string, prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: `Diet Context: ${dietContext}\n\nUser Question: ${prompt}` }] },
      config: {
        systemInstruction: "Sei un assistente nutrizionista esperto di nome ROSYFIT. Fornisci istruzioni di preparazione chiare e pulite. IMPORTANTE: NON utilizzare simboli markdown come doppi asterischi (**) per il grassetto o asterischi singoli (*) per gli elenchi. Per gli elenchi puntati usa solo il simbolo '•'. Scrivi in modo testuale semplice senza alcun codice markdown. Sii molto concisa e vai dritto al punto.",
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Spiacente, non riesco a connettermi all'AI al momento.";
  }
};

export const getShoppingOffers = async (ingredients: string[]) => {
  const month = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date());
  const query = `Cerca i prezzi attuali e le offerte nel volantino di Eurospin, Lidl e Decò per ${month} 2025 per questi prodotti in Sicilia: ${ingredients.join(', ')}`;
  
  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: query }] },
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: `Sei l'assistente agli acquisti di ROSYFIT. 
        Analizza i risultati della ricerca Google per trovare offerte specifiche su: ${ingredients.join(', ')}.
        Rispondi con un elenco puntato usando solo '•'.
        Formato: 'Nome Prodotto - Negozio - Prezzo/Offerta'. 
        NON usare markdown. Sii breve.`,
      },
    }));

    return {
      text: response.text || "Nessuna offerta trovata tramite ricerca web.",
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Search Grounding Error (Handled):", error);
    return { 
      text: "Il radar offerte web è momentaneamente offline. Prova a caricare un volantino PDF.", 
      sources: [] 
    };
  }
};

export const analyzeFlyerPDF = async (base64Pdf: string, ingredients: string[]) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Pdf,
            },
          },
          {
            text: `Analizza questo volantino PDF. Cerca i prezzi migliori per questi prodotti: ${ingredients.join(', ')}. 
            Dimmi quali sono in offerta e il loro prezzo. Sii molto sintetico. Usa solo '•' per elenchi. Niente markdown.`,
          },
        ]
      },
    });
    return response.text;
  } catch (error) {
    console.error("PDF Analysis Error:", error);
    return "Errore durante l'analisi del file PDF.";
  }
};

export const analyzeMealNutrition = async (base64Image: string, description?: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          ...(base64Image ? [{ inlineData: { mimeType: "image/jpeg", data: base64Image } }] : []),
          { text: `Analizza questo pasto ${description ? `(${description})` : ''}. Estrai calorie (Kcal), carboidrati (g), proteine (g) e grassi (g). Rispondi SOLO in questo formato stringa semplice: CAL: [numero] | CARBI: [numero] | PRO: [numero] | FATS: [numero]. Non aggiungere altro testo.` }
        ]
      },
    });
    return response.text;
  } catch (error) {
    console.error("Meal Analysis Error:", error);
    return "CAL: 0 | CARBI: 0 | PRO: 0 | FATS: 0";
  }
};
