import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, 
  UserPlus, 
  Shield,
  ShieldCheck,
  User,
  MoreHorizontal,
  Pencil,
  UserX,
  UserCheck,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { createPageUrl } from '../utils';
import { listProfiles, getProfileByUserId, updateProfileById } from '@/api/profilesDataClient';

export default function AdminManagement() {
  const [profiles, setProfiles] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: authResult } = await supabase.auth.getUser();
      const user = authResult?.user;
      if (!user) {
        throw new Error('Not authenticated');
      }
      setCurrentUser(user);
      
      const allProfiles = await listProfiles(100);
      setProfiles(allProfiles);
      
      const userProfile = allProfiles.find(p => p.id === user.id) || await getProfileByUserId(user.id, user.email, user.user_metadata);
      setCurrentProfile(userProfile);
      
      // Check if user is super_admin
      if (userProfile?.role !== 'super_admin') {
        window.location.href = createPageUrl('Dashboard');
        return;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsInviting(true);
    try {
      const email = newUserEmail.trim();
      const { error } = await supabase.functions.invoke('invite-admin', {
        body: { email },
      });

      if (error) {
        throw error;
      }

      toast.success('Invitation sent. User will receive a magic link to set their password.');
      setNewUserEmail('');
      setShowAddDialog(false);
    } catch (error) {
      console.error('Error inviting user:', error);
      toast.error(error?.message || 'Failed to invite user');
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateRole = async (profile, newRole) => {
    setIsSubmitting(true);
    try {
      await updateProfileById(profile.id, { role: newRole });
      toast.success(`Role updated to ${newRole.replace('_', ' ')}`);
      loadData();
      setShowEditDialog(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (profile) => {
    setIsSubmitting(true);
    try {
      await updateProfileById(profile.id, { is_active: false });
      toast.success('User deactivated');
      loadData();
      setShowDeleteDialog(false);
      setSelectedProfile(null);
    } catch (error) {
      console.error('Error deactivating user:', error);
      toast.error('Failed to deactivate user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async (profile) => {
    setIsSubmitting(true);
    try {
      await updateProfileById(profile.id, { is_active: true });
      toast.success('User activated');
      loadData();
    } catch (error) {
      console.error('Error activating user:', error);
      toast.error('Failed to activate user');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeProfiles = profiles.filter(p => p.is_active !== false);
  const superAdminCount = activeProfiles.filter(p => p.role === 'super_admin').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center">
            <Users className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Admin Management</h1>
            <p className="text-slate-500">{activeProfiles.length} active users</p>
          </div>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Invite User
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>Manage user roles and access</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48 mt-1" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile) => {
                  const isCurrentUser = profile.id === currentUser?.id;
                  const isActive = profile.is_active !== false;
                  
                  return (
                    <TableRow key={profile.id} className={!isActive ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                            <User className="w-5 h-5 text-slate-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">
                              {profile.full_name}
                              {isCurrentUser && (
                                <span className="text-xs text-slate-500 ml-2">(You)</span>
                              )}
                            </p>
                            <p className="text-sm text-slate-500">{profile.created_by || profile.email || '-'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={profile.role === 'super_admin' 
                            ? 'bg-purple-100 text-purple-700 border-purple-200' 
                            : 'bg-blue-100 text-blue-700 border-blue-200'
                          }
                        >
                          {profile.role === 'super_admin' ? (
                            <ShieldCheck className="w-3 h-3 mr-1" />
                          ) : (
                            <Shield className="w-3 h-3 mr-1" />
                          )}
                          {profile.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={isActive 
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                          }
                        >
                          {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {format(new Date(profile.created_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {!isCurrentUser && isActive && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setSelectedProfile(profile);
                                setShowEditDialog(true);
                              }}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedProfile(profile);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-red-600 focus:text-red-600"
                                disabled={profile.role === 'super_admin' && superAdminCount <= 1}
                              >
                                <UserX className="w-4 h-4 mr-2" />
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        {!isCurrentUser && !isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleActivate(profile)}
                            disabled={isSubmitting}
                          >
                            {isSubmitting ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Activating...
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite New User</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
              />
              <p className="text-sm text-slate-500 mt-2">
                User will receive a secure magic link to set their password.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={isInviting}>
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedProfile?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Role</Label>
              <p className="text-sm text-slate-600 capitalize">
                {selectedProfile?.role?.replace('_', ' ')}
              </p>
            </div>
            <div>
              <Label htmlFor="new_role">New Role</Label>
              <Select
                value={selectedProfile?.role}
                onValueChange={(value) => handleUpdateRole(selectedProfile, value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to deactivate <strong>{selectedProfile?.full_name}</strong>? 
              They will no longer be able to access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <Button 
              variant="destructive" 
              onClick={() => handleDeactivate(selectedProfile)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deactivating...
                </>
              ) : (
                'Deactivate'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


