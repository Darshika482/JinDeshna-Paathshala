import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore.js';
import { useConfigStore } from '../../store/useConfigStore.js';
import LanguageToggle from '../../components/common/LanguageToggle.jsx';

const ROLES = [
  { key: 'mentor', icon: '🙋', routeAfter: '/mentor/actions', pinLogin: true },
  { key: 'teacher', icon: '📝', routeAfter: '/teacher', pinLogin: true },
  { key: 'coordinator', icon: '🎯', routeAfter: '/coordinator', pinLogin: true },
  { key: 'coinkeeper', icon: '🪙', routeAfter: '/coinkeeper', pinLogin: true, keeperPin: true },
  { key: 'collection', icon: '📦', routeAfter: '/collection', pinLogin: true },
  { key: 'checkin', icon: '✅', routeAfter: '/checkin', directAccess: true, pinLogin: false },
  { key: 'admin', icon: '🔐', routeAfter: '/admin', pinLogin: false },
];

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginVolunteer, loginAdmin, loginCoinkeeper } = useAuthStore();
  const campName = useConfigStore(s => s.campName) || import.meta.env.VITE_CAMP_NAME || t('app.title');
  const campCity = useConfigStore(s => s.campCity) || import.meta.env.VITE_CAMP_CITY || t('app.subtitle');

  const adminPasswordConfigured = !!(() => {
    try { return JSON.parse(localStorage.getItem('shiviros-config') || '{}').adminPassword; } catch { return false; }
  })();

  const [selectedRole, setSelectedRole] = useState(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const roleFromQueryRaw = (searchParams.get('role') || '').trim();
    // Backward compatibility with previously shared links.
    const roleFromQuery = roleFromQueryRaw === 'volunteer' ? 'mentor' : roleFromQueryRaw;
    if (!roleFromQuery) return;
    const preset = ROLES.find(r => r.key === roleFromQuery && !r.directAccess);
    if (!preset) return;
    setSelectedRole(preset);
    setPin('');
    setPassword('');
    setError('');
  }, [searchParams]);

  const handleRoleSelect = (role) => {
    if (role.directAccess) {
      navigate(role.routeAfter);
      return;
    }
    setSelectedRole(role);
    setPin('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async () => {
    setError('');
    if (!selectedRole) return;
    try {
      let result;
      if (selectedRole.key === 'admin') {
        result = loginAdmin(password);
      } else if (selectedRole.key === 'coinkeeper') {
        result = loginCoinkeeper(pin);
      } else {
        // Mentor/teacher/coordinator/collection all use PIN-based volunteer auth;
        // portal must match the tile so people with multiple duties are not stuck on one derived role.
        result = await loginVolunteer(pin, selectedRole.key);
      }
      if (result.success) {
        // If the DB assigned 'collection' role, always land on /collection —
        // even if the user tapped the Mentor button (Collection Mentors).
        // For every other role, honour the button the user actually tapped.
        const actualRole = useAuthStore.getState().role;
        navigate(actualRole === 'collection' ? '/collection' : selectedRole.routeAfter);
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  return (
    <div className="mobile-container bg-gradient-to-b from-forest-700 to-forest-800 flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 sm:px-6 pt-7 pb-5 max-w-3xl mx-auto w-full">
        <div>
          <h1 className="text-[1.85rem] leading-tight font-bold text-white">{campName}</h1>
          <p className="text-forest-200 text-sm mt-1">{campCity}</p>
        </div>
        <LanguageToggle />
      </div>

      {/* Lotus decoration */}
      <div className="text-center text-6xl mb-3">🪷</div>

      <div className="flex-1 bg-gray-50 rounded-t-[2rem] pt-6 pb-8 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {!selectedRole ? (
          <>
            <h2 className="text-[1.85rem] font-extrabold tracking-tight text-forest-700 mb-4 text-center">{t('auth.selectRole')}</h2>
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
              {ROLES.map(role => (
                <button
                  key={role.key}
                  onClick={() => handleRoleSelect(role)}
                  className="group min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-forest-200 active:scale-[0.99] transition-all text-left px-4 py-4 flex items-center gap-3"
                >
                  <span className="text-3xl shrink-0">{role.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-[1.05rem] leading-tight text-forest-700 break-words">
                      {t(`auth.roles.${role.key}`)}
                    </div>
                  </div>
                  <span className="ml-auto text-saffron-500 text-xl shrink-0 group-hover:translate-x-0.5 transition-transform">›</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <button
              onClick={() => setSelectedRole(null)}
              className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-700 mb-6 font-semibold"
            >
              ← {t('common.back')}
            </button>
            <div className="text-center mb-6 rounded-2xl border border-forest-100 bg-white/70 p-4">
              <div className="text-5xl mb-2">{selectedRole.icon}</div>
              <h2 className="text-xl font-bold text-forest-700">{t(`auth.roles.${selectedRole.key}`)}</h2>
            </div>

            {selectedRole.pinLogin ? (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('auth.enterPin')}</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className="input-field text-center text-2xl tracking-widest"
                  placeholder="••••"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                {/* PIN hint for demo */}
                <p className="text-xs text-gray-400 mt-2 text-center">Enter your assigned PIN</p>
              </div>
            ) : (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-600 mb-2">{t('auth.adminPassword')}</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter admin password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
                {!adminPasswordConfigured && (
                  <p className="text-xs text-amber-600 mt-2 text-center font-medium">
                    Default password: <span className="font-bold">darshika</span> — change it in Admin → Settings after login
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-red-700 text-sm font-medium">
                ⚠️ {error}
              </div>
            )}

            <button onClick={handleSubmit} className="btn-primary w-full">
              {t('auth.login')}
            </button>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
