import { useState } from 'react';

/**
 * VolunteerSummaryCard
 * Props:
 *   transactions — array of transaction objects
 *   title        — optional heading string
 *
 * Groups by volunteer → student → activity (deduplicated).
 * Each volunteer row is expandable to see the full breakdown.
 */
export default function VolunteerSummaryCard({ transactions = [], title = '👤 Mentor Breakdown' }) {
  const [expanded, setExpanded] = useState({});

  if (transactions.length === 0) return null;

  // Build: { volunteerName → { totalPoints, deductions, students: { studentName → [{ activity, points, type }] } } }
  const grouped = {};
  for (const tx of transactions) {
    const vol = tx.volunteer_name || 'Unknown';
    const stu = tx.student_name || 'Unknown';
    if (!grouped[vol]) grouped[vol] = { points: 0, deductions: 0, students: {} };
    const v = grouped[vol];
    if (tx.points > 0) v.points += tx.points;
    else v.deductions += Math.abs(tx.points);

    if (!v.students[stu]) v.students[stu] = [];
    // Deduplicate: same activity + same points only once per student per volunteer
    const key = `${tx.activity}|${tx.points}|${tx.type}`;
    if (!v.students[stu].find(e => e._key === key)) {
      v.students[stu].push({ _key: key, activity: tx.activity || '—', points: tx.points, type: tx.type });
    }
  }

  const volunteers = Object.entries(grouped).sort((a, b) => b[1].points - a[1].points);

  const toggle = name => setExpanded(prev => ({ ...prev, [name]: !prev[name] }));

  const TYPE_COLOR = {
    Coin: 'bg-yellow-100 text-yellow-700',
    Digital: 'bg-blue-100 text-blue-700',
    Deduction: 'bg-red-100 text-red-700',
    Submission: 'bg-green-100 text-green-700',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="font-bold text-forest-700 mb-4">{title}</h3>
      <div className="space-y-2">
        {volunteers.map(([vol, data]) => {
          const studentCount = Object.keys(data.students).length;
          const isOpen = !!expanded[vol];
          return (
            <div key={vol} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Volunteer header row — clickable */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                onClick={() => toggle(vol)}
              >
                <span className="text-base">👤</span>
                <span className="font-semibold text-gray-900 flex-1 truncate">{vol}</span>
                <span className="text-xs text-gray-500 mr-2">{studentCount} student{studentCount !== 1 ? 's' : ''}</span>
                {data.points > 0 && (
                  <span className="text-sm font-bold text-green-600 mr-1">+{data.points} pts</span>
                )}
                {data.deductions > 0 && (
                  <span className="text-sm font-bold text-red-500 mr-1">−{data.deductions}</span>
                )}
                <span className="text-gray-400 text-sm">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Expanded: student → activity list */}
              {isOpen && (
                <div className="divide-y divide-gray-100">
                  {Object.entries(data.students).map(([student, entries]) => (
                    <div key={student} className="px-4 py-2.5 flex flex-col gap-1.5 bg-white">
                      <div className="font-semibold text-sm text-gray-800">🎓 {student}</div>
                      <div className="flex flex-wrap gap-2 pl-1">
                        {entries.map(e => (
                          <div key={e._key} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                            <span className="text-xs text-gray-700">{e.activity}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLOR[e.type] || 'bg-gray-100 text-gray-600'}`}>
                              {e.type}
                            </span>
                            <span className={`text-xs font-bold ${e.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {e.points > 0 ? '+' : ''}{e.points}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
