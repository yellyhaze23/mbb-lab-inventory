import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, X, SlidersHorizontal } from 'lucide-react';

const ROOM_AREA_OPTIONS = [
  { value: 'all', label: 'All Rooms' },
  { value: 'MBB Lab', label: 'MBB Lab' },
  { value: 'RT-PCR Room', label: 'RT-PCR Room' },
  { value: 'PCR Room', label: 'PCR Room' },
  { value: 'Isozyme Ref', label: 'Isozyme ref' },
];

const STORAGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'Shelf', label: 'Shelf' },
  { value: 'Cabinet', label: 'Cabinet' },
  { value: 'Bench', label: 'Bench' },
  { value: 'Table', label: 'Table' },
  { value: 'Freezer', label: 'Freezer' },
  { value: 'Fridge', label: 'Fridge' },
];

const EXPIRATION_OPTIONS = [
  { value: 'all', label: 'All Expiration' },
  { value: 'expired', label: 'Expired' },
  { value: '30days', label: 'Expiring in 30 days' },
  { value: '90days', label: 'Expiring in 90 days' },
  { value: 'none', label: 'No Expiration Date' },
];

const STOCK_OPTIONS = [
  { value: 'all', label: 'All Stock' },
  { value: 'low', label: 'Low Stock Only' },
  { value: 'zero', label: 'Zero Stock Only' },
];

export default function InventoryFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  roomFilter,
  onRoomChange,
  storageFilter,
  onStorageChange,
  expirationFilter,
  onExpirationChange,
  stockFilter,
  onStockChange,
  onClearFilters,
  showExpiration = true,
  placeholder = "Search by name or location..."
}) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const hasActiveFilters = 
    searchQuery || 
    statusFilter !== 'active' || 
    roomFilter !== 'all' || 
    storageFilter !== 'all' || 
    (showExpiration && expirationFilter !== 'all') || 
    stockFilter !== 'all';

  const activeFilterCount = [
    statusFilter !== 'active',
    roomFilter !== 'all',
    storageFilter !== 'all',
    showExpiration && expirationFilter !== 'all',
    stockFilter !== 'all',
  ].filter(Boolean).length;

  const FilterSelects = () => (
    <>
      <Select value={statusFilter} onValueChange={onStatusChange}>
        <SelectTrigger className="w-full sm:w-[130px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="archived">Archived</SelectItem>
          <SelectItem value="disposed">Disposed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={roomFilter} onValueChange={onRoomChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Room" />
        </SelectTrigger>
        <SelectContent>
          {ROOM_AREA_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={storageFilter} onValueChange={onStorageChange}>
        <SelectTrigger className="w-full sm:w-[130px]">
          <SelectValue placeholder="Storage" />
        </SelectTrigger>
        <SelectContent>
          {STORAGE_TYPE_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showExpiration && (
        <Select value={expirationFilter} onValueChange={onExpirationChange}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Expiration" />
          </SelectTrigger>
          <SelectContent>
            {EXPIRATION_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={stockFilter} onValueChange={onStockChange}>
        <SelectTrigger className="w-full sm:w-[140px]">
          <SelectValue placeholder="Stock" />
        </SelectTrigger>
        <SelectContent>
          {STOCK_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <div className="space-y-3">
      {/* Search + Mobile Filter Button Row */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Mobile Filters Button */}
        <div className="sm:hidden">
          <Popover open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4" align="end">
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Filters</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-7 text-xs">
                      Clear All
                    </Button>
                  )}
                </div>
                <FilterSelects />
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Desktop Filters */}
        <div className="hidden sm:flex sm:flex-wrap gap-2">
          <FilterSelects />
        </div>
      </div>

      {/* Clear Filters Button (Desktop) */}
      {hasActiveFilters && (
        <div className="hidden sm:flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClearFilters}
            className="h-7 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>
          {activeFilterCount > 0 && (
            <span className="text-xs text-slate-400">
              {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active
            </span>
          )}
        </div>
      )}
    </div>
  );
}
