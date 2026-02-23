import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { updateProfileById } from '@/api/profilesDataClient';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AVATAR_BUCKET = import.meta.env.VITE_SUPABASE_AVATAR_BUCKET || 'avatars';

export default function ProfileAvatarUpload({ userProfile, onAvatarUpdate }) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(userProfile?.avatar_url || null);
  const fileInputRef = useRef(null);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Please select a PNG or JPG image');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userProfile?.id || 'user'}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const fileUrl = data?.publicUrl || null;

      await updateProfileById(userProfile.id, { avatar_url: fileUrl });

      setPreviewUrl(fileUrl);
      onAvatarUpdate(fileUrl);
      toast.success('Profile picture updated');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      const message = String(error?.message || '');

      if (message.toLowerCase().includes('bucket not found')) {
        toast.error(`Avatar storage bucket '${AVATAR_BUCKET}' is missing. Run the latest Supabase migration first.`);
      } else {
        toast.error('Failed to upload profile picture');
      }
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    setIsUploading(true);
    try {
      await updateProfileById(userProfile.id, { avatar_url: null });
      setPreviewUrl(null);
      onAvatarUpdate(null);
      toast.success('Profile picture removed');
    } catch (error) {
      console.error('Error removing avatar:', error);
      toast.error('Failed to remove profile picture');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <Avatar className="w-24 h-24 border-2 border-slate-200">
          {previewUrl ? <AvatarImage src={previewUrl} alt="Profile" className="object-cover" /> : null}
          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-2xl font-medium">{getInitials(userProfile?.full_name)}</AvatarFallback>
        </Avatar>
        {isUploading && (
          <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
          >
            <Camera className="w-4 h-4 mr-2" />
            {previewUrl ? 'Change Photo' : 'Upload Photo'}
          </Button>
          {previewUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isUploading}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">PNG or JPG, max 2MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
