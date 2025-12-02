export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  status: 'success' | 'error' | 'pending';
  details?: string;
}

export interface BotConfig {
  botToken: string;
  chatId: string;
  geminiApiKey: string;
  intervalMinutes: number;
}

export enum BotStatus {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  FETCHING_QUOTE = 'FETCHING_QUOTE',
  SENDING = 'SENDING',
}

export type TaskType = 'text' | 'image';

export interface ScheduleItem {
  id: string;
  time: string; // Format "HH:MM"
  type: TaskType;
}

export interface GeneratedContent {
  quote: string;
  imageBase64: string;
  source: string;
}