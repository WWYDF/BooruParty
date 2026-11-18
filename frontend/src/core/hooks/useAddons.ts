'use client';

import { useEffect, useState } from 'react';
import { API } from '@/core/api';
import { AddonsState } from '@/core/types/addons';

// The server's addon switches (GET /api/system/addons).
// null while loading, or if the request failed: treat that as "everything off".
export function useAddons(): AddonsState | null {
  const [addons, setAddons] = useState<AddonsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    API('/api/system/addons')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setAddons(data); })
      .catch(() => {}); // addons just stay hidden
    return () => { cancelled = true; };
  }, []);

  return addons;
}

// Is the AutoTagger on, in this mode?
export const autoTaggerHas = (addons: AddonsState | null, mode: AddonsState['autoTaggerMode'][number]) =>
  !!addons?.enableAutoTagger && addons.autoTaggerMode.includes(mode);
