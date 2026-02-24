import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type MsdsViewerModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  signedUrl: string | null;
};

export default function MsdsViewerModal({ open, onClose, title, signedUrl }: MsdsViewerModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setIsLoading(Boolean(signedUrl));
    setHasError(!signedUrl);
  }, [open, signedUrl]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100">
          <DialogTitle className="text-slate-900">{title || 'MSDS Viewer'}</DialogTitle>
          <DialogDescription>Material Safety Data Sheet (PDF)</DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          {!signedUrl ? (
            <div className="h-[70vh] flex items-center justify-center text-sm text-slate-500 border rounded-lg">
              Unable to load MSDS preview.
            </div>
          ) : (
            <div className="relative">
              {isLoading && (
                <Skeleton className="h-[70vh] w-full rounded-lg border border-slate-200" />
              )}
              <iframe
                title={title || 'MSDS PDF'}
                src={signedUrl}
                className={`h-[70vh] w-full rounded-lg border border-slate-200 bg-white ${isLoading ? 'hidden' : ''}`}
                onLoad={() => {
                  setIsLoading(false);
                  setHasError(false);
                }}
                onError={() => {
                  setIsLoading(false);
                  setHasError(true);
                }}
              />
              {hasError && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg border bg-white text-sm text-slate-500">
                  Failed to load PDF preview.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button type="button" variant="outline" onClick={onClose} aria-label="Close MSDS viewer">
            Close
          </Button>
          <Button
            type="button"
            disabled={!signedUrl}
            onClick={() => {
              if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
