import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Loader2, Sparkles, MessageSquare, History, ChevronDown } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ResearchSidecarProps {
  symbol: string;
  context: string;
}

const MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', desc: 'Current 2026 Standard (Reliable)' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', desc: 'Always latest stable' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', desc: 'High Efficiency' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: 'Next-Gen Speed (Preview)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', desc: 'Deep Reasoning Stable' },
];

export const ResearchSidecar: React.FC<ResearchSidecarProps> = ({ symbol, context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[1]); // Default to gemini-flash-latest
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial welcome message
    setMessages([
      { 
        role: 'assistant', 
        content: `Hi! I'm your Gemini-powered research assistant. I'm currently looking at **${symbol}**. What would you like to know about its recent news, technical setup, or fundamental outlook?` 
      }
    ]);
  }, [symbol]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages((prev: Message[]) => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`http://localhost:8000/chat/${symbol}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userMsg, 
          context: context,
          model: selectedModel.id
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: "Sorry, I encountered an error researching that. Please try again." }]);
      }
    } catch (err) {
      setMessages((prev: Message[]) => [...prev, { role: 'assistant', content: "Network error. Could not connect to the AI engine." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border border-gray-800/50 rounded-2xl overflow-hidden shadow-2xl relative min-h-0">
      {/* Header with Model Selector */}
      <div className="px-5 py-4 border-b border-gray-800/50 flex items-center justify-between bg-gray-900/20 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <h3 className="font-bold text-white text-[13px] tracking-tight">Deep Research: {symbol}</h3>
        </div>
        
        <div className="relative">
          <button 
            onClick={() => setShowModelDropdown(!showModelDropdown)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 text-[10px] font-bold text-blue-400 transition-all group"
          >
            <Sparkles className="w-3 h-3 transition-transform group-hover:scale-110" />
            {selectedModel.name.toUpperCase()}
            <ChevronDown className={`w-3 h-3 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showModelDropdown && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowModelDropdown(false)} 
              />
              <div className="absolute right-0 mt-2 w-56 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-30 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-2 space-y-1">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedModel(m);
                        setShowModelDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all flex flex-col gap-0.5
                        ${selectedModel.id === m.id ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-gray-800 text-gray-400'}
                      `}
                    >
                      <span className="text-[11px] font-bold">{m.name}</span>
                      <span className="text-[9px] opacity-60 font-medium">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages Container */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 scroll-smooth scrollbar-thin scrollbar-thumb-gray-800/50"
      >
        {messages.map((m: Message, i: number) => (
          <div key={i} className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.role === 'assistant' ? 'items-start' : 'items-start flex-row-reverse'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border shadow-sm
              ${m.role === 'assistant' 
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              }`}
            >
              {m.role === 'assistant' ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[88%] ${m.role === 'user' ? 'items-end' : ''}`}>
              <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-lg backdrop-blur-sm
                ${m.role === 'assistant' 
                  ? 'bg-gray-900/80 text-gray-200 border border-gray-800/50 rounded-tl-none animate-border-rainbow' 
                  : 'bg-blue-600 text-white rounded-tr-none'
                }`}
              >
                {m.content.split('\n').map((line, lineIdx) => (
                  <p key={lineIdx} className={lineIdx > 0 ? "mt-2" : ""}>
                    {line.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, partIdx) => {
                      if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={partIdx} className="font-black text-white">{part.slice(2, -2)}</strong>;
                      } else if (part.startsWith('*') && part.endsWith('*')) {
                        return <em key={partIdx} className="italic text-blue-200">{part.slice(1, -1)}</em>;
                      }
                      return part;
                    })}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 items-start animate-pulse">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </div>
            <div className="bg-gray-900/50 border border-gray-800/50 px-4 py-2.5 rounded-2xl rounded-tl-none">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-gray-900/40 border-t border-gray-800/50">
        <div className="relative group">
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
            placeholder={`Ask ${selectedModel.name.split(' ')[0]}...`}
            className="w-full bg-gray-950/80 border border-gray-800/50 rounded-xl px-4 py-3 pr-12 text-[13px] text-white placeholder-gray-600 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all resize-none shadow-inner"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-20 disabled:hover:bg-blue-600 text-white rounded-lg transition-all shadow-lg active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="mt-3 text-[10px] text-gray-600 text-center flex items-center justify-center gap-2">
          <History className="w-3 h-3 opacity-50" />
          <span>Real-time market context powered by {selectedModel.name}</span>
        </div>
      </div>
    </div>
  );
};
