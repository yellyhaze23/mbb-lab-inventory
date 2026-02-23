import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listItemsByCategory, createItemForCategory, updateItemById, deleteItemById, moveItemLocation } from '@/api/itemsDataClient';
import { Button } from '@/components/ui/button';
import { Plus, Package } from 'lucide-react';
import { toast } from 'sonner';
import ItemForm from '../components/inventory/ItemForm';
import UseItemDialog from '../components/inventory/UseItemDialog';
import RestockDialog from '../components/inventory/RestockDialog';
import AdjustStockDialog from '../components/inventory/AdjustStockDialog';
import DisposeDialog from '../components/inventory/DisposeDialog';
import DeleteConfirmDialog from '../components/inventory/DeleteConfirmDialog';
import ItemsTableWithSelection from '../components/inventory/ItemsTableWithSelection';
import ItemDetailDrawer from '../components/inventory/ItemDetailDrawer';
import BulkActionBar from '../components/inventory/BulkActionBar';
import QuickFilterTabs from '../components/inventory/QuickFilterTabs';
import InventoryFilters from '../components/inventory/InventoryFilters';
import { formatLocation } from '../components/inventory/ItemsTable';
import { safeUseItem, restockItem, adjustItemStock, archiveItem, restoreItem, disposeItem } from '../components/inventory/inventoryHelpers';
import useDebounce from '@/hooks/useDebounce';

export default function Consumables() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [statusFilter, setStatusFilter] = useState('active');
  const [roomFilter, setRoomFilter] = useState('all');
  const [storageFilter, setStorageFilter] = useState('all');
  const [expirationFilter, setExpirationFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [quickFilter, setQuickFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showUseDialog, setShowUseDialog] = useState(false);
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [showDisposeDialog, setShowDisposeDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDrawer, setShowDetailDrawer] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [highlightedId, setHighlightedId] = useState(null);
  const isFirstLoadRef = useRef(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const highlight = urlParams.get('highlight');
    const search = urlParams.get('search');
    
    if (search) {
      setSearchQuery(search);
    }
    if (highlight) {
      setHighlightedId(highlight);
      setTimeout(() => setHighlightedId(null), 3000);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };

  const getPrimaryUnitLabel = (item) => {
    const trackingType = item?.tracking_type || 'SIMPLE_MEASURE';
    if (trackingType === 'SIMPLE_MEASURE') return item?.quantity_unit || item?.unit;
    return item?.unit_type || item?.unit;
  };

  const loadData = useCallback(async ({ showInitialLoading = false } = {}) => {
    if (showInitialLoading) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    try {
      const [itemsData, authResult] = await Promise.all([
        listItemsByCategory('consumable', { search: debouncedSearch, limit: 1000 }),
        supabase.auth.getUser(),
      ]);
      setItems(itemsData);
      
      const currentUser = authResult?.data?.user;
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url, is_active')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profile) {
          setUserProfile(profile);
        } else {
          setUserProfile({
            id: currentUser.id,
            full_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'User',
            role: 'admin',
            avatar_url: null,
            is_active: true,
          });
        }
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error loading consumables:', error);
      toast.error('Failed to load consumables');
    } finally {
      if (showInitialLoading) {
        setIsLoading(false);
      }
      setIsFetching(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const showInitialLoading = isFirstLoadRef.current;
    loadData({ showInitialLoading });
    isFirstLoadRef.current = false;
  }, [loadData]);

  const quickFilterCounts = useMemo(() => {
    return {
      all: items.length,
      low_stock: items.filter(i => i.quantity <= i.minimum_stock && (i.status === 'active' || !i.status)).length,
      expired: 0,
      expiring_30: 0,
      zero_stock: items.filter(i => i.quantity === 0 && (i.status === 'active' || !i.status)).length,
      disposed: items.filter(i => i.status === 'disposed').length,
    };
  }, [items]);

  const handleQuickFilterChange = (filterId) => {
    setQuickFilter(filterId);
    setStatusFilter(filterId === 'disposed' ? 'disposed' : 'active');
    setStockFilter(filterId === 'low_stock' ? 'low' : filterId === 'zero_stock' ? 'zero' : 'all');
    if (filterId === 'all') {
      setStatusFilter('active');
      setStockFilter('all');
    }
  };

  const filteredAndSortedItems = useMemo(() => {
    let result = items.filter(item => {
      const searchLower = debouncedSearch.toLowerCase();
      const locationStr = formatLocation(item).toLowerCase();
      const matchesSearch = !debouncedSearch || 
        item.name.toLowerCase().includes(searchLower) ||
        locationStr.includes(searchLower) ||
        item.project_fund_source?.toLowerCase().includes(searchLower) ||
        item.supplier?.toLowerCase().includes(searchLower);
      
      const itemStatus = item.status || 'active';
      const matchesStatus = statusFilter === 'all' || itemStatus === statusFilter;
      const matchesRoom = roomFilter === 'all' || (
        roomFilter === 'Isozyme Ref'
          ? item.room_area === 'Isozyme Ref' || item.room_area === 'Isozyme Ref/Freezer'
          : item.room_area === roomFilter
      );
      const matchesStorage = storageFilter === 'all' || item.storage_type === storageFilter;
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = item.quantity <= item.minimum_stock;
      } else if (stockFilter === 'zero') {
        matchesStock = item.quantity === 0;
      }
      
      return matchesSearch && matchesStatus && matchesRoom && matchesStorage && matchesStock;
    });

    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'quantity':
          aVal = a.quantity;
          bVal = b.quantity;
          break;
        case 'location':
          aVal = formatLocation(a).toLowerCase();
          bVal = formatLocation(b).toLowerCase();
          break;
        case 'project_fund_source':
          aVal = (a.project_fund_source || '').toLowerCase();
          bVal = (b.project_fund_source || '').toLowerCase();
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [items, debouncedSearch, statusFilter, roomFilter, storageFilter, stockFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('active');
    setRoomFilter('all');
    setStorageFilter('all');
    setExpirationFilter('all');
    setStockFilter('all');
    setQuickFilter('all');
    setSortConfig({ key: 'name', direction: 'asc' });
  };

  const handleSave = async (formData) => {
    try {
      if (selectedItem) {
        await updateItemById(selectedItem.id, formData);
        toast.success('Consumable updated successfully');
      } else {
        await createItemForCategory('consumable', formData);
        toast.success('Consumable added successfully');
      }
      loadData();
      setSelectedItem(null);
    } catch (error) {
      toast.error('Failed to save consumable');
      throw error;
    }
  };

  const handleUse = async (item, payload) => {
    try {
      await safeUseItem({
        itemId: item.id,
        mode: payload.mode,
        amount: payload.amount,
        userProfile,
        notes: payload.notes,
        source: 'manual',
      });
      const trackingType = item?.tracking_type || 'SIMPLE_MEASURE';
      const deductLabel = trackingType === 'PACK_WITH_CONTENT' && payload.mode === 'CONTENT'
        ? item.content_label || 'pcs'
        : getPrimaryUnitLabel(item);
      toast.success(`Recorded usage of ${payload.amount} ${deductLabel} of ${item.name}`);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to record usage');
      throw error;
    }
  };

  const handleRestock = async (item, quantity, notes) => {
    try {
      await restockItem({ itemId: item.id, quantityToAdd: quantity, userProfile, notes, source: 'manual' });
      toast.success(`Added ${quantity} ${getPrimaryUnitLabel(item)} to ${item.name}`);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to restock');
      throw error;
    }
  };

  const handleAdjust = async (item, newQuantity, notes) => {
    try {
      await adjustItemStock({ itemId: item.id, newQuantity, userProfile, notes, source: 'manual' });
      toast.success(`Adjusted ${item.name} stock to ${newQuantity} ${getPrimaryUnitLabel(item)}`);
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to adjust stock');
      throw error;
    }
  };

  const handleArchive = async (item) => {
    try {
      await archiveItem(item.id);
      toast.success('Consumable archived');
      loadData();
    } catch (error) {
      toast.error('Failed to archive consumable');
    }
  };

  const handleDispose = async (item, reason, notes) => {
    try {
      await disposeItem({ itemId: item.id, userProfile, reason, notes });
      toast.success('Consumable disposed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to dispose consumable');
      throw error;
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreItem(item.id);
      toast.success('Consumable restored');
      loadData();
    } catch (error) {
      toast.error('Failed to restore consumable');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteItemById(item.id);
      toast.success('Consumable deleted permanently');
      loadData();
    } catch (error) {
      toast.error('Failed to delete consumable');
      throw error;
    }
  };

  const handleBulkArchive = async (selectedItems) => {
    for (const item of selectedItems) {
      await archiveItem(item.id);
    }
    toast.success(`Archived ${selectedItems.length} items`);
    loadData();
  };

  const handleBulkDispose = async (selectedItems, reason, notes) => {
    for (const item of selectedItems) {
      await disposeItem({ itemId: item.id, userProfile, reason, notes });
    }
    toast.success(`Disposed ${selectedItems.length} items`);
    loadData();
  };

  const handleBulkMoveLocation = async (selectedItems, location) => {
    for (const item of selectedItems) {
      await moveItemLocation(item, location);
    }
    toast.success(`Moved ${selectedItems.length} items`);
    loadData();
  };

  const handleExportCSV = (selectedItems) => {
    const headers = ['Name', 'Quantity', 'Unit', 'Location', 'Status', 'Supplier', 'Project'];
    const rows = selectedItems.map(item => [
      item.name,
      item.quantity,
      item.unit,
      formatLocation(item),
      item.status || 'active',
      item.supplier || '',
      item.project_fund_source || ''
    ]);
    
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consumables_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailDrawer(true);
  };

  const activeCount = items.filter(i => i.status === 'active' || !i.status).length;
  const selectedItemObjects = filteredAndSortedItems.filter(i => selectedIds.includes(i.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Package className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Consumables</h1>
            <p className="text-slate-500">{activeCount} active items</p>
          </div>
        </div>
        <Button
          onClick={() => { setSelectedItem(null); setShowForm(true); }}
          className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Consumable
        </Button>
      </div>

      {selectedIds.length > 0 && (
        <BulkActionBar
          selectedItems={selectedItemObjects}
          onClearSelection={() => setSelectedIds([])}
          onBulkArchive={handleBulkArchive}
          onBulkDispose={handleBulkDispose}
          onBulkMoveLocation={handleBulkMoveLocation}
          onExportCSV={handleExportCSV}
        />
      )}

      <QuickFilterTabs
        activeFilter={quickFilter}
        onFilterChange={handleQuickFilterChange}
        counts={quickFilterCounts}
      />

      <div className="sticky top-0 z-10 bg-slate-50 -mx-4 px-4 py-3 lg:-mx-8 lg:px-8 border-b border-slate-200">
        <InventoryFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          roomFilter={roomFilter}
          onRoomChange={setRoomFilter}
          storageFilter={storageFilter}
          onStorageChange={setStorageFilter}
          expirationFilter={expirationFilter}
          onExpirationChange={setExpirationFilter}
          stockFilter={stockFilter}
          onStockChange={setStockFilter}
          onClearFilters={clearFilters}
          showExpiration={false}
          placeholder="Search by name, location, supplier..."
        />
      </div>

      <ItemsTableWithSelection
        items={filteredAndSortedItems}
        isLoading={isLoading}
        isFetching={isFetching}
        category="consumable"
        sortConfig={sortConfig}
        onSort={handleSort}
        highlightedId={highlightedId}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={handleRowClick}
        onEdit={(item) => { setSelectedItem(item); setShowForm(true); }}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={(item) => { setSelectedItem(item); setShowDeleteDialog(true); }}
        onUse={(item) => { setSelectedItem(item); setShowUseDialog(true); }}
        onRestock={(item) => { setSelectedItem(item); setShowRestockDialog(true); }}
        onAdjust={(item) => { setSelectedItem(item); setShowAdjustDialog(true); }}
        onDispose={(item) => { setSelectedItem(item); setShowDisposeDialog(true); }}
      />

      <ItemDetailDrawer
        item={selectedItem}
        open={showDetailDrawer}
        onOpenChange={setShowDetailDrawer}
        onUse={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowUseDialog(true); }}
        onRestock={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowRestockDialog(true); }}
        onAdjust={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowAdjustDialog(true); }}
        onDispose={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowDisposeDialog(true); }}
        onEdit={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowForm(true); }}
      />

      <ItemForm
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        category="consumable"
        onSave={handleSave}
      />

      <UseItemDialog
        open={showUseDialog}
        onOpenChange={(open) => { setShowUseDialog(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        onUse={handleUse}
      />

      <RestockDialog
        open={showRestockDialog}
        onOpenChange={(open) => { setShowRestockDialog(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        onRestock={handleRestock}
      />

      <AdjustStockDialog
        open={showAdjustDialog}
        onOpenChange={(open) => { setShowAdjustDialog(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        onAdjust={handleAdjust}
      />

      <DisposeDialog
        open={showDisposeDialog}
        onOpenChange={(open) => { setShowDisposeDialog(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        onDispose={handleDispose}
      />

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={(open) => { setShowDeleteDialog(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        onConfirm={handleDelete}
      />
    </div>
  );
}





