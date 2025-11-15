'use client';

import { useState } from 'react';
import ConfirmModal from '../ConfirmModal';
import ImportModal from './ImportModal';
import FadeIn from '../Motion/FadeIn';
import { ArrowsClockwise } from 'phosphor-react';

export default function PermissionSync() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<any | null>(null);


  const handleSync = async () => {
  try {
    const res = await fetch('/api/system/update', { method: 'GET' });
    if (!res.ok) { throw new Error(`Request failed with status ${res.status}`) }

    const data = await res.json();
    setResult(data);

  } catch (err) {
    console.error('[PermissionSync] Sync error:', err);
  }
};

  return (
    <FadeIn>
      <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
        <h2 className="text-xl font-semibold mb-4">Sync Permissions</h2>

        <div className="flex gap-4">
          <button
            onClick={() => setShowConfirm(true)}
            className="flex gap-2 items-center transition bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700"
          >
            <ArrowsClockwise /> Start Sync
          </button>
        </div>

        {/* Export Confirm */}
        {showConfirm && (
          <ConfirmModal
            open
            onClose={() => setShowConfirm(false)}
            onConfirm={() => {
              setShowConfirm(false);
              handleSync();
            }}
            title="Sync Permissions"
            description={`This will add missing permissions to your permissions table.\nAny leftover or extra permissions will have to be removed manually from within Prisma Studio.`}
            confirmText="Continue"
            maxWidth='max-w-lg'
          />
        )}

        {result && (
          <div className="text-sm text-subtle mt-3">
            Permissions Synced! 
            <span className="text-emerald-400"> Added: {result.added_permissions.length}</span>, 
            <span className="text-amber-400"> Extras: {result.extra_permissions.length}</span>
          </div>
        )}
      </div>
    </FadeIn>
  );
}