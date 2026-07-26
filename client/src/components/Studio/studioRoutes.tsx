// Helmies Studio — Studio Routes
// Integrates the Studio workspace shell into the existing LibreChat client routing.

import React, { lazy, Suspense } from "react";
import { RouteObject } from "react-router-dom";

// Lazy-loaded workspace components
const MasterAgent = lazy(() => import("../Chat/ChatRoute"));
const ImageStudio = lazy(() => import("./workspaces/ImageStudio"));
const VideoStudio = lazy(() => import("./workspaces/VideoStudio"));
const DirectorDashboard = lazy(() => import("./workspaces/DirectorDashboard"));
const AudioStudio = lazy(() => import("./workspaces/AudioStudio"));
const LipSyncStudio = lazy(() => import("./workspaces/LipSyncStudio"));
const RecastStudio = lazy(() => import("./workspaces/RecastStudio"));
const InfluencerStudio = lazy(() => import("./workspaces/InfluencerStudio"));
const WorkflowsView = lazy(() => import("./workspaces/WorkflowsView"));
const BrandKitsView = lazy(() => import("./workspaces/BrandKitsView"));
const ProjectsView = lazy(() => import("./workspaces/ProjectsView"));
const AssetsView = lazy(() => import("./workspaces/AssetsView"));
const GenerationsView = lazy(() => import("./workspaces/GenerationsView"));
const CreditsView = lazy(() => import("./workspaces/CreditsView"));
const AdminDashboard = lazy(() => import("./workspaces/AdminDashboard"));

// Loading fallback
function WorkspaceFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm">Loading workspace...</span>
      </div>
    </div>
  );
}

function Suspensed({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<WorkspaceFallback />}>{children}</Suspense>;
}

// ============================================================
// Studio route definitions
// ============================================================

export const studioRoutes: RouteObject[] = [
  {
    path: "agent",
    element: <Suspensed><MasterAgent /></Suspensed>,
  },
  {
    path: "image",
    element: <Suspensed><ImageStudio /></Suspensed>,
  },
  {
    path: "video",
    element: <Suspensed><VideoStudio /></Suspensed>,
  },
  {
    path: "director",
    element: <Suspensed><DirectorDashboard /></Suspensed>,
  },
  {
    path: "audio",
    element: <Suspensed><AudioStudio /></Suspensed>,
  },
  {
    path: "lipsync",
    element: <Suspensed><LipSyncStudio /></Suspensed>,
  },
  {
    path: "recast",
    element: <Suspensed><RecastStudio /></Suspensed>,
  },
  {
    path: "influencer",
    element: <Suspensed><InfluencerStudio /></Suspensed>,
  },
  {
    path: "workflows",
    element: <Suspensed><WorkflowsView /></Suspensed>,
  },
  {
    path: "brands",
    element: <Suspensed><BrandKitsView /></Suspensed>,
  },
  {
    path: "projects",
    element: <Suspensed><ProjectsView /></Suspensed>,
  },
  {
    path: "assets",
    element: <Suspensed><AssetsView /></Suspensed>,
  },
  {
    path: "generations",
    element: <Suspensed><GenerationsView /></Suspensed>,
  },
  {
    path: "favorites",
    element: <Suspensed><GenerationsView /></Suspensed>,
  },
  {
    path: "templates",
    element: <Suspensed><GenerationsView /></Suspensed>,
  },
  {
    path: "credits",
    element: <Suspensed><CreditsView /></Suspensed>,
  },
  {
    path: "billing",
    element: <Suspensed><CreditsView /></Suspensed>,
  },
  {
    path: "api",
    element: <Suspensed><CreditsView /></Suspensed>,
  },
  {
    path: "settings",
    element: <Suspensed><CreditsView /></Suspensed>,
  },
  {
    path: "admin",
    element: <Suspensed><AdminDashboard /></Suspensed>,
  },
];

// ============================================================
// Integration with existing LibreChat routing
// ============================================================
//
// In the existing Root.tsx or App.jsx, add the Studio shell route:
//
// import StudioShell from "@/components/Studio/StudioShell";
// import { StudioProvider } from "@/components/Studio/StudioShell";
// import { studioRoutes } from "@/components/Studio/studioRoutes";
//
// <Route path="/studio" element={
//   <StudioProvider>
//     <StudioShell />
//   </StudioProvider>
// }>
//   <Route index element={<Navigate to="agent" />} />
//   {studioRoutes.map(route => (
//     <Route key={route.path} path={route.path} element={route.element} />
//   ))}
// </Route>
