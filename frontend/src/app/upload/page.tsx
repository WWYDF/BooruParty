'use client'

import { useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { BroomIcon, CheckSquareIcon, SquareIcon, UploadSimpleIcon } from '@phosphor-icons/react'
import Button from '@/components/UI/Button'
import Checkbox from '@/components/UI/Checkbox'
import { autoTaggerHas, useAddons } from '@/core/hooks/useAddons'
import UploadCard from '@/components/Uploads/UploadCard'
import UploadEditor from '@/components/Uploads/UploadEditor'
import TagInput from '@/components/Uploads/TagInput'
import DuplicateModal from '@/components/Uploads/DuplicateModal'
import { CreateTagModal } from '@/components/Tags/CreateModal'
import { CategoryInfo } from '@/core/types/tags'
import { TagChip, UploadItem, UploadStatus, isEditable, parseSources } from '@/core/types/uploads'
import { useToast } from '@/components/UI/Toast'
import { useUser } from '@/components/UserProvider'
import { API, APIUpload, errorText } from '@/core/api'
import { makeLocalThumbnail } from '@/core/thumbnails'
import { PostDetail } from '@/core/types/posts'

export default function UploadPage() {
  const { user } = useUser()
  const toast = useToast()

  const [items, setItems] = useState<UploadItem[]>([])
  const itemsRef = useRef<UploadItem[]>([]) // latest items for async loops (state in closures goes stale)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClicked = useRef<string | null>(null) // anchor for shift-click ranges
  const [globalTags, setGlobalTags] = useState<TagChip[]>([])
  const [uploading, setUploading] = useState(false)
  const [dupe, setDupe] = useState<{ item: UploadItem; original: PostDetail } | null>(null)
  const idCounter = useRef(0)
  const addons = useAddons()
  const [autoTag, setAutoTag] = useState(false) // SELECTIVE mode: the uploader's opt-in

  // "Add new tag" opens a category picker; the tag box awaits the result
  const [categories, setCategories] = useState<(CategoryInfo & { isDefault: boolean })[]>([])
  const [newTagName, setNewTagName] = useState<string | null>(null)
  const newTagResolve = useRef<((tag: TagChip | null) => void) | null>(null)

  useEffect(() => { itemsRef.current = items }, [items])

  useEffect(() => {
    API('/api/tag-categories')
      .then((res) => (res.ok ? res.json() : []))
      .then(setCategories)
      .catch(() => {}) // without categories the modal falls back to the server's default
  }, [])

  const requestNewTag = (name: string) =>
    new Promise<TagChip | null>((resolve) => {
      newTagResolve.current?.(null) // only one modal at a time
      newTagResolve.current = resolve
      setNewTagName(name)
    })

  // Called with the tag on create, then with null on close; only the first call counts
  const finishNewTag = (tag: TagChip | null) => {
    newTagResolve.current?.(tag)
    newTagResolve.current = null
    setNewTagName(null)
  }

  // Free thumbnail object URLs when leaving the page
  useEffect(() => () => {
    itemsRef.current.forEach((i) => i.thumbnail && URL.revokeObjectURL(i.thumbnail))
  }, [])

  // Closing the tab mid-upload would silently drop the rest of the queue
  useEffect(() => {
    if (!uploading) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false
  const canDupe = hasPerm('posts.create.dupes')
  const canCreateTags = hasPerm('tags.create')
  // AGGRESSIVE tags every image anyway, so the opt-in only shows when it would change something
  const autoTagsAlways = autoTaggerHas(addons, 'AGGRESSIVE')
  const canChooseAutoTag = !autoTagsAlways && autoTaggerHas(addons, 'SELECTIVE') && hasPerm('posts.autotag')

  // Only unsent files can be picked for editing, and nothing while the queue runs
  const canSelect = (item: UploadItem) => !uploading && isEditable(item)

  const patchItems = (ids: Iterable<string>, patch: (item: UploadItem) => Partial<UploadItem>) => {
    const set = new Set(ids)
    setItems((prev) => prev.map((i) => (set.has(i.id) ? { ...i, ...patch(i) } : i)))
  }

  const setStatus = (id: string, status: UploadStatus) => patchItems([id], () => ({ status }))

  const removeItems = (ids: Iterable<string>) => {
    const set = new Set(ids)
    itemsRef.current.forEach((i) => set.has(i.id) && i.thumbnail && URL.revokeObjectURL(i.thumbnail))
    setItems((prev) => prev.filter((i) => !set.has(i.id)))
    setSelected((prev) => new Set([...prev].filter((id) => !set.has(id))))
  }

  const onDrop = async (files: File[]) => {
    // Some formats (e.g. .mkv on Windows) have no MIME type; let the server decide those
    const newItems: UploadItem[] = files
      .filter((f) => f.type === '' || f.type.startsWith('image/') || f.type.startsWith('video/'))
      .map((file) => ({
        id: String(idCounter.current++),
        file,
        thumbnail: null,
        thumbnailFailed: false,
        safety: 'SAFE',
        tags: [],
        sourcesText: '',
        notes: '',
        status: { state: 'queued' },
      }))

    if (newItems.length < files.length) toast(`Skipped ${files.length - newItems.length} non-media file(s)`, 'info')
    setItems((prev) => [...prev, ...newItems])

    // One at a time, so dropping 100 files doesn't decode 100 images at once
    for (const item of newItems) {
      const thumbnail = await makeLocalThumbnail(item.file)
      patchItems([item.id], () => ({ thumbnail, thumbnailFailed: !thumbnail }))
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: true })

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClicked.current) {
      const ids = items.map((i) => i.id)
      const [a, b] = [ids.indexOf(lastClicked.current), ids.indexOf(id)].sort((x, y) => x - y)
      const range = items.slice(a, b + 1).filter(canSelect).map((i) => i.id) // skip sent files in between
      setSelected((prev) => new Set([...prev, ...range]))
    } else if (e.ctrlKey || e.metaKey) {
      toggleOne(id)
    } else {
      // Plain click: select just this one (or deselect it if it was the only one)
      setSelected((prev) => (prev.size === 1 && prev.has(id) ? new Set() : new Set([id])))
    }
    lastClicked.current = id
  }

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    lastClicked.current = id
  }

  // One POST /api/posts/create. The backend only reads fields sent BEFORE the file, so the file goes last.
  const uploadItem = async (item: UploadItem, skipDupes: boolean) => {
    const tags = [...new Set([...globalTags, ...item.tags].map((t) => t.name))]
    const { valid: sources, invalid } = parseSources(item.sourcesText)
    if (invalid.length) {
      setStatus(item.id, { state: 'error', message: `Invalid source URL: ${invalid[0]}` })
      return
    }

    const form = new FormData()
    form.append('safety', item.safety)
    form.append('tags', JSON.stringify(tags))
    if (sources.length) form.append('sources', JSON.stringify(sources))
    if (item.notes.trim()) form.append('notes', item.notes.trim())
    if (skipDupes) form.append('skipDupes', 'true')
    if (canChooseAutoTag && autoTag) form.append('autoTag', 'true')
    form.append('file', item.file) // must be last

    setStatus(item.id, { state: 'uploading', progress: 0 })
    try {
      const res = await APIUpload('/api/posts/create', form, (fraction) =>
        setStatus(item.id, fraction < 1 ? { state: 'uploading', progress: fraction } : { state: 'processing' }),
      )

      if (res.status === 201) setStatus(item.id, { state: 'done', postId: res.data.id })
      else if (res.status === 409 && typeof res.data.duplicateOf === 'number') setStatus(item.id, { state: 'duplicate', postId: res.data.duplicateOf })
      else setStatus(item.id, { state: 'error', message: errorText(res.data) })
    } catch {
      setStatus(item.id, { state: 'error', message: 'Could not reach the server' })
    }
  }

  // Uploads one file at a time (processing is CPU heavy on the server). Duplicates and errors don't stop the queue.
  const runQueue = async (skipDupes = false) => {
    if (uploading) return
    setUploading(true)
    setSelected(new Set()) // editing is locked while the queue runs; the active file gets the outline instead

    const targetIds = itemsRef.current
      .filter((i) => i.status.state === 'queued' || i.status.state === 'error' || (skipDupes && i.status.state === 'duplicate'))
      .map((i) => i.id)

    for (const id of targetIds) {
      const current = itemsRef.current.find((i) => i.id === id) // picks up edits made while earlier files uploaded
      if (current && isEditable(current)) await uploadItem(current, skipDupes)
    }

    setUploading(false)
  }

  const reviewDuplicate = async (item: UploadItem) => {
    if (item.status.state !== 'duplicate') return
    try {
      const res = await API(`/api/posts/${item.status.postId}`)
      if (!res.ok) throw new Error()
      setDupe({ item, original: await res.json() })
    } catch {
      // The original might be hidden from us (e.g. safety settings); the card still links to it
      toast(`Couldn't load post #${item.status.postId} for comparison`, 'error')
    }
  }

  const proceedWithDuplicate = async (copyTags: boolean) => {
    if (!dupe) return
    const { item, original } = dupe
    setDupe(null)

    const tags = copyTags
      ? [...item.tags, ...original.tags.filter((t) => !item.tags.some((x) => x.name === t.name)).map((t) => ({ name: t.name }))]
      : item.tags

    setUploading(true)
    setSelected(new Set())
    await uploadItem({ ...item, tags }, true)
    setUploading(false)
  }

  const selectedItems = items.filter((i) => selected.has(i.id) && isEditable(i)) // isEditable: belt and braces, selection should only hold these
  const count = (state: UploadStatus['state']) => items.filter((i) => i.status.state === state).length
  const pending = count('queued') + count('error')
  const done = count('done')
  const duplicates = count('duplicate')
  const failed = count('error')

  // Permission gates
  if (user === undefined) return null // still loading /api/me

  if (!user || !hasPerm('posts.create')) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Unauthorized</h1>
        <p className="text-base text-subtle max-w-md">
          {user
            ? 'Sorry, but you are not allowed to create posts.'
            : <>Please <a className="text-accent hover:underline" href="/auth/login">log in</a> to upload.</>}
        </p>
      </main>
    )
  }

  // The API refuses uploads from private accounts (their posts would be hidden from everyone)
  if (user.private) {
    return (
      <main className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-3xl font-bold mb-2 text-yellow-400">Your account is private</h1>
        <p className="text-base text-subtle max-w-md">
          Private accounts can't upload new posts, since nobody else would be able to see them.
          Turn off private mode in your <a className="text-accent hover:underline" href={`/account`}>account settings</a> to start posting.
        </p>
      </main>
    )
  }

  return (
    <div className="mx-auto space-y-4 p-4 md:p-8">
      {/* Drop zone: big when empty, compact once files are added */}
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center transition ${
          items.length ? 'p-4' : 'p-16'
        } ${isDragActive ? 'border-accent bg-secondary' : 'border-secondary-border bg-secondary hover:border-zinc-600'}`}
      >
        <input {...getInputProps()} />
        {!items.length && <UploadSimpleIcon size={36} className="text-subtle" />}
        <p className="text-subtle">
          {isDragActive ? 'Drop to add' : 'Drag and drop images, videos or GIFs here, or click to browse'}
        </p>
      </div>

      {items.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => runQueue()}
              disabled={uploading || pending === 0}
              className="rounded-lg cursor-pointer border-2 border-green-800 px-4 py-1.5 text-sm text-zinc-200 transition hover:bg-green-800/30 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : `Upload ${pending} file${pending === 1 ? '' : 's'}`}
            </button>

            {canDupe && duplicates > 0 && (
              <button
                onClick={() => runQueue(true)}
                disabled={uploading}
                className="rounded-lg border-2 border-red-800 px-4 py-1.5 text-sm text-zinc-200 transition hover:bg-red-800/30 disabled:opacity-50"
              >
                Force {duplicates} duplicate{duplicates === 1 ? '' : 's'}
              </button>
            )}

            <span className="mx-1 h-5 w-px bg-secondary-border" />

            <Button
              icon={<CheckSquareIcon size={14} />}
              onClick={() => setSelected(new Set(items.filter(canSelect).map((i) => i.id)))}
              disabled={uploading}
            >
              Select all
            </Button>
            <Button icon={<SquareIcon size={14} />} onClick={() => setSelected(new Set())} disabled={uploading}>
              Select none
            </Button>
            {done > 0 && (
              <Button
                icon={<BroomIcon size={14} />}
                onClick={() => removeItems(items.filter((i) => i.status.state === 'done').map((i) => i.id))}
              >
                Clear finished
              </Button>
            )}

            {canChooseAutoTag && (
              <>
                <span className="mx-1 h-5 w-px bg-secondary-border" />
                <Checkbox
                  checked={autoTag}
                  onChange={setAutoTag}
                  disabled={uploading}
                  label="AutoTag images"
                  title="Adds the existing tags the AutoTagger finds in each image (videos are skipped)"
                />
              </>
            )}
            {autoTagsAlways && (
              <span className="text-xs text-subtle" title="Set by the site's admins">
                Images are auto-tagged on upload
              </span>
            )}

            <span className="ml-auto text-xs text-subtle">
              {items.length} file{items.length === 1 ? '' : 's'}
              {done > 0 && <> · <span className="text-green-400">{done} done</span></>}
              {duplicates > 0 && <> · <span className="text-yellow-300">{duplicates} duplicate{duplicates === 1 ? '' : 's'}</span></>}
              {failed > 0 && <> · <span className="text-red-400">{failed} failed</span></>}
            </span>
          </div>

          {/* Tags for every file */}
          <div>
            <label className="mb-1.5 block text-xs text-subtle">Tags for every file</label>
            <TagInput
              value={globalTags}
              onChange={setGlobalTags}
              placeholder="Added to all files on upload..."
              allowNew={canCreateTags}
              onCreateNew={requestNewTag}
              disabled={uploading}
            />
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
            {/* Grid */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              {items.map((item) => (
                <UploadCard
                  key={item.id}
                  item={item}
                  selected={
                    uploading
                      ? item.status.state === 'uploading' || item.status.state === 'processing' // the file being sent right now
                      : selected.has(item.id)
                  }
                  selectable={canSelect(item)}
                  onClick={(e) => handleCardClick(item.id, e)}
                  onToggle={() => toggleOne(item.id)}
                  onReview={() => reviewDuplicate(item)}
                />
              ))}
            </div>

            {/* Editor panel */}
            <aside className="lg:sticky lg:top-24">
              <UploadEditor
                items={selectedItems}
                uploading={uploading}
                onPatch={(patch) => patchItems(selectedItems.map((i) => i.id), patch)}
                onRemove={() => removeItems(selectedItems.map((i) => i.id))}
                onCreateTag={canCreateTags ? requestNewTag : undefined}
              />
            </aside>
          </div>
        </>
      )}

      {dupe && (
        <DuplicateModal
          isOpen
          onClose={() => setDupe(null)}
          currentPreview={dupe.item.thumbnail ?? ''}
          originalPost={dupe.original}
          onCancelUpload={() => { removeItems([dupe.item.id]); setDupe(null) }}
          onProceedAnyway={proceedWithDuplicate}
          canDupe={canDupe}
        />
      )}

      <CreateTagModal
        open={newTagName !== null}
        initialName={newTagName ?? ''}
        categories={categories}
        onCreated={(tag) => finishNewTag({ name: tag.name, color: tag.category.color })}
        onClose={() => finishNewTag(null)}
      />
    </div>
  )
}
