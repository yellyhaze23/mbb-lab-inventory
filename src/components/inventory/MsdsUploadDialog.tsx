import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import DatePickerInput from '@/components/ui/date-picker-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Upload } from 'lucide-react';
import { validateMsdsFile } from '@/api/msdsService';

type MsdsUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chemicalName?: string;
  mode?: 'upload' | 'replace';
  onSubmit: (payload: {
    file: File;
    title?: string;
    supplier?: string;
    revisionDate?: string;
  }) => Promise<void>;
};

export default function MsdsUploadDialog({
  open,
  onOpenChange,
  chemicalName,
  mode = 'upload',
  onSubmit,
}: MsdsUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [supplier, setSupplier] = useState('');
  const [revisionDate, setRevisionDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setTitle('');
      setSupplier('');
      setRevisionDate('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleFile = (nextFile: File | null) => {
    setError(null);
    setFile(nextFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateMsdsFile(file);
    if (!check.valid || !file) {
      setError(check.message || 'Invalid file');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        file,
        title: title || undefined,
        supplier: supplier || undefined,
        revisionDate: revisionDate || undefined,
      });
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload MSDS');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{mode === 'replace' ? 'Replace MSDS' : 'Upload MSDS'}</DialogTitle>
          <DialogDescription>
            {chemicalName ? `${chemicalName}` : 'Chemical'} - PDF only, max 15MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="msds_file">MSDS PDF *</Label>
            <Input
              id="msds_file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
              disabled={isSubmitting}
            />
            {file && (
              <p className="text-xs text-slate-500">
                {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="msds_title">Title (optional)</Label>
              <Input
                id="msds_title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g., Sodium Chloride MSDS"
              />
            </div>

            <div>
              <Label htmlFor="msds_supplier">Supplier (optional)</Label>
              <Input
                id="msds_supplier"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="msds_revision_date">Revision Date (optional)</Label>
              <DatePickerInput
                id="msds_revision_date"
                value={revisionDate}
                onChange={setRevisionDate}
                placeholder="Select date"
              />
            </div>
          </div>

          {isSubmitting && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full w-1/2 animate-pulse rounded-full bg-slate-900" />
              </div>
              <p className="mt-2 text-xs text-slate-600">Uploading MSDS securely...</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  {mode === 'replace' ? 'Replace MSDS' : 'Upload MSDS'}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

