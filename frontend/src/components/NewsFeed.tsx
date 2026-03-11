import { useEffect, useState } from 'react';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';

interface NewsItem {
  headline: string;
  summary: string;
  url: string;
  created_at: string;
  source: string;
  symbols: string[];
}

export const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!news || news.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-gray-800">
        <Newspaper className="w-12 h-12 text-gray-700 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-400">No News Available</h3>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/40 border border-gray-800 rounded-2xl p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <Newspaper className="text-purple-400 w-6 h-6" /> 
        Macro Catalysts & News
      </h2>
      
      <div className="grid gap-4">
        {news.map((item, idx) => (
          <a 
            key={idx} 
            href={item.url || "#"} 
            target={item.url ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className="group block bg-black/40 hover:bg-gray-800/60 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-all duration-300"
          >
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  {item.symbols && item.symbols.map(sym => (
                    <span key={sym} className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-bold tracking-wider">
                      {sym}
                    </span>
                  ))}
                  <span className="text-xs text-gray-500 font-semibold">{item.source || "System"}</span>
                  <span className="text-xs text-gray-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Just Now'}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-200 group-hover:text-blue-400 transition-colors mb-2">
                  {item.headline || "Macro Alert"}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {item.summary || "Significant macro movement detected in the core ETF basket."}
                </p>
              </div>
              
              <div className="flex items-center justify-end md:justify-center md:pl-4 opacity-50 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};
