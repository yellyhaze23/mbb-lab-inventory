import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  Calendar, 
  FolderOpen, 
  MapPin, 
  Package,
  ArrowRight
} from 'lucide-react';

export default function DataQualityWarnings({ items }) {
  const warnings = [];

  // Items missing expiration (chemicals only)
  const missingExpiration = items.filter(i => 
    i.category === 'chemical' && 
    !i.expiration_date && 
    (i.status === 'active' || !i.status)
  );
  if (missingExpiration.length > 0) {
    warnings.push({
      id: 'missing_expiration',
      icon: Calendar,
      label: 'Missing expiration date',
      count: missingExpiration.length,
      color: 'amber',
      link: createPageUrl('Chemicals') + '?filter=no_expiration'
    });
  }

  // Items missing project/fund source
  const missingProject = items.filter(i => 
    !i.project_fund_source && 
    (i.status === 'active' || !i.status)
  );
  if (missingProject.length > 0) {
    warnings.push({
      id: 'missing_project',
      icon: FolderOpen,
      label: 'Missing project/fund source',
      count: missingProject.length,
      color: 'blue',
      link: createPageUrl('Chemicals') + '?filter=no_project'
    });
  }

  // Zero quantity but active
  const zeroActive = items.filter(i => 
    i.quantity === 0 && 
    (i.status === 'active' || !i.status)
  );
  if (zeroActive.length > 0) {
    warnings.push({
      id: 'zero_active',
      icon: Package,
      label: 'Zero stock but active',
      count: zeroActive.length,
      color: 'red',
      link: null
    });
  }

  // Missing location
  const missingLocation = items.filter(i => 
    !i.room_area && 
    !i.storage_type && 
    (i.status === 'active' || !i.status)
  );
  if (missingLocation.length > 0) {
    warnings.push({
      id: 'missing_location',
      icon: MapPin,
      label: 'Missing location',
      count: missingLocation.length,
      color: 'slate',
      link: null
    });
  }

  if (warnings.length === 0) return null;

  const colorMap = {
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Data Quality Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {warnings.map(warning => {
            const Icon = warning.icon;
            const content = (
              <div 
                className={`flex items-center justify-between p-3 rounded-lg border ${colorMap[warning.color]} ${warning.link ? 'hover:opacity-80 cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{warning.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-white/50">
                    {warning.count}
                  </Badge>
                  {warning.link && <ArrowRight className="w-4 h-4" />}
                </div>
              </div>
            );

            return warning.link ? (
              <Link key={warning.id} to={warning.link}>
                {content}
              </Link>
            ) : (
              <div key={warning.id}>{content}</div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
