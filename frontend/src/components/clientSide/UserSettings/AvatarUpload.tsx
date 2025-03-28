'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function AvatarUpload() {
  const currentAvatarUrl = '/user.png'; // Replace with real user image URL later
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatar(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow">
      <h2 className="text-xl font-semibold mb-4">Avatar</h2>

      {/* Avatar preview */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-muted border border-secondary">
          <Image
            src={preview || currentAvatarUrl}
            alt="Avatar Preview"
            width={96}
            height={96}
            className="object-cover w-full h-full"
          />
        </div>
        <div>
          <input type="file" accept="image/*" onChange={handleAvatarChange} className='text-zinc-100'/>
          <p className="text-subtle text-sm mt-1">Max size 5MB. JPG, PNG, WebP.</p>
        </div>
      </div>
    </section>
  );
}
