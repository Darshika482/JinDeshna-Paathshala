import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase.js';
import { useScheduleStore } from '../../store/useScheduleStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import Select from '../../components/common/Select.jsx';

const EMPTY_SPECIAL = {
  name: '', name_hi: '', start_time: '', end_time: '', venue: '',
  coordinator: '', coins: 0, materials: '', notes: '', session: 'morning',
};

const STAKEHOLDER_TYPES = ['Teacher', 'Coordinator', 'Zone Mentor', 'Speaker', 'External Guest'];
const LEAD_TYPES = ['Teacher', 'Coordinator', 'Zone Mentor', 'Admin'];

const TYPE_BADGE = {
  special: <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full font-bold">⭐ Special</span>,
  slot:    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">📦 Slot</span>,
  base:    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Base</span>,
  class:   <span className="text-xs bg-saffron-100 text-saffron-700 px-2 py-0.5 rounded-full font-bold">📚 Class</span>,
  event:   <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">📅 Event</span>,
};

export default function AdminSchedule() {
  const { t } = useTranslation();
  const { getActivitiesForDay, addSpecialActivity, deleteSpecialActivity, eventPlans, updateEventPlan } = useScheduleStore();

  const [selectedDay, setSelectedDay] = useState(1);
  const [expandedId, setExpandedId]   = useState(null);   // which activity's plan panel is open
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Add-special form state ──────────────────────────────────────────
  const [form, setForm]     = useState(EMPTY_SPECIAL);
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Inline plan editor state ────────────────────────────────────────
  const [planForm, setPlanForm]               = useState(null);   // null = not editing
  const [newStakeholder, setNewStakeholder]   = useState({ name: '', role: '', type: 'Teacher' });
  const [newCheckItem, setNewCheckItem]       = useState('');

  // ── Supabase events (recurring, shown on every day) ──────────────────
  const [dbEvents, setDbEvents] = useState([]);
  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setDbEvents(data || []));
  }, []);

  // Convert a HH:MM time_slot string (e.g. "09:00–09:45") to a start_time for sorting
  function slotToStart(slot) {
    if (!slot) return '99:99';
    return String(slot).split(/[-–]/)[0].trim();
  }

  // Merge Supabase events + local special activities for the selected day
  const localActivities = getActivitiesForDay(selectedDay);
  const dbMapped = dbEvents.map(ev => ({
    id: ev.id,
    name: ev.name,
    start_time: slotToStart(ev.time_slot),
    end_time: '',
    time_slot: ev.time_slot || '',
    venue: '',
    coins: ev.coin_pool_boys || 0,
    type: ev.event_type === 'class' ? 'class' : 'event',
    notes: ev.notes || '',
    responsible_role: ev.responsible_role || '',
    _fromDB: true,
  }));
  const sorted = [...dbMapped, ...localActivities]
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  // ── Add special activity ────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.start_time)  e.start_time = 'Start time is required';
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const handleAdd = () => {
    if (!validate()) return;
    addSpecialActivity(selectedDay, {
      ...form,
      materials: form.materials.split(',').map(m => m.trim()).filter(Boolean),
      coins: parseInt(form.coins) || 0,
    });
    setShowAddForm(false);
    setForm(EMPTY_SPECIAL);
    setFormErrors({});
  };

  // ── Plan editor helpers ─────────────────────────────────────────────
  const openPlan = (act) => {
    if (expandedId === act.id) { setExpandedId(null); setPlanForm(null); return; }
    const saved = eventPlans[act.id] || { lead_name: '', lead_type: 'Coordinator', stakeholders: [], checklist: [], notes: '' };
    setExpandedId(act.id);
    setPlanForm(JSON.parse(JSON.stringify(saved)));
    setNewStakeholder({ name: '', role: '', type: 'Teacher' });
    setNewCheckItem('');
  };

  const savePlan = (actId) => {
    updateEventPlan(actId, planForm);
    setExpandedId(null);
    setPlanForm(null);
  };

  const addStakeholder = () => {
    if (!newStakeholder.name.trim()) return;
    setPlanForm(p => ({ ...p, stakeholders: [...p.stakeholders, { ...newStakeholder }] }));
    setNewStakeholder({ name: '', role: '', type: 'Teacher' });
  };

  const removeStakeholder = (i) => setPlanForm(p => ({ ...p, stakeholders: p.stakeholders.filter((_, idx) => idx !== i) }));

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setPlanForm(p => ({ ...p, checklist: [...p.checklist, { text: newCheckItem, done: false }] }));
    setNewCheckItem('');
  };

  const toggleCheck   = (i) => setPlanForm(p => ({ ...p, checklist: p.checklist.map((c, idx) => idx === i ? { ...c, done: !c.done } : c) }));
  const removeCheck   = (i) => setPlanForm(p => ({ ...p, checklist: p.checklist.filter((_, idx) => idx !== i) }));

  const planSummary = (actId) => {
    const plan = eventPlans[actId];
    if (!plan?.lead_name) return null;
    return plan;
  };

  return (
    <div className="p-3 sm:p-6">
      {/* Day selector + Add button */}
      <div className="mb-5 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1,2,3,4,5,6].map(d => (
            <button
              key={d}
              onClick={() => { setSelectedDay(d); setExpandedId(null); setPlanForm(null); }}
              className={`px-4 py-2 rounded-xl font-semibold text-sm whitespace-nowrap transition-all
                ${selectedDay === d ? 'bg-saffron-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Day {d}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setShowAddForm(s => !s); setForm(EMPTY_SPECIAL); setFormErrors({}); }}
          className="w-full sm:w-auto sm:ml-auto btn-secondary text-sm sm:text-base px-4 py-2"
        >
          {showAddForm ? 'Cancel' : `+ ${t('admin.addSpecialActivity')}`}
        </button>
      </div>

      {/* Add-special form */}
      {showAddForm && (
        <div className="bg-white border-2 border-saffron-200 rounded-2xl p-4 sm:p-5 mb-5 fade-in">
          <h3 className="font-bold text-forest-700 mb-4">✨ {t('admin.addSpecialActivity')} — Day {selectedDay}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Name (English) *</label>
              <input className={`input-field ${formErrors.name ? 'border-red-400' : ''}`} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Name (Hindi)</label>
              <input className="input-field" value={form.name_hi} onChange={e => setForm(p => ({ ...p, name_hi: e.target.value }))} placeholder="हिन्दी नाम" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Start Time *</label>
              <input type="time" className={`input-field ${formErrors.start_time ? 'border-red-400' : ''}`} value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">End Time</label>
              <input type="time" className="input-field" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Venue</label>
              <input className="input-field" value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Coordinator</label>
              <input className="input-field" value={form.coordinator} onChange={e => setForm(p => ({ ...p, coordinator: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Coins Allocated</label>
              <input type="number" className="input-field" value={form.coins} onChange={e => setForm(p => ({ ...p, coins: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Session</label>
              <Select
                value={form.session}
                onChange={val => setForm(p => ({ ...p, session: val }))}
                options={[
                  { value: 'morning', label: 'Morning' },
                  { value: 'afternoon', label: 'Afternoon' },
                  { value: 'evening', label: 'Evening' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Materials (comma-separated)</label>
              <input className="input-field" value={form.materials} onChange={e => setForm(p => ({ ...p, materials: e.target.value }))} placeholder="Mics, Stage setup, Decorations" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600 block mb-1">Notes / Instructions</label>
              <textarea className="input-field resize-none" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
            <button onClick={handleAdd} className="btn-primary text-sm sm:text-base px-6 py-2">{t('common.add')}</button>
            <button onClick={() => { setShowAddForm(false); setFormErrors({}); }} className="btn-outline text-sm sm:text-base px-6 py-2">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* Activity list */}
      {sorted.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
          <div className="text-3xl mb-2">📅</div>
          <div className="text-sm font-medium">No activities for Day {selectedDay} yet.</div>
          <div className="text-xs mt-1">Use the button above to add a special activity.</div>
        </div>
      )}
      <div className="space-y-2.5">
        {sorted.map(act => {
          const isExpanded = expandedId === act.id;
          const summary    = planSummary(act.id);
          const plan       = eventPlans[act.id];
          const checkDone  = plan?.checklist?.filter(c => c.done).length ?? 0;
          const checkTotal = plan?.checklist?.length ?? 0;

          return (
            <div
              key={act.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all shadow-sm
                ${act.type === 'special' ? 'border-yellow-300' : isExpanded ? 'border-saffron-300' : 'border-gray-200'}`}
            >
              {/* Activity row */}
              <div className="flex items-start gap-3 p-3.5 sm:p-4">
                {/* Time */}
                <div className="text-center flex-shrink-0 w-14 sm:w-16">
                  {act._fromDB && act.time_slot ? (
                    <div className="text-sm font-bold text-forest-700 leading-tight">{act.time_slot}</div>
                  ) : (
                    <>
                      <div className="text-sm font-bold text-forest-700 leading-tight">{act.start_time}</div>
                      {act.end_time && act.end_time !== act.start_time && (
                        <div className="text-[11px] text-gray-400 mt-0.5">{act.end_time}</div>
                      )}
                    </>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{act.name}</span>
                    {TYPE_BADGE[act.type]}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {act.venue}{act.coordinator ? ` • ${act.coordinator}` : ''}
                    {act.coins > 0 && <span className="ml-2 text-saffron-600 font-semibold">{act.coins} coins</span>}
                  </div>

                  {/* Plan summary chips */}
                  {summary && !isExpanded && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs bg-forest-100 text-forest-700 px-2 py-0.5 rounded-full font-medium">
                        👤 {summary.lead_name}
                      </span>
                      {summary.stakeholders?.length > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                          👥 {summary.stakeholders.length}
                        </span>
                      )}
                      {checkTotal > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${checkDone === checkTotal ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          ✅ {checkDone}/{checkTotal}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                  {act._fromDB && (
                    <span className="text-xs text-gray-400 italic">via Operations</span>
                  )}
                  {/* Plan toggle — available for all non-slot activities */}
                  {act.type !== 'slot' && (
                    <button
                      onClick={() => openPlan(act)}
                      className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold border transition-all
                        ${isExpanded
                          ? 'bg-saffron-500 text-white border-saffron-500'
                          : summary
                            ? 'bg-forest-50 text-forest-600 border-forest-200'
                            : 'bg-saffron-50 text-saffron-600 border-saffron-200'}`}
                    >
                      {isExpanded ? 'Close' : summary ? 'Edit Plan' : '+ Plan'}
                    </button>
                  )}
                  {act.type === 'special' && (
                    <button
                      onClick={() => setDeleteTarget({ day: selectedDay, id: act.id, name: act.name })}
                      className="text-red-300 hover:text-red-500 transition-colors text-lg p-0.5"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>

              {/* Inline plan editor */}
              {isExpanded && planForm && (
                <div className="border-t border-gray-100 bg-gray-50 p-4 sm:p-5 space-y-5 fade-in">

                  {/* Lead Person */}
                  <div>
                    <h4 className="font-semibold text-forest-700 mb-3 text-sm">👤 Lead Person</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <h4 className="font-semibold text-forest-700 mb-3 text-sm">👥 Stakeholders</h4>
                    {planForm.stakeholders.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
                        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{s.name}</span>
                        <span className="text-xs text-gray-500 hidden sm:block">{s.role}</span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">{s.type}</span>
                        <button onClick={() => removeStakeholder(i)} className="text-red-400 hover:text-red-600 text-lg leading-none flex-shrink-0">×</button>
                      </div>
                    ))}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <input className="input-field py-2 text-sm" placeholder="Name" value={newStakeholder.name} onChange={e => setNewStakeholder(p => ({ ...p, name: e.target.value }))} />
                      <input className="input-field py-2 text-sm" placeholder="Role" value={newStakeholder.role} onChange={e => setNewStakeholder(p => ({ ...p, role: e.target.value }))} />
                      <Select size="sm" value={newStakeholder.type} onChange={val => setNewStakeholder(p => ({ ...p, type: val }))} options={STAKEHOLDER_TYPES} />
                    </div>
                    <button onClick={addStakeholder} className="mt-2 text-sm text-saffron-600 font-semibold hover:underline">+ Add</button>
                  </div>

                  {/* Materials Checklist */}
                  <div>
                    <h4 className="font-semibold text-forest-700 mb-3 text-sm">✅ Materials Checklist</h4>
                    {planForm.checklist.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <input type="checkbox" checked={item.done} onChange={() => toggleCheck(i)} className="w-5 h-5 accent-green-500 flex-shrink-0" />
                        <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-900'}`}>{item.text}</span>
                        <button onClick={() => removeCheck(i)} className="text-red-400 hover:text-red-600 leading-none">×</button>
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
                    <h4 className="font-semibold text-forest-700 mb-2 text-sm">📝 Notes</h4>
                    <textarea
                      className="input-field resize-none"
                      rows={2}
                      value={planForm.notes}
                      onChange={e => setPlanForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Any special instructions..."
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <button onClick={() => savePlan(act.id)} className="btn-primary flex-1 text-sm sm:text-base py-2">{t('common.save')}</button>
                    <button onClick={() => { setExpandedId(null); setPlanForm(null); }} className="btn-outline flex-1 text-sm sm:text-base py-2">{t('common.cancel')}</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Special Activity"
        message={`Remove "${deleteTarget?.name}" from Day ${selectedDay}?`}
        danger
        onConfirm={() => { deleteSpecialActivity(deleteTarget.day, deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
        confirmLabel="Delete"
      />
    </div>
  );
}
