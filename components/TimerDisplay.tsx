import React from 'react';
import { Timer } from 'lucide-react';

interface TimerDisplayProps {
  secondsLeft: number;
  isRunning: boolean;
  totalSeconds: number;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ secondsLeft, isRunning, totalSeconds }) => {
  // Calculate progress percentage for circle
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * circumference;
  const dashoffset = circumference - progress;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="relative w-40 h-40 flex items-center justify-center">
        {/* Background Circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-gray-100"
          />
          {/* Progress Circle */}
          <circle
            cx="80"
            cy="80"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={isRunning ? dashoffset : circumference}
            className={`transition-all duration-1000 ease-linear ${
              isRunning ? 'text-blue-500' : 'text-gray-300'
            }`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
          <Timer size={24} className={`mb-1 ${isRunning ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
          <span className="text-3xl font-bold font-mono">
            {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider mt-1">
            {isRunning ? 'Sonraki Mesaj' : 'Beklemede'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TimerDisplay;