import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { AlertCircle, Loader2, Trash2, FlaskConical, Package, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DisposeDialog({ open, onOpenChange, item, onDispose }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) {
      setError('Disposal reason is required');
      return;
    }

    setIsLoading(true);
    try {
      await onDispose(item, reason, notes);
      setReason('');
      setNotes('');
      onOpenChange(false);
    } catch (err) {
      setError(err.message || 'Failed to dispose item');
    } finally {
      setIsLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Dispose Item
          </DialogTitle>
          <DialogDescription>
            This action will permanently dispose of this item
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This will set the item quantity to 0 and mark it as disposed. 
            The item can be restored later, but will need to be restocked.
          </AlertDescription>
        </Alert>

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
              Current quantity: <span className="font-medium">{item.quantity} {item.unit}</span>
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
            <Label htmlFor="dispose_reason">Disposal Reason *</Label>
            <Textarea
              id="dispose_reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Expired, Contaminated, No longer needed..."
              rows={2}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="dispose_notes">Additional Notes (optional)</Label>
            <Textarea
              id="dispose_notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional details..."
              rows={2}
              className="mt-1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disposing...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Dispose Item
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}