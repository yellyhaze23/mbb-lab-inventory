import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { listAllItems } from '@/api/itemsDataClient';
import { listRecentUsageLogs } from '@/api/usageLogsDataClient';
import { createPageUrl } from '../utils';
import { 
  FlaskConical, 
  Package, 
  AlertTriangle, 
  Calendar, 
  ArrowRight,
  Clock,
  User,
  Trash2,
  PackageX
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, isAfter, addDays, isBefore } from 'date-fns';
import DataQualityWarnings from '../components/dashboard/DataQualityWarnings';
import { handleAsyncError } from '@/lib/errorHandling';

function ClickableStatCard({ title, value, icon: Icon, color, isLoading, href }) {
  const colorConfig = {
    indigo: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
    rose: { bg: 'bg-rose-50', icon: 'text-rose-600', border: 'border-rose-100' },
    slate: { bg: 'bg-slate-100', icon: 'text-slate-600', border: 'border-slate-200' },
  };
  
  const colors = colorConfig[color] || colorConfig.indigo;

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <Skeleton className="w-11 h-11 rounded-xl" />
          </div>
          <Skeleton className="w-16 h-8 mt-3" />
          <Skeleton className="w-20 h-4 mt-1" />
        </CardContent>
      </Card>
    );
  }

  const content = (
    <Card className={`border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer bg-white`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors.bg}`}>
            <Icon className={`w-5 h-5 ${colors.icon}`} />
          </div>
          {href && <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />}
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-bold text-slate-900">{value}</h3>
          <p className="text-slate-500 text-xs font-medium mt-0.5 uppercase tracking-wide">{title}</p>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link to={href} className="group">{content}</Link>;
  }
  return content;
}

export default function Dashboard() {
  const [items, setItems] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [itemsData, logsData, authResult] = await Promise.all([
        listAllItems(1000),
        listRecentUsageLogs(10),
        supabase.auth.getUser(),
      ]);
      const user = authResult?.data?.user;
      
      
      setItems(itemsData);
      setUsageLogs(logsData);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, role, avatar_url, is_active')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setUserProfile(profile);
        } else {
          setUserProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
            role: 'admin',
            avatar_url: null,
            is_active: true,
          });
        }
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      handleAsyncError(error, {
        context: 'Dashboard load error',
        fallback: 'Failed to load dashboard data',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const activeItems = items.filter(i => i.status === 'active' || !i.status);
  const chemicals = activeItems.filter(i => i.category === 'chemical');
  const consumables = activeItems.filter(i => i.category === 'consumable');
  const lowStock = activeItems.filter(i => i.quantity <= i.minimum_stock);
  const expiringSoon = activeItems.filter(i => {
    if (!i.expiration_date) return false;
    const expDate = new Date(i.expiration_date);
    const thirtyDaysFromNow = addDays(new Date(), 30);
    return isBefore(expDate, thirtyDaysFromNow) && isAfter(expDate, new Date());
  });
  const expired = activeItems.filter(i => {
    if (!i.expiration_date) return false;
    return isBefore(new Date(i.expiration_date), new Date());
  });
  const disposed = items.filter(i => i.status === 'disposed');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">
          Welcome back{userProfile?.full_name ? `, ${userProfile.full_name}` : ''}. Here's your lab inventory overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <ClickableStatCard 
          title="Chemicals" 
          value={chemicals.length}
          icon={FlaskConical}
          color="indigo"
          isLoading={isLoading}
          href={createPageUrl('Chemicals')}
        />
        <ClickableStatCard 
          title="Consumables" 
          value={consumables.length}
          icon={Package}
          color="emerald"
          isLoading={isLoading}
          href={createPageUrl('Consumables')}
        />
        <ClickableStatCard 
          title="Low Stock" 
          value={lowStock.length}
          icon={AlertTriangle}
          color="amber"
          isLoading={isLoading}
          href={createPageUrl('Chemicals') + '?filter=low_stock'}
        />
        <ClickableStatCard 
          title="Expired" 
          value={expired.length}
          icon={PackageX}
          color="rose"
          isLoading={isLoading}
          href={createPageUrl('Chemicals') + '?filter=expired'}
        />
        <ClickableStatCard 
          title="Expiring 30d" 
          value={expiringSoon.length}
          icon={Calendar}
          color="amber"
          isLoading={isLoading}
          href={createPageUrl('Chemicals') + '?filter=expiring_30'}
        />
        <ClickableStatCard 
          title="Disposed" 
          value={disposed.length}
          icon={Trash2}
          color="slate"
          isLoading={isLoading}
          href={createPageUrl('Chemicals') + '?filter=disposed'}
        />
      </div>

      {/* Data Quality Warnings */}
      {!isLoading && <DataQualityWarnings items={items} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alert */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Low Stock Alert</CardTitle>
              <CardDescription className="text-xs mt-0.5">Items below minimum stock level</CardDescription>
            </div>
            <Link to={createPageUrl('Chemicals') + '?filter=low_stock'}>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-xs">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-20 h-3 mt-1" />
                    </div>
                    <Skeleton className="w-16 h-6" />
                  </div>
                ))}
              </div>
            ) : lowStock.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <AlertTriangle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>All items are well stocked!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lowStock.slice(0, 5).map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.category === 'chemical' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                      {item.category === 'chemical' ? (
                        <FlaskConical className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Package className="w-5 h-5 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {item.quantity} / {item.minimum_stock} {item.unit}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                      Low
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-semibold">Expiring Soon</CardTitle>
              <CardDescription className="text-xs mt-0.5">Items expiring within 30 days</CardDescription>
            </div>
            <Link to={createPageUrl('Chemicals') + '?filter=expiring_30'}>
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-xs">
                View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-lg" />
                    <div className="flex-1">
                      <Skeleton className="w-32 h-4" />
                      <Skeleton className="w-20 h-3 mt-1" />
                    </div>
                    <Skeleton className="w-16 h-6" />
                  </div>
                ))}
              </div>
            ) : expiringSoon.length === 0 && expired.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No items expiring soon!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...expired, ...expiringSoon].slice(0, 5).map(item => {
                  const isExpired = isBefore(new Date(item.expiration_date), new Date());
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg ${isExpired ? 'bg-rose-50/50 border border-rose-100' : 'bg-amber-50/50 border border-amber-100'}`}
                    >
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-indigo-100">
                        <FlaskConical className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{item.name}</p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(item.expiration_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <Badge variant="outline" className={isExpired ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                        {isExpired ? 'Expired' : 'Expiring'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <CardDescription className="text-xs mt-0.5">Latest usage logs</CardDescription>
          </div>
          <Link to={createPageUrl('UsageLogs')}>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 text-xs">
              View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="w-48 h-4" />
                    <Skeleton className="w-32 h-3 mt-1" />
                  </div>
                  <Skeleton className="w-20 h-4" />
                </div>
              ))}
            </div>
          ) : usageLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p>No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {usageLogs.map(log => (
                <div key={log.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">
                      <span className="text-slate-600">{log.used_by_name || 'User'}</span>{' '}
                      <span className="text-slate-400">{log.action || 'used'}</span>{' '}
                      <span className="text-indigo-600">{Math.abs(log.quantity_used)} {log.unit}</span> of{' '}
                      <span>{log.item_name}</span>
                    </p>
                    {log.notes && (
                      <p className="text-sm text-slate-500 truncate">{log.notes}</p>
                    )}
                  </div>
                  <div className="text-sm text-slate-400">
                    {format(new Date(log.created_date), 'MMM d, h:mm a')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

