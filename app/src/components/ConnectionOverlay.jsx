import React from 'react';
import { RefreshCw } from 'lucide-react';

const ConnectionOverlay = ({ message = "Connecting to WebSocket..." }) => {
  return (
    <div className="fixed inset-0 bg-[#15171a] z-50 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-neutral-400 animate-spin mb-4" />
        <h3 className="text-white text-lg font-medium mb-2">{message}</h3>
        <p className="text-neutral-400 text-sm text-center">
          We're establishing a secure connection to your server. This should only take a moment.
        </p>
    </div>
  );
};

export default ConnectionOverlay;