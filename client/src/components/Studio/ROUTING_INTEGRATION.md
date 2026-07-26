// Helmies Studio — LibreChat Routing Integration
// Sections 7-8, 164: Wires the Studio shell into existing LibreChat routes.
//
// Integration steps:
//
// 1. In client/src/routes/index.tsx, add:
//
//    import StudioShell, { StudioProvider } from '~/components/Studio/StudioShell';
//    import { studioRoutes } from '~/components/Studio/studioRoutes';
//
//    // Inside the route tree:
//    <Route path="/studio" element={
//      <StudioProvider>
//        <StudioShell />
//      </StudioProvider>
//    }>
//      <Route index element={<Navigate to="agent" replace />} />
//      {studioRoutes.map(r => (
//        <Route key={r.path} path={r.path} element={r.element} />
//      ))}
//    </Route>
//
// 2. The nginx gateway (docker/nginx/nginx.conf) routes:
//    /          → landing (Next.js port 3003)
//    /studio/*  → studio-web (LibreChat client port 3080)
//
// 3. The LibreChat server already serves the React SPA at port 3080.
//    The client-side React Router handles /studio/* routes.
//
// 4. The existing ChatRoute at /c/:conversationId continues to work
//    for direct Agent access. The Studio shell wraps it at /studio/agent.
//
// 5. API routes:
//    /api/agent/*   → agent-api (LibreChat Express backend)
//    /api/platform/* → platform-api (commercial backend)
//    /api/generate/* → platform-api (Model Gateway)

// ============================================================
// Route integration code (to be added to client/src/routes/index.tsx)
// ============================================================

/*
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

// Lazy-load the Studio shell to avoid bloating the initial bundle
const StudioShell = lazy(() => import('~/components/Studio/StudioShell'));
const StudioContextProvider = lazy(() =>
  import('~/components/Studio/StudioShell').then(m => ({ default: m.StudioProvider }))
);
const studioRoutes = lazy(() =>
  import('~/components/Studio/studioRoutes').then(m => ({ default: m.studioRoutes }))
);

// Studio loading fallback
function StudioFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm text-zinc-500">Loading Helmies Studio...</span>
      </div>
    </div>
  );
}

// In the route tree:
<Route
  path="/studio"
  element={
    <Suspense fallback={<StudioFallback />}>
      <StudioContextProvider>
        <StudioShell />
      </StudioContextProvider>
    </Suspense>
  }
>
  <Route index element={<Navigate to="agent" replace />} />
  <Route path="agent" element={<ChatRoute />} />
  <Route path="image" element={<ImageStudio />} />
  <Route path="video" element={<VideoStudio />} />
  <Route path="director" element={<DirectorDashboard />} />
  <Route path="audio" element={<AudioStudio />} />
  <Route path="lipsync" element={<LipSyncStudio />} />
  <Route path="recast" element={<RecastStudio />} />
  <Route path="influencer" element={<InfluencerStudio />} />
  <Route path="workflows" element={<WorkflowsView />} />
  <Route path="brands" element={<BrandKitsView />} />
  <Route path="projects" element={<ProjectsView />} />
  <Route path="assets" element={<AssetsView />} />
  <Route path="generations" element={<GenerationsView />} />
  <Route path="favorites" element={<GenerationsView />} />
  <Route path="templates" element={<GenerationsView />} />
  <Route path="credits" element={<CreditsView />} />
  <Route path="billing" element={<CreditsView />} />
  <Route path="api" element={<CreditsView />} />
  <Route path="settings" element={<CreditsView />} />
  <Route path="admin" element={<AdminDashboard />} />
</Route>
*/

// The above commented code is the ACTUAL integration.
// Uncomment and add to client/src/routes/index.tsx when ready to deploy.
// The studio routes are defined in client/src/components/Studio/studioRoutes.tsx
// The workspace views are in client/src/components/Studio/workspaces/index.tsx
// The Studio shell is in client/src/components/Studio/StudioShell.tsx
// The sidebar is in client/src/components/Studio/StudioSidebar.tsx
// The command palette is in client/src/components/Studio/CommandPalette.tsx
