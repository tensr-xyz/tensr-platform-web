import { Button } from '@/components/atoms/button';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export function AgentPanel() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      content: message,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer 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`, // ⚠️ Never expose secrets like this in production!
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: message }],
        }),
      });

      const data = await res.json();
      const aiResponse = data.choices?.[0]?.message?.content;

      if (aiResponse) {
        const aiMessage: Message = {
          id: uuidv4(),
          content: aiResponse,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      console.error('Error talking to ChatGPT:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg max-w-md ${
              msg.sender === 'user' ? 'bg-blue-100 self-end' : 'bg-gray-100 self-start'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && <div className="text-sm text-gray-400">Typing...</div>}
      </div>

      <div className="border-t border-gray-200 p-4">
        <div className="relative">
          <textarea
            placeholder="Message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-4 h-36 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none"
          />
          <div className="absolute bottom-4 right-4 flex space-x-2">
            <Button onClick={handleSendMessage} disabled={loading}>
              <Send size={18} />
              <span className="ml-4">Send</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
