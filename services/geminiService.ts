import { GoogleGenAI } from "@google/genai";

// Helper to parse and format Gemini errors into readable Turkish messages
const formatGeminiError = (error: any): string => {
  let msg = error.message || error.toString();
  
  // Try to parse if it's a JSON string
  if (typeof msg === 'string' && (msg.startsWith('{') || msg.startsWith('['))) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error && parsed.error.message) {
        msg = parsed.error.message;
      }
    } catch (e) {
      // Failed to parse JSON, keep original message
    }
  }

  // Map common errors to user-friendly Turkish messages
  if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
    if (msg.includes("limit: 0")) {
       return `Sunucu IP Kısıtlaması (Limit: 0): Google, bu sunucu IP'sinden (Vercel/Netlify vb.) ücretsiz görsel oluşturmaya izin vermiyor. Lütfen kendi bilgisayarınızda (localhost) deneyin veya faturalı bir API hesabı kullanın.`;
    }
    return `Kota Aşıldı (429): Google Gemini API ücretsiz limitleri doldu. Lütfen biraz bekleyin.`;
  }
  
  if (msg.includes("API key not valid") || msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return `Yetki Hatası (403): API Anahtarı geçersiz veya yetkisiz.`;
  }

  return msg;
};

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateQuote = async (apiKey: string): Promise<string> => {
  if (!apiKey) throw new Error("Gemini API Anahtarı eksik.");

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = 'gemini-2.5-flash';
    
    const prompt = `Türkçe, dünya klasikleri, modern edebiyat, şiir veya felsefeden rastgele bir konuda SADECE TEK BİR TANE kitap alıntısı veya ünlü sözü yaz.

Sürekli 'insan' veya 'hayat' kelimesi geçen sözleri SEÇME. Konu yelpazesini geniş tut: Doğa, aşk, zaman, melankoli, sanat, bilim, cesaret, korku, umut, geçmiş, gelecek, dostluk, yalnızlık gibi farklı temalardan tamamen rastgele seç. Çeşitlilik çok önemli, hep aynı kelimeleri kullanma.

Format kesinlikle şu şekilde olsun (Alıntı ile kaynak arasında MUTLAKA bir boş satır bırak):

"Alıntı Cümlesi"

📖 Kitap Adı, Yazar

Örnek çıktı:
"Bütün mutlu aileler birbirine benzer, her mutsuz ailenin ise kendine özgü bir mutsuzluğu vardır."

📖 Anna Karenina, Lev Tolstoy

Başka açıklama, giriş metni veya numara yazma, sadece yukarıdaki formatta tek bir söz döndür.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        temperature: 1.2, // Yaratıcılığı ve rastgeleliği artırmak için yüksek temperature
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 },
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    const text = response.text;
    
    if (!text) {
      throw new Error("Gemini yanıtı boş döndü.");
    }
    
    return text.trim();
  } catch (error) {
    const formattedError = formatGeminiError(error);
    console.error("Gemini Quote Error:", formattedError);
    throw new Error(formattedError);
  }
};

// Re-implemented using raw fetch instead of SDK to avoid CORS/Client issues and have better control
export const generateImageForQuote = async (apiKey: string, quote: string): Promise<string> => {
  if (!apiKey) throw new Error("Gemini API Anahtarı eksik.");

  const attemptGeneration = async (isRetry = false): Promise<string> => {
    try {
      // Rastgele seed ekleyerek cache sorunlarını önle
      const seed = Math.floor(Math.random() * 1000000);
      const prompt = `Create an artistic, atmospheric, and high-quality illustration that visually represents the mood and meaning of the following quote. No text in the image. Style: Oil painting, Vintage, Textured, Classic Art. Quote: ${quote}. Seed: ${seed}`;

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

      const payload = {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          // imageConfig params are strictly validated in REST, keeping it simple
          responseMimeType: "text/plain" 
        },
        safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
        ]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle API errors directly from response
        const errorMessage = data.error?.message || response.statusText;
        throw new Error(errorMessage);
      }

      // Parse response structure
      if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
            return part.inlineData.data;
          }
        }
      }

      throw new Error("API yanıtında görsel verisi bulunamadı.");

    } catch (error: any) {
      const formattedError = formatGeminiError(error);
      
      // Retry logic only for temporary errors, not for hard limits
      if (!isRetry && 
          (formattedError.includes('429') || formattedError.includes('Kota')) && 
          !formattedError.includes('Limit: 0')) {
        
        console.warn("Kota aşıldı, 15 saniye sonra tekrar deneniyor...");
        await delay(15000); 
        return attemptGeneration(true);
      }
      
      throw new Error(formattedError);
    }
  };

  return attemptGeneration();
};