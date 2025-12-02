export const sendTelegramMessage = async (token: string, chatId: string, text: string): Promise<any> => {
  if (!token || !chatId) {
    throw new Error("Bot Token ve Chat ID gereklidir.");
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown', // Optional: allows bold/italic
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || "Telegram API hatası");
    }

    return data;
  } catch (error: any) {
    // Check for common CORS issue which happens in browser-only environments calling Telegram
    if (error.message === 'Failed to fetch') {
      throw new Error("Ağ hatası (Muhtemelen CORS). Tarayıcılar doğrudan Telegram API'sine erişimi engelleyebilir. Bir CORS eklentisi kullanmayı deneyin veya bu kodu yerel sunucuda çalıştırın.");
    }
    throw error;
  }
};

// Helper to convert base64 string to Blob
const base64ToBlob = (base64: string, mimeType: string) => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

export const sendTelegramPhoto = async (token: string, chatId: string, photoBase64: string, caption: string): Promise<any> => {
  if (!token || !chatId) {
    throw new Error("Bot Token ve Chat ID gereklidir.");
  }

  const url = `https://api.telegram.org/bot${token}/sendPhoto`;
  
  try {
    // Create FormData to send file
    const formData = new FormData();
    formData.append('chat_id', chatId);
    formData.append('caption', caption);
    
    // Convert base64 image data to Blob and append as file
    const imageBlob = base64ToBlob(photoBase64, 'image/png');
    formData.append('photo', imageBlob, 'quote_image.png');

    const response = await fetch(url, {
      method: 'POST',
      // No Content-Type header needed here, browser sets it for FormData (multipart/form-data)
      body: formData,
    });

    const data = await response.json();

    if (!data.ok) {
      throw new Error(data.description || "Telegram API Görsel Gönderme Hatası");
    }

    return data;
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error("Ağ hatası (CORS).");
    }
    throw error;
  }
};

export const getTelegramUpdates = async (token: string): Promise<number | null> => {
  if (!token) throw new Error("Token gerekli");
  
  const url = `https://api.telegram.org/bot${token}/getUpdates`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.ok && data.result && data.result.length > 0) {
      // Get the chat ID from the most recent message
      const lastUpdate = data.result[data.result.length - 1];
      return lastUpdate.message?.chat?.id || lastUpdate.channel_post?.chat?.id || null;
    }
    return null;
  } catch (error) {
    console.error("Failed to get updates", error);
    return null;
  }
};