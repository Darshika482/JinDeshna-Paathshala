import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore.js';
import { useStudentStore } from './store/useStudentStore.js';
import { useVolunteerStore } from './store/useVolunteerStore.js';
import { useTransactionStore } from './store/useTransactionStore.js';
import { useCoinStore } from './store/useCoinStore.js';
import { fetchCampConfigFromSupabase } from './lib/campConfigSync.js';
import LoginPage from './pages/auth/LoginPage.jsx';
import VolunteerApp from './pages/volunteer/VolunteerApp.jsx';
import CoordinatorApp from './pages/coordinator/CoordinatorApp.jsx';
import CoinKeeperApp from './pages/coinkeeper/CoinKeeperApp.jsx';
import CollectionStation from './pages/collection/CollectionStation.jsx';
import DailySchedule from './pages/schedule/DailySchedule.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminCheckIn from './pages/admin/AdminCheckIn.jsx';
import TeacherAttendanceApp from './pages/teacher/TeacherAttendanceApp.jsx';

function AppInitializer() {
  const fetchStudents = useStudentStore(s => s.fetchStudents);
  const setupPointAutoSync = useStudentStore(s => s.setupPointAutoSync);
  const syncPendingPointUpdates = useStudentStore(s => s.syncPendingPointUpdates);
  const fetchVolunteers = useVolunteerStore(s => s.fetchVolunteers);
  const fetchTransactions = useTransactionStore(s => s.fetchTransactions);
  const setupTransactionAutoSync = useTransactionStore(s => s.setupTransactionAutoSync);
  const syncPendingMentorEntries = useTransactionStore(s => s.syncPendingMentorEntries);
  const fetchCoins = useCoinStore(s => s.fetchCoins);
  useEffect(() => {
    (async () => {
      await fetchCampConfigFromSupabase();
      useTransactionStore.getState().refreshCurrentDay();
      fetchStudents();
      fetchVolunteers();
      fetchTransactions();
      fetchCoins();
      setupPointAutoSync();
      setupTransactionAutoSync();
      syncPendingPointUpdates();
      syncPendingMentorEntries();
    })();
  }, []);
  return null;
}

function RequireAuth({ children, allowedRoles }) {
  const { currentUser, role, _hasHydrated, logout } = useAuthStore();

  useEffect(() => {
    if (_hasHydrated && role === 'admin' && !sessionStorage.getItem('admin_session_active')) {
      logout();
    }
  }, [_hasHydrated, role, logout]);

  if (!_hasHydrated) return null;

  if (role === 'admin' && !sessionStorage.getItem('admin_session_active')) {
    return <Navigate to="/login" replace />;
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: '12px', fontFamily: 'Inter, Noto Sans Devanagari, sans-serif' },
        }}
      />
      <AppInitializer />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/schedule" element={<DailySchedule />} />
        <Route path="/checkin" element={<AdminCheckIn />} />

        <Route path="/mentor/actions" element={
          <RequireAuth allowedRoles={['volunteer', 'admin']}>
            <VolunteerApp />
          </RequireAuth>
        } />

        <Route path="/volunteer" element={<Navigate to="/mentor/actions" replace />} />
        <Route path="/mentor" element={<Navigate to="/mentor/actions" replace />} />

        <Route path="/teacher" element={
          <RequireAuth allowedRoles={['teacher', 'admin']}>
            <TeacherAttendanceApp />
          </RequireAuth>
        } />

        <Route path="/coordinator" element={
          <RequireAuth allowedRoles={['coordinator']}>
            <CoordinatorApp />
          </RequireAuth>
        } />

        <Route path="/coinkeeper" element={
          <RequireAuth allowedRoles={['coinkeeper']}>
            <CoinKeeperApp />
          </RequireAuth>
        } />

        <Route path="/collection" element={
          <RequireAuth allowedRoles={['collection', 'admin']}>
            <CollectionStation />
          </RequireAuth>
        } />

        <Route path="/admin/*" element={
          <RequireAuth allowedRoles={['admin']}>
            <AdminLayout />
          </RequireAuth>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
