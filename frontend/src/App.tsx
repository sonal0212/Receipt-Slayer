import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import UploadPage from "./pages/UploadPage";
import ReviewPage from "./pages/ReviewPage";
import ReportPage from "./pages/ReportPage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-light flex flex-col">
        {/* Header — Stitch-inspired nav */}
        <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <NavLink to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">receipt_long</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Receipt Slayer
              </span>
            </NavLink>
            <nav className="flex items-center gap-1">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? "text-primary bg-primary/5 font-semibold"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`
                }
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">cloud_upload</span>
                  Upload
                </span>
              </NavLink>
              <NavLink
                to="/report"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? "text-primary bg-primary/5 font-semibold"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`
                }
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">analytics</span>
                  Report
                </span>
              </NavLink>
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `px-4 py-2 text-sm font-medium transition-colors rounded-lg ${
                    isActive
                      ? "text-primary bg-primary/5 font-semibold"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  }`
                }
              >
                <span className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-lg">insert_chart</span>
                  Dashboard
                </span>
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>

        <footer className="mt-auto bg-slate-900 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
            <img
              src="/mozaic_poweredbyPetroIT_white.png"
              alt="Mozaic — Powered by Petro IT"
              className="h-12 object-contain"
            />
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
