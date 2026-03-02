import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  BarChart3, 
  Download, 
  TrendingUp,
  AlertTriangle,
  Calendar,
  FlaskConical,
  Package,
  FileSpreadsheet
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isBefore, addDays } from 'date-fns';
import { toast } from 'sonner';
import { listAllItems } from '@/api/itemsDataClient';
import { listUsageLogs } from '@/api/usageLogsDataClient';
import TablePagination from '@/components/ui/table-pagination';
import { handleAsyncError } from '@/lib/errorHandling';

export default function Reports() {
  const [items, setItems] = useState([]);
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mostUsedPage, setMostUsedPage] = useState(1);
  const [mostUsedPageSize, setMostUsedPageSize] = useState(10);
  const [lowStockPage, setLowStockPage] = useState(1);
  const [lowStockPageSize, setLowStockPageSize] = useState(10);
  const [expiredPage, setExpiredPage] = useState(1);
  const [expiredPageSize, setExpiredPageSize] = useState(10);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, logsData] = await Promise.all([
        listAllItems(1000),
        listUsageLogs(1000)
      ]);
      setItems(itemsData);
      setLogs(logsData);
    } catch (error) {
      handleAsyncError(error, {
        context: 'Reports load error',
        fallback: 'Failed to load report data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Most used items
  const mostUsedItems = React.useMemo(() => {
    const usageByItem = {};
    logs.forEach(log => {
      if (!usageByItem[log.item_id]) {
        usageByItem[log.item_id] = {
          name: log.item_name,
          type: log.item_type,
          unit: log.unit,
          totalUsed: 0,
          usageCount: 0
        };
      }
      usageByItem[log.item_id].totalUsed += log.quantity_used;
      usageByItem[log.item_id].usageCount += 1;
    });
    
    return Object.entries(usageByItem)
      .sort(([, a], [, b]) => b.usageCount - a.usageCount)
      .map(([id, data]) => ({ id, ...data }));
  }, [logs]);

  // Low stock items
  const lowStockItems = React.useMemo(
    () => items.filter(item => item.quantity <= item.minimum_stock),
    [items]
  );

  // Expired items
  const expiredItems = React.useMemo(
    () => items.filter(item => item.expiration_date && isBefore(new Date(item.expiration_date), new Date())),
    [items]
  );

  // Expiring soon items
  const expiringSoonItems = React.useMemo(
    () =>
      items.filter(item => {
        if (!item.expiration_date) return false;
        const expDate = new Date(item.expiration_date);
        return isAfter(expDate, new Date()) && isBefore(expDate, addDays(new Date(), 30));
      }),
    [items]
  );

  const expiredAndExpiringItems = React.useMemo(
    () => [...expiredItems, ...expiringSoonItems],
    [expiredItems, expiringSoonItems]
  );

  const paginatedMostUsed = React.useMemo(() => {
    const start = (mostUsedPage - 1) * mostUsedPageSize;
    return mostUsedItems.slice(start, start + mostUsedPageSize);
  }, [mostUsedItems, mostUsedPage, mostUsedPageSize]);

  const paginatedLowStock = React.useMemo(() => {
    const start = (lowStockPage - 1) * lowStockPageSize;
    return lowStockItems.slice(start, start + lowStockPageSize);
  }, [lowStockItems, lowStockPage, lowStockPageSize]);

  const paginatedExpired = React.useMemo(() => {
    const start = (expiredPage - 1) * expiredPageSize;
    return expiredAndExpiringItems.slice(start, start + expiredPageSize);
  }, [expiredAndExpiringItems, expiredPage, expiredPageSize]);

  useEffect(() => {
    setMostUsedPage(1);
  }, [mostUsedPageSize]);

  useEffect(() => {
    setLowStockPage(1);
  }, [lowStockPageSize]);

  useEffect(() => {
    setExpiredPage(1);
  }, [expiredPageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(mostUsedItems.length / mostUsedPageSize));
    if (mostUsedPage > totalPages) setMostUsedPage(totalPages);
  }, [mostUsedItems.length, mostUsedPage, mostUsedPageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(lowStockItems.length / lowStockPageSize));
    if (lowStockPage > totalPages) setLowStockPage(totalPages);
  }, [lowStockItems.length, lowStockPage, lowStockPageSize]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(expiredAndExpiringItems.length / expiredPageSize));
    if (expiredPage > totalPages) setExpiredPage(totalPages);
  }, [expiredAndExpiringItems.length, expiredPage, expiredPageSize]);

  function isAfter(date1, date2) {
    return date1 > date2;
  }

  const exportToCSV = (data, filename) => {
    if (data.length === 0) {
      toast.error('No data to export');
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    
    toast.success(`Exported ${data.length} records`);
  };

  const exportInventory = () => {
    const data = items.map(item => ({
      Name: item.name,
      Category: item.category,
      Quantity: item.quantity,
      Unit: item.unit,
      'Minimum Stock': item.minimum_stock,
      Location: item.location || '',
      'Expiration Date': item.expiration_date || '',
      'CAS Number': item.cas_number || '',
      Supplier: item.supplier || ''
    }));
    exportToCSV(data, 'inventory');
  };

  const exportUsageLogs = () => {
    const data = logs.map(log => ({
      'Item Name': log.item_name,
      'Item Type': log.item_type,
      'Quantity Used': log.quantity_used,
      Unit: log.unit,
      'Used By': log.used_by_name || '',
      Notes: log.notes || '',
      Date: format(new Date(log.created_date), 'yyyy-MM-dd HH:mm:ss')
    }));
    exportToCSV(data, 'usage-logs');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-slate-500">Analytics and data exports</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportInventory}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Export Inventory
          </Button>
          <Button variant="outline" onClick={exportUsageLogs}>
            <Download className="w-4 h-4 mr-2" />
            Export Usage Logs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Items</p>
                <p className="text-2xl font-bold text-slate-900">{items.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Usage Records</p>
                <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Low Stock Items</p>
                <p className="text-2xl font-bold text-amber-600">{lowStockItems.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Expired Items</p>
                <p className="text-2xl font-bold text-red-600">{expiredItems.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="most-used" className="space-y-4">
        <TabsList>
          <TabsTrigger value="most-used">Most Used</TabsTrigger>
          <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value="most-used">
          <Card>
            <CardHeader>
              <CardTitle>Most Used Items</CardTitle>
              <CardDescription>Items with highest usage frequency</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : mostUsedItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <TrendingUp className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>No usage data yet</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Total Used</TableHead>
                        <TableHead>Usage Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMostUsed.map((item, index) => {
                        const absoluteRank = (mostUsedPage - 1) * mostUsedPageSize + index + 1;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                absoluteRank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                absoluteRank === 2 ? 'bg-slate-200 text-slate-700' :
                                absoluteRank === 3 ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {absoluteRank}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.type === 'chemical' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
                                  {item.type === 'chemical' ? (
                                    <FlaskConical className="w-4 h-4 text-indigo-600" />
                                  ) : (
                                    <Package className="w-4 h-4 text-emerald-600" />
                                  )}
                                </div>
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.totalUsed.toFixed(2)} {item.unit}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.usageCount} times</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalItems={mostUsedItems.length}
                    currentPage={mostUsedPage}
                    pageSize={mostUsedPageSize}
                    onPageChange={setMostUsedPage}
                    onPageSizeChange={setMostUsedPageSize}
                    itemLabel="ranked items"
                    className="mt-4 rounded-lg border border-slate-200"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="low-stock">
          <Card>
            <CardHeader>
              <CardTitle>Low Stock Items</CardTitle>
              <CardDescription>Items below minimum stock level</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : lowStockItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>All items are well stocked</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Current Qty</TableHead>
                        <TableHead>Min Stock</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLowStock.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${item.category === 'chemical' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
                                {item.category === 'chemical' ? (
                                  <FlaskConical className="w-4 h-4 text-indigo-600" />
                                ) : (
                                  <Package className="w-4 h-4 text-emerald-600" />
                                )}
                              </div>
                              <span className="font-medium">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-amber-600 font-medium">
                              {item.quantity} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.minimum_stock} {item.unit}
                          </TableCell>
                          <TableCell>
                            {item.location || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalItems={lowStockItems.length}
                    currentPage={lowStockPage}
                    pageSize={lowStockPageSize}
                    onPageChange={setLowStockPage}
                    onPageSizeChange={setLowStockPageSize}
                    itemLabel="low stock items"
                    className="mt-4 rounded-lg border border-slate-200"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expired">
          <Card>
            <CardHeader>
              <CardTitle>Expired & Expiring Items</CardTitle>
              <CardDescription>Items that have expired or will expire within 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : expiredItems.length === 0 && expiringSoonItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                  <p>No expired or expiring items</p>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Expiration Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedExpired.map((item) => {
                        const isExpired = isBefore(new Date(item.expiration_date), new Date());
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                                  <FlaskConical className="w-4 h-4 text-indigo-600" />
                                </div>
                                <span className="font-medium">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(item.expiration_date), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={isExpired ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                                {isExpired ? 'Expired' : 'Expiring Soon'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.location || '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <TablePagination
                    totalItems={expiredAndExpiringItems.length}
                    currentPage={expiredPage}
                    pageSize={expiredPageSize}
                    onPageChange={setExpiredPage}
                    onPageSizeChange={setExpiredPageSize}
                    itemLabel="expiring items"
                    className="mt-4 rounded-lg border border-slate-200"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
