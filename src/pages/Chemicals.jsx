import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { listItemsByCategory, createItemForCategory, updateItemById, deleteItemById, moveItemLocation } from '@/api/itemsDataClient';
import { Button } from '@/components/ui/button';
import { Plus, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { isBefore, addDays } from 'date-fns';
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
import MsdsViewerModal from '../components/inventory/MsdsViewerModal';
import MsdsHistoryModal from '../components/inventory/MsdsHistoryModal';
import MsdsUploadDialog from '../components/inventory/MsdsUploadDialog';
import { formatLocation } from '../components/inventory/ItemsTable';
import { safeUseItem, restockItem, adjustItemStock, archiveItem, restoreItem, disposeItem } from '../components/inventory/inventoryHelpers';
import useDebounce from '@/hooks/useDebounce';
import TablePagination from '@/components/ui/table-pagination';
import {
  archiveMsdsVersion,
  getSignedMsdsUrl,
  isAdminProfile,
  listMsdsHistory,
  removeCurrentMsds,
  setCurrentMsds,
  uploadMsdsVersion,
} from '@/api/msdsService';

export default function Chemicals() {
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
  const [showMsdsViewer, setShowMsdsViewer] = useState(false);
  const [showMsdsHistory, setShowMsdsHistory] = useState(false);
  const [showMsdsUpload, setShowMsdsUpload] = useState(false);
  const [viewerSignedUrl, setViewerSignedUrl] = useState(null);
  const [msdsContextItem, setMsdsContextItem] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
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
        listItemsByCategory('chemical', { search: debouncedSearch, limit: 1000 }),
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
      console.error('Error loading chemicals:', error);
      toast.error('Failed to load chemicals');
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

  // Quick filter counts
  const quickFilterCounts = useMemo(() => {
    const today = new Date();
    return {
      all: items.length,
      low_stock: items.filter(i => i.quantity <= i.minimum_stock && (i.status === 'active' || !i.status)).length,
      expired: items.filter(i => i.expiration_date && isBefore(new Date(i.expiration_date), today) && (i.status === 'active' || !i.status)).length,
      expiring_30: items.filter(i => i.expiration_date && !isBefore(new Date(i.expiration_date), today) && isBefore(new Date(i.expiration_date), addDays(today, 30)) && (i.status === 'active' || !i.status)).length,
      zero_stock: items.filter(i => i.quantity === 0 && (i.status === 'active' || !i.status)).length,
      disposed: items.filter(i => i.status === 'disposed').length,
    };
  }, [items]);

  const handleQuickFilterChange = (filterId) => {
    setQuickFilter(filterId);
    // Reset other filters when quick filter changes
    setStatusFilter(filterId === 'disposed' ? 'disposed' : 'active');
    setExpirationFilter(filterId === 'expired' ? 'expired' : filterId === 'expiring_30' ? '30days' : 'all');
    setStockFilter(filterId === 'low_stock' ? 'low' : filterId === 'zero_stock' ? 'zero' : 'all');
    if (filterId === 'all') {
      setStatusFilter('active');
      setExpirationFilter('all');
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
        item.lot_number?.toLowerCase().includes(searchLower) ||
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
      
      let matchesExpiration = true;
      if (expirationFilter !== 'all') {
        const today = new Date();
        if (expirationFilter === 'expired') {
          matchesExpiration = item.expiration_date && isBefore(new Date(item.expiration_date), today);
        } else if (expirationFilter === '30days') {
          matchesExpiration = item.expiration_date && 
            !isBefore(new Date(item.expiration_date), today) && 
            isBefore(new Date(item.expiration_date), addDays(today, 30));
        } else if (expirationFilter === '90days') {
          matchesExpiration = item.expiration_date && 
            !isBefore(new Date(item.expiration_date), today) && 
            isBefore(new Date(item.expiration_date), addDays(today, 90));
        } else if (expirationFilter === 'none') {
          matchesExpiration = !item.expiration_date;
        }
      }
      
      let matchesStock = true;
      if (stockFilter === 'low') {
        matchesStock = item.quantity <= item.minimum_stock;
      } else if (stockFilter === 'zero') {
        matchesStock = item.quantity === 0;
      }
      
      return matchesSearch && matchesStatus && matchesRoom && matchesStorage && matchesExpiration && matchesStock;
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
        case 'expiration_date':
          aVal = a.expiration_date ? new Date(a.expiration_date).getTime() : Infinity;
          bVal = b.expiration_date ? new Date(b.expiration_date).getTime() : Infinity;
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
  }, [items, debouncedSearch, statusFilter, roomFilter, storageFilter, expirationFilter, stockFilter, sortConfig]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedItems.slice(start, start + pageSize);
  }, [filteredAndSortedItems, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, roomFilter, storageFilter, expirationFilter, stockFilter, quickFilter, pageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / pageSize));
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredAndSortedItems.length, currentPage, pageSize]);

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
    setCurrentPage(1);
  };

  // CRUD Handlers
  const handleSave = async (formData) => {
    const { msds_upload, ...itemPayload } = formData;

    try {
      if (selectedItem) {
        await updateItemById(selectedItem.id, itemPayload);
        toast.success('Chemical updated successfully');
      } else {
        const created = await createItemForCategory('chemical', itemPayload);
        if (msds_upload?.file && created?.id) {
          await uploadMsdsVersion({
            chemicalId: created.id,
            file: msds_upload.file,
            title: msds_upload.title || undefined,
            supplier: msds_upload.supplier || undefined,
            revisionDate: msds_upload.revision_date || undefined,
            action: 'UPLOAD',
          });
          toast.success('Chemical and MSDS added successfully');
        } else {
          toast.success('Chemical added successfully');
        }
      }
      loadData();
      setSelectedItem(null);
    } catch (error) {
      console.error('Error saving chemical:', error);
      toast.error('Failed to save chemical');
      throw error;
    }
  };

  const handleUse = async (item, payload) => {
    try {
      await safeUseItem({
        itemId: item.id,
        mode: payload.mode,
        amount: payload.amount,
        trackingType: item?.tracking_type || 'SIMPLE_MEASURE',
        wasOpened: Boolean(item?.opened_date),
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
      toast.success('Chemical archived');
      loadData();
    } catch (error) {
      toast.error('Failed to archive chemical');
    }
  };

  const handleDispose = async (item, reason, notes) => {
    try {
      await disposeItem({ itemId: item.id, userProfile, reason, notes });
      toast.success('Chemical disposed');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to dispose chemical');
      throw error;
    }
  };

  const handleRestore = async (item) => {
    try {
      await restoreItem(item.id);
      toast.success('Chemical restored');
      loadData();
    } catch (error) {
      toast.error('Failed to restore chemical');
    }
  };

  const handleDelete = async (item) => {
    try {
      await deleteItemById(item.id);
      toast.success('Chemical deleted permanently');
      loadData();
    } catch (error) {
      toast.error('Failed to delete chemical');
      throw error;
    }
  };

  // Bulk actions
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
    const headers = ['Name', 'Quantity', 'Unit', 'Location', 'Expiration', 'Status', 'Supplier', 'Project'];
    const rows = selectedItems.map(item => [
      item.name,
      item.quantity,
      item.unit,
      formatLocation(item),
      item.expiration_date || '',
      item.status || 'active',
      item.supplier || '',
      item.project_fund_source || ''
    ]);
    
    const csvContent = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chemicals_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailDrawer(true);
  };

  const canManageMsds = isAdminProfile(userProfile);

  const handleViewMsds = async (target) => {
    const msdsId = target?.msds_current_id || target?.id;
    if (!msdsId) {
      toast.error('No MSDS available');
      return;
    }

    try {
      const signedUrl = await getSignedMsdsUrl(msdsId, 'view');
      setViewerSignedUrl(signedUrl);
      if (target?.name) setMsdsContextItem(target);
      setShowMsdsViewer(true);
    } catch (error) {
      toast.error(error.message || 'Unable to open MSDS');
    }
  };

  const handleDownloadMsds = async (target) => {
    const msdsId = target?.msds_current_id || target?.id;
    if (!msdsId) {
      toast.error('No MSDS available');
      return;
    }
    try {
      const signedUrl = await getSignedMsdsUrl(msdsId, 'download');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error.message || 'Unable to download MSDS');
    }
  };

  const handleOpenHistory = (item) => {
    setMsdsContextItem(item);
    setShowMsdsHistory(true);
  };

  const handleOpenUpload = (item) => {
    setMsdsContextItem(item);
    setShowMsdsUpload(true);
  };

  const handleRemoveMsds = async (item) => {
    if (!canManageMsds) return;
    const shouldDetach = window.confirm(`Remove current MSDS from ${item.name}?`);
    if (!shouldDetach) return;
    const archiveCurrent = window.confirm('Archive the current MSDS version as inactive as well?');

    try {
      await removeCurrentMsds(item.id, { archiveCurrent });
      toast.success('MSDS detached from chemical');
      loadData();
    } catch (error) {
      toast.error(error.message || 'Failed to remove MSDS');
    }
  };

  const handleUploadOrReplaceMsds = async (payload) => {
    if (!msdsContextItem) return;
    await uploadMsdsVersion({
      chemicalId: msdsContextItem.id,
      file: payload.file,
      title: payload.title,
      supplier: payload.supplier,
      revisionDate: payload.revisionDate,
      action: msdsContextItem.msds_current_id ? 'REPLACE' : 'UPLOAD',
    });
    toast.success(msdsContextItem.msds_current_id ? 'MSDS replaced successfully' : 'MSDS uploaded successfully');
    await loadData();
  };

  const loadCurrentHistory = useCallback(async () => {
    if (!msdsContextItem?.id) return [];
    return listMsdsHistory(msdsContextItem.id);
  }, [msdsContextItem]);

  const activeCount = items.filter(i => i.status === 'active' || !i.status).length;
  const selectedItemObjects = filteredAndSortedItems.filter(i => selectedIds.includes(i.id));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <FlaskConical className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Chemicals</h1>
            <p className="text-slate-500">{activeCount} active items</p>
          </div>
        </div>
        <Button
          onClick={() => { setSelectedItem(null); setShowForm(true); }}
          className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Chemical
        </Button>
      </div>

      {/* Bulk Action Bar */}
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

      {/* Quick Filter Tabs */}
      <QuickFilterTabs
        activeFilter={quickFilter}
        onFilterChange={handleQuickFilterChange}
        counts={quickFilterCounts}
      />

      {/* Filters */}
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
          showExpiration={true}
          placeholder="Search by name, location, lot, supplier..."
        />
      </div>

      {/* Table */}
      <ItemsTableWithSelection
        items={paginatedItems}
        isLoading={isLoading}
        isFetching={isFetching}
        category="chemical"
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
        onViewMsds={handleViewMsds}
        onDownloadMsds={handleDownloadMsds}
        onShowMsdsHistory={handleOpenHistory}
        onUploadOrReplaceMsds={handleOpenUpload}
        onRemoveMsds={handleRemoveMsds}
        canManageMsds={canManageMsds}
      />
      {!isLoading && (
        <TablePagination
          totalItems={filteredAndSortedItems.length}
          currentPage={currentPage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="items"
        />
      )}

      {/* Item Detail Drawer */}
      <ItemDetailDrawer
        item={selectedItem}
        open={showDetailDrawer}
        onOpenChange={setShowDetailDrawer}
        onUse={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowUseDialog(true); }}
        onRestock={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowRestockDialog(true); }}
        onAdjust={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowAdjustDialog(true); }}
        onDispose={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowDisposeDialog(true); }}
        onEdit={(item) => { setShowDetailDrawer(false); setSelectedItem(item); setShowForm(true); }}
        onViewMsds={(item) => { setMsdsContextItem(item); handleViewMsds(item); }}
        onDownloadMsds={handleDownloadMsds}
        onShowMsdsHistory={handleOpenHistory}
        onUploadOrReplaceMsds={handleOpenUpload}
        onRemoveMsds={handleRemoveMsds}
        canManageMsds={canManageMsds}
      />

      <MsdsViewerModal
        open={showMsdsViewer}
        onOpenChange={setShowMsdsViewer}
        signedUrl={viewerSignedUrl}
        chemicalName={msdsContextItem?.name}
      />

      <MsdsUploadDialog
        open={showMsdsUpload}
        onOpenChange={setShowMsdsUpload}
        chemicalName={msdsContextItem?.name}
        mode={msdsContextItem?.msds_current_id ? 'replace' : 'upload'}
        onSubmit={handleUploadOrReplaceMsds}
      />

      <MsdsHistoryModal
        open={showMsdsHistory}
        onOpenChange={setShowMsdsHistory}
        chemicalName={msdsContextItem?.name}
        currentMsdsId={msdsContextItem?.msds_current_id || null}
        canManage={canManageMsds}
        loadHistory={loadCurrentHistory}
        onView={handleViewMsds}
        onDownload={handleDownloadMsds}
        onSetCurrent={async (doc) => {
          if (!msdsContextItem?.id) return;
          await setCurrentMsds(msdsContextItem.id, doc.id);
          setMsdsContextItem((prev) => (prev ? { ...prev, msds_current_id: doc.id, msds_current: doc } : prev));
          toast.success(`Set v${doc.version} as current MSDS`);
          await loadData();
        }}
        onArchive={async (doc) => {
          await archiveMsdsVersion(doc.id);
          toast.success(`Archived MSDS v${doc.version}`);
          await loadData();
        }}
      />

      {/* Dialogs */}
      <ItemForm
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setSelectedItem(null); }}
        item={selectedItem}
        category="chemical"
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





