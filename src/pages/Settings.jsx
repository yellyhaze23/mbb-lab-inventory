import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import DatePickerInput from '@/components/ui/date-picker-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings as SettingsIcon,
  User,
  Save,
  Loader2,
  Lock,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { generatePin } from '../components/inventory/inventoryHelpers';
import { getProfileByUserId, updateProfileById } from '@/api/profilesDataClient';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { invokeEdgeFunction } from '@/lib/edgeClient';
import ProfileAvatarUpload from '../components/settings/ProfileAvatarUpload';

const PIN_CACHE_KEY = 'lab_settings_pin_cache';
function readCachedPin() {
  try {
    return localStorage.getItem(PIN_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

function writeCachedPin(pin) {
  try {
    if (pin) {
      localStorage.setItem(PIN_CACHE_KEY, pin);
    } else {
      localStorage.removeItem(PIN_CACHE_KEY);
    }
  } catch {
    // no-op for environments without localStorage
  }
}

export default function Settings() {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [labSettings, setLabSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [pinForm, setPinForm] = useState(() => ({
    lab_pin: readCachedPin(),
    pin_expires_at: ''
  }));

  const [profileForm, setProfileForm] = useState({
    full_name: ''
  });
  const [securityForm, setSecurityForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);

  useEffect(() => {
    loadData();
  }, []);


  const loadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setNeedsSignIn(true);
        setIsLoading(false);
        return;
      }

      setNeedsSignIn(false);
      const currentUser = session.user;
      setUser(currentUser);

      const profile = await getProfileByUserId(
        currentUser.id,
        currentUser.email,
        currentUser.user_metadata
      );

      if (profile) {
        setUserProfile(profile);
        setProfileForm({
          full_name: profile.full_name || ''
        });
      }

      const settingsRes = await invokeEdgeFunction('get-lab-settings', {}, { requireAuth: true });
      const settings = settingsRes?.settings || null;

      if (settings) {
        setLabSettings(settings);
        setPinForm((prev) => ({
          ...prev,
          lab_pin: settings.current_pin || prev.lab_pin || readCachedPin(),
          pin_expires_at: settings.pin_expires_at ? settings.pin_expires_at.split('T')[0] : ''
        }));
        if (settings.current_pin) {
          writeCachedPin(settings.current_pin);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      if (String(error?.message || '').toLowerCase().includes('please log in again')) {
        setNeedsSignIn(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      if (userProfile) {
        await updateProfileById(userProfile.id, profileForm);
      }
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpdate = (newUrl) => {
    setUserProfile(prev => ({ ...prev, avatar_url: newUrl }));
  };

  const handleGeneratePin = () => {
    const newPin = generatePin(6);
    setPinForm({ ...pinForm, lab_pin: newPin });
    writeCachedPin(newPin);
    toast.success('New PIN generated');
  };

  const handleCopyPin = () => {
    if (pinForm.lab_pin) {
      navigator.clipboard.writeText(pinForm.lab_pin);
      toast.success('PIN copied to clipboard');
    }
  };

  const handleSavePin = async () => {
    if (!pinForm.lab_pin || pinForm.lab_pin.length < 4) {
      toast.error('PIN must be at least 4 digits');
      return;
    }

    setIsSaving(true);
    try {
      await invokeEdgeFunction('set-lab-pin', {
        pin: pinForm.lab_pin,
        pin_expires_at: pinForm.pin_expires_at ? new Date(pinForm.pin_expires_at + 'T23:59:59').toISOString() : null,
        pin_updated_by: user?.id || null
      }, { requireAuth: true });
      writeCachedPin(pinForm.lab_pin);
      toast.success('Lab PIN updated successfully');
      loadData();
    } catch (error) {
      console.error('Error saving PIN:', error);
      toast.error(error?.message || 'Failed to update PIN');
    } finally {
      setIsSaving(false);
    }
  };

  const canManagePin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const needsInitialPasswordSetup = user?.user_metadata?.password_set === false;

  const handleUpdatePassword = async () => {
    const currentPassword = securityForm.current_password;
    const newPassword = securityForm.new_password;
    const confirmPassword = securityForm.confirm_password;

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!needsInitialPasswordSetup && !currentPassword) {
      toast.error('Current password is required');
      return;
    }

    setIsSavingSecurity(true);
    try {
      if (!needsInitialPasswordSetup) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: user?.email || '',
          password: currentPassword,
        });

        if (reauthError) {
          throw reauthError;
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: {
          ...(user?.user_metadata || {}),
          password_set: true,
        },
      });

      if (updateError) {
        throw updateError;
      }

      setSecurityForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      toast.success('Password updated successfully');
      loadData();
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error(error?.message || 'Failed to update password');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (needsSignIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Please sign in</CardTitle>
          <CardDescription>You need an active admin session to open Settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => { window.location.href = '/Login'; }}>Go to Login</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
          <SettingsIcon className="w-6 h-6 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500">Manage your account settings</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-slate-100/90 p-1 rounded-xl">
          <TabsTrigger
            value="profile"
            className="transition-all duration-300 ease-out transform-gpu data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7b1c2e] data-[state=active]:to-[#8f2437] data-[state=active]:text-[#f4efe7] data-[state=active]:border data-[state=active]:border-[#c9a84c40] data-[state=active]:shadow-[0_6px_20px_rgba(123,28,46,0.28)] data-[state=active]:scale-[1.02]"
          >
            <User className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="transition-all duration-300 ease-out transform-gpu data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7b1c2e] data-[state=active]:to-[#8f2437] data-[state=active]:text-[#f4efe7] data-[state=active]:border data-[state=active]:border-[#c9a84c40] data-[state=active]:shadow-[0_6px_20px_rgba(123,28,46,0.28)] data-[state=active]:scale-[1.02]"
          >
            <Lock className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          {canManagePin && (
            <TabsTrigger
              value="pin"
              className="transition-all duration-300 ease-out transform-gpu data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7b1c2e] data-[state=active]:to-[#8f2437] data-[state=active]:text-[#f4efe7] data-[state=active]:border data-[state=active]:border-[#c9a84c40] data-[state=active]:shadow-[0_6px_20px_rgba(123,28,46,0.28)] data-[state=active]:scale-[1.02]"
            >
              <Lock className="w-4 h-4 mr-2" />
              Student PIN
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Profile Picture</Label>
                <ProfileAvatarUpload
                  userProfile={userProfile}
                  onAvatarUpdate={handleAvatarUpdate}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email || ''}
                    disabled
                    className="bg-slate-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <Label>Role</Label>
                  <Input
                    value={userProfile?.role?.replace('_', ' ') || 'Admin'}
                    disabled
                    className="bg-slate-50 capitalize"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!needsInitialPasswordSetup && (
                  <div className="md:col-span-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input
                      id="current_password"
                      type="password"
                      value={securityForm.current_password}
                      onChange={(e) => setSecurityForm({ ...securityForm, current_password: e.target.value })}
                      placeholder="Enter your current password"
                      autoComplete="current-password"
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="new_password">New Password</Label>
                  <Input
                    id="new_password"
                    type="password"
                    value={securityForm.new_password}
                    onChange={(e) => setSecurityForm({ ...securityForm, new_password: e.target.value })}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={securityForm.confirm_password}
                    onChange={(e) => setSecurityForm({ ...securityForm, confirm_password: e.target.value })}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleUpdatePassword}
                  disabled={isSavingSecurity}
                  className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
                >
                  {isSavingSecurity ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {canManagePin && (
          <TabsContent value="pin">
            <Card>
              <CardHeader>
                <CardTitle>Student Access PIN</CardTitle>
                <CardDescription>
                  Manage the PIN code that students use to access the usage recording page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <Lock className="h-4 w-4" />
                  <AlertDescription>
                    Students can access <code className="bg-slate-100 px-1 rounded">/StudentUse</code> with this PIN to record item usage without logging in.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lab_pin">Current PIN</Label>
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <Input
                          id="lab_pin"
                          type={showPin ? 'text' : 'password'}
                          value={pinForm.lab_pin}
                          onChange={(e) => {
                            const nextPin = e.target.value.replace(/\\D/g, '');
                            setPinForm({ ...pinForm, lab_pin: nextPin });
                            writeCachedPin(nextPin);
                          }}
                          placeholder={labSettings?.has_pin && !pinForm.lab_pin ? "PIN is set. Enter new PIN to change" : "Enter PIN (min 4 digits)"}
                          maxLength={10}
                          className="pr-20 font-mono text-lg tracking-wider"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setShowPin(!showPin)}
                          >
                            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopyPin}
                            disabled={!pinForm.lab_pin}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleGeneratePin}
                        className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Generate
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="pin_expires">PIN Expiration (optional)</Label>
                    <div className="mt-1">
                      <DatePickerInput
                        id="pin_expires"
                        value={pinForm.pin_expires_at}
                        onChange={(value) => setPinForm({ ...pinForm, pin_expires_at: value })}
                        placeholder="Select expiration date"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty for no expiration. Students won't be able to access after this date.
                    </p>
                  </div>                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSavePin}
                    disabled={isSaving}
                    className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save PIN Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}


