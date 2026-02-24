import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExternalLink } from 'lucide-react';

type MsdsViewerModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signedUrl: string | null;
  chemicalName?: string;
};

export default function MsdsViewerModal({
  open,
  onOpenChange,
  signedUrl,
  chemicalName,
}: MsdsViewerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100">
          <DialogTitle>MSDS Viewer</DialogTitle>
          <DialogDescription>
            {chemicalName ? `${chemicalName} - Material Safety Data Sheet` : 'Material Safety Data Sheet'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2">
          {signedUrl ? (
            <iframe
              title={`MSDS PDF ${chemicalName || ''}`}
              src={signedUrl}
              className="h-[70vh] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="h-[70vh] flex items-center justify-center text-slate-500">
              No file to preview.
            </div>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (signedUrl) window.open(signedUrl, '_blank', 'noopener,noreferrer');
            }}
            disabled={!signedUrl}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

