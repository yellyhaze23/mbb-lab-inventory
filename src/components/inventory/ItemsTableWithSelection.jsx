import React from 'react';
import { format, isBefore, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreHorizontal, 
  Pencil, 
  Archive, 
  MinusCircle,
  PlusCircle,
  Settings,
  AlertTriangle,
  Calendar,
  MapPin,
  FlaskConical,
  Package,
  RotateCcw,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Eye
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatLocation } from './ItemsTable';

function SortableHeader({ label, sortKey, currentSort, onSort }) {
  const isActive = currentSort.key === sortKey;
  const isAsc = currentSort.direction === 'asc';
  
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 font-semibold hover:text-slate-900 transition-colors"
    >
      {label}
      {isActive ? (
        isAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );
}

export default function ItemsTableWithSelection({ 
  items, 
  isLoading, 
  isFetching = false,
  category,
  sortConfig,
  onSort,
  highlightedId,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onEdit, 
  onArchive,
  onRestore,
  onDelete,
  onUse, 
  onRestock,
  onAdjust,
  onDispose,
  onViewMsds,
}) {
  const defaultSort = { key: 'name', direction: 'asc' };
  const currentSort = sortConfig || defaultSort;

  const allSelected = items.length > 0 && selectedIds.length === items.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < items.length;

  const handleSelectAll = (checked) => {
    if (checked) {
      onSelectionChange(items.map(i => i.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (itemId, checked) => {
    if (checked) {
      onSelectionChange([...selectedIds, itemId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== itemId));
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[50px]"><Checkbox disabled /></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Location</TableHead>
              {category === 'chemical' && <TableHead>Expiration</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4, 5].map(i => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                {category === 'chemical' && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
        {category === 'chemical' ? (
          <FlaskConical className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        ) : (
          <Package className="w-16 h-16 mx-auto text-slate-300 mb-4" />
        )}
        <h3 className="text-lg font-medium text-slate-900">No items found</h3>
        <p className="text-slate-500 mt-1">Add your first {category} or adjust filters</p>
      </div>
    );
  }

  const getStatus = (item) => {
    const statuses = [];
    const isActive = item.status === 'active' || !item.status;
    
    if (item.status === 'archived') {
      statuses.push({ label: 'Archived', variant: 'muted' });
    } else if (item.status === 'disposed') {
      statuses.push({ label: 'Disposed', variant: 'muted' });
    }
    
    if ((item.quantity ?? 0) <= item.minimum_stock && isActive) {
      statuses.push({ label: 'Low Stock', variant: 'warning' });
    }
    
    if (item.expiration_date && isActive) {
      const expDate = new Date(item.expiration_date);
      if (isBefore(expDate, new Date())) {
        statuses.push({ label: 'Expired', variant: 'destructive' });
      } else if (isBefore(expDate, addDays(new Date(), 30))) {
        statuses.push({ label: 'Expiring Soon', variant: 'warning' });
      }
    }
    
    return statuses;
  };

  const getStatusBadgeClass = (variant) => {
    switch (variant) {
      case 'destructive':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'muted':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  const getQuantityDisplay = (item) => {
    const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
    if (trackingType === 'SIMPLE_MEASURE') {
      return {
        value: item.quantity_value ?? item.quantity ?? 0,
        unit: item.quantity_unit || item.unit || '',
        min: item.minimum_stock,
        opened: Boolean(item.opened_date),
      };
    }
    if (trackingType === 'UNIT_ONLY') {
      return {
        value: item.total_units ?? item.quantity ?? 0,
        unit: item.unit_type || item.unit || 'unit',
        min: item.minimum_stock,
        opened: Boolean(item.opened_date),
      };
    }
    return {
      value: item.total_units ?? item.quantity ?? 0,
      unit: item.unit_type || item.unit || 'pack',
      min: item.minimum_stock,
      content: item.total_content ?? 0,
      contentLabel: item.content_label || 'pcs',
      sealed: item.sealed_count ?? 0,
      opened: item.opened_count ?? 0,
    };
  };

  return (
    <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
      <div className="overflow-x-auto no-scrollbar">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox 
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all"
                  className={someSelected ? 'data-[state=checked]:bg-indigo-600' : ''}
                />
              </TableHead>
              <TableHead>
                {onSort ? (
                  <SortableHeader label="Name" sortKey="name" currentSort={currentSort} onSort={onSort} />
                ) : (
                  <span className="font-semibold">Name</span>
                )}
              </TableHead>
              <TableHead>
                {onSort ? (
                  <SortableHeader label="Quantity" sortKey="quantity" currentSort={currentSort} onSort={onSort} />
                ) : (
                  <span className="font-semibold">Quantity</span>
                )}
              </TableHead>
              <TableHead>
                {onSort ? (
                  <SortableHeader label="Location" sortKey="location" currentSort={currentSort} onSort={onSort} />
                ) : (
                  <span className="font-semibold">Location</span>
                )}
              </TableHead>
              {category === 'chemical' && (
                <TableHead>
                  {onSort ? (
                    <SortableHeader label="Expiration" sortKey="expiration_date" currentSort={currentSort} onSort={onSort} />
                  ) : (
                    <span className="font-semibold">Expiration</span>
                  )}
                </TableHead>
              )}
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const statuses = getStatus(item);
              const isActive = item.status === 'active' || !item.status;
              const locationDisplay = formatLocation(item);
              const isHighlighted = highlightedId === item.id;
              const isSelected = selectedIds.includes(item.id);
              
              return (
                <TableRow 
                  key={item.id} 
                  className={`
                      group cursor-pointer transition-colors duration-150
                      ${!isActive ? 'opacity-60' : 'hover:bg-slate-50'} 
                      ${isHighlighted ? 'bg-blue-50 animate-pulse' : ''} 
                      ${isSelected ? 'bg-blue-50/60' : ''}
                    `}
                  id={`item-${item.id}`}
                  onClick={(e) => {
                    // Don't trigger row click if clicking checkbox or dropdown
                    if (e.target.closest('[role="checkbox"]') || e.target.closest('[data-radix-collection-item]')) return;
                    onRowClick?.(item);
                  }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox 
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(item.id, checked)}
                      aria-label={`Select ${item.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${category === 'chemical' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
                        {category === 'chemical' ? (
                          <FlaskConical className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Package className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.lot_number && (
                          <p className="text-xs text-slate-500">Lot: {item.lot_number}</p>
                        )}
                        {item.project_fund_source && (
                          <p className="text-xs text-slate-400">{item.project_fund_source}</p>
                        )}
                        {category === 'chemical' && (
                          <div className="mt-1">
                            <Badge
                              variant="outline"
                              className={item.msds_current_id ? 'bg-blue-50 text-blue-700 border-blue-200 text-[10px]' : 'bg-slate-100 text-slate-500 border-slate-200 text-[10px]'}
                            >
                              {item.msds_current_id ? `MSDS v${item.msds_current?.version || '-'}` : 'No MSDS'}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const quantity = getQuantityDisplay(item);
                      const isLow = (quantity.value ?? 0) <= (quantity.min ?? 0) && isActive;
                      return (
                        <>
                          <span className={`font-medium ${isLow ? 'text-amber-600' : 'text-slate-900'}`}>
                            {quantity.value}
                          </span>
                          <span className="text-slate-500 ml-1">{quantity.unit}</span>
                          {typeof quantity.min === 'number' && quantity.min > 0 && (
                            <span className="text-xs text-slate-400 ml-2">/ min: {quantity.min}</span>
                          )}
                          {item.tracking_type === 'PACK_WITH_CONTENT' && (
                            <>
                              <div className="text-xs text-slate-500 mt-1">
                                {quantity.content} {quantity.contentLabel}
                              </div>
                              <div className="text-xs text-slate-500">
                                Sealed: {quantity.sealed} / Opened: {quantity.opened}
                              </div>
                            </>
                          )}
                          {item.tracking_type !== 'PACK_WITH_CONTENT' && (
                            <div className="text-xs text-slate-500 mt-1">
                              {quantity.opened ? 'Opened' : 'Sealed'}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {locationDisplay !== '-' ? (
                      <div className="flex items-start gap-1 text-slate-600">
                        <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="text-sm leading-tight">{locationDisplay}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  {category === 'chemical' && (
                    <TableCell>
                      {item.expiration_date ? (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(item.expiration_date), 'MMM d, yyyy')}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {statuses.length === 0 ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          OK
                        </Badge>
                      ) : (
                        statuses.map((status, idx) => (
                          <Badge 
                            key={idx}
                            variant="outline" 
                            className={getStatusBadgeClass(status.variant)}
                          >
                            {status.variant === 'warning' && <AlertTriangle className="w-3 h-3 mr-1" />}
                            {status.label}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {category === 'chemical' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => onViewMsds?.(item)}
                              disabled={!item.msds_current_id}
                              aria-label={`View MSDS for ${item.name}`}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View MSDS
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {isActive && (
                          <>
                            <DropdownMenuItem onClick={() => onUse(item)}>
                              <MinusCircle className="w-4 h-4 mr-2" />
                              Use / Deduct
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRestock(item)}>
                              <PlusCircle className="w-4 h-4 mr-2" />
                              Restock
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onAdjust(item)}>
                              <Settings className="w-4 h-4 mr-2" />
                              Adjust Stock
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {isActive ? (
                          <>
                            <DropdownMenuItem 
                              onClick={() => onArchive(item)}
                              className="text-amber-600 focus:text-amber-600"
                            >
                              <Archive className="w-4 h-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDispose(item)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Dispose
                            </DropdownMenuItem>
                          </>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => onRestore(item)}>
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Restore
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => onDelete(item)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {isFetching && !isLoading && (
        <div className="border-t border-slate-200 bg-slate-50 p-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      )}
    </div>
  );
}
