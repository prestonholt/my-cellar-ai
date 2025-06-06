'use client';

import { useEffect, useState, useMemo } from 'react';
import { Loader2 } from 'lucide-react';

interface ToolResultSummaryProps {
  toolName: string;
  result: any;
}

// Cache for tool result summaries
const summaryCache = new Map<string, string>();

export function ToolResultSummary({ toolName, result }: ToolResultSummaryProps) {
  const [summary, setSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Create a stable cache key based on the result content
  const cacheKey = useMemo(() => {
    const resultString = JSON.stringify(result);
    // Simple hash function that's safe for all characters
    let hash = 0;
    for (let i = 0; i < resultString.length; i++) {
      const char = resultString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${toolName}:${Math.abs(hash).toString(36)}`;
  }, [toolName, result]);

  useEffect(() => {
    // Check cache first
    const cachedSummary = summaryCache.get(cacheKey);
    if (cachedSummary) {
      setSummary(cachedSummary);
      setIsLoading(false);
      return;
    }

    async function getSummary() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/summarize-tool-result', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ toolName, result }),
        });

        if (!response.ok) {
          throw new Error('Failed to summarize result');
        }

        const data = await response.json();
        const newSummary = data.summary;
        
        // Cache the result
        summaryCache.set(cacheKey, newSummary);
        setSummary(newSummary);
      } catch (error) {
        console.error('Error getting tool result summary:', error);
        // Fallback to simple display
        let fallbackSummary = '';
        if (result?.message) {
          fallbackSummary = result.message;
        } else if (result?.error) {
          fallbackSummary = `Error: ${result.error}`;
        } else {
          fallbackSummary = 'Tool completed successfully.';
        }
        
        // Cache the fallback too
        summaryCache.set(cacheKey, fallbackSummary);
        setSummary(fallbackSummary);
      } finally {
        setIsLoading(false);
      }
    }

    getSummary();
  }, [cacheKey]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-gray-600">Processing results...</span>
      </div>
    );
  }

  return (
    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
      <p className="text-sm text-gray-700">{summary}</p>
    </div>
  );
}