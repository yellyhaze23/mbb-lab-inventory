import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePickerInput from '@/components/ui/date-picker-input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  FileText, 
  Search, 
  User,
  FlaskConical,
  Package,
  Clock,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Settings,
  Trash2,
  GraduationCap,
  X
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { listUsageLogs } from '@/api/usageLogsDataClient';
import useDebounce from '@/hooks/useDebounce';

export default function UsageLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 350);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_date', direction: 'desc' });
  const isFirstLoadRef = useRef(true);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
  };

  const loadLogs = useCallback(async ({ showInitialLoading = false } = {}) => {
    if (showInitialLoading) {
      setIsLoading(true);
    } else {
      setIsFetching(true);
    }
    try {
      const logsData = await listUsageLogs({ limit: 1000, search: debouncedSearch });
      setLogs(logsData);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      if (showInitialLoading) {
        setIsLoading(false);
      }
      setIsFetching(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    const showInitialLoading = isFirstLoadRef.current;
    loadLogs({ showInitialLoading });
    isFirstLoadRef.current = false;
  }, [loadLogs]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Set(logs.map(l => l.used_by_name).filter(Boolean));
    return Array.from(users).sort();
  }, [logs]);

  const filteredAndSortedLogs = useMemo(() => {
    let result = logs.filter(log => {
      const matchesSearch = !debouncedSearch || 
        log.item_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        log.used_by_name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        log.notes?.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesCategory = categoryFilter === 'all' || log.item_type === categoryFilter;
      const matchesAction = actionFilter === 'all' || log.action === actionFilter;
      const matchesUser = userFilter === 'all' || log.used_by_name === userFilter;
      
      let matchesDate = true;
      if (dateFrom) {
        matchesDate = matchesDate && new Date(log.created_date) >= new Date(dateFrom);
      }
      if (dateTo) {
        matchesDate = matchesDate && new Date(log.created_date) <= new Date(dateTo + 'T23:59:59');
      }
      
      return matchesSearch && matchesCategory && matchesAction && matchesUser && matchesDate;
    });

    // Sorting
    result.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortConfig.key) {
        case 'created_date':
          aVal = new Date(a.created_date).getTime();
          bVal = new Date(b.created_date).getTime();
          break;
        case 'item_name':
          aVal = (a.item_name || '').toLowerCase();
          bVal = (b.item_name || '').toLowerCase();
          break;
        case 'used_by_name':
          aVal = (a.used_by_name || '').toLowerCase();
          bVal = (b.used_by_name || '').toLowerCase();
          break;
        case 'quantity_used':
          aVal = Math.abs(a.quantity_used || 0);
          bVal = Math.abs(b.quantity_used || 0);
          break;
        default:
          aVal = new Date(a.created_date).getTime();
          bVal = new Date(b.created_date).getTime();
      }
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [logs, debouncedSearch, categoryFilter, actionFilter, userFilter, dateFrom, dateTo, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryFilter('all');
    setActionFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortConfig({ key: 'created_date', direction: 'desc' });
  };

  const hasActiveFilters = searchQuery || categoryFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || dateFrom || dateTo;

  const getActionBadge = (action, source) => {
    const actionConfig = {
      use: { label: 'Used', icon: ArrowDown, color: 'bg-red-50 text-red-700 border-red-200' },
      restock: { label: 'Restocked', icon: ArrowUp, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      adjust: { label: 'Adjusted', icon: Settings, color: 'bg-blue-50 text-blue-700 border-blue-200' },
      dispose: { label: 'Disposed', icon: Trash2, color: 'bg-slate-100 text-slate-700 border-slate-300' },
    };
    const config = actionConfig[action] || actionConfig.use;
    const Icon = config.icon;
    return (
      <div className="flex items-center gap-1">
        <Badge variant="outline" className={config.color}>
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </Badge>
        {source === 'student_mode' && (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            <GraduationCap className="w-3 h-3" />
          </Badge>
        )}
      </div>
    );
  };

  function SortableHeader({ label, sortKey }) {
    const isActive = sortConfig.key === sortKey;
    const isDesc = sortConfig.direction === 'desc';
    
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className="flex items-center gap-1 font-semibold hover:text-slate-900 transition-colors"
      >
        {label}
        {isActive ? (
          isDesc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usage Logs</h1>
          <p className="text-slate-500">{logs.length} total records</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search item, user, notes..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="chemical">Chemicals</SelectItem>
                <SelectItem value="consumable">Consumables</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="use">Used</SelectItem>
                <SelectItem value="restock">Restocked</SelectItem>
                <SelectItem value="adjust">Adjusted</SelectItem>
                <SelectItem value="dispose">Disposed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map(user => (
                  <SelectItem key={user} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DatePickerInput
              id="usage_date_from"
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="From"
            />

            <DatePickerInput
              id="usage_date_to"
              value={dateTo}
              onChange={setDateTo}
              placeholder="To"
            />
          </div>
          
          {hasActiveFilters && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-slate-500">
                Showing {filteredAndSortedLogs.length} of {logs.length} records
              </p>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-3 h-3 mr-1" />
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto no-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
              <TableRow>
                <TableHead>
                  <SortableHeader label="Item" sortKey="item_name" />
                </TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead>
                  <SortableHeader label="Change" sortKey="quantity_used" />
                </TableHead>
                <TableHead>
                  <SortableHeader label="User" sortKey="used_by_name" />
                </TableHead>
                <TableHead>
                  <SortableHeader label="Date & Time" sortKey="created_date" />
                </TableHead>
                <TableHead className="font-semibold">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(10).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                  </TableRow>
                ))
              ) : filteredAndSortedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500">No usage logs found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-slate-50 transition-colors duration-150">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${log.item_type === 'chemical' ? 'bg-indigo-50' : 'bg-emerald-50'}`}>
                          {log.item_type === 'chemical' ? (
                            <FlaskConical className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Package className="w-4 h-4 text-emerald-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{log.item_name}</p>
                          <Badge variant="outline" className="text-xs capitalize">
                            {log.item_type}
                          </Badge>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getActionBadge(log.action || 'use', log.source)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.before_quantity !== undefined && log.after_quantity !== undefined ? (
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">{log.before_quantity}</span>
                            <span className="text-slate-400">→</span>
                            <span className={`font-medium ${log.action === 'restock' ? 'text-emerald-600' : log.action === 'adjust' ? 'text-blue-600' : 'text-red-600'}`}>
                              {log.after_quantity}
                            </span>
                            <span className="text-slate-400 text-xs">{log.unit}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900">
                            {log.action === 'restock' ? '+' : '-'}{Math.abs(log.quantity_used)} {log.unit}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-slate-500" />
                        </div>
                        <span className="text-slate-700">{log.used_by_name || 'Unknown'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-slate-600">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {format(new Date(log.created_date), 'MMM d, yyyy h:mm a')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-slate-600 max-w-xs truncate">
                        {log.notes || '-'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {isFetching && !isLoading && (
          <div className="border-t border-slate-200 bg-slate-50 p-3">
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
