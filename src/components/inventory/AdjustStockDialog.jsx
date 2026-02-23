import React, { useState, useEffect } from 'react';
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
import { AlertCircle, Loader2, Settings, FlaskConical, Package, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function AdjustStockDialog({ open, onOpenChange, item, onAdjust }) {
  const [newQuantity, setNewQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item && open) {
      const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
      setNewQuantity(
        trackingType === 'SIMPLE_MEASURE'
          ? Number(item.quantity_value ?? item.quantity ?? 0)
          : Number(item.total_units ?? item.quantity ?? 0)
      );
      setNotes('');
      setError('');
    }
  }, [item, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newQuantity < 0) {
      setError('Quantity cannot be negative');
      return;
    }

    setIsLoading(true);
    try {
      await onAdjust(item, newQuantity, notes);
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to adjust stock');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;
  const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
  const isSimpleMeasure = trackingType === 'SIMPLE_MEASURE';
  const stockValue = isSimpleMeasure ? (item.quantity_value ?? item.quantity) : (item.total_units ?? item.quantity);
  const stockUnit = isSimpleMeasure ? (item.quantity_unit || item.unit) : (item.unit_type || item.unit);

  const difference = newQuantity - Number(stockValue || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Set the absolute quantity for this item
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
              Current: <span className="font-medium">{stockValue} {stockUnit}</span>
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="new_quantity">New Quantity *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="new_quantity"
                type="number"
                min="0"
                step={isSimpleMeasure ? '0.01' : '1'}
                value={newQuantity}
                onChange={(e) => setNewQuantity(isSimpleMeasure ? parseFloat(e.target.value) || 0 : parseInt(e.target.value, 10) || 0)}
                className="flex-1"
              />
              <span className="text-slate-500 font-medium">{stockUnit}</span>
            </div>
            {difference !== 0 && (
              <div className="flex items-center gap-2 mt-2 text-sm">
                <span className="text-slate-500">{stockValue} {stockUnit}</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <span className={`font-medium ${difference > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {newQuantity} {stockUnit}
                </span>
                <span className={`text-xs ${difference > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  ({difference > 0 ? '+' : ''}{isSimpleMeasure ? difference.toFixed(2) : difference})
                </span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="adjust_notes">Reason for Adjustment *</Label>
            <Textarea
              id="adjust_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Physical count correction, spillage, expired portion..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || difference === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adjusting...
                </>
              ) : (
                <>
                  <Settings className="w-4 h-4 mr-2" />
                  Adjust Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
