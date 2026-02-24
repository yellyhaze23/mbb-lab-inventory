import React from 'react';
import { cn } from '@/lib/utils';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, idx) => idx + 1);
  }

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('left-ellipsis');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('right-ellipsis');

  pages.push(totalPages);
  return pages;
}

export default function TablePagination({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  pageSizeOptions = [10, 20, 50, 100],
  className,
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(currentPage * pageSize, totalItems);
  const pageItems = buildPageItems(currentPage, totalPages);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  const goToPage = (nextPage) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === currentPage) return;
    onPageChange(nextPage);
  };

  return (
    <div className={cn('flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium text-slate-900">{from}</span>-<span className="font-medium text-slate-900">{to}</span> of{' '}
        <span className="font-medium text-slate-900">{totalItems}</span> {itemLabel}
      </p>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="h-8 w-[72px] bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Pagination className="mx-0 w-auto justify-end">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (canGoPrev) goToPage(currentPage - 1);
                }}
                className={!canGoPrev ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>

            {pageItems.map((item, idx) => (
              <PaginationItem key={`${item}-${idx}`}>
                {typeof item === 'number' ? (
                  <PaginationLink
                    href="#"
                    isActive={item === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      goToPage(item);
                    }}
                  >
                    {item}
                  </PaginationLink>
                ) : (
                  <PaginationEllipsis />
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (canGoNext) goToPage(currentPage + 1);
                }}
                className={!canGoNext ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
