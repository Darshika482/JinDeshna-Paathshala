import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';
import OfflineBanner from '../../components/common/OfflineBanner.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import AdminLeaderboard from './AdminLeaderboard.jsx';
import AdminSchedule from './AdminSchedule.jsx';
import AdminCoinAllocation from './AdminCoinAllocation.jsx';
import AdminTransactions from './AdminTransactions.jsx';
import AdminVolunteers from './AdminVolunteers.jsx';
import AdminCoinRegister from './AdminCoinRegister.jsx';
import AdminCheckInRecords from './AdminCheckInRecords.jsx';
import AdminOperations from './AdminOperations.jsx';
import AdminClasses from './AdminClasses.jsx';
import AdminSettings from './AdminSettings.jsx';
import AdminPathshala from './AdminPathshala.jsx';
import { useConfigStore } from '../../store/useConfigStore.js';

const NAV_ITEMS = [
  { key: 'dashboard',     icon: '📊', label: 'admin.dashboard' },
  { key: 'checkIn',       icon: '✅', label: 'admin.checkIn' },
  { key: 'classes',       icon: '🏫', label: 'admin.pathshala' },
  { key: 'leaderboard',   icon: '🏆', label: 'admin.leaderboard' },
  { key: 'schedule',      icon: '📅', label: 'admin.schedule' },
  { key: 'coinAllocation',icon: '🪙', label: 'admin.coinAllocation' },
  { key: 'transactions',  icon: '📝', label: 'admin.transactions' },
  { key: 'volunteers',    icon: '🙋', label: 'admin.volunteers' },
  { key: 'coinRegister',  icon: '📒', label: 'admin.coinRegister' },
  { key: 'operations',    icon: '⚙️', label: 'admin.operations' },
  { key: 'settings',      icon: '🔧', label: 'admin.settings' },
];

const PAGES = {
  dashboard:     AdminDashboard,
  checkIn:       AdminCheckInRecords,
  classes:       AdminPathshala,
  leaderboard:   AdminLeaderboard,
  schedule:      AdminSchedule,
  coinAllocation:AdminCoinAllocation,
  transactions:  AdminTransactions,
  volunteers:    AdminVolunteers,
  coinRegister:  AdminCoinRegister,
  operations:    AdminOperations,
  settings:      AdminSettings,
};

export default function AdminLayout() {
  const { t } = useTranslation();
  const { logout } = useAuthStore();
  const campName = useConfigStore(s => s.campName) || import.meta.env.VITE_CAMP_NAME || 'ShivirOS';
  const navigate = useNavigate();
  const location = useLocation();
  // On md+ default open; on mobile default closed
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768);

  const segment = location.pathname.replace(/^\/admin\/?/, '') || 'dashboard';
  const activePage = PAGES[segment] ? segment : 'dashboard';
  const PageComponent = PAGES[activePage];

  const handleNavClick = (key) => {
    navigate(`/admin/${key}`);
    // Close sidebar after nav on mobile
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <OfflineBanner />

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed overlay on mobile, inline on md+ */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-50 md:z-auto
        ${sidebarOpen ? 'w-56 translate-x-0' : 'w-56 -translate-x-full md:translate-x-0 md:w-14'}
        bg-forest-700 text-white flex flex-col transition-all duration-200 flex-shrink-0 h-full
      `}>
        <div className="p-3 flex items-center gap-2 border-b border-forest-600">
          <button onClick={() => setSidebarOpen(s => !s)} className="text-white text-xl p-1 flex-shrink-0">☰</button>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="font-bold text-sm whitespace-nowrap truncate max-w-[140px]">{campName}</div>
              <div className="text-xs text-forest-300 whitespace-nowrap">Admin Panel</div>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => handleNavClick(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-3 transition-colors text-left
                ${activePage === item.key ? 'bg-saffron-500 text-white' : 'text-forest-200 hover:bg-forest-600'}`}
            >
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              {sidebarOpen && <span className="text-sm font-medium whitespace-nowrap">{t(item.label)}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-forest-600 flex items-center gap-2">
          <button
            onClick={logout}
            className="flex items-center gap-2 text-forest-300 hover:text-white transition-colors"
          >
            <span className="text-xl">🚪</span>
            {sidebarOpen && <span className="text-sm">{t('auth.logout')}</span>}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 flex-shrink-0">
          {/* Hamburger visible only on mobile */}
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="text-forest-700 text-2xl p-1 md:hidden flex-shrink-0"
          >
            ☰
          </button>
          <h2 className="font-bold text-lg text-forest-700 flex-1 truncate">
            {t(NAV_ITEMS.find(n => n.key === activePage)?.label || '')}
          </h2>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="text-sm text-gray-600 hidden sm:block">🔐 Admin</div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <PageComponent />
        </div>
      </div>
    </div>
  );
}
