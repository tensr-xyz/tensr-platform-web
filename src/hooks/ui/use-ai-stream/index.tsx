import { useState, useEffect, useCallback, useRef } from 'react';
import { ServerMessage } from '@/types/sheet';

interface UseAIStreamOptions {
  channelId: string;
  onMessage?: (message: ServerMessage) => void;
}

interface UseAIStreamReturn {
  content: string;
  isStreaming: boolean;
  toolCalls: Array<{ toolName: string; arguments: any }>;
  toolResults: Array<{ toolName: string; result: any }>;
  error: string | null;
  reset: () => void;
}

export function useAIStream({ channelId, onMessage }: UseAIStreamOptions): UseAIStreamReturn {
  const [content, setContent] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolCalls, setToolCalls] = useState<Array<{ toolName: string; arguments: any }>>([]);
  const [toolResults, setToolResults] = useState<Array<{ toolName: string; result: any }>>([]);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<string>('');

  const reset = useCallback(() => {
    setContent('');
    setIsStreaming(false);
    setToolCalls([]);
    setToolResults([]);
    setError(null);
    contentRef.current = '';
  }, []);

  // This hook expects messages to be passed via onMessage callback
  // The parent component (useSheetState) will handle WebSocket messages
  useEffect(() => {
    if (!onMessage) return;

    const handleMessage = (message: ServerMessage) => {
      if (message.type === 'ai_stream' && (message as any).channelId === channelId) {
        const streamMessage = message as Extract<ServerMessage, { type: 'ai_stream' }>;

        if (streamMessage.done) {
          setIsStreaming(false);
        } else {
          setIsStreaming(true);
          contentRef.current += streamMessage.delta;
          setContent(contentRef.current);
        }
      } else if (message.type === 'ai_tool_call' && (message as any).channelId === channelId) {
        const toolCallMessage = message as Extract<ServerMessage, { type: 'ai_tool_call' }>;
        setToolCalls(prev => [
          ...prev,
          {
            toolName: toolCallMessage.toolName,
            arguments: toolCallMessage.arguments,
          },
        ]);
      } else if (message.type === 'ai_tool_result' && (message as any).channelId === channelId) {
        const toolResultMessage = message as Extract<ServerMessage, { type: 'ai_tool_result' }>;
        setToolResults(prev => [
          ...prev,
          {
            toolName: toolResultMessage.toolName,
            result: toolResultMessage.result,
          },
        ]);
      } else if (message.type === 'error') {
        setError(message.message);
        setIsStreaming(false);
      }

      // Call the parent's onMessage handler
      onMessage(message);
    };

    // The parent component will call this handler
    // For now, we'll rely on the parent to pass messages
    // This is a placeholder - actual integration happens in useSheetState
  }, [channelId, onMessage]);

  return {
    content,
    isStreaming,
    toolCalls,
    toolResults,
    error,
    reset,
  };
}
