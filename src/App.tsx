import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { DashboardPage } from "@/pages/DashboardPage";
import { useServerStore } from "@/stores/serverStore";
import { useThemeStore } from "@/stores/themeStore";

function AppLayout() {
  const { fetchServers } = useServerStore();

  useEffect(() => {
    useThemeStore.getState().initTheme();
    fetchServers();
  }, [fetchServers]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg-primary)]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
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
