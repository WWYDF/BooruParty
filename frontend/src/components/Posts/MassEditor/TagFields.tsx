import TagInput from '@/components/Uploads/TagInput';
import { TagChip } from '@/core/types/uploads';
import Section from './Section';

type Props = {
  addTags: TagChip[];
  removeTags: TagChip[];
  onAddTags: (tags: TagChip[]) => void;
  onRemoveTags: (tags: TagChip[]) => void;
  colorFor: (categoryId: number) => string | undefined; // implied tags only come with a category id
  canCreate: boolean;
  clash: string[]; // names in both lists (the form won't apply while there are any)
  disabled: boolean;
};

export default function TagFields({ addTags, removeTags, onAddTags, onRemoveTags, colorFor, canCreate, clash, disabled }: Props) {
  return (
    <>
      <Section title="Add tags" hint="Picking a tag also adds what it implies. Remove any you don't want.">
        <TagInput
          value={addTags}
          onChange={onAddTags}
          placeholder="Tags to add..."
          withImplications
          colorFor={colorFor}
          allowNew={canCreate}
          disabled={disabled}
        />
        {addTags.some((t) => t.isNew) && (
          <p className="text-xs text-subtle">Dashed tags don't exist yet and will be created when you apply.</p>
        )}
      </Section>

      <Section title="Remove tags">
        <TagInput value={removeTags} onChange={onRemoveTags} placeholder="Tags to remove..." disabled={disabled} />
        {clash.length > 0 && <p className="text-xs text-red-400">In both lists: {clash.join(', ')}</p>}
      </Section>
    </>
  );
}
