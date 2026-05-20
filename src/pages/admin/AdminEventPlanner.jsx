import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScheduleStore } from '../../store/useScheduleStore.js';
import Select from '../../components/common/Select.jsx';

const STAKEHOLDER_TYPES = ['Teacher', 'Coordinator', 'Zone Mentor', 'Speaker', 'External Guest'];
const LEAD_TYPES = ['Teacher', 'Coordinator', 'Zone Mentor', 'Admin'];

export default function AdminEventPlanner() {
  const { t } = useTranslation();
  const { schedule, getActivitiesForDay, eventPlans, updateEventPlan } = useScheduleStore();

  const [view, setView] = useState('day'); // 'day' | 'activity'
  const [selectedDay, setSelectedDay] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({
    lead_name: '', lead_type: 'Coordinator',
    stakeholders: [],
    checklist: [],
    notes: '',
  });
  const [newStakeholder, setNewStakeholder] = useState({ name: '', role: '', type: 'Teacher' });
  const [newCheckItem, setNewCheckItem] = useState('');

  const activities = getActivitiesForDay(selectedDay).filter(a => a.type !== 'slot');

  // All activities across all days for activity view
  const allActivities = {};
  [1,2,3,4,5,6].forEach(day => {
    getActivitiesForDay(day).filter(a => a.type !== 'slot').forEach(act => {
      if (!allActivities[act.name]) allActivities[act.name] = [];
      allActivities[act.name].push({ ...act, day });
    });
  });

  const startEdit = (act) => {
    const plan = eventPlans[act.id] || { lead_name: '', lead_type: 'Coordinator', stakeholders: [], checklist: [], notes: '' };
    setEditingPlan(act);
    setPlanForm(JSON.parse(JSON.stringify(plan)));
    setNewStakeholder({ name: '', role: '', type: 'Teacher' });
    setNewCheckItem('');
  };

  const savePlan = () => {
    updateEventPlan(editingPlan.id, planForm);
    setEditingPlan(null);
  };

  const addStakeholder = () => {
    if (!newStakeholder.name.trim()) return;
    setPlanForm(p => ({ ...p, stakeholders: [...p.stakeholders, { ...newStakeholder }] }));
    setNewStakeholder({ name: '', role: '', type: 'Teacher' });
  };

  const removeStakeholder = (i) => {
    setPlanForm(p => ({ ...p, stakeholders: p.stakeholders.filter((_, idx) => idx !== i) }));
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setPlanForm(p => ({ ...p, checklist: [...p.checklist, { text: newCheckItem, done: false }] }));
    setNewCheckItem('');
  };

  const toggleCheck = (i) => {
    setPlanForm(p => ({
      ...p,
      checklist: p.checklist.map((c, idx) => idx === i ? { ...c, done: !c.done } : c)
    }));
  };

  const removeCheck = (i) => {
    setPlanForm(p => ({ ...p, checklist: p.checklist.filter((_, idx) => idx !== i) }));
  };

  const getPlanStatus = (actId) => {
    const plan = eventPlans[actId];
    if (!plan) return 'empty';
    if (plan.lead_name) return 'partial';
    return 'empty';
  };

  return (
    <div className="p-6">
      {/* View toggle */}
      <div className="flex gap-0 mb-4 border-2 border-gray-200 rounded-xl overflow-hidden w-fit">
        <button
          onClick={() => setView('day')}
          className={`px-5 py-2 font-semibold text-sm ${view === 'day' ? 'bg-forest-700 text-white' : 'text-gray-600'}`}
        >
          📅 {t('admin.dayView')}
        </button>
        <button
          onClick={() => setView('activity')}
          className={`px-5 py-2 font-semibold text-sm ${view === 'activity' ? 'bg-forest-700 text-white' : 'text-gray-600'}`}
        >
          🎯 {t('admin.activityView')}
        </button>
      </div>

      {view === 'day' && (
        <>
          <div className="flex gap-2 mb-4 flex-wrap">
            {[1,2,3,4,5,6].map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all
                  ${selectedDay === d ? 'bg-saffron-500 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Day {d}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {activities.map(act => {
              const plan = eventPlans[act.id];
              const status = getPlanStatus(act.id);
              return (
                <div key={act.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-gray-900">{act.name}</div>
                      <div className="text-xs text-gray-500">{act.start_time} • {act.venue}</div>
                      {plan?.lead_name && (
                        <div className="text-sm text-forest-600 mt-1">👤 Lead: <strong>{plan.lead_name}</strong> ({plan.lead_type})</div>
                      )}
                      {plan?.stakeholders?.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">{plan.stakeholders.length} stakeholder(s)</div>
                      )}
                      {plan?.checklist?.length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {plan.checklist.filter(c => c.done).length}/{plan.checklist.length} materials ready
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => startEdit(act)}
                      className={`text-sm px-3 py-1.5 rounded-lg font-semibold transition-all
                        ${status === 'empty' ? 'bg-saffron-50 text-saffron-600 border border-saffron-200' : 'bg-forest-50 text-forest-600 border border-forest-200'}`}
                    >
                      {status === 'empty' ? '+ Plan' : '✏️ Edit'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === 'activity' && (
        <div className="space-y-4">
          {Object.entries(allActivities).map(([name, instances]) => (
            <div key={name} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-forest-50 border-b border-forest-100 px-5 py-3">
                <h3 className="font-bold text-forest-700">{name}</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {instances.map(act => {
                  const plan = eventPlans[act.id];
                  return (
                    <div key={act.id} className="px-5 py-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-sm text-saffron-600">Day {act.day}</span>
                        <span className="text-gray-500 text-sm ml-2">{act.start_time}</span>
                        {plan?.lead_name && <span className="text-gray-700 text-sm ml-2">• {plan.lead_name}</span>}
                      </div>
                      <button onClick={() => startEdit(act)} className="text-xs text-blue-600 hover:underline font-semibold">
                        {plan?.lead_name ? 'Edit' : 'Plan'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-4 fade-in">
            <div className="bg-forest-700 text-white p-5 rounded-t-2xl flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg">{editingPlan.name}</h3>
                <p className="text-forest-300 text-sm">Day {editingPlan.day} • {editingPlan.start_time}</p>
              </div>
              <button onClick={() => setEditingPlan(null)} className="text-forest-300 text-xl">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Lead Person */}
              <div>
                <h4 className="font-semibold text-forest-700 mb-3">👤 Lead Person</h4>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input-field"
                    placeholder="Lead person name"
                    value={planForm.lead_name}
                    onChange={e => setPlanForm(p => ({ ...p, lead_name: e.target.value }))}
                  />
                  <Select
                    value={planForm.lead_type}
                    onChange={val => setPlanForm(p => ({ ...p, lead_type: val }))}
                    options={LEAD_TYPES}
                  />
                </div>
              </div>

              {/* Stakeholders */}
              <div>
                <h4 className="font-semibold text-forest-700 mb-3">👥 Stakeholders</h4>
                {planForm.stakeholders.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2 bg-gray-50 rounded-xl px-3 py-2">
                    <span className="flex-1 text-sm font-medium text-gray-900">{s.name}</span>
                    <span className="text-xs text-gray-500">{s.role}</span>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{s.type}</span>
                    <button onClick={() => removeStakeholder(i)} className="text-red-400 text-lg ml-1">×</button>
                  </div>
                ))}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <input className="input-field py-2 text-sm" placeholder="Name" value={newStakeholder.name} onChange={e => setNewStakeholder(p => ({ ...p, name: e.target.value }))} />
                  <input className="input-field py-2 text-sm" placeholder="Role" value={newStakeholder.role} onChange={e => setNewStakeholder(p => ({ ...p, role: e.target.value }))} />
                  <Select
                    size="sm"
                    value={newStakeholder.type}
                    onChange={val => setNewStakeholder(p => ({ ...p, type: val }))}
                    options={STAKEHOLDER_TYPES}
                  />
                </div>
                <button onClick={addStakeholder} className="mt-2 text-sm text-saffron-600 font-semibold hover:underline">+ Add Stakeholder</button>
              </div>

              {/* Checklist */}
              <div>
                <h4 className="font-semibold text-forest-700 mb-3">✅ Materials Checklist</h4>
                {planForm.checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() => toggleCheck(i)}
                      className="w-5 h-5 accent-green-500 flex-shrink-0"
                    />
                    <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.text}</span>
                    <button onClick={() => removeCheck(i)} className="text-red-400">×</button>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input
                    className="input-field flex-1 py-2 text-sm"
                    placeholder="Add item..."
                    value={newCheckItem}
                    onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCheckItem()}
                  />
                  <button onClick={addCheckItem} className="btn-secondary px-4 py-2 text-sm">Add</button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="font-semibold text-forest-700 mb-2">📝 Notes</h4>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={planForm.notes}
                  onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any special instructions or notes..."
                />
              </div>

              <div className="flex gap-3">
                <button onClick={savePlan} className="btn-primary flex-1">{t('common.save')}</button>
                <button onClick={() => setEditingPlan(null)} className="btn-outline flex-1">{t('common.cancel')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
