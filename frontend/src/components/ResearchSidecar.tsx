import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, MessageSquare, History } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ResearchSidecarProps {
  symbol: string;
  context: string;
}

export const ResearchSidecar: React.FC<ResearchSidecarProps> = ({ symbol, context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial welcome message
    setMessages([
      { 
        role: 'assistant', 
        content: `Hi! I'm your Gemini-powered research assistant. I'm currently looking at **${symbol}**. What would you like to know about its recent news, technical setup, or fundamental outlook?` 
      }
    ]);
  }, [symbol]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/chat/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, context: context })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error researching that. Please try again." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Network error. Could not connect to the AI engine." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border border-gray-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900/40">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <h3 className="font-bold text-white text-sm">Deep Research: {symbol}</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 rounded-md border border-blue-500/20 text-[10px] font-bold text-blue-400">
          <Sparkles className="w-3 h-3" />
          GEMINI 1.5
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-gray-800"
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-4 ${m.role === 'assistant' ? 'items-start' : 'items-start flex-row-reverse'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border 
              ${m.role === 'assistant' 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              {m.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[85%] ${m.role === 'user' ? 'items-end' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm
                ${m.role === 'assistant' 
                  ? 'bg-gray-900 text-gray-200 border border-gray-800 rounded-tl-none' 
                  : 'bg-blue-600 text-white rounded-tr-none'
                }`}
              >
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 items-start">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center transition-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-gray-900 border border-gray-800 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-gray-900/40 border-t border-gray-800">
        <div className="relative">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask Gemini about this ticker..."
            className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 pr-12 text-sm text-white placeholder-gray-500 focus:border-blue-500 outline-none transition-all resize-none"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-lg transition-all"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2 text-[10px] text-gray-600 text-center flex items-center justify-center gap-1">
          <History className="w-3 h-3" />
          Gemini has access to current news and technical data.
        </div>
      </div>
    </div>
  );
};
