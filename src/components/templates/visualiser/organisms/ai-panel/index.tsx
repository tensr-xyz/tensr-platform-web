'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWebLLM } from '@/lib/visualiser/llm/useWebLLM';
import { buildDatasetOverviewPrompt } from '@/lib/visualiser/llm/prompts/datasetOverview';
import { buildQAAboutDataPrompt } from '@/lib/visualiser/llm/prompts/qaAboutData';
import { buildGenericQuestionPrompt } from '@/lib/visualiser/llm/prompts/genericQuestion';
import {
  buildChartSuggestionsPrompt,
  type EnhancedChart,
} from '@/lib/visualiser/llm/prompts/chartSuggestions';
import { devLog } from '@/lib/dev-log';
import { computeSchemaSummary } from '@/utils/visualiser/schema-compute';
import { generateChartCandidates } from '@/utils/visualiser/chart-candidates';
import { routeQuestionAndComputeStats } from '@/utils/visualiser/stats-router';
import { Column } from '@/types/visualiser/spreadsheet';
import { Button } from '@/components/templates/visualiser/atoms/button';
import { Input } from '@/components/templates/visualiser/atoms/input';
import { ScrollArea } from '@/components/templates/visualiser/molecules/scroll-area';
import { Send, Loader2, AlertCircle, Sparkles } from 'lucide-react';

interface AIPanelProps {
  data?: Record<string, any>[];
  columns?: Column[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AIPanel({ data, columns }: AIPanelProps) {
  const { isReady, isLoading, isInitializing, hasWebGPU, error, ask, ensureReady } = useWebLLM();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [overview, setOverview] = useState<string | null>(null);
  const [chartSuggestions, setChartSuggestions] = useState<EnhancedChart[]>([]);
  const [isGeneratingOverview, setIsGeneratingOverview] = useState(false);
  const hasTriedInit = useRef(false);

  // Compute schema summary when data changes
  const schemaSummary = useMemo(() => {
    if (!data || !columns || data.length === 0) return null;
    return computeSchemaSummary(data, columns);
  }, [data, columns]);

  // Auto-initialize model when panel is opened and data is available (only once)
  useEffect(() => {
    if (schemaSummary && !isReady && !isInitializing && !hasTriedInit.current) {
      hasTriedInit.current = true;
      devLog('Auto-initializing WebLLM model...');
      ensureReady().catch(err => {
        console.error('Failed to auto-initialize model:', err);
        hasTriedInit.current = false; // Allow retry on error
      });
    }
  }, [schemaSummary, isReady, isInitializing]);

  // Auto-generate overview when data is available and model is ready
  useEffect(() => {
    if (schemaSummary && !overview && !isGeneratingOverview && isReady) {
      generateOverview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaSummary, overview, isGeneratingOverview, isReady]);

  const generateOverview = useCallback(async () => {
    if (!schemaSummary) return;

    setIsGeneratingOverview(true);
    try {
      await ensureReady();
      const prompt = buildDatasetOverviewPrompt(schemaSummary);
      const response = await ask(prompt);
      setOverview(response);
      setMessages([{ role: 'assistant', content: response }]);
    } catch (err) {
      console.error('Failed to generate overview:', err);
    } finally {
      setIsGeneratingOverview(false);
    }
  }, [schemaSummary, ask, ensureReady]);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !schemaSummary || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      await ensureReady();

      // Route question and compute stats
      const { statsText, relevantColumns } = routeQuestionAndComputeStats(
        userMessage,
        data || [],
        schemaSummary
      );

      let prompt;
      if (relevantColumns.length > 0 && statsText.includes('statistics')) {
        // Use Q&A prompt with computed stats
        prompt = buildQAAboutDataPrompt(userMessage, statsText);
      } else {
        // Use generic exploration prompt
        prompt = buildGenericQuestionPrompt(schemaSummary, userMessage);
      }

      const response = await ask(prompt);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMsg}` }]);
    }
  }, [inputMessage, schemaSummary, data, isLoading, ask, ensureReady]);

  // Generate chart suggestions
  useEffect(() => {
    if (schemaSummary && isReady && chartSuggestions.length === 0) {
      const candidates = generateChartCandidates(schemaSummary);
      if (candidates.length > 0) {
        const prompt = buildChartSuggestionsPrompt(schemaSummary, candidates);
        ask(prompt)
          .then(response => {
            try {
              // Try to parse JSON response
              const jsonMatch = response.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as EnhancedChart[];
                setChartSuggestions(parsed.slice(0, 5));
              }
            } catch {
              // If parsing fails, ignore
            }
          })
          .catch(() => {
            // Ignore errors
          });
      }
    }
  }, [schemaSummary, isReady, chartSuggestions.length, ask]);

  if (!data || !columns || data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4 text-muted-foreground text-sm text-center">
        Upload a file to see AI insights
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium">AI Assistant</h3>
        </div>
        {isInitializing && (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Preparing local AI (downloads once, runs on your device)...
            <span className="text-xs">This may take a minute on first use</span>
          </div>
        )}
        {!isReady && !isInitializing && schemaSummary && (
          <div className="text-xs text-muted-foreground">
            Click in the input below to start loading the AI model
          </div>
        )}
        {hasWebGPU === false && (
          <div className="text-xs text-amber-600 flex items-center gap-2 mt-1">
            <AlertCircle className="h-3 w-3" />
            WebGPU not available, using CPU (slower)
          </div>
        )}
        {error && (
          <div className="text-xs text-destructive flex items-center gap-2 mt-1">
            <AlertCircle className="h-3 w-3" />
            {error}
          </div>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Overview Section */}
          {overview && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Dataset Overview</h4>
              <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                {overview}
              </div>
            </div>
          )}

          {/* Chart Suggestions */}
          {chartSuggestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Suggested Charts</h4>
              <div className="space-y-2">
                {chartSuggestions.map((chart, idx) => (
                  <div key={idx} className="bg-muted/50 p-3 rounded-md">
                    <div className="text-sm font-medium mb-1">{chart.niceTitle}</div>
                    <div className="text-xs text-muted-foreground">{chart.niceReason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {messages.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Chat</h4>
              <div className="space-y-3">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`text-sm whitespace-pre-wrap p-3 rounded-md ${
                      msg.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-muted/50 mr-4'
                    }`}
                  >
                    {msg.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex gap-2">
          <Input
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder={
              isInitializing
                ? 'Loading AI model...'
                : isReady
                  ? 'Ask about your data...'
                  : 'Click to load AI model...'
            }
            className="flex-1"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isLoading || isInitializing}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || isInitializing || !inputMessage.trim()}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
