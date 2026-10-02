import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { LoadingState } from "./components/States";
import { EventPage } from "./pages/EventPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { PublicLayout } from "./pages/PublicLayout";
import { ShowsPage } from "./pages/ShowsPage";

// O painel é carregado sob demanda: visitantes do site nunca baixam esse código.
const AdminApp = lazy(() => import("./admin/AdminApp"));

// BASE_URL é "/" no site normal e "/<repositório>/" na demonstração do GitHub Pages.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/shows", element: <ShowsPage /> },
      { path: "/shows/:slug", element: <EventPage /> },
      { path: "/privacidade", element: <PrivacyPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
  {
    path: "/admin/*",
    element: (
      <Suspense fallback={<LoadingState className="min-h-[100svh]" label="Abrindo o painel…" />}>
        <AdminApp />
      </Suspense>
    ),
  },
], { basename });

export default function App() {
  return <RouterProvider router={router} />;
}
