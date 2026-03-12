import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Search, Command, X, ArrowRight, Zap } from 'lucide-react';

interface OmnisearchProps {
  onSelect: (symbol: string) => void;
}

export const Omnisearch: React.FC<OmnisearchProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Dynamic list of assets synchronized with the Macro Scanner
  const [popularAssets, setPopularAssets] = useState<string[]>(['SPY', 'QQQ', 'IWM', 'GLD', 'TMF', 'BND', 'NVDA', 'TSLA', 'AAPL', 'MSFT']);
  const [results, setResults] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load latest symbols whenever the search box is opened
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('macro_scanner_symbols');
      if (saved) {
        try {
          const scannerSymbols = JSON.parse(saved);
          // Combine scanner symbols with some core tech stocks, removing duplicates
          const combined = Array.from(new Set([...scannerSymbols, 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL']));
          setPopularAssets(combined);
        } catch (e) {
          console.error("Error parsing scanner symbols");
        }
      }
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (query.trim() === '') {
      setResults(popularAssets.slice(0, 12)); // Increased limit to show more custom symbols
    } else {
      const filtered = popularAssets.filter(a => 
        a.toLowerCase().includes(query.toLowerCase())
      );
      // If the query is a new symbol not in our list, add it as a primary option
      if (query.length >= 2 && !filtered.includes(query.toUpperCase())) {
        filtered.unshift(query.toUpperCase());
      }
      setResults(filtered.slice(0, 8));
    }
  }, [query, popularAssets]);

  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) return (
    <button 
      onClick={() => setIsOpen(true)}
      className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-900/50 border border-gray-800 rounded-xl text-gray-400 hover:text-white hover:border-gray-700 transition-all group"
    >
      <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium">Search symbols...</span>
      <div className="flex items-center gap-1 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800 text-[10px] font-bold">
        <Command className="w-2.5 h-2.5" /> K
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 backdrop-blur-sm bg-black/60 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-gray-950 border border-gray-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-top-4 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800 bg-gray-900/20">
          <Search className="w-5 h-5 text-blue-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search any ticker (e.g. NVDA, AAPL, BTC)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && results[0] && handleSelect(results[0])}
            className="flex-1 bg-transparent border-none outline-none text-lg text-white placeholder-gray-500"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {results.length > 0 ? (
            <div className="grid gap-1">
              <div className="px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-gray-600">
                {query ? 'Search Results' : 'Popular Assets'}
              </div>
              {results.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSelect(symbol)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 group transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold border border-blue-500/20 group-hover:bg-blue-500/20 group-hover:scale-105 transition-all">
                      {symbol[0]}
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {symbol}
                        {popularAssets.includes(symbol) && (
                          <Zap className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <div className="text-xs text-gray-500">View detailed AI Pulse analysis & Research</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-gray-500 italic">
              No symbols found. Type a ticker to search.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 bg-gray-900/10 flex items-center justify-between text-[11px] text-gray-500">
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded border border-gray-700">↵</kbd> Select</span>
            <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded border border-gray-700">↑↓</kbd> Navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-gray-800 px-1 rounded border border-gray-700">ESC</kbd> Close</span>
          </div>
          <div className="flex items-center gap-1.5 text-blue-400/80">
            <Zap className="w-3 h-3" />
            Powered by Gemini AI
          </div>
        </div>
      </div>
      <div 
        className="absolute inset-0 -z-10" 
        onClick={() => setIsOpen(false)} 
      />
    </div>
  );
};
