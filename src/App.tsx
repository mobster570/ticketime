import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DashboardPage } from "@/pages/DashboardPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ServerDetailPage } from "@/pages/ServerDetailPage";
import { useServerStore } from "@/stores/serverStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";

function AppLayout() {
  const { fetchServers } = useServerStore();

  useEffect(() => {
    useThemeStore.getState().initTheme();
    useSettingsStore.getState().fetchSettings();
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/servers/:id" element={<ServerDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <MemoryRouter>
      <AppLayout />
    </MemoryRouter>
  );
}

export default App;
