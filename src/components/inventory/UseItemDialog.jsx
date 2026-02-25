import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { AlertCircle, Loader2, FlaskConical, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const getTrackingType = (item) => item?.tracking_type || 'SIMPLE_MEASURE';
const getContentUnit = (item) => item?.content_unit || item?.total_content_unit || item?.content_label || 'pcs';

export default function UseItemDialog({ open, onOpenChange, item, onUse }) {
  const [mode, setMode] = useState('CONTENT');
  const [amount, setAmount] = useState(1);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const trackingType = getTrackingType(item);
  const isSimpleMeasure = trackingType === 'SIMPLE_MEASURE';
  const isUnitOnly = trackingType === 'UNIT_ONLY';
  const isPackWithContent = trackingType === 'PACK_WITH_CONTENT';

  useEffect(() => {
    if (!open || !item) return;
    if (isSimpleMeasure) {
      setMode('CONTENT');
      setAmount(1);
    } else if (isUnitOnly) {
      setMode('UNITS');
      setAmount(1);
    } else {
      setMode('CONTENT');
      setAmount(1);
    }
    setNotes('');
    setError('');
  }, [open, item, isSimpleMeasure, isUnitOnly]);

  const availabilityLabel = useMemo(() => {
    if (!item) return '';
    if (isSimpleMeasure) {
      return `${item.quantity_value ?? item.quantity} ${item.quantity_unit || item.unit}`;
    }
    if (isUnitOnly) {
      return `${item.total_units ?? item.quantity} ${item.unit_type || item.unit}`;
    }
    if (mode === 'UNITS') {
      const sealed = item.sealed_count ?? 0;
      return `${sealed} sealed ${item.unit_type || item.unit}`;
    }
    return `${item.total_content ?? 0} ${getContentUnit(item)}`;
  }, [item, isSimpleMeasure, isUnitOnly, mode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!item) return;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (isSimpleMeasure) {
      const available = Number(item.quantity_value ?? item.quantity ?? 0);
      if (numericAmount > available) {
        setError(`Insufficient stock. Available: ${available} ${item.quantity_unit || item.unit}`);
        return;
      }
    } else if (isUnitOnly) {
      const asInt = Number.isInteger(numericAmount);
      const available = Number(item.total_units ?? item.quantity ?? 0);
      if (!asInt) {
        setError('Units to deduct must be a whole number');
        return;
      }
      if (numericAmount > available) {
        setError(`Insufficient stock. Available: ${available} ${item.unit_type || item.unit}`);
        return;
      }
    } else {
      if (mode === 'UNITS') {
        const asInt = Number.isInteger(numericAmount);
        const sealed = Number(item.sealed_count ?? 0);
        if (!asInt) {
          setError('Units to deduct must be a whole number');
          return;
        }
        if (numericAmount > sealed) {
          setError(`Insufficient sealed packs. Available sealed: ${sealed}`);
          return;
        }
      } else {
        const available = Number(item.total_content ?? 0);
        if (numericAmount > available) {
          setError(`Insufficient stock. Available: ${available} ${getContentUnit(item)}`);
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      await onUse(item, {
        mode: isUnitOnly ? 'UNITS' : mode,
        amount: numericAmount,
        notes,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to record usage');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Use / Deduct</DialogTitle>
          <DialogDescription>
            Record stock deduction for this item
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${item.category === 'chemical' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
            {item.category === 'chemical' ? (
              <FlaskConical className="w-6 h-6 text-indigo-600" />
            ) : (
              <Package className="w-6 h-6 text-emerald-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-slate-900">{item.name}</p>
            <p className="text-sm text-slate-500">
              Available: <span className="font-medium">{availabilityLabel}</span>
            </p>
            {isPackWithContent && (
              <p className="text-xs text-slate-500 mt-1">
                Sealed: {item.sealed_count ?? 0} / Opened: {item.opened_count ?? 0}
              </p>
            )}
          </div>
        </div>

        {isPackWithContent && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === 'CONTENT' ? 'default' : 'outline'}
              onClick={() => setMode('CONTENT')}
            >
              Deduct by Content
            </Button>
            <Button
              type="button"
              variant={mode === 'UNITS' ? 'default' : 'outline'}
              onClick={() => setMode('UNITS')}
            >
              Deduct by Units
            </Button>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="use_amount">
              {isSimpleMeasure
                ? 'Amount to Deduct *'
                : (isUnitOnly || mode === 'UNITS')
                  ? 'Units to Deduct *'
                  : `Content to Deduct (${getContentUnit(item)}) *`}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="use_amount"
                type="number"
                min="0"
                step={isSimpleMeasure || (isPackWithContent && mode === 'CONTENT') ? '0.01' : '1'}
                value={amount}
                onChange={(e) => {
                  const nextValue = (isSimpleMeasure || (isPackWithContent && mode === 'CONTENT'))
                    ? parseFloat(e.target.value)
                    : parseInt(e.target.value, 10);
                  setAmount(Number.isFinite(nextValue) ? nextValue : 0);
                }}
                className="flex-1"
              />
              <span className="text-slate-500 font-medium">
                {isSimpleMeasure
                  ? (item.quantity_unit || item.unit)
                  : (isUnitOnly || mode === 'UNITS')
                    ? (item.unit_type || item.unit)
                    : getContentUnit(item)}
              </span>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Experiment #123, Project ABC..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                'Confirm Deduct'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
