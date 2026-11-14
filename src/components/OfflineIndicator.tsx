import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-4 right-4 z-40 mx-auto max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-md flex items-center gap-3 lg:bottom-6"
    >
      <WifiOff className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <span>Offline Mode — Showing saved prescription and device speech.</span>
    </div>
  );
};
