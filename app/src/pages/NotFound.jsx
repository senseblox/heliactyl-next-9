import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="bg-neutral-950 min-h-screen flex items-center justify-center p-4">
      <div className="text-sm text-neutral-400">
        404 - Tough Luck, Seems like this page does not exist! 
      </div>
    </div>
  );
};

export default NotFound;
