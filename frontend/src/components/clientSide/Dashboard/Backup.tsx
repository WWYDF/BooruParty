'use client';

import { useState } from 'react';
import ConfirmModal from '../ConfirmModal';
import ImportModal from './ImportModal';
import FadeIn from '../Motion/FadeIn';

export default function DatabaseBackup() {
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleExport = async () => {
    try {
      const res = await fetch('/api/system/backup/export');
      const blob = await res.blob();
  
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'booru_backup.zip';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert('Export failed.');
    }
  };

  return (
    <FadeIn>
      <div className="bg-secondary border border-secondary-border p-6 rounded-2xl shadow w-full">
        <h2 className="text-xl font-semibold mb-4">Database Management</h2>

        <div className="flex gap-4">
          <button
            onClick={() => setShowExportConfirm(true)}
            className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700"
          >
            📦 Export Backup
          </button>

          <button
            onClick={() => setShowImportConfirm(true)}
            className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700"
          >
            📥 Import Backup
          </button>
        </div>

        {/* Export Confirm */}
        {showExportConfirm && (
          <ConfirmModal
            open
            onClose={() => setShowExportConfirm(false)}
            onConfirm={() => {
              setShowExportConfirm(false);
              handleExport();
            }}
            title="Export Database"
            description={`This will generate a full JSON backup of your database.\n\nThis may contain sensitive information such as user emails and hashed passwords. Store it securely.`}
            confirmText="Download"
            maxWidth='max-w-lg'
          />
        )}

        {/* Import Confirm */}
        {showImportConfirm && (
          <ConfirmModal
            open
            onClose={() => setShowImportConfirm(false)}
            onConfirm={() => {
              setShowImportConfirm(false);
              setShowImportModal(true);
            }}
            title="Clear & Re-Import Database"
            description={`This will wipe ALL existing data and replace it with the backup.\nWe recommend additionally making a manual backup with pg_dump.\n\nProceed with caution.`}
            confirmText="Continue"
            maxWidth='max-w-xl'
          />
        )}

        {/* Import Modal */}
        <ImportModal open={showImportModal} onClose={() => setShowImportModal(false)} />
      </div>
    </FadeIn>
  );
}