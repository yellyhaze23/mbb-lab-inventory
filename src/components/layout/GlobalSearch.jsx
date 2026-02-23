import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, X, FlaskConical, Package, MapPin, AlertTriangle } from 'lucide-react';
import debounce from 'lodash/debounce';
import { listAllItems } from '@/api/itemsDataClient';

function formatLocation(item) {
  if (!item.room_area && !item.storage_type) {
    return item.location || null;
  }
  let parts = [];
  if (item.room_area) parts.push(item.room_area);
  if (item.storage_type) {
    let storagePart = item.storage_type;
    if (item.storage_number) storagePart += ` ${item.storage_number}`;
    parts.push(storagePart);
  }
  if (item.position) parts.push(item.position);
  return parts.length > 0 ? parts.join(' – ') : null;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [allItems, setAllItems] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    loadAllItems();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllItems = async () => {
    try {
      const items = await listAllItems(1000);
      setAllItems(items);
    } catch (error) {
      console.error('Error loading items for search:', error);
    }
  };

  const performSearch = useCallback(
    debounce((searchQuery) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }

      const q = searchQuery.toLowerCase();
      const filtered = allItems.filter(item => {
        const locationStr = formatLocation(item)?.toLowerCase() || '';
        return (
          item.name?.toLowerCase().includes(q) ||
          locationStr.includes(q) ||
          item.supplier?.toLowerCase().includes(q) ||
          item.project_fund_source?.toLowerCase().includes(q)
        );
      }).slice(0, 10);

      setResults(filtered);
      setIsSearching(false);
    }, 250),
    [allItems]
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsSearching(true);
    setShowDropdown(true);
    performSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleResultClick = (item) => {
    const page = item.category === 'chemical' ? 'Chemicals' : 'Consumables';
    setShowDropdown(false);
    setQuery('');
    // Navigate with search param to highlight/filter
    navigate(createPageUrl(page) + `?highlight=${item.id}&search=${encodeURIComponent(item.name)}`);
  };

  const getStatusBadges = (item) => {
    const badges = [];
    if (item.status === 'disposed') {
      badges.push({ label: 'Disposed', className: 'bg-slate-100 text-slate-600' });
    }
    if (item.quantity <= item.minimum_stock && item.status !== 'disposed') {
      badges.push({ label: 'Low Stock', className: 'bg-amber-100 text-amber-700' });
    }
    return badges;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          type="text"
          placeholder="Search items by name, location, supplier..."
          value={query}
          onChange={handleInputChange}
          onFocus={() => query && setShowDropdown(true)}
          className="pl-9 pr-8 h-9 rounded-[1.5rem] bg-slate-50 border-slate-200 focus:bg-white"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {showDropdown && query && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg z-50 max-h-[400px] overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No results found for "{query}"
            </div>
          ) : (
            <div className="py-1">
              {results.map((item) => {
                const location = formatLocation(item);
                const statusBadges = getStatusBadges(item);
                
                return (
                  <button
                    key={item.id}
                    onClick={() => handleResultClick(item)}
                    className="w-full px-3 py-2.5 hover:bg-slate-50 flex items-start gap-3 text-left transition-colors"
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.category === 'chemical' ? 'bg-indigo-50' : 'bg-emerald-50'
                    }`}>
                      {item.category === 'chemical' ? (
                        <FlaskConical className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Package className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">{item.name}</span>
                        <Badge variant="outline" className={`text-xs ${
                          item.category === 'chemical' 
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {item.category === 'chemical' ? 'Chemical' : 'Consumable'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-sm text-slate-500">
                        <span>{item.quantity} {item.unit}</span>
                        {location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{location}</span>
                          </span>
                        )}
                      </div>
                      {statusBadges.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {statusBadges.map((badge, idx) => (
                            <Badge key={idx} variant="outline" className={`text-xs ${badge.className}`}>
                              {badge.label === 'Low Stock' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
