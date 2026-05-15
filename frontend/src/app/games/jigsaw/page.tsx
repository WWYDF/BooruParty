'use client';

import { Suspense, use, useEffect, useState, useCallback, useMemo } from 'react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, arraySwap } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowsClockwise as ArrowsClockwiseIcon, Shuffle as ShuffleIcon, Play as PlayIcon, Pause as PauseIcon, Confetti as ConfettiIcon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';

type Post = {
  id: number;
  fileExt: string;
  originalPath: string;
  previewPath: string;
  aspectRatio?: number;
  anonymous: boolean;
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE';
  sources: string[];
  notes: string;
  flags: string[];
  previewScale: number;
  fileSize?: number;
  previewSize?: number;
  duration: number | null;
  hasAudio: boolean | null;
  pHash: string;
  score: number;
  uploadedById: string;
  createdAt: string;
};

type PuzzlePiece = {
  id: string;
  correctIndex: number;
  currentIndex: number;
};

const FILTER_VAGUE_KEY = 'jigsaw-filter-vague';
const GRID_SIZE_KEY = 'jigsaw-grid-size';

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateGridDimensions(difficulty: number, aspectRatio: number): { cols: number; rows: number } {
  // difficulty is now a multiplier (2-12)
  // We want the smaller dimension to be approximately equal to difficulty
  // And maintain the aspect ratio
  
  if (aspectRatio >= 1) {
    // Landscape or square: rows = difficulty, cols = rows * aspectRatio
    const rows = difficulty;
    const cols = Math.round(rows * aspectRatio);
    return { cols, rows };
  } else {
    // Portrait: cols = difficulty, rows = cols / aspectRatio
    const cols = difficulty;
    const rows = Math.round(cols / aspectRatio);
    return { cols, rows };
  }
}

function SortablePuzzlePiece({ 
  piece, 
  imageUrl, 
  cols,
  rows,
  totalPieces,
  activeId,
  overId,
  selectedPieceId,
  isMobile,
  onTap
}: { 
  piece: PuzzlePiece; 
  imageUrl: string; 
  cols: number;
  rows: number;
  totalPieces: number;
  activeId: string | null;
  overId: string | null;
  selectedPieceId: string | null;
  isMobile: boolean;
  onTap: (pieceId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useSortable({ 
    id: piece.id,
    animateLayoutChanges: () => false
  });

  const isActive = piece.id === activeId;
  const isOver = piece.id === overId;
  const isSelected = piece.id === selectedPieceId;

  const row = Math.floor(piece.correctIndex / cols);
  const col = piece.correctIndex % cols;
  const backgroundPositionX = cols > 1 ? (col / (cols - 1)) * 100 : 50;
  const backgroundPositionY = rows > 1 ? (row / (rows - 1)) * 100 : 50;

  const handleClick = () => {
    if (isMobile) {
      onTap(piece.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...(isMobile ? {} : attributes)}
      {...(isMobile ? {} : listeners)}
      onClick={handleClick}
      className={`aspect-square border rounded-sm overflow-hidden ${
        isMobile ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${
        isActive ? 'opacity-0 border-zinc-700' : 
        isSelected ? 'border-blue-500 border-2 ring-2 ring-blue-500/50' :
        isOver ? 'border-yellow-500 border-2 ring-2 ring-yellow-500/50' : 
        'border-zinc-700'
      }`}
    >
      <div
        className="w-full h-full"
        style={{
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
        }}
      />
    </div>
  );
}

function PuzzleGrid({ post, gridSize, onGridSizeChange, filterVague, onToggleFilterVague }: { post: Post; gridSize: number; onGridSizeChange: (size: number) => void; filterVague: boolean; onToggleFilterVague: () => void }) {
  const imageUrl = post.previewPath || post.originalPath;
  
  // Calculate grid dimensions based on aspect ratio
  const aspectRatio = post.aspectRatio || 1;
  const { cols, rows } = calculateGridDimensions(gridSize, aspectRatio);
  const totalPieces = cols * rows;
  
  // Determine max width based on aspect ratio to avoid vertical scrolling
  // Only shrink for tall images (portrait), wide images can stay large
  const getMaxWidthClass = () => {
    if (aspectRatio < 0.5) return 'max-w-xl';   // Very tall portrait
    if (aspectRatio < 0.75) return 'max-w-2xl'; // Tall portrait
    if (aspectRatio < 0.9) return 'max-w-3xl';  // Slightly tall
    return 'max-w-4xl'; // Square or landscape - full size
  };
  const maxWidthClass = getMaxWidthClass();
  const router = useRouter();
  
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isSolved, setIsSolved] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Save grid size to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(GRID_SIZE_KEY, String(gridSize));
  }, [gridSize]);

  // Initialize puzzle
  useEffect(() => {
    const initialPieces: PuzzlePiece[] = Array.from({ length: totalPieces }, (_, i) => ({
      id: `piece-${i}`,
      correctIndex: i,
      currentIndex: i,
    }));

    // Always scramble the puzzle
    const shuffled = shuffleArray(initialPieces);
    setPieces(shuffled.map((piece, idx) => ({ ...piece, currentIndex: idx })));

    setTimerSeconds(0);
    setIsTimerRunning(false);
    setHasStarted(false);
    setIsSolved(false);
  }, [totalPieces, post.id]);

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning) return;
    
    const interval = setInterval(() => {
      setTimerSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Check if solved
  useEffect(() => {
    if (pieces.length === 0) return;
    
    const solved = pieces.every((piece, idx) => piece.correctIndex === idx);
    
    if (solved && hasStarted && !isSolved) {
      setIsSolved(true);
      setIsTimerRunning(false);
      
      // Confetti celebration
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min;
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        });
      }, 250);
    }
  }, [pieces, hasStarted, isSolved]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    
    if (!hasStarted) {
      setHasStarted(true);
      setIsTimerRunning(true);
    }
  };

  const handleDragOver = (event: any) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    setPieces((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);

      // Use arraySwap for clean swap behavior
      const newItems = arraySwap(items, oldIndex, newIndex);

      return newItems.map((item, idx) => ({ ...item, currentIndex: idx }));
    });
  };

  const handleScramble = () => {
    const shuffled = shuffleArray(pieces);
    setPieces(shuffled.map((piece, idx) => ({ ...piece, currentIndex: idx })));
    setTimerSeconds(0);
    setIsTimerRunning(false);
    setHasStarted(false);
    setIsSolved(false);
    setSelectedPieceId(null);
  };

  const handlePieceTap = (pieceId: string) => {
    if (!isMobile) return;

    if (!hasStarted) {
      setHasStarted(true);
      setIsTimerRunning(true);
    }

    if (selectedPieceId === null) {
      // First tap - select the piece
      setSelectedPieceId(pieceId);
    } else if (selectedPieceId === pieceId) {
      // Tapped the same piece - deselect
      setSelectedPieceId(null);
    } else {
      // Second tap - swap pieces
      setPieces((items) => {
        const oldIndex = items.findIndex((item) => item.id === selectedPieceId);
        const newIndex = items.findIndex((item) => item.id === pieceId);
        const newItems = arraySwap(items, oldIndex, newIndex);
        return newItems.map((item, idx) => ({ ...item, currentIndex: idx }));
      });
      setSelectedPieceId(null);
    }
  };

  const activePiece = useMemo(
    () => pieces.find((piece) => piece.id === activeId),
    [activeId, pieces]
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6 min-h-screen bg-zinc-950 text-zinc-100">
      {/* Puzzle Grid - First on mobile, second on desktop */}
      <div className="flex-1 flex items-start justify-center order-1 md:order-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div 
            className={`grid gap-1 w-full ${maxWidthClass}`}
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              aspectRatio: `${cols}/${rows}`,
            }}
          >
            <SortableContext items={pieces.map(p => p.id)}>
              {pieces.map((piece) => (
                <SortablePuzzlePiece
                  key={piece.id}
                  piece={piece}
                  imageUrl={imageUrl}
                  cols={cols}
                  rows={rows}
                  totalPieces={totalPieces}
                  activeId={activeId}
                  overId={overId}
                  selectedPieceId={selectedPieceId}
                  isMobile={isMobile}
                  onTap={handlePieceTap}
                />
              ))}
            </SortableContext>
          </div>

          {!isMobile && (
            <DragOverlay>
              {activeId && activePiece ? (
                <div className="aspect-square border-2 border-zinc-400 rounded-sm overflow-hidden shadow-2xl">
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: `${cols * 100}% ${rows * 100}%`,
                      backgroundPosition: `${((activePiece.correctIndex % cols) / (cols > 1 ? cols - 1 : 1)) * 100}% ${(Math.floor(activePiece.correctIndex / cols) / (rows > 1 ? rows - 1 : 1)) * 100}%`,
                    }}
                  />
                </div>
              ) : null}
            </DragOverlay>
          )}
        </DndContext>
      </div>

      {/* Sidebar - Second on mobile, first on desktop */}
      <div className="w-full md:w-64 flex-shrink-0 space-y-4 md:space-y-6 order-2 md:order-1">
        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Settings</h2>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-zinc-400 mb-2 block">
                Grid Size: {cols}x{rows} ({totalPieces} pieces)
              </label>
              <input
                type="range"
                min="2"
                max={isMobile ? "6" : "12"}
                value={gridSize}
                onChange={(e) => onGridSizeChange(Number(e.target.value))}
                disabled={hasStarted}
                className="w-full accent-accent disabled:opacity-50"
              />
              {hasStarted && (
                <p className="text-xs text-zinc-500 mt-1">Locked during play</p>
              )}
            </div>

            <button
              onClick={() => {
                // Remove postId from URL if present
                const url = new URL(window.location.href);
                url.searchParams.delete('postId');
                window.location.href = url.toString();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ArrowsClockwiseIcon size={18} />
              New Image
            </button>

            <button
              onClick={handleScramble}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <ShuffleIcon size={18} />
              Scramble
            </button>

            <button
              onClick={onToggleFilterVague}
              className={`w-full px-4 py-2 rounded-lg transition-colors ${
                filterVague 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              Remove Vagues: {filterVague ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800">
          <h2 className="text-lg font-semibold mb-4">Timer</h2>
          <div className="text-4xl font-mono text-center mb-4">
            {formatTime(timerSeconds)}
          </div>
          {isSolved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center text-emerald-400 font-semibold"
            >
              Solved!
            </motion.div>
          )}
        </div>

        <div className="bg-zinc-900 rounded-lg p-4 border border-zinc-800 hidden md:block">
          <h2 className="text-sm font-semibold mb-2 text-zinc-400">Preview</h2>
          <img
            src={imageUrl}
            alt="Puzzle preview"
            title={`Click to open post`}
            onClick={() => router.push(`/post/${post.id}`)}
            className="w-full rounded-lg border border-zinc-700 opacity-30 hover:opacity-100 transition-opacity hover:cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

function PuzzleContent({ gridSize, setGridSize }: { gridSize: number; setGridSize: (size: number) => void }) {
  const [post, setPost] = useState<Post | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterVague, setFilterVague] = useState(false);

  // Load filter preference
  useEffect(() => {
    const stored = localStorage.getItem(FILTER_VAGUE_KEY);
    if (stored !== null) {
      setFilterVague(stored === 'true');
    }
  }, []);

  const toggleFilterVague = () => {
    const newValue = !filterVague;
    localStorage.setItem(FILTER_VAGUE_KEY, String(newValue));
    // Reload the page to fetch a new image with the updated filter
    window.location.reload();
  };

  useEffect(() => {
    // Check for postId in URL params
    const params = new URLSearchParams(window.location.search);
    const postId = params.get('postId');
    
    const url = postId 
      ? `/api/posts/${postId}`
      : `/api/posts/random?type=image${filterVague ? '&removeVague=true' : ''}`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setPost(data.post);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch post:', err);
        setIsLoading(false);
      });
  }, [filterVague]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-xl">Loading puzzle...</div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-xl">Failed to load image</div>
      </div>
    );
  }

  return <PuzzleGrid post={post} gridSize={gridSize} onGridSizeChange={setGridSize} filterVague={filterVague} onToggleFilterVague={toggleFilterVague} />;
}

export default function JigsawPuzzlePage() {
  const [gridSize, setGridSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('jigsaw-grid-size');
      if (saved) {
        const size = Number(saved);
        // Validate the saved size is within bounds
        if (size >= 2 && size <= 12) {
          return size;
        }
      }
    }
    return 4; // default size
  });

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-xl">Loading puzzle...</div>
      </div>
    }>
      <PuzzleContent gridSize={gridSize} setGridSize={setGridSize} />
    </Suspense>
  );
}