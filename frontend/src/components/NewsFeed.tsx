import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Clock, Sparkles, Filter, Target } from 'lucide-react';

interface NewsItem {
  headline: string;
  summary: string;
  url: string;
  created_at: string;
  source: string;
  symbols: string[];
}

interface NewsFeedProps {
  portfolioSymbols: string[];
  onAnalyze: (item: NewsItem) => void;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ portfolioSymbols, onAnalyze }) => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPortfolio, setFilterPortfolio] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8000/news')
      .then(res => res.json())
      .then(json => {
        setNews(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch news:", err);
        setLoading(false);
      });
  }, []);

  const isPortfolioMatch = (itemSymbols: string[]) => {
    return itemSymbols && itemSymbols.some(s => portfolioSymbols.includes(s));
  };

  const filteredNews = filterPortfolio 
    ? news.filter(item => isPortfolioMatch(item.symbols))
    : news;

  if (loading) {
    return (
      <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-1/3 mb-6"></div>
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-800 rounded-xl p-5 h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Newspaper className="text-purple-400 w-6 h-6" /> 
          Macro Catalysts & News
        </h2>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setFilterPortfolio(!filterPortfolio)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-xs font-bold
              ${filterPortfolio 
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/10' 
                : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-700'}
            `}
          >
            <Filter className="w-3.5 h-3.5" />
            {filterPortfolio ? 'Portfolio Only Active' : 'Filter by Portfolio'}
          </button>
        </div>
      </div>
      
      {filteredNews.length === 0 ? (
        <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
          <Target className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-400">No Portfolio Matches</h3>
          <p className="text-sm text-gray-500 mt-1">Try disabling the filter to see broad macro news.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredNews.map((item, idx) => {
            const hasMatch = isPortfolioMatch(item.symbols);
            return (
              <div 
                key={idx} 
                className={`group relative block bg-black/40 hover:bg-gray-800/60 border rounded-2xl p-6 transition-all duration-300
                  ${hasMatch ? 'border-amber-500/30 shadow-lg shadow-amber-500/5' : 'border-gray-800 hover:border-gray-700'}
                `}
              >
                {/* Highlight line for matches */}
                {hasMatch && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-l-2xl shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
                )}

                <div className="flex flex-col md:flex-row gap-6 justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      {item.symbols && item.symbols.map(sym => {
                        const isOwned = portfolioSymbols.includes(sym);
                        return (
                          <span 
                            key={sym} 
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wider flex items-center gap-1.5
                              ${isOwned 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' 
                                : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}
                            `}
                          >
                            {isOwned && <Target className="w-3 h-3" />}
                            {sym}
                          </span>
                        );
                      })}
                      <span className="text-xs text-gray-500 font-bold">{item.source || "System"}</span>
                      <span className="text-xs text-gray-600 flex items-center gap-1.5 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Just Now'}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-100 group-hover:text-blue-400 transition-colors mb-3 leading-snug">
                      {item.headline || "Macro Alert"}
                    </h3>
                    <p className="text-gray-400 text-sm leading-relaxed line-clamp-2 max-w-3xl">
                      {item.summary || "Significant macro movement detected in the core ETF basket."}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button 
                        onClick={() => onAnalyze(item)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all
                          ${hasMatch 
                            ? 'bg-amber-500 text-black hover:bg-amber-400 shadow-lg shadow-amber-500/20' 
                            : 'bg-blue-600/20 text-blue-400 border border-blue-500/20 hover:bg-blue-600/30 hover:text-white'}
                        `}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI INSIGHT
                      </button>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-all border border-transparent hover:border-gray-700"
                      >
                        Read Full <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
