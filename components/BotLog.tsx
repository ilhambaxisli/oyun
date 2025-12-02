import React from 'react';
import { LogEntry } from '../types';
import { CheckCircle2, XCircle, Clock, Terminal } from 'lucide-react';

interface BotLogProps {
  logs: LogEntry[];
  clearLogs: () => void;
}

const BotLog: React.FC<BotLogProps> = ({ logs, clearLogs }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-96">
      <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <h3 className="font-semibold text-gray-700 flex items-center gap-2">
          <Terminal size={18} />
          İşlem Kayıtları
        </h3>
        {logs.length > 0 && (
          <button 
            onClick={clearLogs}
            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            Temizle
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <Clock size={48} className="mb-2 opacity-20" />
            <p>Henüz bir işlem yok.</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="mt-0.5 shrink-0">
                {log.status === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                {log.status === 'error' && <XCircle size={16} className="text-red-500" />}
                {log.status === 'pending' && <Clock size={16} className="text-blue-500 animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-0.5">
                  <span className={`font-medium ${
                    log.status === 'error' ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {log.status === 'success' ? 'Başarılı' : log.status === 'error' ? 'Hata' : 'İşleniyor'}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-600 break-words">{log.message}</p>
                {log.details && (
                   <p className="text-xs text-red-400 mt-1 font-mono bg-red-50 p-1 rounded break-all">
                     {log.details}
                   </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BotLog;