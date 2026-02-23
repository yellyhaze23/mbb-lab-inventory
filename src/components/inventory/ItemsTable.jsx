import React from 'react';
import { format, isBefore, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  ArrowUpDown
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Helper to format structured location
export function formatLocation(item) {
  if (!item.room_area && !item.storage_type) {
    return item.location || '-';
  }
  
  let parts = [];
  
  if (item.room_area) {
    parts.push(item.room_area);
  }
  
  if (item.storage_type) {
    let storagePart = item.storage_type;
    if (item.storage_number) {
      storagePart += ` ${item.storage_number}`;
    }
    parts.push(storagePart);
  }
  
  if (item.position) {
    parts.push(item.position);
  }
  
  return parts.length > 0 ? parts.join(' – ') : '-';
}

// Sortable header component
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

export default function ItemsTable({ 
  items, 
  isLoading, 
  category,
  sortConfig,
  onSort,
  highlightedId,
  onEdit, 
  onArchive,
  onRestore,
  onDelete,
  onUse, 
  onRestock,
  onAdjust,
  onDispose 
}) {
  const defaultSort = { key: 'name', direction: 'asc' };
  const currentSort = sortConfig || defaultSort;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
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
    const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
    const stockValue = trackingType === 'SIMPLE_MEASURE'
      ? (item.quantity_value ?? item.quantity ?? 0)
      : (item.total_units ?? item.quantity ?? 0);
    
    if (item.status === 'archived') {
      statuses.push({ label: 'Archived', variant: 'muted' });
    } else if (item.status === 'disposed') {
      statuses.push({ label: 'Disposed', variant: 'muted' });
    }
    
    if (stockValue <= item.minimum_stock && item.status === 'active') {
      statuses.push({ label: 'Low Stock', variant: 'warning' });
    }
    
    if (item.expiration_date && item.status === 'active') {
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

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
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
            const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
            const stockValue = trackingType === 'SIMPLE_MEASURE'
              ? (item.quantity_value ?? item.quantity ?? 0)
              : (item.total_units ?? item.quantity ?? 0);
            const stockUnit = trackingType === 'SIMPLE_MEASURE'
              ? (item.quantity_unit || item.unit || '')
              : (item.unit_type || item.unit || '');
            
            return (
              <TableRow 
                key={item.id} 
                className={`group hover:bg-slate-50/50 ${!isActive ? 'opacity-60' : ''} ${isHighlighted ? 'bg-indigo-50 animate-pulse' : ''}`}
                id={`item-${item.id}`}
              >
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
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`font-medium ${stockValue <= item.minimum_stock && isActive ? 'text-amber-600' : 'text-slate-900'}`}>
                    {stockValue}
                  </span>
                  <span className="text-slate-500 ml-1">{stockUnit}</span>
                  {item.minimum_stock > 0 && (
                    <span className="text-xs text-slate-400 ml-2">/ min: {item.minimum_stock}</span>
                  )}
                  {trackingType === 'PACK_WITH_CONTENT' && (
                    <div className="text-xs text-slate-500 mt-1">
                      {(item.total_content ?? 0)} {(item.content_label || 'pcs')} | Sealed: {item.sealed_count ?? 0} / Opened: {item.opened_count ?? 0}
                    </div>
                  )}
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
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
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
  );
}
