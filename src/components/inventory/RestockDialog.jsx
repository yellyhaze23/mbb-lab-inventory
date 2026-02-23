import React, { useState } from 'react';
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
import { AlertCircle, Loader2, Plus, FlaskConical, Package } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function RestockDialog({ open, onOpenChange, item, onRestock }) {
  const [quantity, setQuantity] = useState(0);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (quantity <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }

    setIsLoading(true);
    try {
      await onRestock(item, quantity, notes);
      setQuantity(0);
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to restock item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;
  const trackingType = item.tracking_type || 'SIMPLE_MEASURE';
  const isSimpleMeasure = trackingType === 'SIMPLE_MEASURE';
  const stockValue = isSimpleMeasure ? (item.quantity_value ?? item.quantity) : (item.total_units ?? item.quantity);
  const stockUnit = isSimpleMeasure ? (item.quantity_unit || item.unit) : (item.unit_type || item.unit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Restock Item</DialogTitle>
          <DialogDescription>
            Add inventory to this item
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
            <Label htmlFor="restock_quantity">Quantity to Add *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="restock_quantity"
                type="number"
                min={isSimpleMeasure ? '0.01' : '1'}
                step={isSimpleMeasure ? '0.01' : '1'}
                value={quantity}
                onChange={(e) => setQuantity(isSimpleMeasure ? parseFloat(e.target.value) || 0 : parseInt(e.target.value, 10) || 0)}
                className="flex-1"
              />
              <span className="text-slate-500 font-medium">{stockUnit}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              New total: {isSimpleMeasure ? (Number(stockValue) + Number(quantity)).toFixed(2) : (Number(stockValue) + Number(quantity))} {stockUnit}
            </p>
          </div>

          <div>
            <Label htmlFor="restock_notes">Notes (optional)</Label>
            <Textarea
              id="restock_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., PO #12345, Supplier delivery..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Stock
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
