'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import { useToast } from '@/components/UI/Toast';
import { API, useSend } from '@/core/api';
import { BulkEditBody, BulkResult, MassEditChange, RelateMode, Safety } from '@/core/types/posts';
import { CategoryInfo } from '@/core/types/tags';
import { TagChip } from '@/core/types/uploads';
import TagFields from './TagFields';
import SafetyPicker from './SafetyPicker';
import RelatedPicker from './RelatedPicker';
import { plural, reportBulk } from './shared';

const MAX_RELATED = 100; // backend MAX_RELATED_POSTS: related links per post

type Props = {
  postIds: number[];
  canCreateTags: boolean;
  onApplied: (change: MassEditChange) => void;
  onClose: () => void;
};

// Tags, safety and related posts, sent together as one PATCH /api/posts/bulk
export default function EditForm({ postIds, canCreateTags, onApplied, onClose }: Props) {
  const toast = useToast();
  const send = useSend();

  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  useEffect(() => {
    API('/api/tag-categories')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: CategoryInfo[]) => setCategories(new Map(list.map((c) => [c.id, c]))))
      .catch(() => {}); // implied tags just show uncolored
  }, []);
  const colorFor = (categoryId: number) => categories.get(categoryId)?.color;

  const [addTags, setAddTags] = useState<TagChip[]>([]);
  const [removeTags, setRemoveTags] = useState<TagChip[]>([]);
  const [safety, setSafety] = useState<Safety | null>(null);
  const [relateMode, setRelateMode] = useState<RelateMode>('none');
  const [relateTo, setRelateTo] = useState('');
  const [applying, setApplying] = useState(false);

  const clash = addTags.filter((a) => removeTags.some((r) => r.name === a.name)).map((t) => t.name);
  const relateId = /^\d+$/.test(relateTo.trim()) ? Number(relateTo.trim()) : null;
  const relateValid = relateMode !== 'one' || (relateId !== null && relateId > 0);
  const eachOtherTooMany = postIds.length > MAX_RELATED + 1;
  const hasChanges = addTags.length > 0 || removeTags.length > 0 || safety !== null || relateMode !== 'none';
  const canApply = hasChanges && clash.length === 0 && relateValid && !(relateMode === 'all' && eachOtherTooMany);

  const apply = async () => {
    const body: BulkEditBody = { postIds };
    if (addTags.length) body.addTags = addTags.map((t) => t.name);
    if (removeTags.length) body.removeTags = removeTags.map((t) => t.name);
    if (safety) body.safety = safety;
    if (relateMode === 'one' && relateId !== null) body.relateTo = relateId;
    if (relateMode === 'all') body.relateEachOther = true;

    setApplying(true);
    const result = await send<BulkResult>('/api/posts/bulk', 'PATCH', body);
    setApplying(false);
    if (!result) return;

    reportBulk(toast, 'Updated', result);
    if (result.updated.length) {
      onApplied({ edited: true });
      onClose();
    }
  };

  return (
    <div className="shrink-0 space-y-4">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TagFields
            addTags={addTags}
            removeTags={removeTags}
            onAddTags={setAddTags}
            onRemoveTags={setRemoveTags}
            colorFor={colorFor}
            canCreate={canCreateTags}
            clash={clash}
            disabled={applying}
          />
        </div>

        <div className="space-y-6">
          <SafetyPicker value={safety} onChange={setSafety} />
          <RelatedPicker
            mode={relateMode}
            onMode={setRelateMode}
            target={relateTo}
            onTarget={setRelateTo}
            maxEachOther={MAX_RELATED + 1}
            selectedCount={postIds.length}
          />
        </div>
      </div>

      {/* The divider closes off the Apply form, so the instant sections below read as separate */}
      <div className="flex justify-end border-b border-secondary-border pb-4">
        <Button variant="primary" size="lg" loading={applying} disabled={!canApply} onClick={apply}>
          Apply to {plural(postIds.length)}
        </Button>
      </div>
    </div>
  );
}
