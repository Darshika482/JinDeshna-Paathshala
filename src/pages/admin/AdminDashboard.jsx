import { useTranslation } from 'react-i18next';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useTransactionStore } from '../../store/useTransactionStore.js';
import { useCoinStore } from '../../store/useCoinStore.js';
import { useScheduleStore } from '../../store/useScheduleStore.js';
import ActivitySummaryCard from '../../components/common/ActivitySummaryCard.jsx';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { students } = useStudentStore();
  const { transactions, currentDay } = useTransactionStore();
  const { getStats } = useCoinStore();
  const { getActivitiesForDay } = useScheduleStore();

  const stats = getStats();
  const todayTx = transactions.filter(tx => tx.day === currentDay);
  const pointsToday = todayTx.filter(tx => tx.points > 0).reduce((s, tx) => s + tx.points, 0);
  const specialToday = getActivitiesForDay(currentDay).filter(a => a.type === 'special').length;
  const checkedInGirls = students.filter(s => s.checked_in && String(s.gender || '').toLowerCase() === 'girl').length;
  const checkedInBoys = students.filter(s => s.checked_in && String(s.gender || '').toLowerCase() === 'boy').length;

  const poolPct = Math.min(100, (stats.availableNow / stats.totalPool) * 100);
  const recentTx = transactions.slice(0, 8);

  const statCards = [
    { label: t('admin.totalStudents'), val: students.length, icon: '👥', accent: 'bg-blue-100 text-blue-700' },
    { label: t('admin.boysCheckedIn'), val: checkedInBoys, icon: '👦', accent: 'bg-cyan-100 text-cyan-700' },
    { label: t('admin.girlsCheckedIn'), val: checkedInGirls, icon: '👧', accent: 'bg-pink-100 text-pink-700' },
    { label: t('admin.pointsToday'), val: pointsToday, icon: '⭐', accent: 'bg-amber-100 text-amber-700' },
    { label: t('admin.coinsCirculating'), val: stats.inCirculation, icon: '🪙', accent: 'bg-orange-100 text-orange-700' },
    { label: t('admin.specialActivitiesToday'), val: specialToday, icon: '🎯', accent: 'bg-violet-100 text-violet-700' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-full">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {statCards.map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm aspect-square md:aspect-auto md:min-h-[104px]">
            <div className="h-full flex flex-col md:justify-between">
              <div className="flex justify-end">
                <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center text-xs sm:text-sm ${s.accent}`}>
                  {s.icon}
                </div>
              </div>
              <div className="mt-auto">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-500 font-medium leading-tight line-clamp-2">
                  {s.label}
                </div>
                <div className="text-xl sm:text-2xl font-semibold text-slate-900 leading-none mt-1 md:mt-1.5">{s.val}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Coin Pool Health */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.coinPoolHealth')}</h3>
          <div className="space-y-4">
            {[
              { label: 'Total Pool', val: stats.totalPool, color: '#1a3d2b' },
              { label: 'Distributed', val: stats.distributed, color: '#E8660A' },
              { label: 'Returned', val: stats.returned, color: '#22c55e' },
              { label: 'In Circulation', val: stats.inCirculation, color: '#f59e0b' },
              { label: 'Available Now', val: stats.availableNow, color: '#3b82f6' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-slate-600">{s.label}</span>
                  <span style={{ color: s.color }} className="font-semibold">{s.val}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(s.val / stats.totalPool) * 100}%`, background: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200">
            {t('admin.recyclingNote')}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-900 mb-4">{t('admin.recentTransactions')}</h3>
          {recentTx.length === 0 ? (
            <p className="text-slate-400 text-center py-8">{t('common.noResults')}</p>
          ) : (
            <div className="space-y-2 overflow-y-auto max-h-72">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <span className={`text-xl ${tx.points >= 0 ? '✅' : '⚠️'}`}>
                    {tx.type === 'Submission' ? '📦' : tx.points >= 0 ? '✅' : '⚠️'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-slate-900 truncate">{tx.student_name}</div>
                    <div className="text-xs text-slate-500 truncate">{tx.activity} • {tx.volunteer_name}</div>
                  </div>
                  <div className={`font-bold text-sm flex-shrink-0 ${tx.points >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points}
                    {tx.flagged && <span className="ml-1 text-orange-500">🚩</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity Summary — today's transactions grouped by activity */}
      <div className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <ActivitySummaryCard
          transactions={todayTx}
          title={`Activity Summary - Day ${currentDay}`}
        />
      </div>

      {/* Activity Allocation Snapshot */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4">Today's Activity Snapshot - Day {currentDay}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {getActivitiesForDay(currentDay).filter(a => a.coins > 0).map(a => (
            <div key={a.id} className="bg-slate-50 rounded-xl p-3 border border-slate-200">
              <div className="font-medium text-sm text-slate-900 truncate">{a.name}</div>
              <div className="text-xs text-slate-500">{a.start_time} • {a.venue}</div>
              <div className="mt-1 text-amber-600 font-semibold">{a.coins} coins</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
