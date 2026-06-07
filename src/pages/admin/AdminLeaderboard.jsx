import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import { supabase } from '../../lib/supabase.js';
import { getCampDayForDate } from '../../lib/campDates.js';
import { normalizeAgeGroup } from '../../lib/formatters.js';
import Select from '../../components/common/Select.jsx';
import MultiCheckSelect from '../../components/common/MultiCheckSelect.jsx';

const CATEGORY_COLORS = {
  High: 'bg-green-100 text-green-700 border-green-300',
  'Mid-High': 'bg-blue-100 text-blue-700 border-blue-300',
  Mid: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Low: 'bg-gray-100 text-gray-600 border-gray-300',
};

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
const naturalSort = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
const normalize = (v) => String(v || '').trim().toLowerCase();
const normalizeRoll = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isAttendanceTransaction = (tx) => /attendance\s*[—-]\s*class/i.test(String(tx?.activity || ''));

function getStudentPaathshalaName(student, codeToName) {
  const code = String(student?.paathshala_code || '').trim();
  return codeToName[code] || student?.pathshala || student?.paathshala || '';
}

function getStudentFatherName(student) {
  return student?.father_name || student?.parent_name || '';
}

// ── Export helpers ─────────────────────────────────────────────────────────
const escapeCSV = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
const buildCSVContent = (headers, rows) =>
  [headers, ...rows].map(r => r.map(escapeCSV).join(',')).join('\n');

const downloadCSV = (filename, content) => {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const exportPDF = (title, headers, rows) => {
  const win = window.open('', '_blank');
  if (!win) return;
  const thead = headers.map((h, i) => `<th class="${i >= headers.length - 1 ? 'num' : ''}">${escapeHtml(h)}</th>`).join('');
  const tbody = rows.map(r =>
    `<tr>${r.map((c, i) => `<td class="${i >= headers.length - 1 ? 'num' : ''}">${escapeHtml(c)}</td>`).join('')}</tr>`
  ).join('');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:24px;}
      h1{font-size:18px;margin:0 0 2px;color:#14532d;}
      .meta{font-size:11px;color:#6b7280;margin-bottom:14px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#14532d;color:#fff;text-align:left;padding:7px 9px;}
      td{padding:6px 9px;border-bottom:1px solid #e5e7eb;}
      tr:nth-child(even) td{background:#f9fafb;}
      .num{text-align:right;}
      th.num{text-align:right;}
      @media print{ button{display:none;} }
      .bar{margin-bottom:14px;}
      .bar button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:#ea7c1f;color:#fff;font-weight:600;cursor:pointer;}
    </style></head><body>
    <div class="bar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} rows</div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch { /* user can use button */ } }, 400);
};

const normalizeGender = (g) => {
  const v = String(g || '').trim().toLowerCase();
  if (['m', 'male', 'boy', 'boys'].includes(v)) return 'Male';
  if (['f', 'female', 'girl', 'girls'].includes(v)) return 'Female';
  return '';
};


function getTxCategory(tx) {
  const type = (tx.type || '').toLowerCase();
  const activity = (tx.activity || '').toLowerCase();
  if (type === 'deduction' || Number(tx.points) < 0) return 'Deduction';
  if (activity.includes('attendance')) return 'Attendance';
  if (type === 'behaviour' || activity.includes('good behaviour')) return 'Good Behaviour';
  if (type === 'coin' || activity.includes('coin collection')) return 'Coin Collection';
  if (type === 'submission' || activity.includes('slot') || activity.includes('submission')) return 'Slot Submission';
  if (activity.includes('kanth')) return 'Kanth Path';
  if (activity.includes('drawing') || activity.includes('story')) return 'Drawing & Story';
  if (activity.includes('competition') || activity.includes('creative')) return 'Competition';
  if (activity.includes('early riser')) return 'Early Riser';
  if (activity.includes('bhakti')) return 'Bhakti';
  if (activity.includes('khojooge')) return 'Khojooge';
  if (activity.includes('room discipline')) return 'Room Discipline';
  if (activity.includes('copy') || activity.includes('notes')) return 'Copy/Notes';
  if (type === 'program') return 'Program Activity';
  if (type === 'digital') return 'Digital Award';
  if (activity.includes('yoga') || activity.includes('poojan') || activity.includes('samuhik')) return 'Program Activity';
  return 'Other';
}

const CATEGORY_ICON = {
  'Attendance':       '📋',
  'Good Behaviour':   '⭐',
  'Coin Collection':  '🪙',
  'Slot Submission':  '📦',
  'Digital Award':    '🏆',
  'Kanth Path':       '📖',
  'Drawing & Story':  '🎨',
  'Competition':      '🏅',
  'Early Riser':      '🌅',
  'Bhakti':           '🕉️',
  'Khojooge':         '🔍',
  'Program Activity': '🎤',
  'Room Discipline':  '🏠',
  'Copy/Notes':       '📝',
  'Deduction':        '❌',
  'Other':            '📌',
};

const DAY_LABEL = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

// ── Student Detail Modal ───────────────────────────────────────────────────────

function StudentDetailModal({ student, onClose }) {
  const [txns, setTxns] = useState(null);
  const [gbLogs, setGbLogs] = useState([]);
  const [coinLogs, setCoinLogs] = useState([]);
  const [negLogs, setNegLogs] = useState([]);
  const [trueDbTotal, setTrueDbTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('summary');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [txRes, gbRes, ccRes, nmRes, studentRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('student_id', student.id).order('timestamp', { ascending: false }),
        supabase.from('good_behaviour_logs').select('*').eq('student_id', student.id).order('timestamp', { ascending: false }),
        supabase.from('coin_collection_logs').select('*').eq('student_id', student.id).order('timestamp', { ascending: false }),
        supabase.from('negative_markings').select('*').eq('student_id', student.id).order('timestamp', { ascending: false }),
        supabase.from('students').select('total_points').eq('id', student.id).single(),
      ]);
      if (!cancelled) {
        // Deduplicate only by transaction ID — the DB assigns a unique ID per row,
        // so this removes true duplicates (same record fetched twice) without
        // collapsing legitimate repeated awards (same activity, same slot, same volunteer).
        const raw = txRes.data || [];
        const seen = new Set();
        const deduped = raw.filter(tx => {
          const key = tx.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setTxns(deduped);
        setGbLogs(gbRes.data || []);
        setCoinLogs(ccRes.data || []);
        setNegLogs(nmRes.data || []);
        // Use the live Supabase value — student prop may include local pending overlay
        setTrueDbTotal(Number(studentRes.data?.total_points ?? student.original_total_points ?? student.total_points ?? 0));
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [student.id]);

  const txGained   = (txns || []).filter(t => Number(t.points) > 0).reduce((s, t) => s + Number(t.points), 0);
  const txDeducted = Math.abs((txns || []).filter(t => Number(t.points) < 0).reduce((s, t) => s + Number(t.points), 0));
  const txTotal    = (txns || []).reduce((s, t) => s + Number(t.points || 0), 0);
  const totalCoins = (txns || []).reduce((s, t) => s + Number(t.coin_count || 0), 0);
  // trueDbTotal: fetched live from Supabase — never includes local pending overlay
  const dbTotal = trueDbTotal ?? Number(student.original_total_points ?? student.total_points ?? 0);
  const localTotal = Number(student.original_total_points ?? student.total_points ?? 0);
  const pendingUnsynced = localTotal - dbTotal;   // points awarded locally but not yet on server
  const legacyBalance = dbTotal - txTotal;         // gap between server total and transaction records
  const attendanceRemoved = Number(student.attendance_points_removed || 0);

  const categoryMap = {};
  (txns || []).forEach(tx => {
    const pts = Number(tx.points || 0);
    if (pts === 0) return;
    const cat = getTxCategory(tx);
    if (!categoryMap[cat]) categoryMap[cat] = { points: 0, entries: 0, coins: 0 };
    categoryMap[cat].points += pts;
    categoryMap[cat].entries += 1;
    categoryMap[cat].coins += Number(tx.coin_count || 0);
  });
  const categories = Object.entries(categoryMap).sort((a, b) => b[1].points - a[1].points);

  const dayPoints = Array.isArray(student.day_points) ? student.day_points : [];

  const SECTIONS = [
    { key: 'summary',      label: 'Summary' },
    { key: 'byDay',        label: 'By Day' },
    { key: 'byCategory',   label: 'By Activity' },
    { key: 'transactions', label: `Transactions (${(txns || []).length})` },
    { key: 'logs',         label: `Logs (${gbLogs.length + coinLogs.length + negLogs.length})` },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[94vh] flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <div className="font-bold text-gray-900 text-lg leading-tight truncate">{student.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {[normalizeAgeGroup(student.batch), student.class && `Class ${student.class}`, student.room_no && `Room ${student.room_no}`, student.group].filter(Boolean).join(' • ')}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 ml-3">
            <div className="text-right">
              <div className="text-[11px] text-gray-400">Leaderboard Pts</div>
              <div className="text-2xl font-bold text-saffron-600 leading-tight">{student.total_points}</div>
            </div>
            <button onClick={onClose} className="text-gray-400 text-2xl leading-none p-1">✕</button>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100 overflow-x-auto flex-shrink-0">
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors
                ${activeSection === s.key ? 'bg-saffron-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading all point records…</div>
          ) : (
            <>
              {/* ── SUMMARY ── */}
              {activeSection === 'summary' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-green-50 border border-green-100 p-3">
                      <div className="text-xs text-green-600 font-semibold">Total Gained</div>
                      <div className="text-2xl font-bold text-green-700 mt-0.5">+{txGained}</div>
                      <div className="text-[10px] text-green-500 mt-0.5">from {(txns || []).length} records</div>
                    </div>
                    <div className="rounded-2xl bg-red-50 border border-red-100 p-3">
                      <div className="text-xs text-red-500 font-semibold">Total Deducted</div>
                      <div className="text-2xl font-bold text-red-600 mt-0.5">{txDeducted > 0 ? `-${txDeducted}` : '0'}</div>
                      <div className="text-[10px] text-red-400 mt-0.5">from {(txns || []).filter(t => Number(t.points) < 0).length} entries</div>
                    </div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-3">
                      <div className="text-xs text-amber-600 font-semibold">Physical Coins</div>
                      <div className="text-2xl font-bold text-amber-700 mt-0.5">{totalCoins}</div>
                      <div className="text-[10px] text-amber-500 mt-0.5">issued total</div>
                    </div>
                    <div className={`rounded-2xl border p-3 ${pendingUnsynced > 0 ? 'bg-blue-50 border-blue-200' : 'bg-saffron-50 border-saffron-200'}`}>
                      <div className={`text-xs font-semibold ${pendingUnsynced > 0 ? 'text-blue-600' : 'text-saffron-600'}`}>Synced to Server</div>
                      <div className={`text-2xl font-bold mt-0.5 ${pendingUnsynced > 0 ? 'text-blue-700' : 'text-saffron-700'}`}>{dbTotal}</div>
                      <div className={`text-[10px] mt-0.5 ${pendingUnsynced > 0 ? 'text-blue-500' : 'text-saffron-500'}`}>
                        {pendingUnsynced > 0 ? `+${pendingUnsynced} pts pending sync` : 'fully synced'}
                      </div>
                    </div>
                  </div>

                  {(student.attendance_points_raw > 0 || student.attendance_points_fair > 0) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 space-y-0.5">
                      <div>📋 <strong>Attendance normalised</strong> (raw sessions → 1 day = +5 pts)</div>
                      <div className="flex gap-4">
                        <span>Raw recorded: <strong>{student.attendance_points_raw ?? 0} pts</strong></span>
                        <span>Fair credit: <strong>+{student.attendance_points_fair ?? 0} pts</strong></span>
                        {attendanceRemoved !== 0 && (
                          <span className={attendanceRemoved > 0 ? 'text-amber-800' : 'text-green-700'}>
                            Net: {attendanceRemoved > 0 ? '−' : '+'}{Math.abs(attendanceRemoved)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {categories.length > 0 && (
                    <div className="bg-gray-50 rounded-2xl p-3 space-y-1.5">
                      <div className="text-xs font-semibold text-gray-500 mb-2">Points by Activity</div>
                      {categories.map(([cat, info]) => (
                        <div key={cat} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{CATEGORY_ICON[cat] || '📌'} {cat}</span>
                          <span className={`font-bold ${info.points < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {info.points > 0 ? `+${info.points}` : info.points}
                          </span>
                        </div>
                      ))}
                      {pendingUnsynced > 0 && (
                        <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-200">
                          <span className="text-blue-600">⏳ Pending sync</span>
                          <span className="font-bold text-blue-600">+{pendingUnsynced}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {pendingUnsynced > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
                      ⏳ {pendingUnsynced} pts were awarded on a device but haven't synced to the server yet. They will appear once that device comes online.
                    </div>
                  )}
                </>
              )}

              {/* ── BY DAY ── */}
              {activeSection === 'byDay' && (
                <>
                  <div className="text-xs text-gray-400 mb-1">Points earned per day of the camp (from stored day_points field).</div>
                  {dayPoints.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">No day-wise data available.</div>
                  )}
                  <div className="space-y-2">
                    {dayPoints.map((pts, idx) => {
                      const pct = txTotal > 0 ? Math.round((pts / txTotal) * 100) : 0;
                      return (
                        <div key={idx} className="bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold text-gray-700">{DAY_LABEL[idx] || `Day ${idx + 1}`}</span>
                            <span className={`font-bold text-base ${pts > 0 ? 'text-green-700' : pts < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {pts > 0 ? `+${pts}` : pts === 0 ? '—' : pts}
                            </span>
                          </div>
                          {pts > 0 && (
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div className="bg-saffron-500 h-1.5 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="bg-saffron-50 border border-saffron-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-saffron-700">Grand Total</span>
                    <span className="text-lg font-bold text-saffron-700">{txTotal}</span>
                  </div>
                </>
              )}

              {/* ── BY CATEGORY ── */}
              {activeSection === 'byCategory' && (
                <>
                  {categories.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">No categorized transactions found.</div>
                  )}
                  <div className="space-y-1.5">
                    {categories.map(([cat, info]) => (
                      <div key={cat} className={`rounded-xl border px-3 py-3 ${info.points < 0 ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{CATEGORY_ICON[cat] || '📌'}</span>
                            <div>
                              <div className="font-semibold text-sm text-gray-800">{cat}</div>
                              <div className="text-xs text-gray-400">
                                {info.entries} {info.entries === 1 ? 'entry' : 'entries'}
                                {info.coins > 0 ? ` · ${info.coins} coins` : ''}
                              </div>
                            </div>
                          </div>
                          <span className={`font-bold text-lg ${info.points < 0 ? 'text-red-600' : 'text-green-700'}`}>
                            {info.points > 0 ? `+${info.points}` : info.points}
                          </span>
                        </div>
                      </div>
                    ))}
                    {pendingUnsynced > 0 && (
                      <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">⏳</span>
                            <div>
                              <div className="font-semibold text-sm text-blue-800">Pending sync</div>
                              <div className="text-xs text-blue-500">Awarded offline, not yet on server</div>
                            </div>
                          </div>
                          <span className="font-bold text-lg text-blue-600">+{pendingUnsynced}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-saffron-50 border border-saffron-200 rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <span className="text-sm font-semibold text-saffron-700">Total (all categories)</span>
                    <span className="text-lg font-bold text-saffron-700">{txTotal}</span>
                  </div>
                </>
              )}

              {/* ── TRANSACTIONS ── */}
              {activeSection === 'transactions' && (
                <>
                  {(txns || []).length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">No transactions recorded.</div>
                  )}
                  <div className="space-y-1.5">
                    {(txns || []).map(tx => {
                      const pts = Number(tx.points || 0);
                      const isDeduction = pts < 0;
                      return (
                        <div key={tx.id} className={`rounded-xl px-3 py-2.5 border text-sm ${isDeduction ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-gray-800 truncate">
                                {CATEGORY_ICON[getTxCategory(tx)] || '📌'} {tx.activity || 'Unknown Activity'}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
                                {tx.volunteer_name && <span>by {tx.volunteer_name}</span>}
                                {tx.day && <span>Day {tx.day}{tx.slot ? ` · Slot ${tx.slot}` : ''}</span>}
                                {tx.timestamp && <span>{new Date(tx.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                              </div>
                              {tx.notes && <div className="text-xs text-gray-500 mt-0.5 italic truncate">{tx.notes}</div>}
                            </div>
                            <div className={`font-bold text-base flex-shrink-0 ${isDeduction ? 'text-red-600' : 'text-green-700'}`}>
                              {isDeduction ? pts : `+${pts}`}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── LOGS (raw tables) ── */}
              {activeSection === 'logs' && (
                <>
                  <div className="text-xs text-gray-400 mb-1">
                    Raw log entries from Good Behaviour, Coin Collection, and Negative Marking tables. Extra entries here vs. Transactions indicate records that may not have synced.
                  </div>

                  {gbLogs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">⭐ Good Behaviour ({gbLogs.length})</div>
                      <div className="space-y-1">
                        {gbLogs.map(l => (
                          <div key={l.id} className="rounded-xl bg-white border border-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium text-gray-800">{l.behaviour_type || 'Good Behaviour'}</div>
                              <div className="text-xs text-gray-400">{l.mentor_name || '—'} · Day {l.day_number}</div>
                            </div>
                            <span className="font-bold text-green-700">+{l.points || 5}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {coinLogs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">🪙 Coin Collection ({coinLogs.length})</div>
                      <div className="space-y-1">
                        {coinLogs.map(l => (
                          <div key={l.id} className="rounded-xl bg-white border border-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium text-gray-800">{l.coins_collected} coins collected</div>
                              <div className="text-xs text-gray-400">{l.mentor_name || '—'} · Day {l.day_number}</div>
                            </div>
                            <span className="font-bold text-green-700">+{(l.coins_collected || 0) * 5}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {negLogs.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">❌ Negative Markings ({negLogs.length})</div>
                      <div className="space-y-1">
                        {negLogs.map(l => (
                          <div key={l.id} className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 flex items-center justify-between text-sm">
                            <div>
                              <div className="font-medium text-red-800">{l.reason || l.reason_category || 'Deduction'}</div>
                              <div className="text-xs text-red-400">{l.mentor_name || '—'} · Day {l.day_number}</div>
                            </div>
                            <span className="font-bold text-red-600">−{l.points || l.points_deducted || 0}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {gbLogs.length === 0 && coinLogs.length === 0 && negLogs.length === 0 && (
                    <div className="text-center py-6 text-gray-400 text-sm">No log entries found in separate tables.</div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Leaderboard ───────────────────────────────────────────────────────────

export default function AdminLeaderboard() {
  const { t } = useTranslation();
  const { students } = useStudentStore();
  const { transactions } = useTransactionStore();
  const { paathshalas, students: pathshalaStudents } = usePathshalaStore();

  const [activeTab, setActiveTab] = useState('students'); // 'students' | 'paathshala' | 'competition'
  const [competitionEvents, setCompetitionEvents] = useState([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [compView, setCompView] = useState('students'); // 'students' | 'paathshala'
  const [filterBatch, setFilterBatch] = useState('All');
  const [filterClass, setFilterClass] = useState('All');
  const [filterRoom, setFilterRoom] = useState('All');
  const [filterGroup, setFilterGroup] = useState('All');
  const [filterGender, setFilterGender] = useState('All');
  const [selectedAges, setSelectedAges] = useState(new Set());
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase
      .from('events')
      .select('id,name,event_type,is_active,sort_order')
      .eq('event_type', 'competition')
      .order('sort_order')
      .order('name')
      .then(({ data }) => setCompetitionEvents(data || []));
  }, []);

  // Raw attendance points per student (may be inflated: multiple sessions/day)
  const rawAttendanceByStudent = transactions.reduce((acc, tx) => {
    if (!isAttendanceTransaction(tx)) return acc;
    const studentId = String(tx.student_id || '').trim();
    if (!studentId) return acc;
    acc[studentId] = (acc[studentId] || 0) + (Number(tx.points) || 0);
    return acc;
  }, {});

  // Which days had any attendance recorded per student (de-duplicate sessions)
  const attendanceDaysByStudent = transactions.reduce((acc, tx) => {
    if (!isAttendanceTransaction(tx)) return acc;
    const studentId = String(tx.student_id || '').trim();
    const day = Number(tx.day);
    if (!studentId || !day) return acc;
    if (!acc[studentId]) acc[studentId] = new Set();
    acc[studentId].add(day);
    return acc;
  }, {});

  // Fair attendance: +5 per unique day with attendance, only for days >= student's join day
  const codeToPaathshalaName = useMemo(
    () => Object.fromEntries(paathshalas.map((p) => [String(p.paathshala_code), p.paathshala_name])),
    [paathshalas]
  );

  const fairAttendanceByStudent = {};
  students.forEach(s => {
    const joinDay = s.checked_in_at ? getCampDayForDate(new Date(s.checked_in_at)) : 1;
    const daysAttended = attendanceDaysByStudent[String(s.id || '').trim()] || new Set();
    let fair = 0;
    daysAttended.forEach(day => { if (day >= joinDay) fair += 5; });
    fairAttendanceByStudent[String(s.id || '').trim()] = fair;
  });

  // txSumByStudent is kept for reference / modal display but is NOT used for the
  // leaderboard total because the Zustand store may only hold a capped subset of
  // rows (Supabase PostgREST default limit = 1000). Using the authoritative
  // students.total_points ("Synced to Server") as the base avoids that truncation.
  const txSumByStudent = transactions.reduce((acc, tx) => {
    const sid = String(tx.student_id || '').trim();
    if (!sid) return acc;
    acc[sid] = (acc[sid] || 0) + (Number(tx.points) || 0);
    return acc;
  }, {});

  const leaderboard = [...students]
    .map((s) => {
      const sid = String(s.id || '').trim();
      const originalPoints = Number(s.total_points) || 0;
      const rawAttendance  = Number(rawAttendanceByStudent[sid] || 0);
      const fairAttendance = Number(fairAttendanceByStudent[sid] || 0);
      const txSum = Number(txSumByStudent[sid] || 0);
      return {
        ...s,
        paathshala_name: getStudentPaathshalaName(s, codeToPaathshalaName),
        father_name_display: getStudentFatherName(s),
        original_total_points: originalPoints,
        tx_total: txSum,
        attendance_points_raw:  rawAttendance,
        attendance_points_fair: fairAttendance,
        attendance_points_removed: rawAttendance - fairAttendance,
        total_points: originalPoints,
      };
    })
    .sort((a, b) => b.total_points - a.total_points)
    .map((s, i, arr) => {
      const maxScore = Number(arr[0]?.total_points) || 1;
      const pct = Number(s.total_points) / maxScore;
      const category = pct >= 0.75 ? 'High' : pct >= 0.5 ? 'Mid-High' : pct >= 0.25 ? 'Mid' : 'Low';
      return { ...s, rank: i + 1, category };
    });

  const batches  = ['All', ...[...new Set(leaderboard.map(s => normalizeAgeGroup(s.batch)).filter(Boolean))].sort(naturalSort)];
  const classes  = ['All', ...[...new Set(leaderboard.map(s => s.class).filter(Boolean))].sort(naturalSort)];
  const rooms    = ['All', ...[...new Set(leaderboard.map(s => s.room_no).filter(Boolean))].sort(naturalSort)];
  const groups   = ['All', ...[...new Set(leaderboard.map(s => s.group).filter(Boolean))].sort(naturalSort)];
  const genders  = ['All', ...[...new Set(leaderboard.map(s => normalizeGender(s.gender)).filter(Boolean))].sort()];
  const ageOptions = [...new Set(leaderboard.map(s => Number(s.age)).filter(Boolean))].sort((a, b) => a - b);
  const q = normalize(searchQuery);
  const qRoll = normalizeRoll(searchQuery);

  const filtered = leaderboard.filter(s =>
    (
      searchQuery === '' ||
      normalize(s.name).includes(q) ||
      normalize(String(s.roll_no || '')).includes(q) ||
      normalizeRoll(s.roll_no).includes(qRoll) ||
      normalize(s.paathshala_name).includes(q) ||
      normalize(s.father_name_display).includes(q)
    ) &&
    (filterBatch  === 'All' || normalizeAgeGroup(s.batch) === filterBatch) &&
    (filterClass  === 'All' || s.class === filterClass) &&
    (filterRoom   === 'All' || s.room_no === filterRoom) &&
    (filterGroup  === 'All' || s.group === filterGroup) &&
    (filterGender === 'All' || normalizeGender(s.gender) === filterGender) &&
    (selectedAges.size === 0 || selectedAges.has(Number(s.age)))
  );

  // Paathshala Rankings: aggregate student points per school
  const pathshalaRankings = paathshalas
    .map(p => {
      const myStudents = pathshalaStudents.filter(s => s.paathshala_code === p.paathshala_code);
      const totalPoints = myStudents.reduce((sum, s) => sum + (Number(s.total_points) || 0), 0);
      return { ...p, totalPoints, studentCount: myStudents.length };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // ── Competition leaderboard ──────────────────────────────────────────────
  // Competition points are stored as transactions with type "Competition" and
  // activity = the competition's name. We list competitions from competition-
  // type events plus any names that already have competition awards.
  const competitionTxs = transactions.filter(tx => String(tx.type || '').toLowerCase() === 'competition');
  const compNamesFromTx = [...new Set(competitionTxs.map(t => String(t.activity || '').trim()).filter(Boolean))];
  const competitionNames = [...new Set([
    ...competitionEvents.map(e => String(e.name || '').trim()).filter(Boolean),
    ...compNamesFromTx,
  ])].sort(naturalSort);
  const activeComp = selectedComp || competitionNames[0] || '';

  const compSelNorm = normalize(activeComp);
  const compPerStudent = {};
  competitionTxs.forEach(t => {
    if (normalize(t.activity) !== compSelNorm) return;
    const sid = String(t.student_id || '').trim();
    if (!sid) return;
    compPerStudent[sid] = (compPerStudent[sid] || 0) + (Number(t.points) || 0);
  });

  const compStudentRanking = students
    .map(s => ({ ...s, compPoints: compPerStudent[String(s.id || '').trim()] || 0 }))
    .filter(s => s.compPoints > 0)
    .sort((a, b) => b.compPoints - a.compPoints)
    .map((s, i) => ({ ...s, rank: i + 1 }));

  const compPerPaathshala = {};
  students.forEach(s => {
    const pts = compPerStudent[String(s.id || '').trim()] || 0;
    if (!pts) return;
    const code = String(s.paathshala_code || '').trim();
    const key = code || (s.pathshala ? `name:${normalize(s.pathshala)}` : 'unknown');
    if (!compPerPaathshala[key]) {
      compPerPaathshala[key] = {
        key,
        name: codeToPaathshalaName[code] || s.pathshala || 'Unassigned',
        code,
        points: 0,
        studentCount: 0,
      };
    }
    compPerPaathshala[key].points += pts;
    compPerPaathshala[key].studentCount += 1;
  });
  const compPaathshalaRanking = Object.values(compPerPaathshala)
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  const compTotalPoints = Object.values(compPerStudent).reduce((s, v) => s + v, 0);

  const today = new Date().toISOString().slice(0, 10);
  const safeName = (s) => String(s || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();

  // Build { title, filename, headers, rows } for the currently active tab/view
  const getExportData = () => {
    if (activeTab === 'paathshala') {
      return {
        title: 'Paathshala Rankings',
        filename: `leaderboard_paathshala_${today}`,
        headers: ['Rank', 'Paathshala', 'Teacher', 'Students', 'Total Points'],
        rows: pathshalaRankings.map((p, i) => [
          i + 1, p.paathshala_name, p.teacher1_name || '', p.studentCount, p.totalPoints,
        ]),
      };
    }
    if (activeTab === 'competition') {
      if (compView === 'paathshala') {
        return {
          title: `Competition – ${activeComp} (By Paathshala)`,
          filename: `competition_${safeName(activeComp)}_paathshala_${today}`,
          headers: ['Rank', 'Paathshala', 'Participants', 'Total Points'],
          rows: compPaathshalaRanking.map((p, i) => [i + 1, p.name, p.studentCount, p.points]),
        };
      }
      return {
        title: `Competition – ${activeComp} (By Student)`,
        filename: `competition_${safeName(activeComp)}_students_${today}`,
        headers: ['Rank', 'Name', 'Roll', 'Batch', 'Paathshala', 'Points'],
        rows: compStudentRanking.map(s => [
          s.rank, s.name, s.roll_no || '', normalizeAgeGroup(s.batch) || '',
          s.pathshala || codeToPaathshalaName[String(s.paathshala_code)] || '', s.compPoints,
        ]),
      };
    }
    // Students tab (respects current filters/search)
    return {
      title: 'Student Rankings',
      filename: `leaderboard_students_${today}`,
      headers: ['Rank', 'Name', 'Children Roll No', 'Paathshala Name', "Father's Name", 'Room', 'Group', 'Gender', 'Age', 'Total Points', 'Category'],
      rows: filtered.map(s => [
        s.rank, s.name, s.roll_no || '', s.paathshala_name || '', s.father_name_display || '',
        s.room_no || '', s.group || '', normalizeGender(s.gender) || '', s.age || '',
        s.total_points, s.category,
      ]),
    };
  };

  const handleExportCSV = () => {
    const { filename, headers, rows } = getExportData();
    downloadCSV(`${filename}.csv`, buildCSVContent(headers, rows));
  };

  const handleExportPDF = () => {
    const { title, headers, rows } = getExportData();
    exportPDF(title, headers, rows);
  };

  return (
    <div className="p-3 sm:p-6 min-w-0 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">🏆 Leaderboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">{leaderboard.length} students · points from transactions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'students' && filtered.length !== leaderboard.length && (
            <span className="text-sm text-saffron-700 font-semibold bg-saffron-50 border border-saffron-200 px-3 py-1 rounded-full">
              {filtered.length} shown
            </span>
          )}
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-xs sm:text-sm font-semibold hover:bg-gray-50"
          >
            📄 Export CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-lg bg-forest-700 text-white text-xs sm:text-sm font-semibold hover:bg-forest-800"
          >
            🧾 Export PDF
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-full sm:w-fit overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'students' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          👤 Students
        </button>
        <button
          onClick={() => setActiveTab('paathshala')}
          className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'paathshala' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          🏫 Paathshala
        </button>
        <button
          onClick={() => setActiveTab('competition')}
          className={`flex-1 sm:flex-none whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${activeTab === 'competition' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          🏅 Competition
        </button>
      </div>

      {/* Paathshala Rankings Tab */}
      {activeTab === 'paathshala' && (
        <div className="space-y-3">
          {pathshalaRankings.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
              <div className="text-4xl mb-2">🏫</div>
              <div className="text-sm">No Paathshalas registered yet</div>
            </div>
          ) : (
            <>
              {/* Top 3 podium */}
              {pathshalaRankings.length >= 2 && (
                <div className="bg-gradient-to-br from-forest-800 to-forest-900 rounded-2xl p-5 text-white mb-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-forest-300 mb-4 text-center">Overall Standings</div>
                  <div className="flex items-end justify-center gap-3">
                    {/* 2nd */}
                    {pathshalaRankings[1] && (
                      <div className="flex-1 text-center">
                        <div className="text-2xl mb-1">🥈</div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="font-bold text-xs truncate">{pathshalaRankings[1].paathshala_name}</div>
                          <div className="text-saffron-300 font-bold text-lg">{pathshalaRankings[1].totalPoints}</div>
                          <div className="text-forest-300 text-xs">{pathshalaRankings[1].studentCount} students</div>
                        </div>
                      </div>
                    )}
                    {/* 1st — taller */}
                    <div className="flex-1 text-center -mb-1">
                      <div className="text-3xl mb-1">🥇</div>
                      <div className="bg-saffron-500/20 border border-saffron-400/30 rounded-xl p-3">
                        <div className="font-bold text-sm truncate">{pathshalaRankings[0].paathshala_name}</div>
                        <div className="text-saffron-300 font-bold text-2xl">{pathshalaRankings[0].totalPoints}</div>
                        <div className="text-forest-300 text-xs">{pathshalaRankings[0].studentCount} students</div>
                      </div>
                    </div>
                    {/* 3rd */}
                    {pathshalaRankings[2] && (
                      <div className="flex-1 text-center">
                        <div className="text-2xl mb-1">🥉</div>
                        <div className="bg-white/10 rounded-xl p-2">
                          <div className="font-bold text-xs truncate">{pathshalaRankings[2].paathshala_name}</div>
                          <div className="text-saffron-300 font-bold text-lg">{pathshalaRankings[2].totalPoints}</div>
                          <div className="text-forest-300 text-xs">{pathshalaRankings[2].studentCount} students</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile cards */}
              <div className="md:hidden space-y-2.5">
                {pathshalaRankings.map((p, idx) => (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="text-lg leading-none flex-shrink-0 mt-0.5">
                          {RANK_MEDALS[idx + 1] || <span className="text-gray-500 font-mono text-sm">#{idx + 1}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900 leading-snug">{p.paathshala_name}</div>
                          {p.teacher1_name && <div className="text-xs text-gray-500 mt-0.5 truncate">👩‍🏫 {p.teacher1_name}</div>}
                          <span className="inline-block mt-1.5 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">{p.studentCount} students</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[11px] text-gray-500">Points</div>
                        <div className="font-bold text-saffron-600 text-lg leading-tight">{p.totalPoints}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-forest-700 text-white">
                      <tr>
                        <th className="px-4 py-3 text-center w-16">Rank</th>
                        <th className="px-4 py-3 text-left">Paathshala</th>
                        <th className="px-4 py-3 text-left hidden sm:table-cell">Teacher</th>
                        <th className="px-4 py-3 text-center">Students</th>
                        <th className="px-4 py-3 text-right">Total Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pathshalaRankings.map((p, idx) => (
                        <tr key={p.id} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx < 3 ? 'font-semibold' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            {RANK_MEDALS[idx + 1] || <span className="text-gray-500 font-mono text-sm">#{idx + 1}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">{p.paathshala_name}</div>
                            {p.address && <div className="text-xs text-gray-500 truncate max-w-[200px]">{p.address}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{p.teacher1_name || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">{p.studentCount}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-saffron-600 text-base">{p.totalPoints}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Competition Leaderboard Tab */}
      {activeTab === 'competition' && (
        <div className="space-y-4">
          {competitionNames.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
              <div className="text-4xl mb-2">🏅</div>
              <div className="text-sm">No competitions found yet.</div>
              <div className="text-xs mt-1">Add a <strong>Competition</strong> event in Operations, or award competition points to students.</div>
            </div>
          ) : (
            <>
              {/* Competition picker + view toggle */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div className="w-full sm:w-72">
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Competition</label>
                  <Select
                    size="sm"
                    value={activeComp}
                    onChange={setSelectedComp}
                    options={competitionNames}
                  />
                </div>
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-auto">
                  <button
                    onClick={() => setCompView('students')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${compView === 'students' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    👤 By Student
                  </button>
                  <button
                    onClick={() => setCompView('paathshala')}
                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${compView === 'paathshala' ? 'bg-white text-forest-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    🏫 By Paathshala
                  </button>
                </div>
              </div>

              {/* Summary strip */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl bg-saffron-50 border border-saffron-200 px-3 py-2.5">
                  <div className="text-[10px] sm:text-[11px] text-saffron-600 font-semibold uppercase tracking-wide leading-tight">Participants</div>
                  <div className="text-lg sm:text-xl font-bold text-saffron-700">{compStudentRanking.length}</div>
                </div>
                <div className="rounded-2xl bg-forest-50 border border-forest-200 px-3 py-2.5">
                  <div className="text-[10px] sm:text-[11px] text-forest-600 font-semibold uppercase tracking-wide leading-tight">Points Awarded</div>
                  <div className="text-lg sm:text-xl font-bold text-forest-700">{compTotalPoints}</div>
                </div>
                <div className="rounded-2xl bg-blue-50 border border-blue-200 px-3 py-2.5">
                  <div className="text-[10px] sm:text-[11px] text-blue-600 font-semibold uppercase tracking-wide leading-tight">Paathshalas</div>
                  <div className="text-lg sm:text-xl font-bold text-blue-700">{compPaathshalaRanking.length}</div>
                </div>
              </div>

              {/* By Student */}
              {compView === 'students' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-forest-700 text-white">
                        <tr>
                          <th className="px-4 py-3 text-center w-16">Rank</th>
                          <th className="px-4 py-3 text-left">Name</th>
                          <th className="px-4 py-3 text-left hidden sm:table-cell">Roll</th>
                          <th className="px-4 py-3 text-left">Batch</th>
                          <th className="px-4 py-3 text-left hidden md:table-cell">Paathshala</th>
                          <th className="px-4 py-3 text-right">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {compStudentRanking.map((s, i) => (
                          <tr
                            key={s.id}
                            onClick={() => setSelectedStudent(s)}
                            className={`border-b last:border-0 cursor-pointer hover:bg-saffron-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${s.rank <= 3 ? 'font-semibold' : ''}`}
                          >
                            <td className="px-4 py-3 text-center">
                              {RANK_MEDALS[s.rank] || <span className="text-gray-500 font-mono">#{s.rank}</span>}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                            <td className="px-4 py-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{s.roll_no || '—'}</td>
                            <td className="px-4 py-3">
                              <span className="bg-forest-100 text-forest-700 px-2 py-0.5 rounded-full text-xs font-semibold">{normalizeAgeGroup(s.batch) || '—'}</span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{s.pathshala || codeToPaathshalaName[String(s.paathshala_code)] || '—'}</td>
                            <td className="px-4 py-3 text-right font-bold text-saffron-600 text-base">+{s.compPoints}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {compStudentRanking.length === 0 && (
                    <div className="text-center py-12 text-gray-400">No points awarded for this competition yet.</div>
                  )}
                </div>
              )}

              {/* By Paathshala */}
              {compView === 'paathshala' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-forest-700 text-white">
                      <tr>
                        <th className="px-4 py-3 text-center w-16">Rank</th>
                        <th className="px-4 py-3 text-left">Paathshala</th>
                        <th className="px-4 py-3 text-center whitespace-nowrap">Participants</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">Total Points</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compPaathshalaRanking.map((p, idx) => (
                        <tr key={p.key} className={`border-b last:border-0 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx < 3 ? 'font-semibold' : ''}`}>
                          <td className="px-4 py-3 text-center">
                            {RANK_MEDALS[idx + 1] || <span className="text-gray-500 font-mono text-sm">#{idx + 1}</span>}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{p.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold">{p.studentCount}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-saffron-600 text-base">+{p.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  {compPaathshalaRanking.length === 0 && (
                    <div className="text-center py-12 text-gray-400">No points awarded for this competition yet.</div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Student Rankings Tab */}
      {activeTab === 'students' && <>
      {/* Search */}
      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          placeholder="Search name, roll no, paathshala, father…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-saffron-400 bg-white shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        <div className="w-full sm:w-32">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Batch</label>
          <Select size="sm" value={filterBatch} onChange={v => { setFilterBatch(v); setFilterClass('All'); }} options={batches} />
        </div>
        <div className="w-full sm:w-32">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Class</label>
          <Select
            size="sm"
            value={filterClass}
            onChange={setFilterClass}
            options={filterBatch === 'All' ? classes : ['All', ...classes.filter(c => c === 'All' || leaderboard.some(s => normalizeAgeGroup(s.batch) === filterBatch && s.class === c))]}
          />
        </div>
        <div className="w-full sm:w-28">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Room</label>
          <Select size="sm" value={filterRoom} onChange={setFilterRoom} options={rooms} />
        </div>
        <div className="w-full sm:w-32">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Group</label>
          <Select size="sm" value={filterGroup} onChange={setFilterGroup} options={groups} />
        </div>
        <div className="w-full sm:w-28">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Gender</label>
          <Select size="sm" value={filterGender} onChange={setFilterGender} options={genders} />
        </div>
        <div className="w-full sm:w-36">
          <label className="text-xs font-semibold text-gray-600 block mb-1">Age</label>
          <MultiCheckSelect
            label="All Ages"
            options={ageOptions}
            selected={selectedAges}
            onChange={setSelectedAges}
            size="sm"
          />
        </div>
        <div className="self-end text-sm text-gray-500 pb-1 sm:pb-2">{filtered.length} of {leaderboard.length}</div>
      </div>

      {/* Mobile / tablet cards */}
      <div className="xl:hidden space-y-2.5">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedStudent(s)}
            className="w-full text-left bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm hover:border-saffron-300 active:scale-[0.98] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none flex-shrink-0">
                    {RANK_MEDALS[s.rank] || <span className="text-gray-500 font-mono text-sm">#{s.rank}</span>}
                  </span>
                  <div className="font-semibold text-gray-900 leading-snug">{s.name}</div>
                </div>
                <dl className="mt-2 space-y-1 text-xs text-gray-600">
                  <div className="flex gap-2">
                    <dt className="text-gray-400 flex-shrink-0 w-24">Roll No</dt>
                    <dd className="font-mono font-semibold text-gray-800">{s.roll_no || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-400 flex-shrink-0 w-24">Paathshala</dt>
                    <dd className="leading-snug">{s.paathshala_name || '—'}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-gray-400 flex-shrink-0 w-24">Father</dt>
                    <dd className="leading-snug">{s.father_name_display || '—'}</dd>
                  </div>
                </dl>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[11px] text-gray-500">Points</div>
                <div className="font-bold text-saffron-600 text-lg leading-tight">{s.total_points}</div>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {s.room_no && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                  Room {s.room_no}
                </span>
              )}
              {s.group && (
                <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                  {s.group}
                </span>
              )}
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${CATEGORY_COLORS[s.category]}`}>
                {t(`admin.category.${s.category.toLowerCase().replace('-', '')}`) || s.category}
              </span>
              {normalizeGender(s.gender) && (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${normalizeGender(s.gender) === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                  {normalizeGender(s.gender)}
                </span>
              )}
              {s.age && (
                <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                  {s.age}y
                </span>
              )}
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
            {t('common.noResults')}
          </div>
        )}
      </div>

      {/* Desktop table — scroll horizontally when columns exceed viewport */}
      <div className="hidden xl:block bg-white rounded-2xl border border-gray-200 max-w-full">
        <div className="overflow-x-auto overscroll-x-contain rounded-2xl">
          <table className="text-sm w-max min-w-full">
            <thead className="bg-forest-700 text-white">
              <tr>
                <th className="px-3 py-3 text-left w-14 sticky left-0 z-20 bg-forest-700">{t('admin.rank')}</th>
                <th className="px-3 py-3 text-left min-w-[120px] max-w-[160px] sticky left-14 z-20 bg-forest-700 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.3)]">{t('common.name')}</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Roll No</th>
                <th className="px-3 py-3 text-left min-w-[160px] max-w-[200px]">Paathshala</th>
                <th className="px-3 py-3 text-left min-w-[120px] max-w-[160px]">Father</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Room</th>
                <th className="px-3 py-3 text-left min-w-[100px] max-w-[140px]">{t('common.group')}</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Gender</th>
                <th className="px-3 py-3 text-left whitespace-nowrap">Age</th>
                <th className="px-3 py-3 text-right whitespace-nowrap sticky right-[88px] z-20 bg-forest-700 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.3)]">Points</th>
                <th className="px-3 py-3 text-center whitespace-nowrap sticky right-0 z-20 bg-forest-700 min-w-[88px]">Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                return (
                <tr
                  key={s.id}
                  onClick={() => setSelectedStudent(s)}
                  className={`group border-b last:border-0 cursor-pointer hover:bg-saffron-50 transition-colors ${rowBg} ${s.rank <= 3 ? 'font-semibold' : ''}`}
                >
                  <td className={`px-3 py-3 text-center sticky left-0 z-10 group-hover:bg-saffron-50 ${rowBg}`}>
                    {RANK_MEDALS[s.rank] || <span className="text-gray-500 font-mono">#{s.rank}</span>}
                  </td>
                  <td className={`px-3 py-3 font-semibold text-gray-900 sticky left-14 z-10 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] max-w-[160px] group-hover:bg-saffron-50 ${rowBg}`}>
                    <span className="block truncate" title={s.name}>{s.name}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-700 font-mono text-xs whitespace-nowrap">{s.roll_no || <span className="text-gray-400">—</span>}</td>
                  <td className="px-3 py-3 text-gray-700 max-w-[200px]">
                    <span className="block truncate" title={s.paathshala_name || ''}>{s.paathshala_name || <span className="text-gray-400">—</span>}</span>
                  </td>
                  <td className="px-3 py-3 text-gray-700 max-w-[160px]">
                    <span className="block truncate" title={s.father_name_display || ''}>{s.father_name_display || <span className="text-gray-400">—</span>}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {s.room_no ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.room_no}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-700 max-w-[140px]">
                    <span className="block truncate" title={s.group || ''}>{s.group || <span className="text-gray-400">—</span>}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {normalizeGender(s.gender) ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${normalizeGender(s.gender) === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'}`}>
                        {normalizeGender(s.gender)}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-3 text-gray-700 whitespace-nowrap">{s.age || <span className="text-gray-400">—</span>}</td>
                  <td className={`px-3 py-3 text-right font-bold text-saffron-600 text-base whitespace-nowrap sticky right-[88px] z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] group-hover:bg-saffron-50 ${rowBg}`}>{s.total_points}</td>
                  <td className={`px-3 py-3 text-center sticky right-0 z-10 min-w-[88px] group-hover:bg-saffron-50 ${rowBg}`}>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${CATEGORY_COLORS[s.category]}`}>
                      {t(`admin.category.${s.category.toLowerCase().replace('-', '')}`) || s.category}
                    </span>
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
        <p className="px-3 py-1.5 text-[11px] text-gray-400 border-t border-gray-100">
          Scroll horizontally if columns are hidden
        </p>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">{t('common.noResults')}</div>
        )}
      </div>

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
      </>}
    </div>
  );
}
