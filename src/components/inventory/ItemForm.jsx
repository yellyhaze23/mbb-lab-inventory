import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/ui/date-picker-input';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, ChevronDown, Loader2 } from 'lucide-react';

const generateQRCode = () => {
  return `LAB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
};

const TRACKING_TYPES = [
  { value: 'SIMPLE_MEASURE', label: 'Simple Measure' },
  { value: 'UNIT_ONLY', label: 'Unit Only' },
  { value: 'PACK_WITH_CONTENT', label: 'Pack With Content' },
];

const MEASURE_UNIT_OPTIONS = ['g', 'mg', 'kg', 'mL', 'L', 'uL', 'ug', 'mol', 'mmol'];
const UNIT_TYPE_OPTIONS = ['box', 'pack', 'bag', 'bottle', 'kit', 'container', 'other'];
const CONTENT_LABEL_OPTIONS = ['pcs', 'preps', 'tubes', 'vials'];

const ROOM_AREA_OPTIONS = ['MBB Lab', 'RT-PCR Room', 'PCR Room', 'Isozyme Ref', 'Other'];
const STORAGE_TYPE_OPTIONS = ['Shelf', 'Cabinet', 'Bench', 'Table', 'Freezer', 'Fridge', 'Other'];
const POSITION_OPTIONS = ['Top', 'Middle', 'Bottom', 'Other'];
const STORAGE_NUMBER_OPTIONS = ['A', 'B', 'C', 'D', '1', '2', '3', '4', 'Other'];

function EditableCombobox({ id, value, onChange, options, placeholder, hasError = false }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const trimmedSearch = searchQuery.trim();
  const normalizedSearch = trimmedSearch.toLowerCase();
  const filteredOptions = normalizedSearch
    ? options.filter((opt) => opt.toLowerCase().includes(normalizedSearch))
    : options;
  const showCreateOption = Boolean(trimmedSearch) && !options.some((opt) => opt.toLowerCase() === normalizedSearch);

  const handleOpenChange = (nextOpen) => {
    setOpen(nextOpen);
    if (nextOpen) setSearchQuery('');
  };

  const commitValue = (nextValue) => {
    onChange(nextValue);
    setSearchQuery('');
    setOpen(false);
  };

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
            onFocus={() => handleOpenChange(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setSearchQuery('');
              }
              if (e.key === 'Enter' && showCreateOption) {
                e.preventDefault();
                commitValue(trimmedSearch);
              }
            }}
            placeholder={placeholder}
            className={`${hasError ? 'border-red-500' : ''} pr-10`}
            autoComplete="off"
          />
          <button
            type="button"
            aria-label={`Toggle ${id} options`}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-slate-500 hover:bg-slate-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleOpenChange(!open)}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent className="w-[var(--radix-popover-anchor-width)] p-1" align="start">
        <div
          className="max-h-40 overflow-y-auto overscroll-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          onWheelCapture={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {showCreateOption && (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
              onClick={() => commitValue(trimmedSearch)}
            >
              Use "{trimmedSearch}"
            </button>
          )}
          {filteredOptions.map((opt) => (
            <button
              key={opt}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-slate-100"
              onClick={() => commitValue(opt)}
            >
              <Check className={`h-4 w-4 ${value === opt ? 'opacity-100' : 'opacity-0'}`} />
              <span>{opt}</span>
            </button>
          ))}
          {filteredOptions.length === 0 && !showCreateOption && (
            <p className="px-3 py-2 text-sm text-slate-500">No options found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const getInitialFormData = (category) => ({
  name: '',
  category,
  tracking_type: 'SIMPLE_MEASURE',
  quantity_value: 0,
  quantity_unit: category === 'chemical' ? 'g' : 'pcs',
  unit_type: '',
  total_units: 0,
  content_per_unit: 0,
  content_label: 'pcs',
  total_content: 0,
  already_opened: false,
  opened_pack_remaining_content: '',
  room_area: '',
  storage_type: '',
  storage_number: '',
  position: '',
  project_fund_source: '',
  expiration_date: '',
  minimum_stock: 0,
  qr_code_value: '',
  description: '',
  supplier: '',
  status: 'active',
  date_received: '',
  lot_number: '',
  opened_date: '',
});

export default function ItemForm({ open, onOpenChange, item, category, onSave }) {
  const [formData, setFormData] = useState(getInitialFormData(category));
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const isSimpleMeasure = formData.tracking_type === 'SIMPLE_MEASURE';
  const isUnitOnly = formData.tracking_type === 'UNIT_ONLY';
  const isPackWithContent = formData.tracking_type === 'PACK_WITH_CONTENT';

  useEffect(() => {
    if (item) {
      const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
      setFormData({
        name: item.name || '',
        category: item.category || category,
        tracking_type: trackingType,
        quantity_value: item.quantity_value ?? (trackingType === 'SIMPLE_MEASURE' ? item.quantity || 0 : 0),
        quantity_unit: item.quantity_unit || (trackingType === 'SIMPLE_MEASURE' ? item.unit || '' : ''),
        unit_type: item.unit_type || (trackingType !== 'SIMPLE_MEASURE' ? item.unit || '' : ''),
        total_units: item.total_units ?? (trackingType !== 'SIMPLE_MEASURE' ? item.quantity || 0 : 0),
        content_per_unit: item.content_per_unit || 0,
        content_label: item.content_label || 'pcs',
        total_content: item.total_content || 0,
        already_opened: false,
        opened_pack_remaining_content: '',
        room_area: item.room_area || '',
        storage_type: item.storage_type || '',
        storage_number: item.storage_number || '',
        position: item.position || '',
        project_fund_source: item.project_fund_source || '',
        expiration_date: item.expiration_date || '',
        minimum_stock: item.minimum_stock || 0,
        qr_code_value: item.qr_code_value || '',
        description: item.description || '',
        supplier: item.supplier || '',
        status: item.status || 'active',
        date_received: item.date_received || '',
        lot_number: item.lot_number || '',
        opened_date: item.opened_date || '',
      });
    } else {
      setFormData({
        ...getInitialFormData(category),
        qr_code_value: generateQRCode(),
      });
    }
    setErrors({});
  }, [item, category, open]);

  const validate = () => {
    const nextErrors = {};

    if (!formData.name.trim()) nextErrors.name = 'Name is required';
    if (!formData.room_area) nextErrors.room_area = 'Room/Area is required';
    if (!formData.storage_type) nextErrors.storage_type = 'Storage type is required';
    if (Number(formData.minimum_stock) < 0) nextErrors.minimum_stock = 'Minimum stock cannot be negative';

    if (isSimpleMeasure) {
      if (Number(formData.quantity_value) <= 0) nextErrors.quantity_value = 'Quantity must be greater than 0';
      if (!formData.quantity_unit?.trim()) nextErrors.quantity_unit = 'Unit is required';
    }

    if (isUnitOnly) {
      if (Number(formData.total_units) <= 0) nextErrors.total_units = 'Total units must be greater than 0';
      if (!formData.unit_type?.trim()) nextErrors.unit_type = 'Unit type is required';
    }

    if (isPackWithContent) {
      if (Number(formData.total_units) <= 0) nextErrors.total_units = 'Total units must be greater than 0';
      if (!formData.unit_type?.trim()) nextErrors.unit_type = 'Unit type is required';
      if (Number(formData.content_per_unit) <= 0) nextErrors.content_per_unit = 'Content per unit must be greater than 0';
      if (!formData.content_label?.trim()) nextErrors.content_label = 'Content label is required';

      if (formData.already_opened) {
        const openedRemaining = Number(formData.opened_pack_remaining_content);
        if (!Number.isInteger(openedRemaining) || openedRemaining < 0) {
          nextErrors.opened_pack_remaining_content = 'Opened pack remaining content must be a non-negative integer';
        } else if (openedRemaining > Number(formData.content_per_unit || 0)) {
          nextErrors.opened_pack_remaining_content = 'Opened pack remaining content cannot exceed content per unit';
        }
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const payload = { ...formData };

    if (isPackWithContent) {
      const totalUnits = Number(payload.total_units) || 0;
      const contentPerUnit = Number(payload.content_per_unit) || 0;
      if (payload.already_opened) {
        const openedRemaining = Number(payload.opened_pack_remaining_content) || 0;
        payload.total_content = Math.max(totalUnits - 1, 0) * contentPerUnit + openedRemaining;
      } else {
        payload.total_content = totalUnits * contentPerUnit;
      }
    } else {
      payload.total_content = null;
    }

    setIsLoading(true);
    try {
      await onSave(payload);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const computedTotalContent = useMemo(() => {
    if (!isPackWithContent) return null;
    const totalUnits = Number(formData.total_units) || 0;
    const contentPerUnit = Number(formData.content_per_unit) || 0;
    if (formData.already_opened) {
      const openedRemaining = Number(formData.opened_pack_remaining_content) || 0;
      return Math.max(totalUnits - 1, 0) * contentPerUnit + openedRemaining;
    }
    return totalUnits * contentPerUnit;
  }, [formData.total_units, formData.content_per_unit, formData.already_opened, formData.opened_pack_remaining_content, isPackWithContent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto p-0 rounded-2xl border-slate-200 shadow-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {item ? 'Edit' : 'Add'} {category === 'chemical' ? 'Chemical' : 'Consumable'}
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            {item ? 'Update the item details below.' : 'Fill in the details for the new item.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter item name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div className="col-span-2">
              <Label htmlFor="tracking_type">Tracking Type *</Label>
              <Select
                value={formData.tracking_type}
                onValueChange={(value) => handleChange('tracking_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tracking type" />
                </SelectTrigger>
                <SelectContent>
                  {TRACKING_TYPES.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isSimpleMeasure && (
              <>
                <div>
                  <Label htmlFor="quantity_value">Quantity Value *</Label>
                  <Input
                    id="quantity_value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.quantity_value}
                    onChange={(e) => handleChange('quantity_value', parseFloat(e.target.value) || 0)}
                    className={errors.quantity_value ? 'border-red-500' : ''}
                  />
                  {errors.quantity_value && <p className="text-red-500 text-sm mt-1">{errors.quantity_value}</p>}
                </div>

                <div>
                  <Label htmlFor="quantity_unit">Quantity Unit *</Label>
                  <Select
                    value={formData.quantity_unit}
                    onValueChange={(value) => handleChange('quantity_unit', value)}
                  >
                    <SelectTrigger className={errors.quantity_unit ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEASURE_UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.quantity_unit && <p className="text-red-500 text-sm mt-1">{errors.quantity_unit}</p>}
                </div>
              </>
            )}

            {(isUnitOnly || isPackWithContent) && (
              <>
                <div>
                  <Label htmlFor="total_units">Total Units *</Label>
                  <Input
                    id="total_units"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.total_units}
                    onChange={(e) => handleChange('total_units', parseInt(e.target.value, 10) || 0)}
                    className={errors.total_units ? 'border-red-500' : ''}
                  />
                  {errors.total_units && <p className="text-red-500 text-sm mt-1">{errors.total_units}</p>}
                </div>

                <div>
                  <Label htmlFor="unit_type">Unit Type *</Label>
                  <Select
                    value={formData.unit_type}
                    onValueChange={(value) => handleChange('unit_type', value)}
                  >
                    <SelectTrigger className={errors.unit_type ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select unit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_TYPE_OPTIONS.map((unitType) => (
                        <SelectItem key={unitType} value={unitType}>{unitType}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.unit_type && <p className="text-red-500 text-sm mt-1">{errors.unit_type}</p>}
                </div>
              </>
            )}

            {isPackWithContent && (
              <>
                <div>
                  <Label htmlFor="content_per_unit">Content Per Unit *</Label>
                  <Input
                    id="content_per_unit"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.content_per_unit}
                    onChange={(e) => handleChange('content_per_unit', parseInt(e.target.value, 10) || 0)}
                    className={errors.content_per_unit ? 'border-red-500' : ''}
                  />
                  {errors.content_per_unit && <p className="text-red-500 text-sm mt-1">{errors.content_per_unit}</p>}
                </div>

                <div>
                  <Label htmlFor="content_label">Content Label *</Label>
                  <Select
                    value={formData.content_label}
                    onValueChange={(value) => handleChange('content_label', value)}
                  >
                    <SelectTrigger className={errors.content_label ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select content label" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_LABEL_OPTIONS.map((label) => (
                        <SelectItem key={label} value={label}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.content_label && <p className="text-red-500 text-sm mt-1">{errors.content_label}</p>}
                </div>

                {!item && (
                  <>
                    <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={formData.already_opened}
                          onChange={(e) => handleChange('already_opened', e.target.checked)}
                        />
                        Already opened?
                      </label>
                      <p className="mt-1 text-xs text-slate-500">
                        Default is automatic all-sealed initialization on add.
                      </p>
                    </div>

                    {formData.already_opened && (
                      <div className="col-span-2">
                        <Label htmlFor="opened_pack_remaining_content">Opened Pack Remaining Content *</Label>
                        <Input
                          id="opened_pack_remaining_content"
                          type="number"
                          min="0"
                          step="1"
                          value={formData.opened_pack_remaining_content}
                          onChange={(e) => handleChange('opened_pack_remaining_content', e.target.value)}
                          className={errors.opened_pack_remaining_content ? 'border-red-500' : ''}
                        />
                        {errors.opened_pack_remaining_content && <p className="text-red-500 text-sm mt-1">{errors.opened_pack_remaining_content}</p>}
                      </div>
                    )}
                  </>
                )}

                <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Total content: <span className="font-semibold">{computedTotalContent ?? 0} {formData.content_label || 'pcs'}</span>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="minimum_stock">Minimum Stock</Label>
              <Input
                id="minimum_stock"
                type="number"
                min="0"
                step={isSimpleMeasure ? '0.01' : '1'}
                value={formData.minimum_stock}
                onChange={(e) => handleChange('minimum_stock', parseFloat(e.target.value) || 0)}
                className={errors.minimum_stock ? 'border-red-500' : ''}
              />
              {errors.minimum_stock && <p className="text-red-500 text-sm mt-1">{errors.minimum_stock}</p>}
            </div>

            <div>
              <Label htmlFor="project_fund_source">Project / Fund Source</Label>
              <Input
                id="project_fund_source"
                value={formData.project_fund_source}
                onChange={(e) => handleChange('project_fund_source', e.target.value)}
                placeholder="e.g., MBB Research Grant 2024"
              />
            </div>

            <div className="col-span-2 pt-1">
              <p className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-200 pb-2">Storage Location</p>
            </div>

            <div>
              <Label htmlFor="room_area">Room / Area *</Label>
              <EditableCombobox
                id="room_area"
                value={formData.room_area}
                onChange={(value) => handleChange('room_area', value)}
                options={ROOM_AREA_OPTIONS}
                placeholder="Select room"
                hasError={Boolean(errors.room_area)}
              />
              {errors.room_area && <p className="text-red-500 text-sm mt-1">{errors.room_area}</p>}
            </div>

            <div>
              <Label htmlFor="storage_type">Storage Type *</Label>
              <EditableCombobox
                id="storage_type"
                value={formData.storage_type}
                onChange={(value) => handleChange('storage_type', value)}
                options={STORAGE_TYPE_OPTIONS}
                placeholder="Select type"
                hasError={Boolean(errors.storage_type)}
              />
              {errors.storage_type && <p className="text-red-500 text-sm mt-1">{errors.storage_type}</p>}
            </div>

            <div>
              <Label htmlFor="storage_number">Storage Number</Label>
              <EditableCombobox
                id="storage_number"
                value={formData.storage_number}
                onChange={(value) => handleChange('storage_number', value)}
                options={STORAGE_NUMBER_OPTIONS}
                placeholder="e.g., 1, 2, A"
              />
            </div>

            <div>
              <Label htmlFor="position">Position</Label>
              <EditableCombobox
                id="position"
                value={formData.position}
                onChange={(value) => handleChange('position', value)}
                options={POSITION_OPTIONS}
                placeholder="Select position"
              />
            </div>

            {category === 'chemical' && (
              <>
                <div className="col-span-2 pt-1">
                  <p className="text-sm font-semibold text-slate-700 mb-3 border-b border-slate-200 pb-2">Chemical Details</p>
                </div>

                <div>
                  <Label htmlFor="expiration_date">Expiration Date</Label>
                  <DatePickerInput
                    id="expiration_date"
                    value={formData.expiration_date}
                    onChange={(value) => handleChange('expiration_date', value)}
                    placeholder="Select expiration date"
                  />
                </div>

                <div>
                  <Label htmlFor="lot_number">Lot/Batch Number</Label>
                  <Input
                    id="lot_number"
                    value={formData.lot_number}
                    onChange={(e) => handleChange('lot_number', e.target.value)}
                    placeholder="e.g., LOT-2024-001"
                  />
                </div>

                <div>
                  <Label htmlFor="date_received">Date Received</Label>
                  <DatePickerInput
                    id="date_received"
                    value={formData.date_received}
                    onChange={(value) => handleChange('date_received', value)}
                    placeholder="Select date received"
                  />
                </div>

                <div>
                  <Label htmlFor="opened_date">Date Opened</Label>
                  <DatePickerInput
                    id="opened_date"
                    value={formData.opened_date}
                    onChange={(value) => handleChange('opened_date', value)}
                    placeholder="Select opened date"
                  />
                </div>
              </>
            )}

            <div className="col-span-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) => handleChange('supplier', e.target.value)}
                placeholder="Supplier name"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sticky bottom-0 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-t border-slate-100 px-0 pt-4 pb-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                item ? 'Update' : 'Add Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
