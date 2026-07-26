// Helmies Studio — Command Palette
// Section 86: ⌘K command palette for quick navigation
// Commands: Ask Agent, Image Studio, Video Studio, Director, open project, etc.

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles, Image, Video, Clapperboard, Music, Search,
  FolderOpen, Palette, Image as ImageIcon, Workflow, CreditCard,
} from "lucide-react";

// ============================================================
// Command definitions
// ============================================================

interface Command {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  path: string;
  category: string;
  keywords: string[];
}

const COMMANDS: Command[] = [
  { id: "agent", label: "Ask Agent", description: "Chat with the Master Agent", icon: Sparkles, path: "/studio/agent", category: "Create", keywords: ["chat", "ai", "assistant", "help"] },
  { id: "image", label: "Image Studio", description: "Generate and edit images", icon: Image, path: "/studio/image", category: "Create", keywords: ["photo", "picture", "generate", "t2i", "i2i"] },
  { id: "video", label: "Video Studio", description: "Generate and edit videos", icon: Video, path: "/studio/video", category: "Create", keywords: ["film", "clip", "t2v", "i2v", "motion"] },
  { id: "director", label: "Director", description: "Multi-shot production planner", icon: Clapperboard, path: "/studio/director", category: "Create", keywords: ["film", "production", "shots", "pipeline"] },
  { id: "audio", label: "Audio Studio", description: "TTS, music, and sound effects", icon: Music, path: "/studio/audio", category: "Create", keywords: ["voice", "tts", "sound", "music"] },
  { id: "projects", label: "Open Project", description: "Browse and manage projects", icon: FolderOpen, path: "/studio/projects", category: "Build", keywords: ["folder", "campaign", "organize"] },
  { id: "brands", label: "Brand Kits", description: "Manage brand identities", icon: Palette, path: "/studio/brands", category: "Build", keywords: ["brand", "logo", "colors", "style"] },
  { id: "assets", label: "Asset Library", description: "Browse generated assets", icon: ImageIcon, path: "/studio/assets", category: "Library", keywords: ["files", "media", "downloads"] },
  { id: "workflows", label: "Create Workflow", description: "Build automated pipelines", icon: Workflow, path: "/studio/workflows", category: "Build", keywords: ["automation", "pipeline", "batch"] },
  { id: "credits", label: "View Credits", description: "Check credit balance", icon: CreditCard, path: "/studio/credits", category: "Account", keywords: ["balance", "wallet", "tokens"] },
];

// ============================================================
// Command Palette Component
// ============================================================

interface CommandPaletteProps {
  onClose: () => void;
  onSelect: (command: Command) => void;
}

export function CommandPalette({ onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Filter commands
  const filtered = query.trim()
    ? COMMANDS.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(query.toLowerCase()) ||
          cmd.description.toLowerCase().includes(query.toLowerCase()) ||
          cmd.keywords.some((kw) => kw.includes(query.toLowerCase())),
      )
    : COMMANDS;

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) {
          onSelect(filtered[selectedIndex]);
        }
        break;
      case "Escape":
        onClose();
        break;
    }
  };

  // Scroll selected into view
  useEffect(() => {
    const selected = listRef.current?.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Group by category
  const grouped: Record<string, Command[]> = {};
  for (const cmd of filtered) {
    if (!grouped[cmd.category]) grouped[cmd.category] = [];
    grouped[cmd.category].push(cmd);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search size={18} className="text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands..."
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-600"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No commands found
            </div>
          ) : (
            Object.entries(grouped).map(([category, commands]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">
                  {category}
                </div>
                {commands.map((cmd) => {
                  const globalIndex = filtered.indexOf(cmd);
                  const isSelected = globalIndex === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => onSelect(cmd)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-600/20 text-white"
                          : "text-zinc-400 hover:bg-zinc-800/50"
                      }`}
                    >
                      <cmd.icon size={16} className={isSelected ? "text-indigo-400" : "text-zinc-500"} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{cmd.label}</div>
                        <div className="text-xs text-zinc-500 truncate">{cmd.description}</div>
                      </div>
                      {isSelected && (
                        <kbd className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-zinc-800 text-[10px] text-zinc-600">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>esc Dismiss</span>
        </div>
      </div>
    </div>
  );
}
