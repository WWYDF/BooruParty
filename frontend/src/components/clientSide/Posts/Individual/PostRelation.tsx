"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";

export default function RelatedPostInput({
  value,
  onChange,
  placeholder = "Add post ID...",
  className = "",
}: {
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const addId = () => {
    const id = parseInt(inputValue.trim());
    if (!isNaN(id) && !value.includes(id)) {
      onChange([...value, id]);
    }
    setInputValue("");
  };

  return (
    <div className={`flex flex-wrap gap-2 bg-secondary p-2 rounded border border-secondary-border ${className}`}>
      {value.map((id) => (
        <div
          key={id}
          className="bg-zinc-800 text-white px-2 py-1 rounded flex items-center gap-1"
        >
          <span>{id}</span>
          <button
            onClick={() => onChange(value.filter((r) => r !== id))}
            className="hover:text-red-400"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            addId();
          } else if (e.key === "Backspace" && inputValue === "") {
            onChange(value.slice(0, -1));
          }
        }}
        className="bg-transparent outline-none text-white text-sm flex-1 min-w-[50px]"
        placeholder={placeholder}
      />
    </div>
  );
}
