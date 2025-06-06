'use client';

import { useState, useEffect } from 'react';
import { WineCardsGrid } from './wine-card';
import type { WineCardsData } from './data-stream-handler';

interface WineCardsDisplayProps {
  id: string;
}

export function WineCardsDisplay({ id }: WineCardsDisplayProps) {
  const [wineCardsData, setWineCardsData] = useState<WineCardsData | null>(null);

  // Listen for wine cards data from the data stream
  useEffect(() => {
    const handleWineCardsMessage = (event: MessageEvent) => {
      if (event.data?.type === 'wine-cards' && event.data?.chatId === id) {
        setWineCardsData(event.data.content as WineCardsData);
      }
    };

    window.addEventListener('message', handleWineCardsMessage);
    return () => window.removeEventListener('message', handleWineCardsMessage);
  }, [id]);

  if (!wineCardsData) {
    return null;
  }

  return (
    <div className="my-4">
      <WineCardsGrid 
        wines={wineCardsData.wineCards} 
        contextMessage={wineCardsData.contextMessage}
      />
    </div>
  );
}