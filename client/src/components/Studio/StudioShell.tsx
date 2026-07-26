// Helmies Studio — Studio Workspace Shell
// The authenticated /studio application shell wrapping the existing LibreChat
// Agent UI with the Helmies Studio navigation, workspaces, and commercial context.

import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import StudioSidebar from "./StudioSidebar";
import { useStudioContext } from "./StudioContext";
import { CommandPalette } from "./CommandPalette";

// ============================================================
// Studio Layout
// ============================================================

export default function StudioShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const { userContext, wallet, refreshWallet } = useStudioContext();
  const location = useLocation();
  const navigate = useNavigate();

  // ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Refresh wallet on mount
  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  const handleCommandSelect = useCallback(
    (command: { id: string; path: string }) => {
      navigate(command.path);
      setCommandPaletteOpen(false);
    },
    [navigate],
  );

  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden">
      {/* Sidebar */}
      <StudioSidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
        userRole={userContext?.role}
        walletBalance={wallet?.available}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Breadcrumb */}
            <div className="text-sm text-zinc-400">
              {getBreadcrumb(location.pathname)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Credits display */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-zinc-300">
                <span className="font-medium text-white">{wallet?.available?.toLocaleString() ?? "—"}</span>
                <span className="text-zinc-500 ml-1">credits</span>
              </span>
            </div>

            {/* Quick actions */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="px-3 py-1.5 text-sm text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors flex items-center gap-2"
            >
              <span>⌘K</span>
            </button>
          </div>
        </header>

        {/* Workspace content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      {commandPaletteOpen && (
        <CommandPalette
          onClose={() => setCommandPaletteOpen(false)}
          onSelect={handleCommandSelect}
        />
      )}
    </div>
  );
}

// ============================================================
// Breadcrumb helper
// ============================================================

function getBreadcrumb(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";

  const labels: Record<string, string> = {
    studio: "Studio",
    agent: "Master Agent",
    image: "Image Studio",
    video: "Video Studio",
    director: "Director",
    audio: "Audio Studio",
    lipsync: "Lip Sync",
    recast: "Recast",
    influencer: "AI Influencer",
    workflows: "Workflows",
    brands: "Brand Kits",
    projects: "Projects",
    assets: "Assets",
    generations: "Generations",
    favorites: "Favorites",
    templates: "Templates",
    credits: "Credits",
    billing: "Billing",
    api: "API Keys",
    settings: "Settings",
    admin: "Admin Dashboard",
  };

  return segments.map((s) => labels[s] || s).join(" / ");
}

// ============================================================
// Studio Context (React Context for commercial state)
// ============================================================

import { createContext, useContext, useReducer, ReactNode } from "react";

interface StudioUserContext {
  platformUserId: string;
  agentUserId: string;
  email: string;
  role: string;
  plan: string;
  isLinkedToAgent: boolean;
}

interface StudioWallet {
  available: number;
  reserved: number;
  total: number;
}

interface StudioState {
  userContext: StudioUserContext | null;
  wallet: StudioWallet | null;
  isLoading: boolean;
}

type StudioAction =
  | { type: "SET_CONTEXT"; userContext: StudioUserContext; wallet: StudioWallet }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "UPDATE_WALLET"; wallet: StudioWallet };

function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case "SET_CONTEXT":
      return { ...state, userContext: action.userContext, wallet: action.wallet, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "UPDATE_WALLET":
      return { ...state, wallet: action.wallet };
    default:
      return state;
  }
}

const StudioContext = createContext<{
  userContext: StudioUserContext | null;
  wallet: StudioWallet | null;
  isLoading: boolean;
  refreshWallet: () => Promise<void>;
}>({
  userContext: null,
  wallet: null,
  isLoading: true,
  refreshWallet: async () => {},
});

export function StudioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(studioReducer, {
    userContext: null,
    wallet: null,
    isLoading: true,
  });

  const refreshWallet = useCallback(async () => {
    try {
      const [identityRes, walletRes] = await Promise.all([
        fetch("/api/identity/me").then((r) => r.json()),
        fetch("/api/wallet").then((r) => r.json()),
      ]);

      dispatch({
        type: "SET_CONTEXT",
        userContext: identityRes,
        wallet: walletRes,
      });
    } catch (error) {
      console.error("Failed to load studio context:", error);
      dispatch({ type: "SET_LOADING", isLoading: false });
    }
  }, []);

  useEffect(() => {
    refreshWallet();
  }, [refreshWallet]);

  return (
    <StudioContext.Provider value={{ ...state, refreshWallet }}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudioContext() {
  return useContext(StudioContext);
}
