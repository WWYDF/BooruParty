import SearchBar from "@/components/clientSide/Posts/SearchBar";
import Filters from "@/components/clientSide/Posts/Filters";
import MassSelectionBar from "./MassSelectBar";
import { motion } from "framer-motion";

export default function PostToolbar({
  searchText,
  setSearchText,
  selectedSafeties,
  toggleSafety,
  searchPosts,
  selectionMode,
  selectedPostIds,
  setSelectionMode,
  setSelectedPostIds,
  setModalOpen,
}: {
  searchText: string;
  setSearchText: (v: string) => void;
  selectedSafeties: string[];
  toggleSafety: (safety: string) => void;
  searchPosts: (queryOverride?: string) => void;
  selectionMode: boolean;
  selectedPostIds: number[];
  setSelectionMode: (v: boolean) => void;
  setSelectedPostIds: (v: number[]) => void;
  setModalOpen: (v: boolean) => void;
}) {
  return (
    <motion.div
      className="sticky top-0 md:top-16.5 z-40 bg-black"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <section className="flex flex-wrap md:flex-nowrap items-stretch gap-2 sm:gap-3 px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex-grow">
          <SearchBar
            input={searchText}
            setInput={setSearchText}
            onSubmit={(query) => {
              const clean = query ?? "";
              setSearchText(clean);
              searchPosts(clean);
            }}
          />
        </div>
        <Filters
          selectedSafeties={selectedSafeties}
          toggleSafety={toggleSafety}
          triggerSearch={searchPosts}
        />
        <MassSelectionBar
          selectionMode={selectionMode}
          selectedCount={selectedPostIds.length}
          onToggle={() => {
            setSelectionMode(true);
            setSelectedPostIds([]);
          }}
          onClear={() => setSelectionMode(false)}
          onEdit={() => setModalOpen(true)}
        />
      </section>
    </motion.div>
  );
}
