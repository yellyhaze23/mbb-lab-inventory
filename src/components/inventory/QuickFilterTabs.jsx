import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutList, 
  AlertTriangle, 
  Clock, 
  Calendar, 
  Package, 
  Trash2 
} from 'lucide-react';

const QUICK_FILTERS = [
  { id: 'all', label: 'All Items', icon: LayoutList },
  { id: 'low_stock', label: 'Low Stock', icon: AlertTriangle, color: 'amber' },
  { id: 'expired', label: 'Expired', icon: Clock, color: 'red' },
  { id: 'expiring_30', label: 'Expiring 30d', icon: Calendar, color: 'orange' },
  { id: 'zero_stock', label: 'Zero Stock', icon: Package, color: 'slate' },
  { id: 'disposed', label: 'Disposed', icon: Trash2, color: 'slate' },
];

export default function QuickFilterTabs({ activeFilter, onFilterChange, counts = {} }) {
  return (
    <div className="flex flex-wrap gap-2">
      {QUICK_FILTERS.map(filter => {
        const isActive = activeFilter === filter.id;
        const count = counts[filter.id] || 0;
        const Icon = filter.icon;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
              transition-all duration-300 ease-out border transform-gpu
              ${isActive 
                ? 'bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] scale-[1.02]' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-[1px]'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            {filter.label}
            {count > 0 && filter.id !== 'all' && (
              <Badge 
                variant="secondary" 
                className={`ml-1 h-5 px-1.5 text-xs ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
