import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useStudentStore } from '../../store/useStudentStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';

const escapeCSV = (cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`;
const buildCSV = (headers, rows) =>
  [headers, ...rows].map((row) => row.map(escapeCSV).join(',')).join('\n');

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

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
));

const exportPDF = (title, headers, rows) => {
  const win = window.open('', '_blank');
  if (!win) return;
  const thead = headers.map((h, i) => `<th class="${i === headers.length - 1 ? 'num' : ''}">${escapeHtml(h)}</th>`).join('');
  const tbody = rows.map((r) =>
    `<tr>${r.map((c, i) => `<td class="${i === headers.length - 1 ? 'num' : ''}">${escapeHtml(c)}</td>`).join('')}</tr>`
  ).join('');

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:24px;}
      h1{font-size:18px;margin:0 0 2px;color:#14532d;}
      .meta{font-size:11px;color:#6b7280;margin-bottom:14px;}
      .bar{margin-bottom:14px;}
      .bar button{font:inherit;padding:8px 16px;border:0;border-radius:8px;background:#ea7c1f;color:#fff;font-weight:600;cursor:pointer;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#14532d;color:#fff;text-align:left;padding:7px 9px;}
      td{padding:6px 9px;border-bottom:1px solid #e5e7eb;}
      tr:nth-child(even) td{background:#f9fafb;}
      .num{text-align:right;}
      th.num{text-align:right;}
      @media print{button{display:none;}}
    </style></head><body>
    <div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${rows.length} rows</div>
    <table><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
    </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => {
    try { win.print(); } catch { /* user can click print button */ }
  }, 350);
};

export default function AdminCheckInRecords() {
  const { students, checkIn, resetAllCheckIns } = useStudentStore();
  const [query, setQuery] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetAll = async () => {
    setResetting(true);
    const r = await resetAllCheckIns();
    setResetting(false);
    setShowReset(false);
    if (r?.success) toast.success('All check-in records reset');
    else toast.error(r?.error || 'Failed to reset check-ins');
  };

  const checkedInStudents = useMemo(
    () => students.filter((s) => s.checked_in),
    [students]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = checkedInStudents;
    if (!q) return base;
    return base.filter((s) =>
      s.name?.toLowerCase().includes(q) ||
      s.roll_no?.toLowerCase().includes(q) ||
      (s.mobile && s.mobile.includes(q))
    );
  }, [checkedInStudents, query]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = a.checked_in_at ? new Date(a.checked_in_at).getTime() : 0;
      const tb = b.checked_in_at ? new Date(b.checked_in_at).getTime() : 0;
      return tb - ta;
    });
  }, [filtered]);

  const checkedIn = students.filter((s) => s.checked_in).length;
  const checkedInBoys = students.filter(
    (s) => s.checked_in && String(s.gender || '').toLowerCase() === 'boy'
  ).length;
  const checkedInGirls = students.filter(
    (s) => s.checked_in && String(s.gender || '').toLowerCase() === 'girl'
  ).length;
  const pending = Math.max(0, students.length - checkedIn);
  const completion = students.length ? Math.round((checkedIn / students.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);

  const getExportRows = () => (
    sorted.map((s, i) => [
      i + 1,
      s.roll_no || '',
      s.name || '',
      s.batch || '',
      s.class || '',
      s.room_no || '',
      s.parent_name || '',
      s.mobile || '',
      s.checked_in_at
        ? new Date(s.checked_in_at).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
        : '',
    ])
  );

  const handleExportCSV = () => {
    const headers = ['#', 'Roll', 'Name', 'Batch', 'Class', 'Room', 'Father/Mother', 'Mobile', 'Check-In Time'];
    const content = buildCSV(headers, getExportRows());
    downloadCSV(`checkin-records_${today}.csv`, content);
  };

  const handleExportPDF = () => {
    const headers = ['#', 'Roll', 'Name', 'Batch', 'Class', 'Room', 'Father/Mother', 'Mobile', 'Check-In Time'];
    exportPDF('Check-In Records', headers, getExportRows());
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-full">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-green-700 leading-none">{checkedIn}</div>
            <div className="text-xs text-green-700/90 mt-1 font-medium">Checked In</div>
          </div>
          <div className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-cyan-700 leading-none">{checkedInBoys}</div>
            <div className="text-xs text-cyan-700/90 mt-1 font-medium">Boys Checked In</div>
          </div>
          <div className="rounded-2xl border border-pink-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-pink-700 leading-none">{checkedInGirls}</div>
            <div className="text-xs text-pink-700/90 mt-1 font-medium">Girls Checked In</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-amber-700 leading-none">{pending}</div>
            <div className="text-xs text-amber-700/90 mt-1 font-medium">Pending</div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-2xl font-semibold text-blue-700 leading-none">{completion}%</div>
            <div className="text-xs text-blue-700/90 mt-1 font-medium">Complete</div>
          </div>
        </div>

        <div className="mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-gray-400">🔍</span>
          <input
            className="w-full border-2 border-gray-200 bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-saffron-500 shadow-sm"
            placeholder="Search by name, roll or mobile..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700 bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Check-In Records ({sorted.length})</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 font-medium">Sorted by check-in time</span>
                <button
                  onClick={handleExportCSV}
                  disabled={sorted.length === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  ⬇ CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={sorted.length === 0}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-forest-700 text-white hover:bg-forest-800 disabled:opacity-50 transition-colors"
                >
                  🧾 PDF
                </button>
                <button
                  onClick={() => setShowReset(true)}
                  disabled={checkedIn === 0 || resetting}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {resetting ? 'Resetting…' : '↺ Reset All Check-Ins'}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile layout (same details, better readability) */}
          <div className="md:hidden p-2 space-y-2">
            {sorted.map((s, i) => (
              <div key={s.id} className="p-3.5 bg-white border border-gray-100 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="text-[11px] text-gray-400">#{i + 1} • {s.roll_no}</div>
                    <div className="font-semibold text-gray-900 text-base leading-tight mt-0.5">{s.name}</div>
                  </div>
                  <button
                    onClick={() => checkIn(s.id)}
                    className="text-xs font-semibold px-3 py-1 rounded-full border transition-colors bg-red-50 text-red-600 border-red-200 hover:bg-red-100 shrink-0"
                  >
                    Undo
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pt-1">
                  <div>
                    <div className="text-[11px] text-gray-400">Batch / Class</div>
                    <div className="text-gray-700 font-medium">{s.batch || '—'}{s.class ? ` · ${s.class}` : ''}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Room</div>
                    <div className="text-amber-700 font-semibold">{s.room_no || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Father</div>
                    <div className="text-gray-600">{s.parent_name || '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Check-In Time</div>
                    <div className="text-gray-600 font-medium">
                      {s.checked_in_at
                        ? new Date(s.checked_in_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                        : 'No timestamp'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop layout */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-2.5 text-left">#</th>
                  <th className="px-4 py-2.5 text-left">Roll</th>
                  <th className="px-4 py-2.5 text-left">Name</th>
                  <th className="px-4 py-2.5 text-left">Batch / Class</th>
                  <th className="px-4 py-2.5 text-left">Room</th>
                  <th className="px-4 py-2.5 text-left">Father</th>
                  <th className="px-4 py-2.5 text-left">Check-In Time</th>
                  <th className="px-4 py-2.5 text-center">Undo</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.id} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{s.roll_no}</td>
                    <td className="px-4 py-2.5 font-semibold text-gray-900">{s.name}</td>
                    <td className="px-4 py-2.5 text-gray-700">{s.batch || '—'}{s.class ? ` · ${s.class}` : ''}</td>
                    <td className="px-4 py-2.5">
                      {s.room_no ? <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">{s.room_no}</span> : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{s.parent_name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600">
                      {s.checked_in_at
                        ? new Date(s.checked_in_at).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                        : 'No timestamp'}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button
                        onClick={() => checkIn(s.id)}
                        className="text-xs font-semibold px-3 py-1 rounded-full border transition-colors bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                      >
                        Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-12 text-gray-400">No results found</div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showReset}
        title="Reset All Check-Ins?"
        message={`This will mark all ${checkedIn} checked-in student${checkedIn !== 1 ? 's' : ''} as not checked in. This cannot be undone.`}
        danger
        confirmLabel={resetting ? 'Resetting…' : 'Reset All'}
        onConfirm={handleResetAll}
        onCancel={() => setShowReset(false)}
      />
    </div>
  );
}
