import { useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useConfigStore } from '../../store/useConfigStore.js';
import schemaSQL from '../../../supabase/schema.sql?raw';
import addPointsRPC from '../../../supabase/add_points_rpc.sql?raw';

const FULL_SQL = schemaSQL + '\n\n' + addPointsRPC;

const REQUIRED_TABLES = [
  'students', 'volunteers', 'transactions',
  'attendance', 'attendance_submissions',
  'coin_distributions', 'coin_returns',
];

function extractProjectRef(url) {
  return url.trim().match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
}

export default function SetupWizard() {
  const { saveSupabaseConfig, saveCampConfig, completeSetup } = useConfigStore();

  const [step, setStep] = useState(1);

  // Step 1
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [connError, setConnError] = useState('');

  // Step 2
  const [verifying, setVerifying] = useState(false);
  const [tableStatus, setTableStatus] = useState({});
  const [copied, setCopied] = useState(false);

  // Step 3
  const [campName, setCampName] = useState('');
  const [campCity, setCampCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adminPwd, setAdminPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [coinPin, setCoinPin] = useState('');

  const projectRef = useMemo(() => extractProjectRef(url), [url]);
  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  const allTablesOk = REQUIRED_TABLES.every(t => tableStatus[t] === true);
  const step3Valid = campName.trim() && startDate && endDate && adminPwd.length >= 6 && /^\d{4}$/.test(coinPin);

  const testConnection = async () => {
    setTesting(true);
    setConnError('');
    try {
      const client = createClient(url.trim(), anonKey.trim());
      // Use auth.getSession() — works without any tables existing yet
      const { error } = await client.auth.getSession();
      if (error) throw new Error(error.message);
      setConnected(true);
      saveSupabaseConfig({ supabaseUrl: url.trim(), supabaseAnonKey: anonKey.trim() });
    } catch (err) {
      setConnError(err.message || 'Could not connect. Check your URL and key.');
    }
    setTesting(false);
  };

  const verifyTables = async () => {
    setVerifying(true);
    const client = createClient(url.trim(), anonKey.trim());
    const status = {};
    for (const table of REQUIRED_TABLES) {
      try {
        const { error } = await client.from(table).select('id').limit(1);
        status[table] = !error;
      } catch {
        status[table] = false;
      }
    }
    setTableStatus(status);
    setVerifying(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(FULL_SQL).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([FULL_SQL], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jain-shiviros-schema.sql';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleLaunch = () => {
    const days = startDate && endDate
      ? Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1)
      : 7;
    saveCampConfig({
      campName: campName.trim(), campCity: campCity.trim(),
      campStartDate: startDate, campEndDate: endDate, campTotalDays: days,
      adminPassword: adminPwd, coinkeeperPin: coinPin,
    });
    completeSetup();
    window.location.href = '/';
  };

  const STEPS = ['Connect', 'Database', 'Configure', 'Launch'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-800 to-forest-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header */}
        <div className="bg-forest-700 px-6 pt-6 pb-4">
          <div className="text-white text-xl font-bold mb-1">jain-shivirOS</div>
          <div className="text-forest-200 text-sm mb-4">Camp Management Platform — Setup</div>
          <div className="flex gap-2">
            {STEPS.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                  ${step === i + 1 ? 'bg-saffron-500 text-white' : step > i + 1 ? 'bg-green-400 text-white' : 'bg-forest-500 text-forest-200'}`}>
                  {step > i + 1 ? '✓' : i + 1}
                </div>
                <div className={`text-[10px] ${step === i + 1 ? 'text-white' : 'text-forest-300'}`}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6">

          {/* STEP 1 — Connect Supabase */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-bold text-gray-900">Connect your Supabase project</div>
                <div className="text-sm text-gray-500 mt-1">ShivirOS needs a free Supabase database to store camp data.</div>
              </div>

              {/* Create project guide */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Don't have a project yet? Follow these steps:</div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-semibold">supabase.com</a> and create a free account</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Click <strong>New project</strong>, give it a name (e.g. "Shivir 2026") and a database password</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Wait ~1 min for the project to be ready, then open <strong>Project Settings → API</strong></span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                  <span>Copy the <strong>Project URL</strong> and <strong>anon / public key</strong> into the fields below</span>
                </div>
                <a
                  href="https://supabase.com/dashboard/new"
                  target="_blank"
                  rel="noreferrer"
                  className="block mt-1 w-full text-center py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold"
                >
                  Create Supabase project ↗
                </a>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Project URL</label>
                <input
                  className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500"
                  placeholder="https://xxxxxxxxxxx.supabase.co"
                  value={url}
                  onChange={e => { setUrl(e.target.value); setConnected(false); setConnError(''); }}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Anon / Public Key</label>
                <input
                  className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500 font-mono text-xs"
                  placeholder="eyJ..."
                  value={anonKey}
                  onChange={e => { setAnonKey(e.target.value); setConnected(false); setConnError(''); }}
                />
              </div>
              {connError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{connError}</div>
              )}
              {connected && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-green-700 flex items-center gap-2">
                  ✓ Connected to Supabase successfully
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={testConnection}
                  disabled={testing || !url.trim() || !anonKey.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-forest-700 text-white text-sm font-semibold disabled:opacity-40"
                >
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!connected}
                  className="flex-1 py-2.5 rounded-xl bg-saffron-500 text-white text-sm font-semibold disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 — Database schema */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-bold text-gray-900">Set up your database</div>
                <div className="text-sm text-gray-500 mt-1">Create all tables with one SQL command in Supabase.</div>
              </div>

              {/* Numbered steps */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</span>
                  <span>Click <strong>Copy SQL</strong> or <strong>Download SQL</strong> below</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</span>
                  <span>Click <strong>Open SQL Editor ↗</strong> — it opens your Supabase project directly</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</span>
                  <span>Paste the SQL, click <strong>Run</strong> — all tables are created instantly</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-blue-800">
                  <span className="bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">4</span>
                  <span>Come back here and click <strong>Verify Tables</strong></span>
                </div>
              </div>

              {/* SQL preview */}
              <div className="relative border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-100 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <span className="text-xs font-mono text-gray-500">jain-shiviros-schema.sql</span>
                  <span className="text-xs text-gray-400">{FULL_SQL.split('\n').length} lines</span>
                </div>
                <pre className="bg-gray-50 p-3 text-[11px] font-mono overflow-y-auto max-h-36 text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {FULL_SQL.slice(0, 600)}
                  {'\n'}…{'\n'}(full file — use Copy or Download below)
                </pre>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleCopy}
                  className={`py-2.5 rounded-xl text-sm font-semibold transition-all
                    ${copied ? 'bg-green-500 text-white' : 'bg-forest-700 text-white'}`}
                >
                  {copied ? '✓ Copied!' : 'Copy SQL'}
                </button>
                <button
                  onClick={handleDownload}
                  className="py-2.5 rounded-xl text-sm font-semibold bg-forest-700 text-white"
                >
                  Download SQL
                </button>
                <a
                  href={sqlEditorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 rounded-xl text-sm font-semibold bg-saffron-500 text-white text-center"
                >
                  SQL Editor ↗
                </a>
              </div>

              {/* Verify */}
              <button
                onClick={verifyTables}
                disabled={verifying}
                className="w-full py-2.5 rounded-xl border-2 border-forest-700 text-forest-700 text-sm font-semibold disabled:opacity-40"
              >
                {verifying ? 'Checking tables…' : 'Verify Tables'}
              </button>

              {Object.keys(tableStatus).length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 text-xs font-medium text-gray-500">
                    {allTablesOk ? '✅ All tables found — ready to continue' : '❌ Some tables missing — run the SQL then verify again'}
                  </div>
                  <div className="divide-y">
                    {REQUIRED_TABLES.map(table => (
                      <div key={table} className="flex items-center justify-between px-3 py-1.5 text-sm">
                        <span className="font-mono text-gray-700">{table}</span>
                        <span className="text-base">{tableStatus[table] ? '✅' : '❌'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600">← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!allTablesOk}
                  className="flex-1 py-2.5 rounded-xl bg-saffron-500 text-white text-sm font-semibold disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 — Camp config */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <div className="text-lg font-bold text-gray-900">Configure your camp</div>
                <div className="text-sm text-gray-500 mt-1">You can change all of this later in Admin → Settings.</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Camp Name</label>
                  <input className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500"
                    placeholder="Jain Shivir 2026" value={campName} onChange={e => setCampName(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">City <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500"
                    placeholder="Your City" value={campCity} onChange={e => setCampCity(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  <input type="date" className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500"
                    value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">End Date</label>
                  <input type="date" className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500"
                    value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Admin Password</label>
                  <div className="relative mt-1">
                    <input type={showPwd ? 'text' : 'password'}
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500 pr-16"
                      placeholder="Min 6 characters" value={adminPwd} onChange={e => setAdminPwd(e.target.value)} />
                    <button onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                      {showPwd ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-700">Coinkeeper PIN <span className="text-gray-400 font-normal">(4 digits)</span></label>
                  <input className="mt-1 w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500 font-mono tracking-widest"
                    placeholder="1234" maxLength={4}
                    value={coinPin} onChange={e => setCoinPin(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600">← Back</button>
                <button onClick={() => setStep(4)} disabled={!step3Valid}
                  className="flex-1 py-2.5 rounded-xl bg-saffron-500 text-white text-sm font-semibold disabled:opacity-40">
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4 — Launch */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <div className="text-lg font-bold text-gray-900">You're all set!</div>
                <div className="text-sm text-gray-500 mt-1">Review your configuration before launching.</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Camp</span><span className="font-semibold text-gray-900">{campName}{campCity ? `, ${campCity}` : ''}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Dates</span><span className="font-semibold text-gray-900">{startDate} → {endDate}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Admin password</span><span className="font-semibold text-gray-900">{'•'.repeat(adminPwd.length)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Coinkeeper PIN</span><span className="font-semibold text-gray-900">••••</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Supabase</span><span className="font-semibold text-green-600">Connected ✓</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Database tables</span><span className="font-semibold text-green-600">All verified ✓</span></div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                After launching: go to <strong>Admin → Mentors</strong> to add your volunteer team, and <strong>Admin → Operations</strong> to import students via CSV.
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="px-4 py-3 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600">← Back</button>
                <button onClick={handleLaunch} className="flex-1 py-3 rounded-xl bg-forest-700 text-white font-bold text-base">
                  Launch App →
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
