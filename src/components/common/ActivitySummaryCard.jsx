/**
 * ActivitySummaryCard
 * Props:
 *   transactions — array of transaction objects to summarise
 *   title        — optional heading string
 */
export default function ActivitySummaryCard({ transactions = [], title = '📊 Activity Summary' }) {
  if (transactions.length === 0) return null;

  const grouped = {};
  for (const tx of transactions) {
    const key = tx.activity || 'Unknown';
    if (!grouped[key]) {
      grouped[key] = { points: 0, deductions: 0, students: new Set(), types: new Set() };
    }
    const g = grouped[key];
    g.students.add(tx.student_id || tx.student_name);
    if (tx.points > 0) g.points += tx.points;
    else g.deductions += Math.abs(tx.points);
    if (tx.type) g.types.add(tx.type);
  }

  const entries = Object.entries(grouped).sort((a, b) => b[1].points - a[1].points);

  const TYPE_ICON = { Coin: '🪙', Digital: '💻', Deduction: '⬇️', Submission: '📦' };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-bold text-forest-700 mb-4">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {entries.map(([activity, g]) => (
          <div key={activity} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-1">
            <div className="font-semibold text-sm text-gray-900 truncate" title={activity}>{activity}</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {[...g.types].map(type => (
                <span key={type} className="text-xs text-gray-500">{TYPE_ICON[type] || '•'} {type}</span>
              ))}
            </div>
            {/* Total points — hero metric */}
            <div className={`text-2xl font-extrabold mt-1 ${g.points > 0 ? 'text-green-600' : 'text-gray-400'}`}>
              +{g.points} <span className="text-sm font-semibold text-gray-500">pts</span>
            </div>
            {g.deductions > 0 && (
              <div className="text-sm font-bold text-red-500">−{g.deductions} deducted</div>
            )}
            <div className="text-xs text-gray-400 mt-0.5">👤 {g.students.size} student{g.students.size !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
