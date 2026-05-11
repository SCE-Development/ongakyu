import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlayerPage from "./pages/PlayerPage";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-sce-darker">
        <header className="bg-sce-dark/80 backdrop-blur border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-3">
            <img src="/sce_logo.ico" alt="" className="h-9 w-9 rounded" />
            <span className="text-white font-semibold text-lg tracking-tight">OngaKyu</span>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <PlayerPage />
        </main>
      </div>
    </QueryClientProvider>
  </React.StrictMode>
);
