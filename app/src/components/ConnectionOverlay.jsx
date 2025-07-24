import React from 'react';
import { RefreshCw } from 'lucide-react';

const ConnectionOverlay = ({ message = "Connecting to WebSocket..." }) => {
  return (
    <div className="fixed inset-0 bg-[#15171a] z-50 flex flex-col items-center justify-center">
        <RefreshCw className="w-10 h-10 text-neutral-400 animate-spin mb-4" />
        <h3 className="text-white text-lg font-medium mb-2">{message}</h3>
        <p className="text-neutral-400 text-sm text-center">
          Please wait while we establish a secure websocket connection...
        </p>
    </div>
  );
};

export default ConnectionOverlay;
