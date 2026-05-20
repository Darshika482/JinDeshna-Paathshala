import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore.js';
import { useStudentStore } from './store/useStudentStore.js';
import { useVolunteerStore } from './store/useVolunteerStore.js';
import { useTransactionStore } from './store/useTransactionStore.js';
import { useCoinStore } from './store/useCoinStore.js';
import { useConfigStore } from './store/useConfigStore.js';
import LoginPage from './pages/auth/LoginPage.jsx';
import VolunteerApp from './pages/volunteer/VolunteerApp.jsx';
import CoordinatorApp from './pages/coordinator/CoordinatorApp.jsx';
import CoinKeeperApp from './pages/coinkeeper/CoinKeeperApp.jsx';
import CollectionStation from './pages/collection/CollectionStation.jsx';
import DailySchedule from './pages/schedule/DailySchedule.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminCheckIn from './pages/admin/AdminCheckIn.jsx';
import TeacherAttendanceApp from './pages/teacher/TeacherAttendanceApp.jsx';
import SetupWizard from './pages/setup/SetupWizard.jsx';

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
    fetchStudents();
    fetchVolunteers();
    fetchTransactions();
    fetchCoins();
    setupPointAutoSync();
    setupTransactionAutoSync();
    syncPendingPointUpdates();
    syncPendingMentorEntries();
  }, []);
  return null;
}

function RequireAuth({ children, allowedRoles }) {
  const { currentUser, role, _hasHydrated } = useAuthStore();
  if (!_hasHydrated) return null;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/login" replace />;
  return children;
}

function RequireSetup({ children }) {
  const isSetupComplete = useConfigStore(s => s.isSetupComplete);
  if (!isSetupComplete) return <Navigate to="/setup" replace />;
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
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/" element={<RequireSetup><Navigate to="/schedule" replace /></RequireSetup>} />
        <Route path="/login" element={<RequireSetup><LoginPage /></RequireSetup>} />
        <Route path="/schedule" element={<RequireSetup><DailySchedule /></RequireSetup>} />
        <Route path="/checkin" element={<RequireSetup><AdminCheckIn /></RequireSetup>} />

        <Route path="/mentor/actions" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['volunteer', 'admin']}>
              <VolunteerApp />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="/volunteer" element={<RequireSetup><Navigate to="/mentor/actions" replace /></RequireSetup>} />
        <Route path="/mentor" element={<RequireSetup><Navigate to="/mentor/actions" replace /></RequireSetup>} />

        <Route path="/teacher" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['teacher', 'admin']}>
              <TeacherAttendanceApp />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="/coordinator" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['coordinator']}>
              <CoordinatorApp />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="/coinkeeper" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['coinkeeper']}>
              <CoinKeeperApp />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="/collection" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['collection', 'admin']}>
              <CollectionStation />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="/admin/*" element={
          <RequireSetup>
            <RequireAuth allowedRoles={['admin']}>
              <AdminLayout />
            </RequireAuth>
          </RequireSetup>
        } />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
