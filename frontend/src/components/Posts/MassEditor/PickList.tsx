import { CircleNotchIcon, MinusCircleIcon, PlusCircleIcon } from '@phosphor-icons/react';
import { inputClass } from './shared';

type Props<T extends { id: string | number; name: string }> = {
  items: T[] | null; // null = loading
  query: string;
  onQuery: (q: string) => void;
  placeholder: string;
  empty: string;
  meta: (item: T) => React.ReactNode;
  busy: { id: T['id']; action: 'add' | 'remove' } | null; // the request running right now (one at a time)
  onAdd: (item: T) => void;
  onRemove: (item: T) => void;
};

// Searchable list (collections, pools) with add/remove buttons per row. Fills the height its section gets.
export default function PickList<T extends { id: string | number; name: string }>({
  items, query, onQuery, placeholder, empty, meta, busy, onAdd, onRemove,
}: Props<T>) {
  const iconButton = 'shrink-0 cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        className={`w-full shrink-0 ${inputClass}`}
      />
      {/* min-h-48: still usable when the modal is short (phones), where the whole body scrolls instead */}
      <div className="min-h-48 flex-1 overflow-y-auto rounded-lg border border-secondary-border">
        {items === null ? (
          <p className="px-3 py-2 text-sm text-subtle">Loading...</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 text-sm text-subtle">{empty}</p>
        ) : (
          items.map((item) => {
            const running = busy?.id === item.id ? busy.action : null;
            return (
              <div key={item.id} className="flex items-center gap-1 border-b border-secondary-border px-3 py-1.5 last:border-b-0">
                <span className="truncate text-sm text-white pr-1">{item.name}</span>
                <span className="shrink-0 text-xs text-subtle">({meta(item)})</span>

                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  disabled={busy !== null}
                  aria-label={`Remove from ${item.name}`}
                  title={`Remove from ${item.name}`}
                  className={`ml-auto text-zinc-700 hover:text-red-500 ${iconButton}`}
                >
                  {running === 'remove'
                    ? <CircleNotchIcon size={22} className="animate-spin" />
                    : <MinusCircleIcon size={22} weight="fill" />}
                </button>
                <button
                  type="button"
                  onClick={() => onAdd(item)}
                  disabled={busy !== null}
                  aria-label={`Add to ${item.name}`}
                  title={`Add to ${item.name}`}
                  className={`text-zinc-600 hover:text-green-500 ${iconButton}`}
                >
                  {running === 'add'
                    ? <CircleNotchIcon size={22} className="animate-spin" />
                    : <PlusCircleIcon size={22} weight="fill" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
