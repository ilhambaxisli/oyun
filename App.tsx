import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, Send, Play, Square, MessageSquare, AlertTriangle, Key, Image as ImageIcon, CalendarClock, Plus, Trash2, Sparkles, PenTool } from 'lucide-react';
import { BotConfig, BotStatus, LogEntry, ScheduleItem, TaskType } from './types';
import { generateQuote, generateImageForQuote } from './services/geminiService';
import { sendTelegramMessage, sendTelegramPhoto, getTelegramUpdates } from './services/telegramService';
import BotLog from './components/BotLog';
import TimerDisplay from './components/TimerDisplay';

const DEFAULT_INTERVAL_MINUTES = 10;
const DEFAULT_TOKEN = "8321920172:AAGnr3FqM_m-qhIyHXkW3BTc0jgl-ypLj-A";
const DEFAULT_CHAT_ID = "-1003127799012";
const DEFAULT_GEMINI_KEY = "AIzaSyA6F-I8XU2gd5sSE4bpWOaiJ3y3BFOn05M";

export default function App() {
  const [config, setConfig] = useState<BotConfig>({
    botToken: DEFAULT_TOKEN,
    chatId: DEFAULT_CHAT_ID,
    geminiApiKey: DEFAULT_GEMINI_KEY,
    intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  });

  // UI Status (Idle, Fetching, Sending)
  const [status, setStatus] = useState<BotStatus>(BotStatus.IDLE);
  
  // Automation State (Is the interval timer running?)
  const [isAutoMode, setIsAutoMode] = useState(false);
  const isAutoModeRef = useRef(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_INTERVAL_MINUTES * 60);
  
  // Scheduler State
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [scheduleHour, setScheduleHour] = useState("12");
  const [scheduleMinute, setScheduleMinute] = useState("00");
  const [newScheduleType, setNewScheduleType] = useState<TaskType>('text');

  // Custom Quote State
  const [customQuote, setCustomQuote] = useState("");

  // Generate 00-23 hours and 00-59 minutes
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // Timers
  const intervalTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const schedulerClockRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTriggeredMinuteRef = useRef<string | null>(null);

  useEffect(() => {
    isAutoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  const addLog = (message: string, type: 'success' | 'error' | 'pending', details?: string) => {
    const newLog: LogEntry = {
      id: Date.now().toString() + Math.random().toString(),
      timestamp: new Date(),
      message,
      status: type,
      details
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const fetchChatId = async () => {
    if (!config.botToken) {
      addLog("Önce Bot Token girmelisiniz.", "error");
      return;
    }
    try {
      addLog("Chat ID aranıyor... (Lütfen bota bir mesaj atın)", "pending");
      const foundId = await getTelegramUpdates(config.botToken);
      if (foundId) {
        setConfig(prev => ({ ...prev, chatId: foundId.toString() }));
        addLog(`Chat ID bulundu: ${foundId}`, "success");
      } else {
        addLog("Chat ID bulunamadı. Lütfen bota bir 'Merhaba' yazıp tekrar deneyin.", "error");
      }
    } catch (e: any) {
      addLog("Chat ID alınırken hata oluştu", "error", e.message);
    }
  };

  // Custom Quote Handler
  const handleCustomSend = async () => {
    if (!customQuote.trim()) {
      alert("Lütfen önce bir söz yazın.");
      return;
    }
    if (!config.botToken || !config.chatId || !config.geminiApiKey) {
      addLog("Bot Token, Chat ID ve Gemini API Key gereklidir.", "error");
      return;
    }

    try {
      setStatus(BotStatus.FETCHING_QUOTE);
      addLog(`[Manuel] Özel söz için görsel hazırlanıyor...`, "pending");

      // Generate image based on the custom quote
      const imageBase64 = await generateImageForQuote(config.geminiApiKey, customQuote);
      addLog("Görsel hazır, Telegram'a gönderiliyor...", "pending");

      // Send photo with custom quote as caption
      await sendTelegramPhoto(config.botToken, config.chatId, imageBase64, customQuote);
      addLog("[Manuel] Özel resimli mesaj başarıyla iletildi.", "success");

      setCustomQuote(""); // Clear input
      setStatus(isAutoModeRef.current ? BotStatus.RUNNING : BotStatus.IDLE);

    } catch (error: any) {
      addLog("Özel mesaj hatası", "error", error.message);
      setStatus(isAutoModeRef.current ? BotStatus.RUNNING : BotStatus.IDLE);
    }
  };

  // Unified Task Executor
  const executeTask = useCallback(async (type: TaskType, source: 'manual' | 'interval' | 'schedule') => {
    if (!config.botToken || !config.chatId || !config.geminiApiKey) {
      addLog("Bot Token, Chat ID ve Gemini API Key gereklidir.", "error");
      return;
    }

    try {
      const sourceLabel = source === 'schedule' ? 'Zamanlanmış' : source === 'interval' ? 'Otomatik' : 'Manuel';
      
      // Update UI Status
      setStatus(BotStatus.FETCHING_QUOTE);
      
      // Image Process: Fully Automatic
      if (type === 'image') {
        addLog(`[${sourceLabel}] Görsel ve söz üretiliyor...`, "pending");
        
        const quote = await generateQuote(config.geminiApiKey);
        addLog("Söz hazır, görsel çiziliyor (10-20sn)...", "pending");
        
        const imageBase64 = await generateImageForQuote(config.geminiApiKey, quote);
        addLog("Görsel hazır, Telegram'a gönderiliyor...", "pending");
        
        await sendTelegramPhoto(config.botToken, config.chatId, imageBase64, quote);
        addLog(`[${sourceLabel}] Resimli mesaj başarıyla iletildi.`, "success");
        
        setStatus(isAutoModeRef.current ? BotStatus.RUNNING : BotStatus.IDLE);
        return; 
      }

      // Text Flow: Standard logs and auto-send
      addLog(`[${sourceLabel}] Söz üretiliyor...`, "pending");
      const quote = await generateQuote(config.geminiApiKey);
      addLog(`Söz hazır: "${quote.substring(0, 30)}..."`, "success");

      setStatus(BotStatus.SENDING);
      addLog("Metin gönderiliyor...", "pending");
      await sendTelegramMessage(config.botToken, config.chatId, quote);
      addLog(`[${sourceLabel}] Mesaj başarıyla iletildi.`, "success");

      // Reset logic for text
      if (source === 'interval') {
         setSecondsLeft(config.intervalMinutes * 60);
      }
      
      setStatus(isAutoModeRef.current ? BotStatus.RUNNING : BotStatus.IDLE);

    } catch (error: any) {
      addLog(`İşlem hatası (${type})`, "error", error.message);
      setStatus(isAutoModeRef.current ? BotStatus.RUNNING : BotStatus.IDLE);
    }
  }, [config.botToken, config.chatId, config.geminiApiKey, config.intervalMinutes]);


  // Scheduler Handlers
  const addSchedule = () => {
    const timeString = `${scheduleHour}:${scheduleMinute}`;
    if (schedules.some(s => s.time === timeString)) {
      alert("Bu saat için zaten bir görev var.");
      return;
    }
    const newItem: ScheduleItem = {
      id: Date.now().toString(),
      time: timeString, 
      type: newScheduleType
    };
    setSchedules(prev => [...prev, newItem].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const removeSchedule = (id: string) => {
    setSchedules(prev => prev.filter(s => s.id !== id));
  };

  const toggleBot = () => {
    if (!isAutoMode) {
      if (!config.botToken || !config.chatId || !config.geminiApiKey) {
        alert("Lütfen tüm ayarları (Token, Chat ID, API Key) doldurun.");
        return;
      }
      setIsAutoMode(true);
      setStatus(BotStatus.RUNNING);
      addLog("Otomatik periyodik gönderim başlatıldı.", "success");
    } else {
      setIsAutoMode(false);
      setStatus(BotStatus.IDLE);
      addLog("Otomatik periyodik gönderim durduruldu.", "pending");
      setSecondsLeft(config.intervalMinutes * 60);
    }
  };

  // Effect 1: Interval Timer
  useEffect(() => {
    if (isAutoMode && status === BotStatus.RUNNING) {
      intervalTimerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            executeTask('text', 'interval');
            return config.intervalMinutes * 60; 
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    }
    return () => {
      if (intervalTimerRef.current) clearInterval(intervalTimerRef.current);
    };
  }, [isAutoMode, status, config.intervalMinutes, executeTask]);

  // Effect 2: Scheduler Clock
  useEffect(() => {
    schedulerClockRef.current = setInterval(() => {
      const now = new Date();
      const currentMinuteString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (lastTriggeredMinuteRef.current !== currentMinuteString) {
        const matchedSchedule = schedules.find(s => s.time === currentMinuteString);
        
        if (matchedSchedule) {
          if (status === BotStatus.IDLE || status === BotStatus.RUNNING) {
             addLog(`Zamanlanmış görev tetiklendi: ${matchedSchedule.time} (${matchedSchedule.type === 'image' ? 'Resim' : 'Metin'})`, "pending");
             executeTask(matchedSchedule.type, 'schedule');
          } else {
             addLog(`Zamanlanmış görev (${matchedSchedule.time}) atlandı: Bot meşgul.`, "error");
          }
          lastTriggeredMinuteRef.current = currentMinuteString;
        }
      }
    }, 1000);

    return () => {
      if (schedulerClockRef.current) clearInterval(schedulerClockRef.current);
    };
  }, [schedules, executeTask, status]);

  // Update seconds left
  useEffect(() => {
    if (!isAutoMode) {
      setSecondsLeft(config.intervalMinutes * 60);
    }
  }, [config.intervalMinutes, isAutoMode]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-8 font-sans relative">
      
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200">
            <Bot className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Telegram Oto-Söz Botu</h1>
            <p className="text-gray-500">Gemini AI destekli otomatik alıntı ve içerik yönetim sistemi</p>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: Config & Controls (Span 5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Settings Card */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Key size={20} className="text-gray-500" />
                Bot Ayarları
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Bot Token</label>
                  <input
                    type="text"
                    value={config.botToken}
                    onChange={(e) => setConfig({ ...config, botToken: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                    placeholder="123456:ABC-DEF..."
                  />
                </div>

                {/* API Key field removed for security/visual preference, but key is still used in state */}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.chatId}
                      onChange={(e) => setConfig({ ...config, chatId: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                      placeholder="-100123456789"
                    />
                    <button
                      onClick={fetchChatId}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap"
                    >
                      <MessageSquare size={16} />
                      ID Bul
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Otomatik Aralık (Dakika)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={config.intervalMinutes}
                    onChange={(e) => setConfig({ ...config, intervalMinutes: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1">Sadece "Botu Başlat" aktifken çalışır.</p>
                </div>
              </div>
            </div>

            {/* Manual Controls */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
               <h2 className="text-lg font-semibold flex items-center gap-2">
                <Play size={20} className="text-gray-500" />
                Kontrol Paneli
              </h2>
              
              <div className="flex items-center gap-2">
                 <button
                  onClick={toggleBot}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-white transition-all transform active:scale-95 shadow-md ${
                    isAutoMode 
                      ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                      : 'bg-green-600 hover:bg-green-700 shadow-green-200'
                  }`}
                >
                  {isAutoMode ? (
                    <>
                      <Square size={20} fill="currentColor" /> Sayacı Durdur
                    </>
                  ) : (
                    <>
                      <Play size={20} fill="currentColor" /> Sayacı Başlat
                    </>
                  )}
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => executeTask('text', 'manual')}
                  disabled={status !== BotStatus.IDLE && status !== BotStatus.RUNNING}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-100 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  <Send size={16} /> Test (Yazı)
                </button>
                <button
                  onClick={() => executeTask('image', 'manual')}
                  disabled={status !== BotStatus.IDLE && status !== BotStatus.RUNNING}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-100 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  <ImageIcon size={16} /> Resimli Test
                </button>
              </div>
            </div>

            {/* Custom Content Creator */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
               <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <PenTool size={20} className="text-gray-500" />
                Özel Söz & Görsel
              </h2>
              <textarea
                value={customQuote}
                onChange={(e) => setCustomQuote(e.target.value)}
                placeholder="Buraya kendi sözünüzü yazın. Bot buna uygun bir görsel oluşturup ikisini birlikte gönderecektir..."
                className="w-full p-3 border border-gray-300 rounded-lg text-sm h-24 resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none mb-3"
              />
              <button
                onClick={handleCustomSend}
                disabled={status !== BotStatus.IDLE && status !== BotStatus.RUNNING || !customQuote.trim()}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles size={16} />
                Oluştur ve Gönder
              </button>
            </div>

          </div>

          {/* MIDDLE COLUMN: Scheduler (Span 4) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CalendarClock size={20} className="text-purple-500" />
                Zamanlayıcı (Her Zaman Aktif)
              </h2>
              
              <div className="bg-purple-50 p-4 rounded-lg mb-4 border border-purple-100">
                <label className="block text-xs font-semibold text-purple-800 uppercase tracking-wide mb-2">Yeni Görev Ekle (24 Saat)</label>
                <div className="flex gap-2 mb-2 items-center">
                  {/* Hour Selector */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 mb-0.5 ml-1">Saat</span>
                    <select
                      value={scheduleHour}
                      onChange={(e) => setScheduleHour(e.target.value)}
                      className="px-2 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                    >
                      {hours.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  
                  <span className="font-bold text-gray-400 mt-4">:</span>

                  {/* Minute Selector */}
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 mb-0.5 ml-1">Dakika</span>
                    <select
                      value={scheduleMinute}
                      onChange={(e) => setScheduleMinute(e.target.value)}
                      className="px-2 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                    >
                      {minutes.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col flex-1 ml-2">
                     <span className="text-[10px] text-gray-500 mb-0.5 ml-1">Tip</span>
                    <select 
                      value={newScheduleType}
                      onChange={(e) => setNewScheduleType(e.target.value as TaskType)}
                      className="w-full px-2 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="text">Metin</option>
                      <option value="image">Resim</option>
                    </select>
                  </div>
                </div>
                
                <button 
                  onClick={addSchedule}
                  className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors mt-2"
                >
                  <Plus size={16} /> Ekle
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px]">
                {schedules.length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">
                    Planlanmış görev yok.
                  </div>
                ) : (
                  schedules.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group hover:border-purple-200 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${item.type === 'image' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                           {item.type === 'image' ? <ImageIcon size={16} /> : <MessageSquare size={16} />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 font-mono text-lg leading-none">{item.time}</p>
                          <p className="text-xs text-gray-500">{item.type === 'image' ? 'Resimli Mesaj' : 'Metin Mesajı'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeSchedule(item.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Status & Logs (Span 3) */}
          <div className="lg:col-span-3 space-y-6">
            <TimerDisplay 
              secondsLeft={secondsLeft} 
              isRunning={isAutoMode} 
              totalSeconds={config.intervalMinutes * 60} 
            />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                <div className="text-xs text-amber-800">
                  <p className="font-semibold mb-1">Önemli Bilgi</p>
                  <p className="opacity-90">
                    Botun çalışması için bu tarayıcı sekmesi açık kalmalıdır. <br/><br/>
                    <strong>Zamanlayıcı:</strong> Sayacı başlatmasanız bile listedeki saatlerde çalışır. <br/>
                    <strong>Sayaç:</strong> "Sayacı Başlat" butonuna bastığınızda her {config.intervalMinutes} dakikada bir çalışır.
                  </p>
                </div>
              </div>
            </div>

             <BotLog logs={logs} clearLogs={() => setLogs([])} />
          </div>
        </div>
      </div>
    </div>
  );
}