import React from 'react';
import { format, isBefore, addDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  FlaskConical, 
  Package, 
  MapPin, 
  Calendar,
  MinusCircle,
  PlusCircle,
  Settings,
  Trash2,
  Pencil,
  FolderOpen,
  Building2,
  Hash,
  FileText,
  Eye,
  Download,
  History,
  Upload,
  FileX
} from 'lucide-react';
import { formatLocation } from './ItemsTable';

export default function ItemDetailDrawer({ 
  item, 
  open, 
  onOpenChange,
  onUse,
  onRestock,
  onAdjust,
  onDispose,
  onEdit,
  onViewMsds,
  onDownloadMsds,
  onShowMsdsHistory,
  onUploadOrReplaceMsds,
  onRemoveMsds,
  canManageMsds = false,
}) {
  if (!item) return null;

  const isActive = item.status === 'active' || !item.status;
  const location = formatLocation(item);
  const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
  const contentUnit = item.content_unit || item.total_content_unit || item.content_label || 'pcs';
  const quantityValue = trackingType === 'SIMPLE_MEASURE'
    ? (item.quantity_value ?? item.quantity ?? 0)
    : (item.total_units ?? item.quantity ?? 0);
  const quantityUnit = trackingType === 'SIMPLE_MEASURE'
    ? (item.quantity_unit || item.unit || '')
    : (item.unit_type || item.unit || '');
  
  const getStatusBadges = () => {
    const badges = [];
    
    if (item.status === 'archived') {
      badges.push({ label: 'Archived', className: 'bg-slate-100 text-slate-600' });
    } else if (item.status === 'disposed') {
      badges.push({ label: 'Disposed', className: 'bg-slate-100 text-slate-600' });
    }
    
    if ((quantityValue ?? 0) <= item.minimum_stock && isActive) {
      badges.push({ label: 'Low Stock', className: 'bg-amber-100 text-amber-700' });
    }
    
    if ((quantityValue ?? 0) === 0 && isActive) {
      badges.push({ label: 'Out of Stock', className: 'bg-red-100 text-red-700' });
    }
    
    if (item.expiration_date && isActive) {
      const expDate = new Date(item.expiration_date);
      if (isBefore(expDate, new Date())) {
        badges.push({ label: 'Expired', className: 'bg-red-100 text-red-700' });
      } else if (isBefore(expDate, addDays(new Date(), 30))) {
        badges.push({ label: 'Expiring Soon', className: 'bg-amber-100 text-amber-700' });
      }
    }
    
    if (badges.length === 0 && isActive) {
      badges.push({ label: 'OK', className: 'bg-emerald-100 text-emerald-700' });
    }
    
    return badges;
  };

  const InfoRow = ({ icon: Icon, label, value, className = '' }) => (
    <div className={`flex items-start gap-3 py-3 border-b border-slate-100 ${className}`}>
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm text-slate-900 mt-0.5">{value || '-'}</p>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto no-scrollbar">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              item.category === 'chemical' ? 'bg-indigo-100' : 'bg-emerald-100'
            }`}>
              {item.category === 'chemical' ? (
                <FlaskConical className="w-6 h-6 text-indigo-600" />
              ) : (
                <Package className="w-6 h-6 text-emerald-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-left text-lg">{item.name}</SheetTitle>
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="capitalize">
                  {item.category}
                </Badge>
                {getStatusBadges().map((badge, idx) => (
                  <Badge key={idx} variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-4">
          {/* Quick Actions */}
          {isActive && (
            <div className="grid grid-cols-2 gap-2 mb-6">
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onUse(item); }}>
                <MinusCircle className="w-4 h-4 mr-2" />
                Use
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onRestock(item); }}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Restock
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onAdjust(item); }}>
                <Settings className="w-4 h-4 mr-2" />
                Adjust
              </Button>
              <Button variant="outline" size="sm" onClick={() => { onOpenChange(false); onEdit(item); }}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            </div>
          )}

          {/* Item Details */}
          <div className="space-y-0">
            <InfoRow 
              icon={Hash} 
              label="Quantity" 
              value={
                <span className={quantityValue <= item.minimum_stock ? 'text-amber-600 font-medium' : ''}>
                  {quantityValue} {quantityUnit}
                  {item.minimum_stock > 0 && (
                    <span className="text-slate-400 text-xs ml-2">(min: {item.minimum_stock})</span>
                  )}
                  {trackingType === 'PACK_WITH_CONTENT' && (
                    <span className="text-slate-500 text-xs block mt-1">
                      {item.total_content ?? 0} {contentUnit} | Sealed: {item.sealed_count ?? 0} / Opened: {item.opened_count ?? 0} / Empty: {item.empty_count ?? 0}
                    </span>
                  )}
                </span>
              }
            />
            
            <InfoRow icon={MapPin} label="Location" value={location !== '-' ? location : null} />
            
            {item.project_fund_source && (
              <InfoRow icon={FolderOpen} label="Project / Fund Source" value={item.project_fund_source} />
            )}
            
            {item.supplier && (
              <InfoRow icon={Building2} label="Supplier" value={item.supplier} />
            )}
            
            {item.expiration_date && (
              <InfoRow 
                icon={Calendar} 
                label="Expiration Date" 
                value={format(new Date(item.expiration_date), 'MMMM d, yyyy')} 
              />
            )}
            
            {item.lot_number && (
              <InfoRow icon={Hash} label="Lot Number" value={item.lot_number} />
            )}
            
            {item.date_received && (
              <InfoRow 
                icon={Calendar} 
                label="Date Received" 
                value={format(new Date(item.date_received), 'MMMM d, yyyy')} 
              />
            )}
            
            {item.description && (
              <InfoRow icon={FileText} label="Description" value={item.description} />
            )}
          </div>

          {item.category === 'chemical' && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-800">MSDS</h3>
                <Badge
                  variant="outline"
                  className={item.msds_current_id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}
                >
                  {item.msds_current_id ? 'Attached' : 'Missing'}
                </Badge>
              </div>

              {item.msds_current_id ? (
                <div className="mt-2 text-xs text-slate-600">
                  <p>Current version: v{item.msds_current?.version || '-'}</p>
                  <p>Supplier: {item.msds_current?.supplier || '-'}</p>
                  <p>Revision: {item.msds_current?.revision_date ? format(new Date(item.msds_current.revision_date), 'MMM d, yyyy') : '-'}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">No MSDS uploaded.</p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewMsds?.(item)}
                  disabled={!item.msds_current_id}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDownloadMsds?.(item)}
                  disabled={!item.msds_current_id}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onShowMsdsHistory?.(item)}
                >
                  <History className="w-4 h-4 mr-2" />
                  History
                </Button>
                {canManageMsds && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUploadOrReplaceMsds?.(item)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {item.msds_current_id ? 'Replace' : 'Upload'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onRemoveMsds?.(item)}
                      disabled={!item.msds_current_id}
                    >
                      <FileX className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Danger Zone */}
          {isActive && (
            <div className="mt-6 pt-4 border-t">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => { onOpenChange(false); onDispose(item); }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Dispose Item
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
