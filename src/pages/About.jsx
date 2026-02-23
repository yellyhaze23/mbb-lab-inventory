import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, ShieldCheck, FlaskConical, Package, FileText, ListChecks, LockKeyhole, Code2 } from 'lucide-react';

export default function About() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
          <Info className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">About</h1>
          <p className="text-slate-500">System information and overview</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GMBD MBB Lab Inventory</CardTitle>
          <CardDescription>
            A secure web-based inventory system designed to streamline laboratory chemical and consumable management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
              <FlaskConical className="w-3 h-3 mr-1" />
              Chemicals
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Package className="w-3 h-3 mr-1" />
              Consumables
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <FileText className="w-3 h-3 mr-1" />
              Usage Logs
            </Badge>
            <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Role-Based Access
            </Badge>
          </div>
          <p className="text-slate-600">
            This system enables administrators to monitor chemical stock levels, track consumable usage,
            generate audit logs, and maintain accurate laboratory inventory records to support efficient
            daily operations.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-blue-600" />
              System Features
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Chemical inventory lifecycle tracking</li>
              <li>Consumable stock monitoring</li>
              <li>Usage log recording and audit history</li>
              <li>Reports and summary analytics</li>
              <li>Role-based administrative access control</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="w-5 h-5 text-blue-600" />
              Security & Access
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>Admin access via secure authentication (email + password / invite flow)</li>
              <li>Role-based permission management (Admin / Super Admin)</li>
              <li>Student access via secured PIN system (students are not invited by email)</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            Development Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>Developed By: Ariel C. Longa</li>
            <li>Program: BSIT - Web and Mobile Application Development</li>
            <li>Institution: Laguna State Polytechnic University - Los Banos Campus</li>
            <li>Year Developed: 2026</li>
            <li>Version: 1.0</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
