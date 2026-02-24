import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Eye, History, Loader2, Star, Archive } from 'lucide-react';
import { format } from 'date-fns';
import TablePagination from '@/components/ui/table-pagination';
import type { MsdsDocument } from '@/types/msds';

type MsdsHistoryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chemicalName?: string;
  currentMsdsId?: string | null;
  canManage?: boolean;
  onView: (doc: MsdsDocument) => Promise<void> | void;
  onDownload: (doc: MsdsDocument) => Promise<void> | void;
  onSetCurrent?: (doc: MsdsDocument) => Promise<void>;
  onArchive?: (doc: MsdsDocument) => Promise<void>;
  loadHistory: () => Promise<MsdsDocument[]>;
};

export default function MsdsHistoryModal({
  open,
  onOpenChange,
  chemicalName,
  currentMsdsId,
  canManage = false,
  onView,
  onDownload,
  onSetCurrent,
  onArchive,
  loadHistory,
}: MsdsHistoryModalProps) {
  const [docs, setDocs] = useState<MsdsDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!open) return;
    let isActive = true;
    setIsLoading(true);
    loadHistory()
      .then((rows) => {
        if (isActive) setDocs(rows || []);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, [open, loadHistory]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return docs.slice(start, start + pageSize);
  }, [docs, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize, docs.length]);

  const withBusy = async (id: string, action: () => Promise<void>) => {
    setBusyId(id);
    try {
      await action();
      const refreshed = await loadHistory();
      setDocs(refreshed || []);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            MSDS History
          </DialogTitle>
          <DialogDescription>
            {chemicalName ? `${chemicalName}` : 'Chemical'} - version history and actions.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Version</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Revision</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[280px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin inline-block" />
                    Loading history...
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                    No MSDS versions found.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-semibold">v{doc.version}</TableCell>
                    <TableCell>{doc.title || '-'}</TableCell>
                    <TableCell>{doc.supplier || '-'}</TableCell>
                    <TableCell>{doc.revision_date ? format(new Date(doc.revision_date), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>{doc.uploaded_at ? format(new Date(doc.uploaded_at), 'MMM d, yyyy h:mm a') : '-'}</TableCell>
                    <TableCell>{doc.uploaded_by_name || doc.uploaded_by || 'Unknown'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {doc.id === currentMsdsId && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Current
                          </Badge>
                        )}
                        {!doc.is_active && (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
                            Archived
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" variant="outline" onClick={() => onView(doc)}>
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => onDownload(doc)}>
                          <Download className="w-3 h-3 mr-1" />
                          Download
                        </Button>
                        {canManage && onSetCurrent && doc.id !== currentMsdsId && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === doc.id}
                            onClick={() => withBusy(doc.id, async () => onSetCurrent(doc))}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            Set Current
                          </Button>
                        )}
                        {canManage && onArchive && doc.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === doc.id}
                            onClick={() => withBusy(doc.id, async () => onArchive(doc))}
                          >
                            <Archive className="w-3 h-3 mr-1" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isLoading && docs.length > 0 && (
          <TablePagination
            totalItems={docs.length}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="versions"
            className="rounded-lg border border-slate-200"
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

