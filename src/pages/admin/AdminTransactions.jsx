import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { useVolunteerStore } from '../../store/useVolunteerStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import Select from '../../components/common/Select.jsx';
import ActivitySummaryCard from '../../components/common/ActivitySummaryCard.jsx';
import VolunteerSummaryCard from '../../components/common/VolunteerSummaryCard.jsx';

const TYPE_COLORS = {
  Coin: 'bg-yellow-100 text-yellow-700',
  Digital: 'bg-blue-100 text-blue-700',
  Deduction: 'bg-red-100 text-red-700',
  Submission: 'bg-green-100 text-green-700',
  Exam: 'bg-indigo-100 text-indigo-700',
  Behaviour: 'bg-purple-100 text-purple-700',
};

export default function AdminTransactions() {
  const { t } = useTranslation();
  const { transactions, flagTransaction } = useTransactionStore();
  const { volunteers } = useVolunteerStore();
  const { students } = useStudentStore();

  const [filterType, setFilterType] = useState('All');
  const [filterDay, setFilterDay] = useState('All');
  const [searchQ, setSearchQ] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 100;

  const studentNameById = useMemo(() => new Map((students || []).map(s => [s.id, s.name])), [students]);
  const studentRollById = useMemo(() => new Map((students || []).map(s => [s.id, s.roll_no])), [students]);
  const volunteerNameById = useMemo(() => new Map((volunteers || []).map(v => [v.id, v.name])), [volunteers]);

  const normalizedTransactions = useMemo(() => transactions.map(tx => ({
    ...tx,
    _student_name: tx.student_name || studentNameById.get(tx.student_id) || tx.student_id || 'Unknown student',
    _roll_no: tx.roll_no || studentRollById.get(tx.student_id) || '—',
    _volunteer_name: tx.volunteer_name || volunteerNameById.get(tx.volunteer_id) || tx.volunteer_id || 'Unknown volunteer',
  })), [transactions, studentNameById, studentRollById, volunteerNameById]);

  const filtered = useMemo(() => normalizedTransactions.filter(tx => {
    if (filterType !== 'All' && tx.type !== filterType) return false;
    if (filterDay !== 'All' && tx.day !== parseInt(filterDay)) return false;
    if (showFlagged && !tx.flagged) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!tx._student_name?.toLowerCase().includes(q) && !tx._volunteer_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [normalizedTransactions, filterType, filterDay, showFlagged, searchQ]);

  const paginated = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  // Reset page when filters change
  const handleFilterChange = (setter) => (val) => { setter(val); setPage(1); };

  return (
    <div className="p-3 sm:p-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4">
        <input
          className="border-2 border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-saffron-500 w-full sm:w-48"
          placeholder="Search student or mentor..."
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); setPage(1); }}
        />
        <div className="w-full sm:w-auto flex gap-2">
          <Select
            size="sm"
            className="flex-1 sm:w-36"
            value={filterType}
            onChange={handleFilterChange(setFilterType)}
            options={[
              { value: 'All', label: 'All Types' },
              { value: 'Coin', label: 'Coin' },
              { value: 'Digital', label: 'Digital' },
              { value: 'Behaviour', label: 'Behaviour' },
              { value: 'Deduction', label: 'Deduction' },
              { value: 'Exam', label: 'Exam' },
              { value: 'Submission', label: 'Submission' },
            ]}
          />
          <Select
            size="sm"
            className="flex-1 sm:w-32"
            value={filterDay}
            onChange={handleFilterChange(setFilterDay)}
            options={[
              { value: 'All', label: 'All Days' },
              ...([1,2,3,4,5,6].map(d => ({ value: d, label: `Day ${d}` }))),
            ]}
          />
        </div>
        <button
          onClick={() => { setShowFlagged(s => !s); setPage(1); }}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all w-full sm:w-auto
            ${showFlagged ? 'bg-orange-100 border-orange-400 text-orange-700' : 'border-gray-200 text-gray-600'}`}
        >
          Flagged Only
        </button>
        <span className="self-center text-sm text-gray-500 ml-1">{filtered.length} records</span>
        {filtered.length !== transactions.length && (
          <span className="self-center text-xs text-gray-400">of {transactions.length} total</span>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivitySummaryCard transactions={filtered} title="Activity Summary" />
        <VolunteerSummaryCard transactions={filtered} title="Mentor Breakdown" />
      </div>

      {/* Mobile transaction cards */}
      <div className="md:hidden space-y-2.5 mb-4">
        {paginated.map((tx) => (
          <div
            key={tx.id}
            onClick={() => setSelectedTx(tx)}
            className={`bg-white rounded-2xl border p-3 shadow-sm cursor-pointer ${tx.flagged ? 'border-orange-300 bg-orange-50/40' : 'border-gray-200'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 truncate">{tx._student_name}</div>
                <div className="text-[11px] text-gray-500">Roll: {tx._roll_no}</div>
                <div className="text-xs text-gray-500 truncate">{tx.activity}</div>
              </div>
              <div className={`text-base font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {tx.points > 0 ? '+' : ''}{tx.points}
              </div>
            </div>
            <div className="mt-1 text-xs text-gray-600 truncate">
              {tx._volunteer_name} • D{tx.day}/S{tx.slot}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLORS[tx.type] || 'bg-gray-100 text-gray-600'}`}>
                  {tx.type}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  {new Date(tx.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); flagTransaction(tx.id); }}
                className={`text-sm px-2 py-1 rounded-lg border ${tx.flagged ? 'border-orange-300 text-orange-700 bg-orange-100' : 'border-gray-200 text-gray-500'}`}
                title={tx.flagged ? 'Unflag' : 'Flag as incorrect'}
              >
                Flag
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 bg-white rounded-2xl border border-gray-200">
            {t('common.noResults')}
          </div>
        )}
        {paginated.length < filtered.length && (
          <button
            onClick={() => setPage(p => p + 1)}
            className="w-full py-3 rounded-2xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Load more ({filtered.length - paginated.length} remaining)
          </button>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-forest-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left">Time</th>
                <th className="px-4 py-3 text-left">Student</th>
                <th className="px-4 py-3 text-left">Roll</th>
                <th className="px-4 py-3 text-left">Mentor</th>
                <th className="px-4 py-3 text-left">Activity</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Points</th>
                <th className="px-4 py-3 text-center">Day/Slot</th>
                <th className="px-4 py-3 text-center">Flag</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((tx, i) => (
                <tr
                  key={tx.id}
                  onClick={() => setSelectedTx(tx)}
                  className={`border-b last:border-0 cursor-pointer ${tx.flagged ? 'bg-orange-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap font-mono">
                    {new Date(tx.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{tx._student_name}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{tx._roll_no}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{tx._volunteer_name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">{tx.activity}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${TYPE_COLORS[tx.type] || 'bg-gray-100 text-gray-600'}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-bold ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">D{tx.day}/S{tx.slot}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); flagTransaction(tx.id); }}
                      className={`text-lg transition-all hover:scale-110 ${tx.flagged ? 'opacity-100' : 'opacity-30 hover:opacity-70'}`}
                      title={tx.flagged ? 'Unflag' : 'Flag as incorrect'}
                    >
                      🚩
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">{t('common.noResults')}</div>
          )}
          {paginated.length < filtered.length && (
            <div className="p-4 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="px-6 py-2.5 rounded-xl border-2 border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Load more ({filtered.length - paginated.length} remaining)
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/50 p-3 sm:p-6 flex items-center justify-center" onClick={() => setSelectedTx(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <div className="font-bold text-gray-900">Transaction Details</div>
              <button onClick={() => setSelectedTx(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Student:</span> <span className="font-semibold text-gray-900">{selectedTx._student_name}</span></div>
              <div><span className="text-gray-500">Roll:</span> <span className="font-semibold text-gray-900">{selectedTx._roll_no}</span></div>
              <div><span className="text-gray-500">Mentor:</span> <span className="font-semibold text-gray-900">{selectedTx._volunteer_name}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className="font-semibold text-gray-900">{selectedTx.type || '—'}</span></div>
              <div><span className="text-gray-500">Points:</span> <span className={`font-bold ${selectedTx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>{selectedTx.points > 0 ? '+' : ''}{selectedTx.points}</span></div>
              <div><span className="text-gray-500">Day/Slot:</span> <span className="font-semibold text-gray-900">D{selectedTx.day}/S{selectedTx.slot}</span></div>
              <div><span className="text-gray-500">Time:</span> <span className="font-semibold text-gray-900">{selectedTx.timestamp ? new Date(selectedTx.timestamp).toLocaleString('en-IN') : '—'}</span></div>
              <div><span className="text-gray-500">Coins:</span> <span className="font-semibold text-gray-900">{selectedTx.coin_count ?? 0}</span></div>
              <div className="sm:col-span-2">
                <div className="text-gray-500 mb-1">Activity / Reason</div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 whitespace-pre-wrap break-words">
                  {selectedTx.activity || '—'}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-gray-500 mb-1">Notes</div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 whitespace-pre-wrap break-words min-h-10">
                  {selectedTx.notes || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
