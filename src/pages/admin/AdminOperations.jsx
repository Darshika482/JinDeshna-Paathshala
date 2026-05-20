import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase.js';
import { useVolunteerStore } from '../../store/useVolunteerStore.js';
import { useStudentStore } from '../../store/useStudentStore.js';
import { useConfigStore, DEFAULT_BATCH_CLASSES } from '../../store/useConfigStore.js';
import { buildWhatsAppLink, getLoginTarget, normalizePhone } from '../../lib/whatsapp.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeId(prefix) { return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

const GOOD_BEHAVIOUR_TYPES = [
  { id: 1,  name: 'Self Study',                    emoji: '📚' },
  { id: 2,  name: 'Helping Behaviour',              emoji: '🤝' },
  { id: 3,  name: 'Personal Cleanliness',           emoji: '✨' },
  { id: 4,  name: 'Meal Discipline',                emoji: '🍽' },
  { id: 5,  name: 'Morning Routine',                emoji: '🛏' },
  { id: 6,  name: 'Queue Discipline',               emoji: '🚶' },
  { id: 7,  name: 'First to be Ready',              emoji: '⚡' },
  { id: 8,  name: 'Evening Diary Writing',          emoji: '📓' },
  { id: 9,  name: 'Waking Up Without Being Called', emoji: '⏰' },
  { id: 10, name: 'Silent Prayer / Meditation',     emoji: '🕉️' },
  { id: 11, name: 'Encouraging Peers',              emoji: '💪' },
];

const EMPTY_EVENT = { name: '', time_slot: '', event_type: 'daily', applicable_gender: 'all', coin_pool_boys: 0, coin_pool_girls: 0, points_per_coin: 5, responsible_role: 'mentor', notes: '', is_active: true, sort_order: 0 };
const EMPTY_RESP  = { responsibility_text: '', applies_to_role: 'mentor', notes: '' };

// ── Data hook ──────────────────────────────────────────────────────────────────

function useOperationsData() {
  const [events, setEvents]           = useState([]);
  const [responsibilities, setResps]  = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [gbLogs, setGbLogs]           = useState([]);
  const [coinLogs, setCoinLogs]       = useState([]);
  const [roomLogs, setRoomLogs]       = useState([]);
  const [negLogs, setNegLogs]         = useState([]);
  const [config, setConfig]           = useState({ start_date: '2026-05-01' });
  const [loading, setLoading]         = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, rsRes, asRes, gbRes, ccRes, rdRes, nmRes, cfgRes] = await Promise.allSettled([
        supabase.from('events').select('*').order('sort_order'),
        supabase.from('event_responsibilities').select('*').order('sort_order'),
        supabase.from('mentor_event_assignments').select('*'),
        supabase.from('good_behaviour_logs').select('*').order('timestamp', { ascending: false }).limit(200),
        supabase.from('coin_collection_logs').select('*').order('logged_at', { ascending: false }).limit(200),
        supabase.from('room_discipline_logs').select('*').order('checked_at', { ascending: false }),
        supabase.from('negative_markings').select('*').order('logged_at', { ascending: false }).limit(100),
        supabase.from('shivir_config').select('key,value'),
      ]);

      if (evRes.status  === 'fulfilled' && !evRes.value.error)  setEvents(evRes.value.data || []);
      if (rsRes.status  === 'fulfilled' && !rsRes.value.error)  setResps(rsRes.value.data || []);
      if (asRes.status  === 'fulfilled' && !asRes.value.error)  setAssignments(asRes.value.data || []);
      if (gbRes.status  === 'fulfilled' && !gbRes.value.error)  setGbLogs(gbRes.value.data || []);
      if (ccRes.status  === 'fulfilled' && !ccRes.value.error)  setCoinLogs(ccRes.value.data || []);
      if (rdRes.status  === 'fulfilled' && !rdRes.value.error)  setRoomLogs(rdRes.value.data || []);
      if (nmRes.status  === 'fulfilled' && !nmRes.value.error)  setNegLogs(nmRes.value.data || []);
      if (cfgRes.status === 'fulfilled' && !cfgRes.value.error) {
        const m = {};
        (cfgRes.value.data || []).forEach(r => { m[r.key] = r.value; });
        setConfig(c => ({ ...c, ...m }));
      }
    } catch { /* offline */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, setEvents, responsibilities, setResps, assignments, setAssignments, gbLogs, coinLogs, roomLogs, setRoomLogs, negLogs, config, setConfig, loading, refresh };
}

// ── Events Tab ─────────────────────────────────────────────────────────────────

function EventForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_EVENT, ...initial });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Event name is required.'); return; }
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Event Name *</label>
          <input className="form-input mt-1" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Yoga, Bhakti" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Time Slot</label>
          <input className="form-input mt-1" value={form.time_slot} onChange={e => set('time_slot', e.target.value)} placeholder="e.g. 5:15–6:00 AM" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Event Type</label>
          <select className="form-input mt-1" value={form.event_type} onChange={e => set('event_type', e.target.value)}>
            <option value="daily">Daily</option>
            <option value="one-time">One-Time</option>
            <option value="two-day">Two-Day</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Applicable Gender</label>
          <select className="form-input mt-1" value={form.applicable_gender} onChange={e => set('applicable_gender', e.target.value)}>
            <option value="all">All</option>
            <option value="boys_only">Boys Only</option>
            <option value="girls_only">Girls Only</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Coin Pool — Boys</label>
          <input className="form-input mt-1" type="number" min="0" value={form.coin_pool_boys} onChange={e => set('coin_pool_boys', +e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Coin Pool — Girls</label>
          <input className="form-input mt-1" type="number" min="0" value={form.coin_pool_girls} onChange={e => set('coin_pool_girls', +e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Points per Coin</label>
          <input className="form-input mt-1" type="number" min="1" value={form.points_per_coin} onChange={e => set('points_per_coin', +e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Responsible Role</label>
          <select className="form-input mt-1" value={form.responsible_role} onChange={e => set('responsible_role', e.target.value)}>
            <option value="mentor">Mentor</option>
            <option value="teacher">Teacher</option>
            <option value="both">Both</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Sort Order</label>
          <input className="form-input mt-1" type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="w-4 h-4" />
          <label htmlFor="is_active" className="text-sm text-gray-700">Active (visible to mentors)</label>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 font-medium">Notes / Special Rules</label>
        <textarea className="form-input mt-1 h-20 resize-none" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special rules for this event…" />
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Event'}
        </button>
        <button onClick={onCancel} className="px-5 py-2.5 text-sm border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </div>
  );
}

function ResponsibilityForm({ eventId, initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_RESP, ...initial });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.responsibility_text.trim()) { toast.error('Responsibility text is required.'); return; }
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
      <textarea className="form-input w-full h-16 resize-none text-sm" value={form.responsibility_text}
        onChange={e => set('responsibility_text', e.target.value)} placeholder="Responsibility description…" />
      <div className="flex gap-2 items-center">
        <select className="form-input flex-1 text-sm py-1.5" value={form.applies_to_role} onChange={e => set('applies_to_role', e.target.value)}>
          <option value="mentor">Mentor</option>
          <option value="teacher">Teacher</option>
        </select>
        <button onClick={handleSave} disabled={saving} className="btn-primary px-4 py-1.5 text-sm disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700">✕</button>
      </div>
    </div>
  );
}

function EventsSection({ events, setEvents, responsibilities, setResps }) {
  const [showAdd, setShowAdd]         = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [expandedId, setExpandedId]   = useState(null);
  const [addRespFor, setAddRespFor]   = useState(null);
  const [editRespId, setEditRespId]   = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  async function saveEvent(form) {
    if (editingId) {
      const { error } = await supabase.from('events').update(form).eq('id', editingId);
      if (error) { toast.error('Save failed.'); return; }
      setEvents(ev => ev.map(e => e.id === editingId ? { ...e, ...form } : e));
      toast.success('Event updated.');
      setEditingId(null);
    } else {
      const id = makeId('ev');
      const { error } = await supabase.from('events').insert({ ...form, id });
      if (error) { toast.error('Save failed.'); return; }
      setEvents(ev => [...ev, { ...form, id }]);
      toast.success('Event added.');
      setShowAdd(false);
    }
  }

  async function toggleActive(ev) {
    const { error } = await supabase.from('events').update({ is_active: !ev.is_active }).eq('id', ev.id);
    if (error) { toast.error('Update failed.'); return; }
    setEvents(evs => evs.map(e => e.id === ev.id ? { ...e, is_active: !e.is_active } : e));
    toast.success(ev.is_active ? 'Event deactivated.' : 'Event reactivated.');
  }

  async function deleteEvent(id) {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) { toast.error('Delete failed.'); return; }
    setEvents(ev => ev.filter(e => e.id !== id));
    setResps(rs => rs.filter(r => r.event_id !== id));
    toast.success('Event deleted.');
    setDeleteConfirm(null);
  }

  async function saveResp(form) {
    if (editRespId) {
      const { error } = await supabase.from('event_responsibilities').update(form).eq('id', editRespId);
      if (error) { toast.error('Save failed.'); return; }
      setResps(rs => rs.map(r => r.id === editRespId ? { ...r, ...form } : r));
      toast.success('Responsibility updated.');
      setEditRespId(null);
    } else if (addRespFor) {
      const id = makeId('er');
      const payload = { ...form, id, event_id: addRespFor, sort_order: responsibilities.filter(r => r.event_id === addRespFor).length + 1 };
      const { error } = await supabase.from('event_responsibilities').insert(payload);
      if (error) { toast.error('Save failed.'); return; }
      setResps(rs => [...rs, payload]);
      toast.success('Responsibility added.');
      setAddRespFor(null);
    }
  }

  async function deleteResp(id) {
    const { error } = await supabase.from('event_responsibilities').delete().eq('id', id);
    if (error) { toast.error('Delete failed.'); return; }
    setResps(rs => rs.filter(r => r.id !== id));
    toast.success('Deleted.');
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-bold text-gray-700">Events ({events.length})</div>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary px-4 py-2 text-sm">+ Add Event</button>
      </div>

      {showAdd && <EventForm onSave={saveEvent} onCancel={() => setShowAdd(false)} />}

      {events.map(ev => {
        const evResps = responsibilities.filter(r => r.event_id === ev.id);
        const isExpanded = expandedId === ev.id;
        const isEditing = editingId === ev.id;

        return (
          <div key={ev.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${!ev.is_active ? 'opacity-60' : ''}`}>
            {isEditing ? (
              <div className="p-4">
                <EventForm initial={ev} onSave={saveEvent} onCancel={() => setEditingId(null)} />
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">{ev.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ev.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {ev.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">{ev.responsible_role}</span>
                    </div>
                    {ev.time_slot && <div className="text-xs text-gray-400 mt-0.5">🕐 {ev.time_slot}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {ev.event_type} · {ev.applicable_gender === 'all' ? 'All' : ev.applicable_gender === 'boys_only' ? 'Boys' : 'Girls'} · Pool: {ev.coin_pool_boys}♂/{ev.coin_pool_girls}♀ coins
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => setExpandedId(isExpanded ? null : ev.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                      {isExpanded ? '▲' : `📋 ${evResps.length}`}
                    </button>
                    <button onClick={() => setEditingId(ev.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">✏️</button>
                    <button onClick={() => toggleActive(ev)} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                      {ev.is_active ? '🔴' : '🟢'}
                    </button>
                    <button onClick={() => setDeleteConfirm(ev.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">🗑</button>
                  </div>
                </div>

                {/* Confirm delete */}
                {deleteConfirm === ev.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-sm text-red-700 flex-1">Delete "{ev.name}" and all its responsibilities?</span>
                    <button onClick={() => deleteEvent(ev.id)} className="text-sm font-semibold text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700">Delete</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-sm text-gray-500 px-2 py-1.5">Cancel</button>
                  </div>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="border-t border-gray-100 px-4 pb-4">
                {ev.notes && <div className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-2 italic">{ev.notes}</div>}
                <div className="mt-3 space-y-2">
                  {evResps.map(r => (
                    <div key={r.id}>
                      {editRespId === r.id
                        ? <ResponsibilityForm eventId={ev.id} initial={r} onSave={saveResp} onCancel={() => setEditRespId(null)} />
                        : (
                          <div className="flex items-start gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 group">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-semibold flex-shrink-0 mt-0.5 ${r.applies_to_role === 'teacher' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                              {r.applies_to_role}
                            </span>
                            <span className="text-sm text-gray-700 flex-1 leading-snug">{r.responsibility_text}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                              <button onClick={() => setEditRespId(r.id)} className="text-xs px-1.5 py-0.5 text-gray-400 hover:text-gray-700">✏️</button>
                              <button onClick={() => deleteResp(r.id)} className="text-xs px-1.5 py-0.5 text-red-400 hover:text-red-600">🗑</button>
                            </div>
                          </div>
                        )
                      }
                    </div>
                  ))}
                  {addRespFor === ev.id
                    ? <ResponsibilityForm eventId={ev.id} onSave={saveResp} onCancel={() => setAddRespFor(null)} />
                    : (
                      <button onClick={() => setAddRespFor(ev.id)}
                        className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 mt-1">
                        + Add Responsibility
                      </button>
                    )
                  }
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}



// ── Assignment Matrix Tab ──────────────────────────────────────────────────────

function MatrixSection({ volunteers, events, assignments, setAssignments }) {
  const [filterGender, setFilterGender] = useState('all');
  const [toggling, setToggling] = useState(null);

  const mentors = volunteers.filter(v => (v.roles || []).includes('Zone Mentor'));
  const femaleMentors = ['Tanu','Jiya','Srishti','Ankita','Anuprekstha','Shreni','Nishtha','Vishuddhi','Akanksha','Anubhuti','Darshika','Kalpana Didi','Sapna Didi','Shuchi Didi','Bharati Didi','Ritu Ji','Ashi Ji','Smita Bhabhi','Richa Bhabhi','Neha Didi','Surbhi Bhabhi'];
  const filtered = filterGender === 'all' ? mentors
    : mentors.filter(v => filterGender === 'female' ? femaleMentors.some(n => v.name.includes(n.split(' ')[0])) : !femaleMentors.some(n => v.name.includes(n.split(' ')[0])));

  const activeEvents = events.filter(e => e.is_active);

  function isAssigned(mentorId, eventId) {
    return assignments.some(a => a.mentor_id === mentorId && a.event_id === eventId);
  }

  async function toggle(mentorId, eventId) {
    const key = `${mentorId}_${eventId}`;
    setToggling(key);
    const existing = assignments.find(a => a.mentor_id === mentorId && a.event_id === eventId);
    try {
      if (existing) {
        await supabase.from('mentor_event_assignments').delete().eq('id', existing.id);
        setAssignments(prev => prev.filter(a => a.id !== existing.id));
      } else {
        const id = makeId('mea');
        await supabase.from('mentor_event_assignments').insert({ id, mentor_id: mentorId, event_id: eventId });
        setAssignments(prev => [...prev, { id, mentor_id: mentorId, event_id: eventId }]);
      }
    } catch { toast.error('Failed.'); } finally { setToggling(null); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="font-bold text-gray-700 flex-1">Event–Mentor Matrix</div>
        <div className="flex gap-1">
          {['all','female','male'].map(g => (
            <button key={g} onClick={() => setFilterGender(g)}
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors
                ${filterGender === g ? 'bg-forest-600 text-white border-forest-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {g === 'all' ? 'All' : g === 'female' ? '👩' : '👨'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-xs min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2.5 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-[120px]">Mentor</th>
              {activeEvents.map(ev => (
                <th key={ev.id} className="text-center px-2 py-2.5 font-semibold text-gray-600 min-w-[80px]">
                  <div className="truncate max-w-[70px]">{ev.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((v, i) => (
              <tr key={v.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                <td className={`px-3 py-2 font-medium text-gray-800 sticky left-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>{v.name}</td>
                {activeEvents.map(ev => {
                  const assigned = isAssigned(v.id, ev.id);
                  const key = `${v.id}_${ev.id}`;
                  return (
                    <td key={ev.id} className="text-center px-2 py-2">
                      <button
                        disabled={toggling === key}
                        onClick={() => toggle(v.id, ev.id)}
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold mx-auto transition-colors active:scale-90 disabled:opacity-50
                          ${assigned ? 'bg-forest-600 text-white' : 'border-2 border-gray-200 text-gray-300 hover:border-forest-400'}`}
                      >
                        {assigned ? '✓' : ''}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Room Discipline Tab ────────────────────────────────────────────────────────

function RoomDisciplineSection({ roomLogs, setRoomLogs, students }) {
  const [filterDay, setFilterDay] = useState(1);
  const [bestRoom, setBestRoom]   = useState({ boys: null, girls: null });
  const [awarding, setAwarding]   = useState(false);

  const dayLogs = roomLogs.filter(l => l.day_number === filterDay);
  const candidates = dayLogs.filter(l => l.is_best_room);
  const boyCandidates   = candidates.filter(l => l.gender === 'male');
  const girlCandidates  = candidates.filter(l => l.gender === 'female');

  async function awardBestRoom() {
    if (!bestRoom.boys && !bestRoom.girls) { toast.error('Select at least one winner.'); return; }
    setAwarding(true);
    try {
      for (const [gender, roomNum] of [['male', bestRoom.boys], ['female', bestRoom.girls]]) {
        if (!roomNum) continue;
        await supabase.from('room_discipline_logs').update({ mentor_prize_awarded: true }).eq('room_number', roomNum).eq('day_number', filterDay).eq('gender', gender);
        setRoomLogs(prev => prev.map(l => l.room_number === roomNum && l.day_number === filterDay && l.gender === gender ? { ...l, mentor_prize_awarded: true } : l));
      }
      toast.success('Best room winners recorded. Award +5 pts to students from the Students tab.');
      setBestRoom({ boys: null, girls: null });
    } catch {
      toast.error('Failed. Check connection.');
    } finally {
      setAwarding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="font-bold text-gray-700 flex-1">Room Discipline</div>
        <div className="flex gap-1">
          {[1,2,3,4,5,6].map(d => (
            <button key={d} onClick={() => setFilterDay(d)}
              className={`text-xs w-8 h-8 rounded-full border font-semibold ${filterDay === d ? 'bg-forest-600 text-white border-forest-600' : 'border-gray-300 text-gray-600'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Candidates */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div className="font-semibold text-gray-700 text-sm">Best Room Candidates — Day {filterDay}</div>

        {/* Boys */}
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1.5">👨 Boys</div>
          {boyCandidates.length === 0 ? <div className="text-xs text-gray-400">No candidates submitted by mentors yet.</div> : (
            <div className="flex flex-wrap gap-2">
              {boyCandidates.map(l => (
                <button key={l.id} onClick={() => setBestRoom(prev => ({ ...prev, boys: prev.boys === l.room_number ? null : l.room_number }))}
                  className={`text-sm px-4 py-2 rounded-xl border font-semibold transition-colors
                    ${bestRoom.boys === l.room_number ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-300 text-gray-700 hover:bg-amber-50'}`}>
                  Room {l.room_number} {l.mentor_prize_awarded ? '🎁' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Girls */}
        <div>
          <div className="text-xs text-gray-500 font-medium mb-1.5">👩 Girls</div>
          {girlCandidates.length === 0 ? <div className="text-xs text-gray-400">No candidates submitted by mentors yet.</div> : (
            <div className="flex flex-wrap gap-2">
              {girlCandidates.map(l => (
                <button key={l.id} onClick={() => setBestRoom(prev => ({ ...prev, girls: prev.girls === l.room_number ? null : l.room_number }))}
                  className={`text-sm px-4 py-2 rounded-xl border font-semibold transition-colors
                    ${bestRoom.girls === l.room_number ? 'bg-pink-500 border-pink-500 text-white' : 'border-gray-300 text-gray-700 hover:bg-pink-50'}`}>
                  Room {l.room_number} {l.mentor_prize_awarded ? '🎁' : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        {(bestRoom.boys || bestRoom.girls) && (
          <button disabled={awarding} onClick={awardBestRoom} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {awarding ? 'Recording…' : '⭐ Record Best Room Prize'}
          </button>
        )}
      </div>

      {/* All logs */}
      {dayLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">All Checks — Day {filterDay}</div>
          {dayLogs.map(l => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0">
              <div className="text-sm font-semibold text-gray-800 w-20">Room {l.room_number}</div>
              <div className="text-xs text-gray-400">{l.gender}</div>
              {l.is_best_room && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">⭐ Best</span>}
              {l.mentor_prize_awarded && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold">🎁 Prize</span>}
              {l.notes && <span className="text-xs text-gray-400 truncate flex-1 ml-1">{l.notes}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Operations Log Tab ─────────────────────────────────────────────────────────

function OperationsLogSection({ gbLogs, coinLogs, negLogs, volunteers, students }) {
  const [filterType, setFilterType] = useState('all');

  function getStudentName(id) { return students.find(s => s.id === id)?.name || id; }
  function getMentorName(id)  { return volunteers.find(v => v.id === id)?.name || id; }
  function getActorName(log) {
    return (
      log.mentor_name ||
      log.volunteer_name ||
      getMentorName(log.mentor_id || log.volunteer_id) ||
      'Unknown'
    );
  }

  const allLogs = [
    ...gbLogs.map(l => ({ ...l, _type: 'gb',   _ts: l.timestamp })),
    ...coinLogs.map(l => ({ ...l, _type: 'cc',  _ts: l.logged_at })),
    ...negLogs.map(l => ({ ...l, _type: 'neg',  _ts: l.logged_at })),
  ].sort((a, b) => new Date(b._ts) - new Date(a._ts)).slice(0, 150);

  const filtered = filterType === 'all' ? allLogs : allLogs.filter(l => l._type === filterType);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="font-bold text-gray-700 flex-1">Operations Log</div>
        <div className="flex gap-1 flex-wrap">
          {[['all','All'],['gb','Good Behaviour'],['cc','Coin Collection'],['neg','Negative Marking']].map(([k, label]) => (
            <button key={k} onClick={() => setFilterType(k)}
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors
                ${filterType === k ? 'bg-forest-600 text-white border-forest-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No logs yet.</div>
        ) : filtered.map((l, i) => (
          <div key={l.id || i} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${l._type === 'neg' ? 'bg-red-50/40' : ''}`}>
            <div className="flex-shrink-0 mt-0.5">
              {l._type === 'gb'  && <span className="text-base">🌟</span>}
              {l._type === 'cc'  && <span className="text-base">🪙</span>}
              {l._type === 'neg' && <span className="text-base">⚠️</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900">
                {l._type === 'gb' && `Good Behaviour — ${getStudentName(l.student_id)}`}
                {l._type === 'cc' && `${l.coins_collected} coins → +${l.points_awarded} pts — ${getStudentName(l.student_id)}`}
                {l._type === 'neg' && `−${l.points_deducted} pts — ${getStudentName(l.student_id)}: ${l.reason_text}`}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                by {getActorName(l)} · Day {l.day_number} · {l._ts ? format(new Date(l._ts), 'h:mm a') : ''}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Config Section ─────────────────────────────────────────────────────────────

function ConfigSection({ config, setConfig }) {
  const [form, setForm] = useState({ ...config });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(form)) {
        await supabase.from('shivir_config').upsert({ key, value: String(value) }, { onConflict: 'key' });
      }
      setConfig(form);
      toast.success('Config saved.');
    } catch {
      toast.error('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-md">
      <div className="font-bold text-gray-700">Shivir Config</div>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div>
          <label className="text-xs text-gray-500 font-medium">Shivir Start Date</label>
          <input type="date" className="form-input mt-1" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Coin Collection Opens (hour, 24h)</label>
          <input type="number" min="0" max="23" className="form-input mt-1" value={form.coin_collect_open_hh || 12} onChange={e => setForm(f => ({ ...f, coin_collect_open_hh: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-medium">Coin Collection Closes (hour, 24h)</label>
          <input type="number" min="0" max="23" className="form-input mt-1" value={form.coin_collect_close_hh || 13} onChange={e => setForm(f => ({ ...f, coin_collect_close_hh: e.target.value }))} />
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Config'}
        </button>
      </div>
    </div>
  );
}

// ── PIN Distribution Tab ───────────────────────────────────────────────────────
//
// Lets the admin send each teacher / mentor their personal login PIN over
// WhatsApp. We build a wa.me link with a pre-filled message containing the
// app URL, the role-specific path, and the volunteer's PIN.

const ROLE_FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'teacher', label: '📝 Teachers' },
  { key: 'mentor',  label: '👥 Mentors' },
];

function isPinRecipient(v) {
  // Send PINs to anyone who has a login flow other than admin.
  const roles = v?.roles || (v?.role ? [v.role] : []);
  if (!roles.length) return false;
  if (roles.includes('Admin') && roles.length === 1) return false;
  return true;
}

function PinsSection({ volunteers }) {
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [sentIds, setSentIds]   = useState(() => new Set());

  const recipients = volunteers.filter(isPinRecipient);

  const filtered = recipients.filter(v => {
    const target = getLoginTarget(v);
    if (filter === 'teacher' && target.key !== 'teacher') return false;
    if (filter === 'mentor'  && target.key === 'teacher') return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.name_hi?.includes(search) ||
      String(v.mobile || '').includes(search) ||
      String(v.pin || '').includes(search) ||
      v.city?.toLowerCase().includes(q)
    );
  });

  const sendOne = (v) => {
    const url = buildWhatsAppLink(v);
    if (!url) {
      toast.error(v.mobile ? 'Missing PIN.' : 'Missing mobile number.');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    setSentIds(prev => new Set(prev).add(v.id));
  };

  const missingMobile = recipients.filter(v => !normalizePhone(v.mobile)).length;
  const missingPin    = recipients.filter(v => !String(v.pin || '').trim()).length;

  return (
    <div className="space-y-3">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="font-bold text-gray-700 flex-1">
          PIN Distribution <span className="text-gray-400 font-normal">({filtered.length})</span>
        </div>
        <div className="flex gap-1">
          {ROLE_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-colors
                ${filter === f.key ? 'bg-forest-600 text-white border-forest-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <input
        className="form-input w-full"
        placeholder="Search by name, mobile, PIN, or city…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Helper banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
        Tap <span className="font-bold">Send PIN</span> to open WhatsApp with a pre-filled message containing the
        login link and the mentor's PIN. Make sure each person has a mobile number and PIN set in <span className="font-semibold">Mentors</span>.
        {(missingMobile > 0 || missingPin > 0) && (
          <div className="mt-1 text-amber-700">
            ⚠️ {missingMobile > 0 && <>{missingMobile} missing mobile</>}{missingMobile > 0 && missingPin > 0 && ' · '}{missingPin > 0 && <>{missingPin} missing PIN</>}
          </div>
        )}
      </div>

      {/* Recipient list */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No matching mentors.</div>
        ) : filtered.map(v => {
          const target  = getLoginTarget(v);
          const phone   = normalizePhone(v.mobile);
          const hasPin  = !!String(v.pin || '').trim();
          const ready   = phone && hasPin;
          const sent    = sentIds.has(v.id);
          const initials = (v.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={v.id} className="flex items-center gap-3 p-3 sm:p-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                ${target.key === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-forest-100 text-forest-700'}`}>
                {initials || '👤'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900 truncate">{v.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold
                    ${target.key === 'teacher' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {target.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                  <span className={phone ? '' : 'text-amber-600 font-semibold'}>
                    📱 {v.mobile || 'No mobile'}
                  </span>
                  <span className={hasPin ? 'font-mono' : 'text-amber-600 font-semibold'}>
                    🔑 PIN {hasPin ? v.pin : '—'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => sendOne(v)}
                disabled={!ready}
                title={!phone ? 'Add mobile number first' : !hasPin ? 'Set a PIN first' : `Send PIN to ${v.name} via WhatsApp`}
                className={`flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl flex-shrink-0 transition-colors
                  ${!ready
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : sent
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      : 'bg-[#25D366] text-white hover:bg-[#128C7E] active:scale-95'
                  }`}
              >
                <span>{sent ? '✓' : '💬'}</span>
                <span className="hidden sm:inline">{sent ? 'Sent — Resend' : 'Send PIN'}</span>
                <span className="sm:hidden">{sent ? 'Resend' : 'Send'}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

// ── Manage Classes ─────────────────────────────────────────────────────────────
function ClassesSection() {
  const storedBatchClasses = useConfigStore(s => s.batchClasses);
  const saveBatchClasses   = useConfigStore(s => s.saveBatchClasses);
  const [batches, setBatches] = useState(() => storedBatchClasses || DEFAULT_BATCH_CLASSES);
  const [newBatchName, setNewBatchName] = useState('');
  const [addingClass, setAddingClass] = useState({}); // { [batchKey]: inputValue }

  const save = (next) => { setBatches(next); saveBatchClasses(next); };

  const addClass = (batch) => {
    const code = (addingClass[batch] || '').trim().toUpperCase();
    if (!code) return;
    if ((batches[batch] || []).includes(code)) { toast.error(`${code} already exists in ${batch}.`); return; }
    save({ ...batches, [batch]: [...(batches[batch] || []), code] });
    setAddingClass(p => ({ ...p, [batch]: '' }));
    toast.success(`${code} added to ${batch}.`);
  };

  const removeClass = (batch, cls) => {
    const next = (batches[batch] || []).filter(c => c !== cls);
    save({ ...batches, [batch]: next });
  };

  const addBatch = () => {
    const name = newBatchName.trim();
    if (!name) return;
    if (batches[name]) { toast.error('Batch already exists.'); return; }
    save({ ...batches, [name]: [] });
    setNewBatchName('');
    toast.success(`Batch "${name}" added.`);
  };

  const removeBatch = (batch) => {
    if (!window.confirm(`Remove batch "${batch}" and all its classes? Existing student records are not affected.`)) return;
    const next = { ...batches };
    delete next[batch];
    save(next);
    toast.success(`Batch "${batch}" removed.`);
  };

  const renameBatch = (oldName, newName) => {
    newName = newName.trim();
    if (!newName || newName === oldName) return;
    if (batches[newName]) { toast.error('A batch with that name already exists.'); return; }
    const next = {};
    for (const [k, v] of Object.entries(batches)) {
      next[k === oldName ? newName : k] = v;
    }
    save(next);
    toast.success(`Renamed to "${newName}".`);
  };

  const resetToDefault = () => {
    if (!window.confirm('Reset to the default class structure? Your custom classes will be lost.')) return;
    save(DEFAULT_BATCH_CLASSES);
    toast.success('Classes reset to defaults.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Add or remove batches and class codes. Changes apply immediately to the student form and CSV template.
          Existing student records are <strong>not</strong> affected.
        </p>
        <button onClick={resetToDefault} className="text-xs text-gray-400 hover:text-red-500 shrink-0 ml-4">Reset to default</button>
      </div>

      {Object.entries(batches).map(([batch, classes]) => (
        <div key={batch} className="bg-white border border-gray-200 rounded-2xl p-4">
          {/* Batch header */}
          <div className="flex items-center gap-2 mb-3">
            <input
              className="font-semibold text-forest-700 text-sm bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-forest-500 w-32"
              defaultValue={batch}
              onBlur={e => renameBatch(batch, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              title="Click to rename batch"
            />
            <span className="text-xs text-gray-400">({classes.length} classes)</span>
            <button
              onClick={() => removeBatch(batch)}
              className="ml-auto text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50"
            >
              Remove batch
            </button>
          </div>

          {/* Class chips */}
          <div className="flex flex-wrap gap-2">
            {classes.map(cls => (
              <span key={cls} className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-mono text-gray-700">
                {cls}
                <button
                  onClick={() => removeClass(batch, cls)}
                  className="text-gray-400 hover:text-red-500 leading-none ml-0.5"
                  title={`Remove ${cls}`}
                >×</button>
              </span>
            ))}

            {/* Inline add field */}
            <div className="flex items-center gap-1">
              <input
                className="w-16 border-2 border-dashed border-gray-300 rounded-lg px-2 py-1 text-sm font-mono text-center focus:outline-none focus:border-forest-500 uppercase"
                placeholder="+ 1A"
                value={addingClass[batch] || ''}
                onChange={e => setAddingClass(p => ({ ...p, [batch]: e.target.value.toUpperCase() }))}
                onKeyDown={e => { if (e.key === 'Enter') addClass(batch); }}
              />
              <button
                onClick={() => addClass(batch)}
                className="text-xs px-2 py-1 bg-forest-700 text-white rounded-lg hover:bg-forest-800"
              >Add</button>
            </div>
          </div>
        </div>
      ))}

      {/* Add new batch */}
      <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center gap-2">
        <input
          className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-500 flex-1 max-w-xs"
          placeholder="New batch name, e.g. Bhag-5"
          value={newBatchName}
          onChange={e => setNewBatchName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addBatch(); }}
        />
        <button onClick={addBatch} className="px-4 py-2 bg-forest-700 text-white rounded-xl text-sm font-semibold hover:bg-forest-800">
          + Add Batch
        </button>
      </div>
    </div>
  );
}

const TABS = [
  { key: 'classes',  icon: '🏫', label: 'Classes' },
  { key: 'events',   icon: '📅', label: 'Events' },
  { key: 'matrix',   icon: '⊞',  label: 'Matrix' },
  { key: 'rooms',    icon: '🏠', label: 'Rooms' },
  { key: 'pins',     icon: '🔑', label: 'PINs' },
  { key: 'log',      icon: '📋', label: 'Log' },
  { key: 'config',   icon: '⚙️', label: 'Config' },
];

export default function AdminOperations() {
  const { volunteers } = useVolunteerStore();
  const { students } = useStudentStore();
  const { events, setEvents, responsibilities, setResps, assignments, setAssignments, gbLogs, coinLogs, roomLogs, setRoomLogs, negLogs, config, setConfig, loading } = useOperationsData();

  const [activeTab, setActiveTab] = useState('events');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-center"><div className="text-3xl mb-2">⏳</div><div className="text-sm">Loading operations data…</div></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors
              ${activeTab === tab.key ? 'bg-white text-forest-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'classes' && <ClassesSection />}
      {activeTab === 'events'  && <EventsSection events={events} setEvents={setEvents} responsibilities={responsibilities} setResps={setResps} />}
{activeTab === 'matrix'  && <MatrixSection volunteers={volunteers} events={events} assignments={assignments} setAssignments={setAssignments} />}
      {activeTab === 'rooms'   && <RoomDisciplineSection roomLogs={roomLogs} setRoomLogs={setRoomLogs} students={students} />}
      {activeTab === 'pins'    && <PinsSection volunteers={volunteers} />}
      {activeTab === 'log'     && <OperationsLogSection gbLogs={gbLogs} coinLogs={coinLogs} negLogs={negLogs} volunteers={volunteers} students={students} />}
      {activeTab === 'config'  && <ConfigSection config={config} setConfig={setConfig} />}
    </div>
  );
}
