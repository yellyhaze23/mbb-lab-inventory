import React, { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import { Archive, Check, ChevronDown, Download, Trash2, X } from 'lucide-react';
import { handleAsyncError } from '@/lib/errorHandling';

const ROOM_AREA_OPTIONS = ['MBB Lab', 'RT-PCR Room', 'PCR Room', 'Isozyme Ref', 'Other'];
const STORAGE_TYPE_OPTIONS = ['Shelf', 'Cabinet', 'Bench', 'Table', 'Freezer', 'Fridge', 'Other'];
const STORAGE_NUMBER_OPTIONS = ['A', 'B', 'C', 'D', '1', '2', '3', '4', 'Other'];
const POSITION_OPTIONS = ['Top', 'Middle', 'Bottom', 'Other'];
const DISPOSE_REASON_OPTIONS = ['Expired', 'Contaminated', 'Damaged', 'Broken Container', 'Other'];

function EditableCombobox({ id, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const skipCloseAutoFocusRef = useRef(false);
  const skipNextFocusOpenRef = useRef(false);
  const optionRefs = useRef([]);
  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((opt) => opt.toLowerCase().includes(normalizedSearch))
    : options;
  const showCreateOption = Boolean(trimmedSearch) && !options.some((opt) => opt.toLowerCase() === normalizedSearch);
  const selectableOptions = useMemo(() => {
    const base = filteredOptions.map((opt) => ({ kind: 'option', value: opt }));
    if (showCreateOption) return [{ kind: 'create', value: trimmedSearch }, ...base];
    return base;
  }, [filteredOptions, showCreateOption, trimmedSearch]);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearchQuery('');
      setHighlightedIndex(-1);
    }
  };

  const commitValue = (nextValue) => {
    onChange(nextValue);
    setSearchQuery('');
    setOpen(false);
    setHighlightedIndex(-1);
  };

  React.useEffect(() => {
    if (!open) return;
    if (selectableOptions.length === 0) {
      setHighlightedIndex(-1);
      return;
    }

    if (highlightedIndex < 0 || highlightedIndex >= selectableOptions.length) {
      const selectedIdx = selectableOptions.findIndex(
        (entry) => entry.kind === 'option' && entry.value === value
      );
      setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    }
  }, [open, selectableOptions, highlightedIndex, value]);

  React.useEffect(() => {
    if (!open || highlightedIndex < 0) return;
    const el = optionRefs.current[highlightedIndex];
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlightedIndex]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            id={id}
            value={open ? searchQuery : value}
            onChange={(e) => {
              if (!open) {
                setOpen(true);
                setSearchQuery('');
              }
              setSearchQuery(e.target.value);
            }}
            onFocus={(e) => {
              if (skipNextFocusOpenRef.current) {
                skipNextFocusOpenRef.current = false;
                return;
              }
              requestAnimationFrame(() => {
                if (document.activeElement === e.currentTarget) {
                  handleOpenChange(true);
                }
              });
            }}
            onClick={() => {
              if (!open) handleOpenChange(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setSearchQuery('');
                setHighlightedIndex(-1);
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!open) {
                  handleOpenChange(true);
                  return;
                }
                if (selectableOptions.length > 0) {
                  setHighlightedIndex((prev) => (prev + 1) % selectableOptions.length);
                }
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (!open) {
                  handleOpenChange(true);
                  return;
                }
                if (selectableOptions.length > 0) {
                  setHighlightedIndex((prev) =>
                    prev <= 0 ? selectableOptions.length - 1 : prev - 1
                  );
                }
                return;
              }
              if (e.key === 'Enter' && !open) {
                e.preventDefault();
                handleOpenChange(true);
                return;
              }
              if (e.key === 'Enter' && open) {
                const highlighted = selectableOptions[highlightedIndex];
                if (highlighted) {
                  e.preventDefault();
                  commitValue(highlighted.value);
                  return;
                }
              }
              if (e.key === 'Tab') {
                skipCloseAutoFocusRef.current = true;
                skipNextFocusOpenRef.current = true;
                setOpen(false);
                setSearchQuery('');
                setHighlightedIndex(-1);
                return;
              }
              if (e.key === 'Enter' && showCreateOption) {
                e.preventDefault();
                commitValue(trimmedSearch);
              }
            }}
            placeholder={placeholder}
            className="pr-10"
            autoComplete="off"
          />
          <button
            type="button"
            aria-label={`Toggle ${id} options`}
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-slate-500 hover:bg-slate-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleOpenChange(!open)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-anchor-width)] p-1"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          if (skipCloseAutoFocusRef.current) {
            e.preventDefault();
            skipCloseAutoFocusRef.current = false;
          }
        }}
      >
        <div
          className="max-h-40 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onWheelCapture={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {showCreateOption && (
            <button
              ref={(el) => {
                optionRefs.current[0] = el;
              }}
              type="button"
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100 ${highlightedIndex === 0 ? 'bg-slate-100' : ''}`}
              onMouseEnter={() => setHighlightedIndex(0)}
              onClick={() => commitValue(trimmedSearch)}
            >
              Use "{trimmedSearch}"
            </button>
          )}
          {filteredOptions.map((opt, index) => {
            const optionIndex = showCreateOption ? index + 1 : index;
            return (
            <button
              ref={(el) => {
                optionRefs.current[optionIndex] = el;
              }}
              key={opt}
              type="button"
              className={`flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100 ${highlightedIndex === optionIndex ? 'bg-slate-100' : ''}`}
              onMouseEnter={() => setHighlightedIndex(optionIndex)}
              onClick={() => {
                commitValue(opt);
              }}
            >
              <Check className={`h-4 w-4 ${value === opt ? 'opacity-100' : 'opacity-0'}`} />
              <span>{opt}</span>
            </button>
            );
          })}
          {filteredOptions.length === 0 && !showCreateOption && (
            <p className="px-3 py-2 text-sm text-slate-500">No options found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function BulkActionBar({
  selectedItems = [],
  onClearSelection,
  onBulkArchive,
  onBulkDispose,
  onBulkMoveLocation,
  onExportCSV,
}) {
  const count = selectedItems.length;
  const [showDisposeDialog, setShowDisposeDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [disposeError, setDisposeError] = useState('');
  const [disposeForm, setDisposeForm] = useState({
    reason: 'Expired',
    notes: '',
  });
  const [moveForm, setMoveForm] = useState({
    room_area: '',
    storage_type: '',
    storage_number: '',
    position: '',
  });

  const roomOptions = useMemo(() => {
    const dynamic = selectedItems.map((i) => i.room_area).filter(Boolean);
    return Array.from(new Set([...ROOM_AREA_OPTIONS, ...dynamic]));
  }, [selectedItems]);

  const storageTypeOptions = useMemo(() => {
    const dynamic = selectedItems.map((i) => i.storage_type).filter(Boolean);
    return Array.from(new Set([...STORAGE_TYPE_OPTIONS, ...dynamic]));
  }, [selectedItems]);

  const storageNumberOptions = useMemo(() => {
    const dynamic = selectedItems.map((i) => i.storage_number).filter(Boolean);
    return Array.from(new Set([...STORAGE_NUMBER_OPTIONS, ...dynamic]));
  }, [selectedItems]);

  const positionOptions = useMemo(() => {
    const dynamic = selectedItems.map((i) => i.position).filter(Boolean);
    return Array.from(new Set([...POSITION_OPTIONS, ...dynamic]));
  }, [selectedItems]);

  const handleArchive = async () => {
    if (!count || !onBulkArchive) return;
    try {
      await onBulkArchive(selectedItems);
      onClearSelection?.();
    } catch (error) {
      handleAsyncError(error, {
        context: 'Bulk archive error',
        fallback: 'Failed to archive selected items',
      });
    }
  };

  const handleDispose = async () => {
    if (!count || !onBulkDispose) return;
    const reason = disposeForm.reason.trim();
    if (!reason) {
      setDisposeError('Dispose reason is required');
      return;
    }

    try {
      await onBulkDispose(selectedItems, reason, disposeForm.notes.trim());
      setShowDisposeDialog(false);
      setDisposeError('');
      setDisposeForm({ reason: 'Expired', notes: '' });
      onClearSelection?.();
    } catch (error) {
      handleAsyncError(error, {
        context: 'Bulk dispose error',
        fallback: 'Failed to dispose selected items',
      });
    }
  };

  const handleMove = async () => {
    if (!count || !onBulkMoveLocation) return;
    const room = moveForm.room_area.trim();
    const storageType = moveForm.storage_type.trim();
    const storageNumber = moveForm.storage_number.trim();
    const position = moveForm.position.trim();

    if (!room && !storageType && !storageNumber && !position) return;

    try {
      await onBulkMoveLocation(selectedItems, {
        room_area: room || undefined,
        storage_type: storageType || undefined,
        storage_number: storageNumber || undefined,
        position: position || undefined,
      });
      setShowMoveDialog(false);
      setMoveForm({ room_area: '', storage_type: '', storage_number: '', position: '' });
      onClearSelection?.();
    } catch (error) {
      handleAsyncError(error, {
        context: 'Bulk move error',
        fallback: 'Failed to move selected items',
      });
    }
  };

  const handleExport = () => {
    if (!count || !onExportCSV) return;
    onExportCSV(selectedItems);
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-medium text-slate-700">{count} item{count !== 1 ? 's' : ''} selected</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleArchive}>
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDisposeError('');
              setDisposeForm({ reason: 'Expired', notes: '' });
              setShowDisposeDialog(true);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Dispose
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setMoveForm({ room_area: '', storage_type: '', storage_number: '', position: '' });
              setShowMoveDialog(true);
            }}
          >
            Move
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Move Selected Items</DialogTitle>
            <DialogDescription>
              Update only the fields you want to change. Leave others blank to keep current values.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <label htmlFor="bulk_room_area" className="mb-2 block text-sm font-medium text-slate-700">Room / Area</label>
              <EditableCombobox
                id="bulk_room_area"
                value={moveForm.room_area}
                onChange={(value) => setMoveForm((prev) => ({ ...prev, room_area: value }))}
                options={roomOptions}
                placeholder="Select or type room/area"
              />
            </div>

            <div>
              <label htmlFor="bulk_storage_type" className="mb-2 block text-sm font-medium text-slate-700">Storage Type</label>
              <EditableCombobox
                id="bulk_storage_type"
                value={moveForm.storage_type}
                onChange={(value) => setMoveForm((prev) => ({ ...prev, storage_type: value }))}
                options={storageTypeOptions}
                placeholder="Select or type storage type"
              />
            </div>

            <div>
              <label htmlFor="bulk_storage_number" className="mb-2 block text-sm font-medium text-slate-700">Storage Number</label>
              <EditableCombobox
                id="bulk_storage_number"
                value={moveForm.storage_number}
                onChange={(value) => setMoveForm((prev) => ({ ...prev, storage_number: value }))}
                options={storageNumberOptions}
                placeholder="Select or type storage number"
              />
            </div>

            <div>
              <label htmlFor="bulk_position" className="mb-2 block text-sm font-medium text-slate-700">Position</label>
              <EditableCombobox
                id="bulk_position"
                value={moveForm.position}
                onChange={(value) => setMoveForm((prev) => ({ ...prev, position: value }))}
                options={positionOptions}
                placeholder="Select or type position"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleMove}>
              Move Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisposeDialog} onOpenChange={setShowDisposeDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Dispose Selected Items</DialogTitle>
            <DialogDescription>
              You are about to dispose {count} item{count !== 1 ? 's' : ''}. This will mark them as disposed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label htmlFor="bulk_dispose_reason" className="mb-2 block text-sm font-medium text-slate-700">
                Dispose Reason *
              </label>
              <EditableCombobox
                id="bulk_dispose_reason"
                value={disposeForm.reason}
                onChange={(value) => {
                  setDisposeError('');
                  setDisposeForm((prev) => ({ ...prev, reason: value }));
                }}
                options={DISPOSE_REASON_OPTIONS}
                placeholder="Select or type reason"
              />
              {disposeError && <p className="mt-1 text-sm text-red-600">{disposeError}</p>}
            </div>

            <div>
              <label htmlFor="bulk_dispose_notes" className="mb-2 block text-sm font-medium text-slate-700">
                Notes (Optional)
              </label>
              <Textarea
                id="bulk_dispose_notes"
                value={disposeForm.notes}
                onChange={(e) => setDisposeForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Add disposal notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowDisposeDialog(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDispose}>
              Dispose Items
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
