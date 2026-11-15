'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ImportModal({ open, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/json': ['.json'],
      'application/zip': ['.zip'],
    },
  });

  const handleSubmit = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setStatus('uploading');

    const res = await fetch('/api/system/backup/import', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) setStatus('done');
    else setStatus('error');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-secondary-border rounded-xl p-6 w-full max-w-md text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">Import Backup</h2>

        <div
          {...getRootProps()}
          className={`w-full p-6 border-2 rounded-lg cursor-pointer transition ${
            isDragActive ? 'border-blue-400 bg-blue-900/30' : 'border-dashed border-zinc-500'
          }`}
        >
          <input {...getInputProps()} />
          <p className="text-subtle">
            {file
              ? `Selected: ${file.name}`
              : isDragActive
              ? 'Drop the file here...'
              : 'Drag & drop a .zip or .json file here, or click to select'}
          </p>
        </div>

        <button
          disabled={!file || status === 'uploading'}
          onClick={handleSubmit}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          {status === 'uploading' ? 'Importing...' : 'Import'}
        </button>

        {status === 'done' && <p className="mt-3 text-green-400">Import complete.</p>}
        {status === 'error' && <p className="mt-3 text-red-400">Import failed.</p>}
      </div>
    </div>
  );
}
