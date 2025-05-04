'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { getCurrentUser } from '@/components/serverSide/Users/getCurrentUser';
import { useToast } from '../Toast';

export default function AvatarUpload({ username }: { username: string }) {
  const [current, setCurrent] = useState('/user.png');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const toast = useToast();

  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
  
        setCurrent(user.avatar || '/user.png');
  
        const perms = user.role?.permissions?.map((p: any) => p.name) || [];
  
        if (perms.includes("profile_edit_avatar") || perms.includes("administrator")) {
          setCanEdit(true);
        }
      } catch {
        setStatus('Could not load avatar');
      }
    })();
  }, []);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  const uploadAvatar = async () => {
    if (!file) return;
    if (!canEdit) { toast('You do not have permission to change your avatar.', 'error'); return; }

    toast('Uploading...');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      const res = await fetch(`/api/users/${username}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: buffer,
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.url) {
        throw new Error(data.error || 'Upload failed');
      }

      // await updateUser({ avatar: data.url });

      const cacheBusted = `${data.url}?t=${Date.now()}`;
      setCurrent(cacheBusted);

      setCurrent(data.url);
      setPreview(null);
      setFile(null);
      toast('Avatar Updated!', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast(err.message || 'Error uploading avatar', 'error');
    }
  }; 

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow">
      <h2 className="text-xl font-semibold mb-4">Avatar</h2>
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border border-secondary-border">
          <Image
            src={preview || current}
            alt="Avatar Preview"
            width={96}
            height={96}
            className="object-cover w-full h-full"
            unoptimized
          />
        </div>
        <div>
          <input type="file" accept="image/*" onChange={handleAvatarChange} className="text-transparent" />
          <p className="text-subtle text-sm mt-1">Max 5MB. JPG/PNG/WebP.</p>
        </div>
      </div>

      <button
        onClick={uploadAvatar}
        className="bg-darkerAccent hover:bg-darkerAccent/80 transition text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={!file}
      >
        Upload Avatar
      </button>
      <p className="text-sm text-subtle mt-2">{status}</p>
    </section>
  );
}
