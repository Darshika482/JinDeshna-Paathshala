import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useConfigStore } from '../../store/useConfigStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { notifyCampConfigUpdated } from '../../lib/campDates.js';
import { saveCampConfigToSupabase } from '../../lib/campConfigSync.js';
import schemaSQL from '../../../supabase/schema.sql?raw';
import addPointsRPC from '../../../supabase/add_points_rpc.sql?raw';

const FULL_SQL = schemaSQL + '\n\n' + addPointsRPC;

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="font-semibold text-gray-800 text-sm">{title}</div>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

const INPUT = "w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500";

function toDateInputValue(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export default function AdminSettings() {
  const config = useConfigStore();

  // Camp info state — synced after zustand persist rehydrates from localStorage
  const [campName, setCampName] = useState('');
  const [campCity, setCampCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [campSaved, setCampSaved] = useState(false);
  const [campSaving, setCampSaving] = useState(false);

  useEffect(() => {
    setCampName(config.campName || '');
    setCampCity(config.campCity || '');
    setStartDate(toDateInputValue(config.campStartDate || import.meta.env.VITE_CAMP_START_DATE || ''));
    setEndDate(toDateInputValue(config.campEndDate || import.meta.env.VITE_CAMP_END_DATE || ''));
  }, [config.campName, config.campCity, config.campStartDate, config.campEndDate]);

  // Password change state
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  // PIN change state
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState(null);

  // Supabase state
  const [newUrl, setNewUrl] = useState('');
  const [newKey, setNewKey] = useState('');
  const [dbMsg, setDbMsg] = useState(null);
  const [schemaCopied, setSchemaCopied] = useState(false);

  const saveCamp = async () => {
    if (!startDate || !endDate) {
      toast.error('Please set both start and end dates.');
      return;
    }
    const days = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
    const payload = { campName, campCity, campStartDate: startDate, campEndDate: endDate, campTotalDays: days };
    setCampSaving(true);
    try {
      config.saveCampConfig(payload);
      useTransactionStore.getState().refreshCurrentDay();
      notifyCampConfigUpdated();
      const { error } = await saveCampConfigToSupabase(payload);
      if (error) {
        toast.error('Saved on this device, but cloud sync failed. Teachers may not see new dates yet.');
      } else {
        toast.success('Camp dates saved and synced for all users.');
        setCampSaved(true);
        setTimeout(() => setCampSaved(false), 2000);
      }
    } finally {
      setCampSaving(false);
    }
  };

  const changePassword = () => {
    setPwdMsg(null);
    const stored = localStorage.getItem('shiviros-config');
    const adminPwd = stored ? JSON.parse(stored)?.state?.adminPassword : null;
    const actual = adminPwd || import.meta.env.VITE_ADMIN_PASSWORD || 'darshika';
    if (currentPwd !== actual) { setPwdMsg({ ok: false, text: 'Current password is incorrect.' }); return; }
    if (newPwd.length < 6) { setPwdMsg({ ok: false, text: 'New password must be at least 6 characters.' }); return; }
    if (newPwd !== confirmPwd) { setPwdMsg({ ok: false, text: 'Passwords do not match.' }); return; }
    config.saveCampConfig({ adminPassword: newPwd });
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setPwdMsg({ ok: true, text: 'Password updated successfully.' });
    setTimeout(() => setPwdMsg(null), 3000);
  };

  const changePin = () => {
    setPinMsg(null);
    const stored = localStorage.getItem('shiviros-config');
    const storedPin = stored ? JSON.parse(stored)?.state?.coinkeeperPin : null;
    const actual = storedPin || import.meta.env.VITE_COINKEEPER_PIN || null;
    if (actual && currentPin !== actual) { setPinMsg({ ok: false, text: 'Current PIN is incorrect.' }); return; }
    if (!/^\d{4}$/.test(newPin)) { setPinMsg({ ok: false, text: 'New PIN must be exactly 4 digits.' }); return; }
    config.saveCampConfig({ coinkeeperPin: newPin });
    setCurrentPin(''); setNewPin('');
    setPinMsg({ ok: true, text: 'PIN updated.' });
    setTimeout(() => setPinMsg(null), 3000);
  };

  const saveDatabase = () => {
    if (!newUrl.trim() || !newKey.trim()) { setDbMsg({ ok: false, text: 'Both fields are required.' }); return; }
    config.saveSupabaseConfig({ supabaseUrl: newUrl.trim(), supabaseAnonKey: newKey.trim() });
    setNewUrl(''); setNewKey('');
    setDbMsg({ ok: true, text: 'Database config updated. Reload the app to reconnect.' });
    setTimeout(() => setDbMsg(null), 4000);
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([FULL_SQL], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jain-shiviros-schema.sql';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(FULL_SQL);
      setSchemaCopied(true);
      setTimeout(() => setSchemaCopied(false), 2000);
    } catch {
      setSchemaCopied(false);
    }
  };

  const maskedUrl = config.supabaseUrl
    ? config.supabaseUrl.replace(/https:\/\/([a-z0-9]{4})[a-z0-9]+\.supabase\.co/, 'https://$1******.supabase.co')
    : import.meta.env.VITE_SUPABASE_URL ? '(set via .env)' : 'Not configured';

  return (
    <div className="p-3 sm:p-6 max-w-2xl mx-auto">

      {/* Camp Info */}
      <Section title="Camp Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Camp Name">
            <input className={INPUT} value={campName} onChange={e => setCampName(e.target.value)} placeholder="Jain Shivir 2026" />
          </Field>
          <Field label="City">
            <input className={INPUT} value={campCity} onChange={e => setCampCity(e.target.value)} placeholder="Your City" />
          </Field>
          <Field label="Start Date">
            <input type="date" className={INPUT} value={startDate} onChange={e => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date">
            <input type="date" className={INPUT} value={endDate} onChange={e => setEndDate(e.target.value)} />
          </Field>
        </div>
        <button
          onClick={saveCamp}
          disabled={campSaving}
          className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60
            ${campSaved ? 'bg-green-500' : 'bg-forest-700 hover:bg-forest-800'}`}
        >
          {campSaving ? 'Saving…' : campSaved ? '✓ Saved' : 'Save Changes'}
        </button>
        <p className="text-xs text-gray-500">
          Dates sync to the cloud so teachers and mentors on any device see the same camp calendar.
        </p>
      </Section>

      {/* Change Admin Password */}
      <Section title="Change Admin Password">
        <Field label="Current Password">
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              className={INPUT + ' pr-16'}
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Enter current password"
            />
            <button onClick={() => setShowPwd(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              {showPwd ? 'Hide' : 'Show'}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="New Password">
            <input type={showPwd ? 'text' : 'password'} className={INPUT} value={newPwd}
              onChange={e => setNewPwd(e.target.value)} placeholder="Min 6 characters" />
          </Field>
          <Field label="Confirm New Password">
            <input type={showPwd ? 'text' : 'password'} className={INPUT} value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)} placeholder="Repeat new password" />
          </Field>
        </div>
        {pwdMsg && (
          <div className={`px-3 py-2 rounded-xl text-sm ${pwdMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {pwdMsg.text}
          </div>
        )}
        <button onClick={changePassword} className="px-5 py-2 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800">
          Update Password
        </button>
      </Section>

      {/* Change Coinkeeper PIN */}
      <Section title="Change Coinkeeper PIN">
        <p className="text-xs text-gray-500">
          {config.coinkeeperPin ? 'PIN is configured.' : 'No PIN configured yet — set one to enable coinkeeper login.'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label={config.coinkeeperPin ? 'Current PIN' : 'Skip (not set)'}>
            <input type="password" className={INPUT + ' tracking-widest font-mono'} maxLength={4}
              value={currentPin} onChange={e => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••" disabled={!config.coinkeeperPin} />
          </Field>
          <Field label="New PIN (4 digits)">
            <input type="text" className={INPUT + ' tracking-widest font-mono'} maxLength={4}
              value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234" />
          </Field>
          <Field label=" ">
            <button onClick={changePin} className="w-full mt-1 px-4 py-2 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800">
              {config.coinkeeperPin ? 'Update PIN' : 'Set PIN'}
            </button>
          </Field>
        </div>
        {pinMsg && (
          <div className={`px-3 py-2 rounded-xl text-sm ${pinMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {pinMsg.text}
          </div>
        )}
      </Section>

      {/* Database */}
      <Section title="Database Connection">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-500">Connected to</span>
          <span className="font-mono text-gray-700 text-xs">{maskedUrl}</span>
        </div>
        <div className="text-xs text-gray-400 mb-3">To connect to a different Supabase project, enter new credentials below. The app will reload.</div>
        <Field label="New Supabase URL">
          <input className={INPUT} value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://your-project.supabase.co" />
        </Field>
        <Field label="New Anon Key">
          <input className={INPUT + ' font-mono'} value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="eyJ..." />
        </Field>
        {dbMsg && (
          <div className={`px-3 py-2 rounded-xl text-sm ${dbMsg.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {dbMsg.text}
          </div>
        )}
        <button onClick={saveDatabase} className="px-5 py-2 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800">
          Update Database
        </button>
      </Section>

      {/* Schema Download */}
      <Section title="Database Schema SQL">
        <p className="text-sm text-gray-600">
          Download or copy the full SQL schema to create all required tables in your Supabase project.
          Paste it into the <strong>Supabase SQL Editor</strong> and click Run. Safe to re-run on an existing database.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopySchema}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all
              ${schemaCopied ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-300 text-gray-700 hover:border-forest-500'}`}
          >
            {schemaCopied ? '✓ Copied!' : '📋 Copy SQL'}
          </button>
          <button
            onClick={handleDownloadSchema}
            className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-gray-300 bg-white text-gray-700 hover:border-forest-500 transition-all"
          >
            ⬇ Download SQL
          </button>
          {config.supabaseUrl && (() => {
            const m = config.supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
            if (!m) return null;
            return (
              <a
                href={`https://supabase.com/dashboard/project/${m[1]}/sql/new`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl text-sm font-semibold border-2 border-gray-300 bg-white text-gray-700 hover:border-forest-500 transition-all"
              >
                SQL Editor ↗
              </a>
            );
          })()}
        </div>
        <div className="text-xs text-gray-400 mt-1">File: <span className="font-mono">jain-shiviros-schema.sql</span></div>
      </Section>

      {/* Setup Wizard */}
      <Section title="Setup Wizard">
        <p className="text-sm text-gray-600">Re-open the guided setup wizard to update your Supabase connection or reconfigure the camp from scratch.</p>
        <a
          href="/setup"
          className="inline-block px-5 py-2 rounded-xl text-sm font-semibold bg-forest-700 text-white hover:bg-forest-800"
        >
          Open Setup Wizard
        </a>
      </Section>

      {/* Danger Zone */}
      <Section title="Reset Setup">
        <p className="text-sm text-gray-600">This will clear all configuration (Supabase credentials, camp info, passwords) and show the setup wizard again. Your database data is not affected.</p>
        <button
          onClick={() => {
            if (window.confirm('Reset all configuration? You will need to go through the setup wizard again.')) {
              config.resetConfig();
              window.location.href = '/';
            }
          }}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
        >
          Reset Configuration
        </button>
      </Section>

    </div>
  );
}
