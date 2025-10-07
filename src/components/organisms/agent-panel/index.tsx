import { Button } from '@/components/atoms/button';
import { Alert, AlertDescription } from '@/components/atoms/alert';
import { Textarea } from '@/components/atoms/text-area';
import { Send, Brain, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTabsStore } from '@/stores/tabs-store';
import { useProjectStore } from '@/stores/project-store';
import { useAuth } from '@/hooks/api/use-auth';
import { Message } from '@/types/agent';
import { v4 as uuidv4 } from 'uuid';
import { apiClient } from '@/lib/api-client';
import { getIdToken } from '@/utils/auth';
import { useChatStore, ChatMessage } from '@/stores/chat-store';
import { ApprovalDialog } from '@/components/molecules/approval-dialog';
import { ProgressIndicator } from '@/components/molecules/progress-indicator';

export function AgentPanel() {
  const { tabs, activeTabId } = useTabsStore();
  const { currentProject } = useProjectStore();
  const { tokens } = useAuth();

  // Get project ID from current project or use default
  const projectId = currentProject?.id || 'default-project';

  // Use chat store for persistent state
  const {
    initializeSession,
    addMessage,
    setLoading,
    setError,
    getMessages,
    getLoading,
    getError,
    clearMessages,
  } = useChatStore();

  // Local state for input
  const [inputMessage, setInputMessage] = useState('');

  // Approval dialog state
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState<any>(null);

  // Get messages and state from store
  const messages = getMessages(projectId);
  const isLoading = getLoading(projectId);
  const error = getError(projectId);

  // Initialize session when component mounts or project changes
  useEffect(() => {
    initializeSession(projectId);
  }, [projectId, initializeSession]);

  // Get active tab data
  const { tabs: storeTabs, activeTabId: storeActiveTabId } = useTabsStore();
  const activeTab = storeTabs.find(tab => tab.id === storeActiveTabId);

  // Message handling using chat store
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      role: 'user' as const,
      content: inputMessage,
      timestamp: new Date(),
    };

    // Add user message to store
    addMessage(projectId, userMessage);
    
    const currentMessage = inputMessage;
    setInputMessage('');
    setLoading(projectId, true);
    setError(projectId, null);

    try {
      // Get the auth token (use ID token for API Gateway authorization)
      const token = getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      // Call the backend agent API
      const response = await apiClient.agent.chat({
        projectId,
        message: currentMessage,
        cursor: {
          snapshotId: 'current-snapshot',
          variables: [],
          filters: {},
        },
        authToken: token, // Use ID token for API Gateway authorization
      });

      if (response.type === 'error') {
        throw new Error(response.content);
      }

      // Handle different response types
      if (response.type === 'pending_approval') {
        // Show approval dialog
        setPendingCommand(response.pendingCommand);
        setApprovalDialogOpen(true);
        
        const aiMessage = {
          role: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
        };
        addMessage(projectId, aiMessage);
        return;
      }

      if (response.type === 'executing') {
        // Show progress indicator
        setExecutionProgress(response.executionProgress);
        setIsExecuting(true);
        return;
      }

      if (response.type === 'completed') {
        // Hide progress indicator
        setIsExecuting(false);
        setExecutionProgress(null);
      }

      const aiMessage = {
        role: 'assistant' as const,
        content: response.content,
        timestamp: new Date(),
      };

      // Add AI response to store
      addMessage(projectId, aiMessage);

      // Show suggested actions if available
      if (response.suggestedActions && response.suggestedActions.length > 0) {
        const suggestionsMessage = {
          role: 'assistant' as const,
          content: `💡 **Suggested next steps:**\n${response.suggestedActions.map((action: string) => `• ${action}`).join('\n')}`,
          timestamp: new Date(),
        };
        addMessage(projectId, suggestionsMessage);
      }
    } catch (err: any) {
      setError(projectId, err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(projectId, false);
    }
  };

  // Handle approval
  const handleApprove = async () => {
    if (!pendingCommand) return;

    setApprovalDialogOpen(false);
    setIsExecuting(true);
    setExecutionProgress({
      step: 1,
      totalSteps: 3,
      currentStep: 'Processing dataset',
      completed: false,
    });

    try {
      const token = getIdToken();
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await apiClient.agent.approve({
        projectId,
        command: pendingCommand,
        approved: true,
        authToken: token,
      });

      if (response.type === 'error') {
        throw new Error(response.content);
      }

      // Update progress
      setExecutionProgress({
        step: 2,
        totalSteps: 3,
        currentStep: 'Running analysis',
        completed: false,
      });

      // Simulate progress updates
      setTimeout(() => {
        setExecutionProgress({
          step: 3,
          totalSteps: 3,
          currentStep: 'Generating results',
          completed: false,
        });
      }, 2000);

      setTimeout(() => {
        setIsExecuting(false);
        setExecutionProgress(null);
        
        const aiMessage = {
          role: 'assistant' as const,
          content: response.content,
          timestamp: new Date(),
        };
        addMessage(projectId, aiMessage);
      }, 4000);

    } catch (err: any) {
      setIsExecuting(false);
      setExecutionProgress(null);
      setError(projectId, err.message || 'Failed to execute command. Please try again.');
    }
  };

  // Handle rejection
  const handleReject = () => {
    setApprovalDialogOpen(false);
    setPendingCommand(null);
    
    const aiMessage = {
      role: 'assistant' as const,
      content: 'Command cancelled. Let me know if you\'d like to try something else!',
      timestamp: new Date(),
    };
    addMessage(projectId, aiMessage);
  };

  return (
    <div
      className="flex flex-col h-full w-full bg-background p-0"
      style={{ maxWidth: '100%', width: '100%' }}
    >
      {/* Header with project context */}
      <div className="flex items-center gap-2 border-b border-border flex-shrink-0 px-4 py-2 min-w-0">
        <Brain className="h-4 w-4 text-primary flex-shrink-0" />
        <span className="font-medium text-sm truncate min-w-0">AI Assistant</span>
        <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">
          Project: {currentProject?.name || projectId}
        </span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearMessages(projectId)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground flex-shrink-0"
            title="Clear chat history"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Messages area - takes up all available space */}
      <div className="flex-1 overflow-auto space-y-4 min-h-0 min-w-0 py-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 px-4">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ask me anything about your data analysis</p>
            <p className="text-xs text-muted-foreground mt-2">
              I can help with statistics, code generation, and data interpretation
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current project: {currentProject?.name || projectId}
            </p>
          </div>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} px-4`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm break-words ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <div
                  dangerouslySetInnerHTML={{ __html: message.content.replace(/\n/g, '<br/>') }}
                />
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start px-4">
            <div className="bg-muted rounded-lg px-4 py-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}
      </div>

      {/* Input area - fixed at bottom */}
      <div className="p-4 border-t border-border bg-background flex-shrink-0 min-w-0">
        <div className="relative w-full">
          <Textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            placeholder="Ask about your data..."
            className="min-h-[40px] max-h-[120px] resize-none w-full pr-12"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            size="sm"
            className="absolute right-2 bottom-2 h-8 w-8 p-0 rounded-md flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-4 border-t border-border bg-background flex-shrink-0 min-w-0">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Approval Dialog */}
      <ApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        command={pendingCommand}
        onApprove={handleApprove}
        onReject={handleReject}
        isExecuting={isExecuting}
      />

      {/* Progress Indicator */}
      {isExecuting && executionProgress && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <ProgressIndicator
              progress={executionProgress}
              command={pendingCommand?.tool}
            />
          </div>
        </div>
      )}
    </div>
  );
}
