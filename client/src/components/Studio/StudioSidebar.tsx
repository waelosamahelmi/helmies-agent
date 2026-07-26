// Helmies Studio — Studio Navigation Sidebar
// Section 8, Layer 2: Transforms the LibreChat client into the Helmies Studio shell.
// The authenticated /studio application uses the organizational foundation of Helmies Agent.

import React, { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Sparkles, Image, Video, Clapperboard, Music, Mic, UserRound, Repeat,
  Workflow, Palette, FolderOpen, Image as ImageIcon,
  History, Star, Layout, CreditCard, Receipt, Key, Settings,
  Shield, ChevronLeft, ChevronRight, Search,
} from "lucide-react";

// ============================================================
// Navigation items
// ============================================================

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  path: string;
  adminOnly?: boolean;
  badge?: string;
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "CREATE",
    items: [
      { id: "agent", label: "Agent", icon: Sparkles, path: "/studio/agent" },
      { id: "image", label: "Image Studio", icon: Image, path: "/studio/image" },
      { id: "video", label: "Video Studio", icon: Video, path: "/studio/video" },
      { id: "director", label: "Director", icon: Clapperboard, path: "/studio/director" },
      { id: "audio", label: "Audio Studio", icon: Music, path: "/studio/audio" },
      { id: "lipsync", label: "Lip Sync", icon: Mic, path: "/studio/lipsync" },
      { id: "recast", label: "Recast", icon: Repeat, path: "/studio/recast" },
      { id: "influencer", label: "Influencer", icon: UserRound, path: "/studio/influencer" },
    ],
  },
  {
    label: "BUILD",
    items: [
      { id: "workflows", label: "Workflows", icon: Workflow, path: "/studio/workflows" },
      { id: "brands", label: "Brand Kits", icon: Palette, path: "/studio/brands" },
      { id: "projects", label: "Projects", icon: FolderOpen, path: "/studio/projects" },
      { id: "assets", label: "Assets", icon: ImageIcon, path: "/studio/assets" },
    ],
  },
  {
    label: "LIBRARY",
    items: [
      { id: "generations", label: "Generations", icon: History, path: "/studio/generations" },
      { id: "favorites", label: "Favorites", icon: Star, path: "/studio/favorites" },
      { id: "templates", label: "Templates", icon: Layout, path: "/studio/templates" },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { id: "credits", label: "Credits", icon: CreditCard, path: "/studio/credits", badge: "4,200" },
      { id: "billing", label: "Billing", icon: Receipt, path: "/studio/billing" },
      { id: "api", label: "API", icon: Key, path: "/studio/api" },
      { id: "settings", label: "Settings", icon: Settings, path: "/studio/settings" },
    ],
  },
];

const ADMIN_SECTION: NavSection = {
  label: "ADMIN",
  items: [
    { id: "admin", label: "Dashboard", icon: Shield, path: "/studio/admin", adminOnly: true },
  ],
};

// ============================================================
// Studio Sidebar Component
// ============================================================

interface StudioSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  userRole?: string;
  walletBalance?: number;
}

export default function StudioSidebar({
  isCollapsed,
  onToggle,
  userRole = "user",
  walletBalance,
}: StudioSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = useCallback(
    (path: string) => location.pathname === path || location.pathname.startsWith(path + "/"),
    [location.pathname],
  );

  const sections = [...NAV_SECTIONS];
  if (userRole === "admin" || userRole === "super_admin") {
    sections.push(ADMIN_SECTION);
  }

  // Update credits badge
  if (walletBalance !== undefined) {
    const creditsItem = NAV_SECTIONS[3].items[0];
    creditsItem.badge = walletBalance.toLocaleString();
  }

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  if (isCollapsed) {
    return (
      <aside className="flex flex-col items-center w-16 h-full bg-zinc-950 border-r border-zinc-800 py-4 gap-1">
        {/* Toggle */}
        <button
          onClick={onToggle}
          className="p-2 mb-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          aria-label="Expand sidebar"
        >
          <ChevronRight size={18} />
        </button>

        {/* Icon-only nav */}
        {sections.flatMap((section) =>
          section.items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.path)}
              className={`relative p-2.5 rounded-lg transition-all group ${
                isActive(item.path)
                  ? "bg-indigo-600/20 text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
              aria-label={item.label}
              title={item.label}
            >
              <item.icon size={20} />
              {item.badge && (
                <span className="absolute -top-0.5 -right-0.5 text-[9px] bg-indigo-600 text-white rounded-full px-1 min-w-[18px] text-center">
                  {item.badge}
                </span>
              )}
              <span className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {item.label}
              </span>
            </button>
          )),
        )}
      </aside>
    );
  }

  return (
    <aside className="flex flex-col w-56 h-full bg-zinc-950 border-r border-zinc-800 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Sparkles size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">Helmies Studio</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"
          aria-label="Collapse sidebar"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Quick search */}
      <button
        onClick={() => setSearchOpen(true)}
        className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 hover:text-zinc-300 transition-colors"
      >
        <Search size={14} />
        <span>Quick search...</span>
        <kbd className="ml-auto text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">⌘K</kbd>
      </button>

      {/* Navigation sections */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.label}>
            <h3 className="px-3 mb-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">
              {section.label}
            </h3>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all ${
                      isActive(item.path)
                        ? "bg-indigo-600/10 text-indigo-400 font-medium border border-indigo-500/20"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                    }`}
                  >
                    <item.icon size={16} className={isActive(item.path) ? "text-indigo-400" : ""} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="text-[11px] text-zinc-500 bg-zinc-800 rounded-full px-1.5 py-0.5">
                        {item.badge}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: user info */}
      <div className="px-3 py-3 border-t border-zinc-800">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-white font-medium">
            U
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-300 truncate">User Account</p>
            <p className="text-[10px] text-zinc-500">{userRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
