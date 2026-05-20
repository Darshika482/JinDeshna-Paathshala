import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase.js';
import { useVolunteerStore } from '../../store/useVolunteerStore.js';
import { useScheduleStore } from '../../store/useScheduleStore.js';
import { useConfigStore, DEFAULT_BATCH_CLASSES } from '../../store/useConfigStore.js';
import Select from '../../components/common/Select.jsx';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';
import { buildWhatsAppLink } from '../../lib/whatsapp.js';

// Open WhatsApp with a pre-filled login PIN message for this volunteer.
// Surface a clear toast if mobile or PIN is missing.
function sendPinViaWhatsApp(v) {
  const url = buildWhatsAppLink(v);
  if (!url) {
    if (!v?.mobile) toast.error(`${v?.name || 'Mentor'} has no mobile number.`);
    else toast.error(`${v?.name || 'Mentor'} has no PIN set.`);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Duty areas — emoji prefix is used to match responsibilities strings ──────
const DEFAULT_DUTY_AREAS = [
  { key: 'early_riser', emoji: '🌅', label: 'Early Riser', stdText: '🌅 Early Riser (5:00 AM)', color: 'bg-amber-50 border-amber-300 text-amber-800', aliases: ['early riser'] },
  { key: 'yoga', emoji: '🧘', label: 'Yoga', stdText: '🧘 Yoga supervision', color: 'bg-emerald-50 border-emerald-300 text-emerald-800', aliases: ['yoga'] },
  { key: 'poojan', emoji: '🙏', label: 'Morning Puja', stdText: '🙏 Morning Puja supervision', color: 'bg-orange-50 border-orange-300 text-orange-800', aliases: ['morning puja', 'poojan', 'puja'] },
  { key: 'kaksha_1', emoji: '📚', label: 'Kaksha – Class 1', stdText: '📚 Kaksha – Class 1 support', color: 'bg-sky-50 border-sky-300 text-sky-800', aliases: ['kaksha class 1', 'class 1', 'kaksha 1'] },
  { key: 'kaksha_2', emoji: '📚', label: 'Kaksha – Class 2', stdText: '📚 Kaksha – Class 2 support', color: 'bg-blue-50 border-blue-300 text-blue-800', aliases: ['kaksha class 2', 'class 2', 'kaksha 2'] },
  { key: 'kaksha_3', emoji: '📚', label: 'Kaksha – Class 3', stdText: '📚 Kaksha – Class 3 support', color: 'bg-indigo-50 border-indigo-300 text-indigo-800', aliases: ['kaksha class 3', 'class 3', 'kaksha 3'] },
  { key: 'samuhik', emoji: '🏛️', label: 'Samuhik Kaksha', stdText: '🏛️ Samuhik Kaksha', color: 'bg-violet-50 border-violet-300 text-violet-800', aliases: ['samuhik kaksha', 'samuhik'] },
  { key: 'bhakti', emoji: '🎵', label: 'Bhakti', stdText: '🎵 Bhakti supervision', color: 'bg-pink-50 border-pink-300 text-pink-800', aliases: ['bhakti'] },
  { key: 'khojooge', emoji: '🔎', label: 'Khojooge To Paoge', stdText: '🔎 Khojooge To Paoge', color: 'bg-yellow-50 border-yellow-300 text-yellow-800', aliases: ['khojooge to paoge', 'khojooge'] },
  { key: 'meal', emoji: '🍽', label: 'Meal Supervision', stdText: '🍽 Meal supervision', color: 'bg-lime-50 border-lime-300 text-lime-800', aliases: ['meal supervision', 'meal'] },
  { key: 'night', emoji: '🌙', label: 'Night Duty', stdText: '🌙 Night duty', color: 'bg-slate-50 border-slate-300 text-slate-800', aliases: ['night duty', 'night'] },
  { key: 'coin_dist', emoji: '🪙', label: 'Coin Distribution', stdText: '🪙 Coin distribution', color: 'bg-yellow-50 border-yellow-300 text-yellow-800', aliases: ['coin distribution'] },
  { key: 'coin_coll', emoji: '💰', label: 'Coin Collection', stdText: '💰 Coin collection', color: 'bg-teal-50 border-teal-300 text-teal-800', aliases: ['coin collection'] },
  { key: 'zone', emoji: '🏠', label: 'Zone Supervision', stdText: '🏠 Zone room supervision', color: 'bg-gray-50 border-gray-300 text-gray-800', aliases: ['zone room supervision', 'zone supervision'] },
  { key: 'welfare', emoji: '🏥', label: 'Student Welfare', stdText: '🏥 Student welfare & sick bay', color: 'bg-rose-50 border-rose-300 text-rose-800', aliases: ['student welfare', 'sick bay'] },
  { key: 'emergency', emoji: '⚡', label: 'Emergency Support', stdText: '⚡ Emergency coordinator', color: 'bg-red-50 border-red-300 text-red-800', aliases: ['emergency coordinator', 'emergency support'] },
  { key: 'data', emoji: '📊', label: 'Data & Records', stdText: '📊 Data & records coordination', color: 'bg-purple-50 border-purple-300 text-purple-800', aliases: ['data records', 'records coordination'] },
];

const DUTY_COLOR_OPTIONS = [
  'bg-amber-50 border-amber-300 text-amber-800',
  'bg-emerald-50 border-emerald-300 text-emerald-800',
  'bg-orange-50 border-orange-300 text-orange-800',
  'bg-sky-50 border-sky-300 text-sky-800',
  'bg-blue-50 border-blue-300 text-blue-800',
  'bg-indigo-50 border-indigo-300 text-indigo-800',
  'bg-violet-50 border-violet-300 text-violet-800',
  'bg-pink-50 border-pink-300 text-pink-800',
  'bg-yellow-50 border-yellow-300 text-yellow-800',
  'bg-lime-50 border-lime-300 text-lime-800',
  'bg-slate-50 border-slate-300 text-slate-800',
  'bg-teal-50 border-teal-300 text-teal-800',
  'bg-gray-50 border-gray-300 text-gray-800',
  'bg-rose-50 border-rose-300 text-rose-800',
  'bg-red-50 border-red-300 text-red-800',
  'bg-purple-50 border-purple-300 text-purple-800',
];

const DUTY_AREAS_STORAGE_KEY = 'shivir-duty-areas-v1';
const CLASS_BOARD_COLOR_OPTIONS = [
  'bg-sky-50 border-sky-300 text-sky-800',
  'bg-blue-50 border-blue-300 text-blue-800',
  'bg-indigo-50 border-indigo-300 text-indigo-800',
  'bg-violet-50 border-violet-300 text-violet-800',
];

function normalizeResponsibilityText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toDutyKey(label) {
  return normalizeResponsibilityText(label).replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeClassCode(value) {
  return String(value || '').toUpperCase().replace(/\s+/g, '');
}

function classNamesFromEvent(eventName) {
  const raw = String(eventName || '').trim();
  if (!raw) return [];

  // If event name contains explicit class codes, prefer those.
  const upper = raw.toUpperCase();
  const codeMatches = upper.match(/\b\d+[A-Z]\b/g);
  if (codeMatches?.length) return codeMatches.map(normalizeClassCode);

  // Otherwise treat the class event name itself as assignable text.
  return [raw];
}

function BoardActionIconButton({ title, onClick, children, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'text-rose-700 hover:text-rose-800'
      : 'text-slate-600 hover:text-slate-800';
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`h-6 w-6 inline-flex items-center justify-center rounded-md bg-white/80 border border-white/70 hover:bg-white transition-colors ${toneClass}`}
    >
      {children}
    </button>
  );
}

// Returns true if a mentor's responsibility string belongs to this duty area
function respMatchesDuty(resp, area) {
  const raw = String(resp || '');
  const normalized = normalizeResponsibilityText(raw);
  const aliases = area.aliases || [];

  if (raw.includes(area.emoji)) {
    if (aliases.length === 0) return true;
    if (aliases.some(alias => normalized.includes(alias))) return true;
  }

  return aliases.some(alias => normalized.includes(alias));
}

function mentorHasDuty(mentor, area) {
  return (mentor.responsibilities || []).some(r => respMatchesDuty(r, area));
}

const ROLES = ['Activity Coordinator', 'Zone Mentor', 'Class Teacher', 'Collection Mentor', 'Admin'];
const DEFAULT_sessionKeys = ['1', '2', '3'];
const DEFAULT_sessionLabels = {
  '1': 'Session 1 — Morning 1',
  '2': 'Session 2 — Morning 2',
  '3': 'Session 3 — Afternoon',
};
const EMPTY_VOL = {
  name: '',
  pin: '',
  mobile: '',
  city: '',
  name_hi: '',
  availability: '',
  roles: ['Zone Mentor'],
  assigned_activity: '',
  assigned_class: '',
  assigned_classes: [],
  session_classes: {},
  has_deduction_rights: false,
  responsibilities: [],
};

function parseSessionClasses(raw, keys = DEFAULT_SESSION_KEYS) {
  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  const savedKeys = (value && typeof value === 'object' && !Array.isArray(value))
    ? Object.keys(value)
    : [];
  const allKeys = [...new Set([...keys, ...savedKeys])];
  const out = Object.fromEntries(allKeys.map(k => [k, '']));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of allKeys) {
      const code = String(value[k] ?? '').trim();
      if (code) out[k] = code;
    }
  }
  return out;
}

const ROLE_COLORS = {
  'Activity Coordinator': 'bg-purple-100 text-purple-700',
  'Zone Mentor': 'bg-blue-100 text-blue-700',
  'Class Teacher': 'bg-green-100 text-green-700',
  'Collection Mentor': 'bg-orange-100 text-orange-700',
  'Admin': 'bg-red-100 text-red-700',
};

const AVAIL_COLORS = {
  'Full': 'bg-green-100 text-green-700',
  'Day': 'bg-sky-100 text-sky-700',
  'Night': 'bg-indigo-100 text-indigo-700',
  'From 4 May': 'bg-amber-100 text-amber-700',
};

export default function AdminVolunteers() {
  const { t } = useTranslation();
  const { volunteers, addVolunteer, updateVolunteer, deleteVolunteer, importFromCSV } = useVolunteerStore();
  const { schedule } = useScheduleStore();
  const configuredBatchClasses = useConfigStore(s => s.batchClasses) || DEFAULT_BATCH_CLASSES;

  const [classSessionEvents, setClassSessionEvents] = useState([]);
  const [dbEvents, setDbEvents] = useState([]);

  useEffect(() => {
    supabase
      .from('events')
      .select('id,name,time_slot,event_type,sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .then(({ data }) => {
        const all = data || [];
        setDbEvents(all);
        setClassSessionEvents(all.filter(e => e.event_type === 'class'));
      });
  }, []);

  const sessionKeys = classSessionEvents.length > 0
    ? classSessionEvents.map((_, i) => String(i + 1))
    : DEFAULT_sessionKeys;

  const sessionLabels = classSessionEvents.length > 0
    ? Object.fromEntries(classSessionEvents.map((ev, i) => [
        String(i + 1),
        ev.time_slot ? `${ev.name} (${ev.time_slot})` : ev.name,
      ]))
    : DEFAULT_sessionLabels;

  // Extract class options from Operations -> Events (event_type = "class").
  // Supports both code-style names ("1A", "Class 2B") and free names
  // ("Class Morning", "Junior Batch").
  const eventClassCodes = [...new Set(
    classSessionEvents
      .flatMap((ev) => classNamesFromEvent(ev?.name))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  // Duty areas derived from Operations → Events (auto-synced, non-editable on this page)
  const EVENT_TYPE_BOARD_META = {
    class:       { emoji: '📚', color: 'bg-sky-50 border-sky-300 text-sky-800' },
    competition: { emoji: '🏆', color: 'bg-amber-50 border-amber-300 text-amber-800' },
    activity:    { emoji: '🎯', color: 'bg-violet-50 border-violet-300 text-violet-800' },
    event:       { emoji: '📅', color: 'bg-green-50 border-green-300 text-green-800' },
  };
  const dbDutyAreas = dbEvents.map(ev => {
    const meta = EVENT_TYPE_BOARD_META[ev.event_type] || { emoji: '📌', color: 'bg-gray-50 border-gray-300 text-gray-800' };
    const displayLabel = ev.time_slot ? `${ev.name} (${ev.time_slot})` : ev.name;
    return {
      key: `db_${ev.id}`,
      emoji: meta.emoji,
      label: displayLabel,
      stdText: `${meta.emoji} ${ev.name}`,
      color: meta.color,
      aliases: [ev.name.toLowerCase()],
      _fromDB: true,
    };
  });

  const [view, setView] = useState('list'); // 'list' | 'board'
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_VOL);
  const [deleteId, setDeleteId] = useState(null);
  const [errors, setErrors] = useState({});
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterMobile, setFilterMobile] = useState('all');
  const [filterResponsibility, setFilterResponsibility] = useState('all');
  const [newResp, setNewResp] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const csvInputRef = useRef(null);
  const [dutyAreas, setDutyAreas] = useState(() => {
    try {
      if (typeof window === 'undefined') return DEFAULT_DUTY_AREAS;
      const raw = window.localStorage.getItem(DUTY_AREAS_STORAGE_KEY);
      if (!raw) return DEFAULT_DUTY_AREAS;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_DUTY_AREAS;
      return parsed.map((area, idx) => ({
        key: String(area?.key || `custom_${idx + 1}`).trim() || `custom_${idx + 1}`,
        emoji: String(area?.emoji || '📌').trim() || '📌',
        label: String(area?.label || `Duty ${idx + 1}`).trim() || `Duty ${idx + 1}`,
        stdText: String(area?.stdText || '').trim() || `${String(area?.emoji || '📌').trim() || '📌'} ${String(area?.label || `Duty ${idx + 1}`).trim() || `Duty ${idx + 1}`}`,
        color: String(area?.color || DUTY_COLOR_OPTIONS[0]),
        aliases: Array.isArray(area?.aliases)
          ? area.aliases.map(a => normalizeResponsibilityText(a)).filter(Boolean)
          : [],
      }));
    } catch {
      return DEFAULT_DUTY_AREAS;
    }
  });
  // All duty areas: DB-synced first, then local custom ones
  const allDutyAreas = [...dbDutyAreas, ...dutyAreas];
  const [dutyModalOpen, setDutyModalOpen] = useState(false);
  const [editingDutyKey, setEditingDutyKey] = useState('');
  const [dutyForm, setDutyForm] = useState({
    emoji: '📌',
    label: '',
    stdText: '',
    color: DUTY_COLOR_OPTIONS[0],
    aliasesText: '',
  });
  const [dragDutyKey, setDragDutyKey] = useState('');
  const [dragOverDutyKey, setDragOverDutyKey] = useState('');
  const [classSetupLoading, setClassSetupLoading] = useState(false);

  // Duty board manage modal
  const [manageDuty, setManageDuty] = useState(null);
  const [dutyDraft, setDutyDraft] = useState([]); // volunteer ids
  const [deleteDuty, setDeleteDuty] = useState(null);

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(DUTY_AREAS_STORAGE_KEY, JSON.stringify(dutyAreas));
    } catch { /* ignore storage failures */ }
  }, [dutyAreas]);

  const openManageDuty = (area) => {
    setManageDuty(area);
    setDutyDraft(volunteers.filter(v => mentorHasDuty(v, area)).map(v => v.id));
  };

  const openAddDutyModal = () => {
    setEditingDutyKey('');
    setDutyForm({
      emoji: '📌',
      label: '',
      stdText: '',
      color: DUTY_COLOR_OPTIONS[0],
      aliasesText: '',
    });
    setDutyModalOpen(true);
  };

  const openEditDutyModal = (area) => {
    setEditingDutyKey(area.key);
    setDutyForm({
      emoji: area.emoji || '📌',
      label: area.label || '',
      stdText: area.stdText || '',
      color: area.color || DUTY_COLOR_OPTIONS[0],
      aliasesText: (area.aliases || []).join(', '),
    });
    setDutyModalOpen(true);
  };

  const buildUniqueDutyCopy = (sourceArea) => {
    const keyBase = toDutyKey(sourceArea.label) || `duty_${Date.now()}`;
    const usedKeys = new Set(dutyAreas.map(a => a.key));
    const usedStdText = new Set(dutyAreas.map(a => String(a.stdText || '').trim()).filter(Boolean));
    const usedLabels = new Set(dutyAreas.map(a => String(a.label || '').trim()).filter(Boolean));

    let index = 1;
    let key = `${keyBase}_copy`;
    let label = `${sourceArea.label} Copy`;
    let stdText = `${sourceArea.stdText} (Copy)`;

    while (usedKeys.has(key)) {
      index += 1;
      key = `${keyBase}_copy_${index}`;
    }

    while (usedLabels.has(label)) {
      index += 1;
      label = `${sourceArea.label} Copy ${index}`;
    }

    index = 1;
    while (usedStdText.has(stdText)) {
      index += 1;
      stdText = `${sourceArea.stdText} (Copy ${index})`;
    }

    return { key, label, stdText };
  };

  const duplicateDutyArea = async (area) => {
    const copyMeta = buildUniqueDutyCopy(area);
    const duplicatedArea = {
      ...area,
      ...copyMeta,
      aliases: [...(area.aliases || [])],
    };

    setDutyAreas(prev => {
      const sourceIndex = prev.findIndex(item => item.key === area.key);
      if (sourceIndex < 0) return [...prev, duplicatedArea];
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, duplicatedArea);
      return next;
    });

    // Keep assignments consistent so copied board starts with same mentors.
    const assignedMentors = volunteers.filter(v => mentorHasDuty(v, area));
    await Promise.all(
      assignedMentors.map(async (v) => {
        const existing = Array.isArray(v.responsibilities) ? v.responsibilities : [];
        if (existing.includes(duplicatedArea.stdText)) return;
        await updateVolunteer(v.id, { ...v, responsibilities: [...existing, duplicatedArea.stdText] });
      })
    );

    toast.success(`Duplicated "${area.label}".`);
  };

  const setupClasswiseBoards = async () => {
    if (classSetupLoading) return;
    setClassSetupLoading(true);
    try {
      const classCodes = eventClassCodes;

      if (classCodes.length === 0) {
        toast.error('No class codes found in active class events.');
        return;
      }

      const classBoardByCode = {};
      const existingByKey = new Set(dutyAreas.map(a => a.key));
      const nextDutyAreas = [...dutyAreas];
      classCodes.forEach((classCode, idx) => {
        const key = `class_${normalizeClassCode(classCode).toLowerCase()}`;
        const displayClassLabel = /^class\b/i.test(String(classCode).trim())
          ? String(classCode).trim()
          : `Class ${classCode}`;
        const board = {
          key,
          emoji: '📚',
          label: displayClassLabel,
          stdText: `📚 ${displayClassLabel} Mentor`,
          color: CLASS_BOARD_COLOR_OPTIONS[idx % CLASS_BOARD_COLOR_OPTIONS.length],
          aliases: [
            `class ${String(classCode).toLowerCase()}`,
            `kaksha ${String(classCode).toLowerCase()}`,
            String(classCode).toLowerCase(),
          ],
        };
        classBoardByCode[classCode] = board;
        if (!existingByKey.has(key)) {
          nextDutyAreas.push(board);
        }
      });
      setDutyAreas(nextDutyAreas);

      const classStdTexts = new Set(Object.values(classBoardByCode).map(b => b.stdText));
      const updates = volunteers
        .filter(v => !(v.roles || []).includes('Admin'))
        .map(async (v) => {
          const sessionClasses = parseSessionClasses(v.session_classes, sessionKeys);
          const assignedClasses = new Set(
            [
              ...sessionKeys.map(k => normalizeClassCode(sessionClasses[k])),
              ...(Array.isArray(v.assigned_classes) ? v.assigned_classes.map(normalizeClassCode) : []),
              normalizeClassCode(v.assigned_class),
            ].filter(Boolean)
          );

          const existing = Array.isArray(v.responsibilities) ? v.responsibilities : [];
          const withoutClassBoards = existing.filter(resp => !classStdTexts.has(resp));
          const classResponsibilities = [...assignedClasses]
            .map(code => classBoardByCode[code]?.stdText)
            .filter(Boolean);
          const nextResponsibilities = [...withoutClassBoards, ...classResponsibilities];

          const unchanged = nextResponsibilities.length === existing.length
            && nextResponsibilities.every((item, i) => item === existing[i]);
          if (unchanged) return;
          await updateVolunteer(v.id, { ...v, responsibilities: nextResponsibilities });
        });

      await Promise.all(updates);
      toast.success('Class boards created and mentors assigned.');
    } finally {
      setClassSetupLoading(false);
    }
  };

  const moveDutyArea = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return;
    setDutyAreas(prev => {
      const fromIndex = prev.findIndex(a => a.key === fromKey);
      const toIndex = prev.findIndex(a => a.key === toKey);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const onDutyDragStart = (areaKey, e) => {
    setDragDutyKey(areaKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', areaKey);
  };

  const onDutyDragOver = (areaKey, e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDutyKey !== areaKey) setDragOverDutyKey(areaKey);
  };

  const onDutyDrop = (areaKey, e) => {
    e.preventDefault();
    const droppedKey = e.dataTransfer.getData('text/plain') || dragDutyKey;
    moveDutyArea(droppedKey, areaKey);
    setDragDutyKey('');
    setDragOverDutyKey('');
  };

  const onDutyDragEnd = () => {
    setDragDutyKey('');
    setDragOverDutyKey('');
  };

  const deleteDutyArea = async () => {
    if (!deleteDuty) return;
    const areaToDelete = deleteDuty;
    setDeleteDuty(null);

    setDutyAreas(prev => prev.filter(area => area.key !== areaToDelete.key));

    // Remove this duty responsibility from all mentors who currently have it.
    await Promise.all(
      volunteers.map(async (v) => {
        const existing = Array.isArray(v.responsibilities) ? v.responsibilities : [];
        const next = existing.filter(resp => !respMatchesDuty(resp, areaToDelete));
        if (next.length === existing.length) return;
        await updateVolunteer(v.id, { ...v, responsibilities: next });
      })
    );

    toast.success(`Deleted "${areaToDelete.label}".`);
  };

  const saveDutyDefinition = async () => {
    const label = String(dutyForm.label || '').trim();
    const stdText = String(dutyForm.stdText || '').trim();
    const emoji = String(dutyForm.emoji || '📌').trim() || '📌';
    if (!label) {
      toast.error('Duty name is required.');
      return;
    }
    if (!stdText) {
      toast.error('Responsibility text is required.');
      return;
    }

    const aliases = String(dutyForm.aliasesText || '')
      .split(',')
      .map(a => normalizeResponsibilityText(a))
      .filter(Boolean);

    if (editingDutyKey) {
      const previous = dutyAreas.find(a => a.key === editingDutyKey);
      const updated = {
        ...(previous || {}),
        key: editingDutyKey,
        emoji,
        label,
        stdText,
        color: dutyForm.color || DUTY_COLOR_OPTIONS[0],
        aliases,
      };

      setDutyAreas(prev => prev.map(area => (area.key === editingDutyKey ? updated : area)));

      // Keep already-assigned mentors in sync if the canonical text changed.
      if (previous && previous.stdText !== stdText) {
        await Promise.all(
          volunteers.map(async (v) => {
            const resps = Array.isArray(v.responsibilities) ? v.responsibilities : [];
            if (!resps.includes(previous.stdText)) return;
            const next = resps.map(r => (r === previous.stdText ? stdText : r));
            await updateVolunteer(v.id, { ...v, responsibilities: next });
          })
        );
      }

      toast.success('Duty updated.');
    } else {
      const baseKey = toDutyKey(label) || `duty_${Date.now()}`;
      let key = baseKey;
      let i = 2;
      const used = new Set(dutyAreas.map(a => a.key));
      while (used.has(key)) {
        key = `${baseKey}_${i}`;
        i += 1;
      }

      setDutyAreas(prev => [...prev, {
        key,
        emoji,
        label,
        stdText,
        color: dutyForm.color || DUTY_COLOR_OPTIONS[0],
        aliases,
      }]);
      toast.success('New duty added.');
    }

    setDutyModalOpen(false);
  };

  const saveDutyAssignments = () => {
    volunteers.forEach(v => {
      const had = mentorHasDuty(v, manageDuty);
      const should = dutyDraft.includes(v.id);
      if (had === should) return;
      let resps = [...(v.responsibilities || [])];
      if (had && !should) {
        resps = resps.filter(r => !respMatchesDuty(r, manageDuty));
      } else if (!had && should) {
        resps = [...resps, manageDuty.stdText];
      }
      updateVolunteer(v.id, { ...v, responsibilities: resps });
    });
    setManageDuty(null);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (!form.pin.trim() || form.pin.length < 4) e.pin = 'PIN must be at least 4 digits';
    if (!form.roles || form.roles.length === 0) e.roles = 'At least one role is required';
    if (form.pin.trim().length >= 4) {
      const duplicate = volunteers.find(v => v.pin === form.pin.trim() && v.id !== editingId);
      if (duplicate) e.pin = `PIN already used by ${duplicate.name}. Each mentor must have a unique PIN.`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const isTeacher = (form.roles || []).includes('Class Teacher');
    // Per-session map (cleaned, only kept if Class Teacher).
    const sessionClasses = isTeacher
      ? sessionKeys.reduce((acc, k) => {
        const code = String(form.session_classes?.[k] || '').trim();
        if (code) acc[k] = code;
        return acc;
      }, {})
      : {};
    // Derived flat list (union of session values), kept for legacy displays.
    const assignedClasses = [...new Set(Object.values(sessionClasses))];
    const normalized = {
      ...form,
      session_classes: sessionClasses,
      assigned_classes: assignedClasses,
      assigned_class: assignedClasses[0] || '',
    };
    if (editingId) {
      updateVolunteer(editingId, normalized);
    } else {
      addVolunteer(normalized);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_VOL);
    setErrors({});
    setNewResp('');
  };

  const handleEdit = (v) => {
    const assignedClasses = Array.isArray(v.assigned_classes)
      ? v.assigned_classes
      : (v.assigned_class ? [v.assigned_class] : []);
    const sessionClasses = parseSessionClasses(v.session_classes, sessionKeys);
    // If the saved volunteer has classes but no per-session map yet,
    // pre-fill every session with their primary class.
    const hasAnySession = sessionKeys.some(k => sessionClasses[k]);
    if (!hasAnySession && assignedClasses[0]) {
      for (const k of sessionKeys) sessionClasses[k] = assignedClasses[0];
    }
    setEditingId(v.id);
    setForm({
      name: v.name || '',
      name_hi: v.name_hi || '',
      pin: v.pin || '',
      mobile: v.mobile || '',
      city: v.city || '',
      availability: v.availability || '',
      roles: v.roles || (v.role ? [v.role] : ['Zone Mentor']),
      assigned_activity: v.assigned_activity || '',
      assigned_class: v.assigned_class || assignedClasses[0] || '',
      assigned_classes: assignedClasses,
      session_classes: sessionClasses,
      has_deduction_rights: !!v.has_deduction_rights,
      responsibilities: [...(v.responsibilities || [])],
    });
    setShowForm(true);
    setErrors({});
    setNewResp('');
  };

  const addResp = () => {
    if (!newResp.trim()) return;
    setForm(p => ({ ...p, responsibilities: [...p.responsibilities, newResp.trim()] }));
    setNewResp('');
  };

  const removeResp = (i) => {
    setForm(p => ({ ...p, responsibilities: p.responsibilities.filter((_, idx) => idx !== i) }));
  };

  const exportAllMentors = () => {
    const headers = ['Name', 'PIN', 'Mobile', 'City', 'Roles', 'Assigned Classes', 'Has Deduction Rights', 'Availability'];
    const rows = volunteers.map(v => [
      v.name || '',
      v.pin || '',
      v.mobile || '',
      v.city || '',
      (v.roles || []).join(';'),
      (v.assigned_classes?.length ? v.assigned_classes : v.assigned_class ? [v.assigned_class] : []).join(';'),
      v.has_deduction_rights ? 'Yes' : 'No',
      v.availability || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mentors-export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadMentorTemplate = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Mentors');

    const headers = ['Name', 'PIN', 'Mobile', 'City', 'Roles', 'Assigned Classes', 'Has Deduction Rights', 'Availability'];
    const widths  = [22, 8, 15, 14, 28, 22, 22, 16];
    sheet.addRow(headers);
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
    });
    headers.forEach((_, i) => { sheet.getColumn(i + 1).width = widths[i]; });

    sheet.addRow(['Rahul Jain',  '1234', '9876543210', 'Indore', 'Zone Mentor',  '1A;1B', 'No', 'Full Camp']);
    sheet.addRow(['Priya Shah',  '5678', '8765432109', 'Bhopal', 'Class Teacher', '2A',    'No', 'Full Camp']);

    const rolesFormula = `"${ROLES.join(',')}"`;
    for (let row = 2; row <= 500; row++) {
      sheet.getCell(`E${row}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [rolesFormula],
        showErrorMessage: true, errorStyle: 'warning',
        error: 'For multiple roles, separate with semicolons: Zone Mentor;Class Teacher',
      };
      sheet.getCell(`G${row}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: ['"Yes,No"'],
      };
    }

    // Reference sheet
    const ref = workbook.addWorksheet('Valid Options');
    ref.addRow(['Field', 'Valid Values']);
    ref.getRow(1).font = { bold: true };
    ref.addRow(['Roles', ROLES.join(' | ')]);
    ref.addRow(['', 'Separate multiple roles with semicolons: Zone Mentor;Class Teacher']);
    ref.addRow(['Has Deduction Rights', 'Yes | No']);
    ref.addRow(['Assigned Classes', 'Class codes separated by semicolons: 1A;1B;2A']);
    ref.addRow(['PIN', 'Must be unique for each mentor']);
    ref.getColumn(1).width = 22;
    ref.getColumn(2).width = 60;

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'mentors-template.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const result = await importFromCSV(data);
        setImporting(false);
        if (result.success) {
          toast.success(`${result.count} mentor${result.count !== 1 ? 's' : ''} imported.`);
          setShowImport(false);
        } else {
          toast.error(result.error || 'Import failed.');
        }
      },
      error: () => { setImporting(false); toast.error('Could not read the CSV file.'); },
    });
  };

  const activityOptions = [
    { value: '', label: 'Unassigned' },
    ...Object.entries(schedule || {})
      .flatMap(([, acts]) => (acts || []).map(a => ({ value: a.name, label: a.name })))
      .filter(a => a.value)
      .filter((a, idx, arr) => arr.findIndex(x => x.value === a.value) === idx),
  ];

  const classOptions = [...new Set(
    Object.values(configuredBatchClasses)
      .flat()
      .map(normalizeClassCode)
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const filteredVols = volunteers.filter(v => {
    if (filterRole !== 'All' && !(v.roles || []).includes(filterRole)) return false;

    const hasMobile = !!String(v.mobile || '').trim();
    const hasResponsibilities = (v.responsibilities || []).length > 0;

    if (filterMobile === 'has_mobile' && !hasMobile) return false;
    if (filterMobile === 'missing_mobile' && hasMobile) return false;

    if (filterResponsibility === 'assigned' && !hasResponsibilities) return false;
    if (filterResponsibility === 'not_assigned' && hasResponsibilities) return false;

    if (search) {
      const q = search.toLowerCase();
      return v.name?.toLowerCase().includes(q) ||
        v.name_hi?.includes(search) ||
        v.mobile?.includes(search) ||
        v.city?.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-3 sm:p-6">

      {/* Header row */}
      <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 items-center">
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_VOL); setErrors({}); setNewResp(''); }}
          className="btn-secondary text-sm px-4 py-2"
        >
          + {t('admin.addVolunteer')}
        </button>
        <span className="text-sm text-gray-500">{volunteers.filter(v => !v.roles?.includes('Admin')).length} mentors</span>
        <button
          onClick={() => setShowImport(s => !s)}
          className="text-sm px-3 py-2 rounded-xl border-2 border-gray-200 text-gray-700 hover:border-forest-500 transition-all"
        >
          {showImport ? 'Hide' : 'Bulk Import / Export'}
        </button>
        {/* View toggle */}
        <div className="ml-auto flex gap-0 border-2 border-gray-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors ${view === 'list' ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📋 Mentors
          </button>
          <button
            onClick={() => setView('board')}
            className={`px-4 py-1.5 text-sm font-semibold transition-colors ${view === 'board' ? 'bg-forest-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            🗂️ Duties Board
          </button>
        </div>
      </div>

      {/* ── BULK IMPORT / EXPORT ─────────────────────────────────────────────── */}
      {showImport && <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="text-sm font-semibold text-gray-700 mb-1">Bulk Import / Export</div>
        <p className="text-xs text-gray-500 mb-3">
          Download all current mentors as CSV, or use the Excel template (has role dropdowns built in) to add mentors in bulk.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportAllMentors}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-gray-300 bg-white text-gray-700 text-sm font-semibold hover:border-forest-500 transition-all"
          >
            ⬇ Export All Mentors (.csv)
          </button>
          <button
            onClick={downloadMentorTemplate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-saffron-400 bg-saffron-50 text-saffron-800 text-sm font-semibold hover:bg-saffron-100 transition-all"
          >
            ⬇ Download Template (.xlsx)
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-forest-400 bg-forest-50 text-forest-800 text-sm font-semibold hover:bg-forest-100 transition-all disabled:opacity-50"
          >
            {importing ? '⏳ Importing…' : '⬆ Upload CSV'}
          </button>
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
        </div>
        <div className="mt-3 text-xs text-gray-400">
          <span className="font-semibold text-gray-600">Roles:</span> {ROLES.join(' · ')} &nbsp;·&nbsp;
          <span className="font-semibold text-gray-600">Multiple values:</span> separate with semicolons
        </div>
      </div>}

      {/* ── MENTOR LIST VIEW ─────────────────────────────────────────────────── */}
      {view === 'list' && (
        <>
          {/* Search + role filter */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-saffron-500 w-full sm:w-56"
              placeholder="Search name, city, mobile…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <Select
              size="sm"
              className="w-full sm:w-44"
              value={filterRole}
              onChange={setFilterRole}
              options={[{ value: 'All', label: 'All Roles' }, ...ROLES.map(r => ({ value: r, label: r }))]}
            />
            <Select
              size="sm"
              className="w-full sm:w-44"
              value={filterMobile}
              onChange={setFilterMobile}
              options={[
                { value: 'all', label: 'Mobile: All' },
                { value: 'has_mobile', label: 'Has Mobile' },
                { value: 'missing_mobile', label: 'Missing Mobile' },
              ]}
            />
            <Select
              size="sm"
              className="w-full sm:w-52"
              value={filterResponsibility}
              onChange={setFilterResponsibility}
              options={[
                { value: 'all', label: 'Responsibility: All' },
                { value: 'assigned', label: 'Responsibility Assigned' },
                { value: 'not_assigned', label: 'Responsibility Not Assigned' },
              ]}
            />
            <span className="self-center text-xs text-gray-400">{filteredVols.length} shown</span>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2.5 mb-4">
            {filteredVols.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900">{v.name}</div>
                    {v.name_hi && <div className="text-xs text-gray-500">{v.name_hi}</div>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {v.availability && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${AVAIL_COLORS[v.availability] || 'bg-gray-100 text-gray-600'}`}>
                        {v.availability}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">PIN: {v.pin}</span>
                  </div>
                </div>

                {v.mobile && <div className="text-xs text-gray-500 mt-1">📱 {v.mobile}</div>}
                {v.city && <div className="text-xs text-gray-400">{v.city}</div>}

                <div className="mt-2 flex flex-wrap gap-1">
                  {(v.roles || []).map(r => (
                    <span key={r} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-600'}`}>{r}</span>
                  ))}
                  {(v.roles || []).includes('Class Teacher') && (() => {
                    const sc = parseSessionClasses(v.session_classes, sessionKeys);
                    const filled = sessionKeys.filter(k => sc[k]);
                    if (filled.length === 0) return null;
                    return filled.map(k => (
                      <span key={k} className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-saffron-100 text-saffron-700">
                        S{k}: {sc[k]}
                      </span>
                    ));
                  })()}
                </div>

                {(v.responsibilities || []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.responsibilities.map((r, i) => (
                      <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{r}</span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  {!(v.roles || []).includes('Admin') && (
                    <button
                      onClick={() => sendPinViaWhatsApp(v)}
                      title="Send login PIN via WhatsApp"
                      className="flex-1 py-2 rounded-xl bg-[#25D366] text-white text-xs font-semibold hover:bg-[#128C7E] active:scale-95 transition-colors"
                    >
                      💬 Send PIN
                    </button>
                  )}
                  <button onClick={() => handleEdit(v)} className="flex-1 py-2 rounded-xl border border-blue-200 text-blue-700 text-xs font-semibold">Edit</button>
                  {!(v.roles || []).includes('Admin') && (
                    <button onClick={() => setDeleteId(v.id)} className="flex-1 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-semibold">Delete</button>
                  )}
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
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Mobile</th>
                    <th className="px-4 py-3 text-left">PIN</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">Avail.</th>
                    <th className="px-4 py-3 text-left">Responsibilities</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVols.map((v, i) => (
                    <tr key={v.id} className={`border-b last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{v.name}</div>
                        {v.name_hi && <div className="text-xs text-gray-400">{v.name_hi}</div>}
                        {v.city && <div className="text-xs text-gray-400">{v.city}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{v.mobile || '—'}</td>
                      <td className="px-4 py-3 font-mono text-gray-600">{v.pin}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(v.roles || []).map(r => (
                            <span key={r} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-600'}`}>{r}</span>
                          ))}
                          {(v.roles || []).includes('Class Teacher') && (() => {
                            const sc = parseSessionClasses(v.session_classes, sessionKeys);
                            const filled = sessionKeys.filter(k => sc[k]);
                            if (filled.length === 0) return null;
                            return filled.map(k => (
                              <span key={k} className="px-2 py-0.5 rounded-full text-xs font-semibold bg-saffron-100 text-saffron-700">
                                S{k}: {sc[k]}
                              </span>
                            ));
                          })()}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {v.availability ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${AVAIL_COLORS[v.availability] || 'bg-gray-100 text-gray-600'}`}>{v.availability}</span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="flex flex-wrap gap-1">
                          {(v.responsibilities || []).map((r, idx) => (
                            <span key={idx} className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full whitespace-nowrap">{r}</span>
                          ))}
                          {!(v.responsibilities || []).length && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 items-center">
                          {!(v.roles || []).includes('Admin') && (
                            <button
                              onClick={() => sendPinViaWhatsApp(v)}
                              title="Send login PIN via WhatsApp"
                              className="text-emerald-600 hover:text-emerald-700 hover:underline text-xs font-semibold"
                            >
                              💬 Send PIN
                            </button>
                          )}
                          <button onClick={() => handleEdit(v)} className="text-blue-600 hover:underline text-xs font-semibold">Edit</button>
                          {!(v.roles || []).includes('Admin') && (
                            <button onClick={() => setDeleteId(v.id)} className="text-red-500 hover:underline text-xs font-semibold">Delete</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredVols.length === 0 && (
                <div className="text-center py-10 text-gray-400">{t('common.noResults')}</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── DUTIES BOARD VIEW ────────────────────────────────────────────────── */}
      {view === 'board' && (
        <div>
          <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
            <p className="text-sm text-gray-500">
              Each card shows who is assigned to that duty. Cards marked <em>via Events</em> sync automatically from Operations → Events. Click <strong>Manage</strong> to assign mentors.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={setupClasswiseBoards}
                disabled={classSetupLoading}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {classSetupLoading ? 'Setting up...' : '⚡ Setup Class Boards'}
              </button>
              <button
                onClick={openAddDutyModal}
                className="text-xs font-bold px-3 py-1.5 rounded-xl bg-forest-700 text-white hover:bg-forest-800 transition-colors"
              >
                + Add Duty
              </button>
            </div>
          </div>
          {dbDutyAreas.length > 0 && (
            <div className="mb-2">
              <p className="text-xs text-forest-600 font-semibold mb-2 flex items-center gap-1.5">
                <span>🔗</span> Synced from Operations → Events
                <span className="text-gray-400 font-normal">(edit events there to add/remove cards)</span>
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {allDutyAreas.map(area => {
              const assigned = volunteers.filter(v => mentorHasDuty(v, area));
              const isDropTarget = !area._fromDB && dragOverDutyKey === area.key && dragDutyKey && dragDutyKey !== area.key;
              return (
                <div
                  key={area.key}
                  draggable={!area._fromDB}
                  onDragStart={area._fromDB ? undefined : (e) => onDutyDragStart(area.key, e)}
                  onDragOver={area._fromDB ? undefined : (e) => onDutyDragOver(area.key, e)}
                  onDrop={area._fromDB ? undefined : (e) => onDutyDrop(area.key, e)}
                  onDragEnd={area._fromDB ? undefined : onDutyDragEnd}
                  className={`rounded-2xl border-2 p-4 flex flex-col gap-2 transition-shadow ${area._fromDB ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${area.color} ${isDropTarget ? 'ring-2 ring-saffron-400 shadow-lg' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {!area._fromDB && (
                        <span className="text-slate-400 shrink-0" title="Drag to reorder" aria-hidden="true">
                          <svg viewBox="0 0 20 20" className="h-4 w-4 fill-current">
                            <circle cx="6" cy="5" r="1.3" />
                            <circle cx="6" cy="10" r="1.3" />
                            <circle cx="6" cy="15" r="1.3" />
                            <circle cx="12" cy="5" r="1.3" />
                            <circle cx="12" cy="10" r="1.3" />
                            <circle cx="12" cy="15" r="1.3" />
                          </svg>
                        </span>
                      )}
                      <span className="text-xl shrink-0">{area.emoji}</span>
                      <span className="font-bold text-sm leading-tight truncate">{area.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {area._fromDB ? (
                        <span className="text-[10px] font-semibold bg-white/60 rounded-full px-2 py-0.5 text-gray-500">via Events</span>
                      ) : (
                        <>
                          <BoardActionIconButton title="Delete duty card" onClick={() => setDeleteDuty(area)} tone="danger">
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                              <path d="M7.5 2.5h5l.5 1.5H16a1 1 0 1 1 0 2h-.6l-.7 9.2A2 2 0 0 1 12.7 17H7.3a2 2 0 0 1-2-1.8L4.6 6H4a1 1 0 1 1 0-2h3l.5-1.5Zm-1 3.5.7 9h5.6l.7-9H6.5Zm2.2 1.8a.9.9 0 0 1 .9.9v4.6a.9.9 0 1 1-1.8 0V8.7a.9.9 0 0 1 .9-.9Zm2.6 0a.9.9 0 0 1 .9.9v4.6a.9.9 0 1 1-1.8 0V8.7a.9.9 0 0 1 .9-.9Z" />
                            </svg>
                          </BoardActionIconButton>
                          <BoardActionIconButton title="Duplicate duty card" onClick={() => duplicateDutyArea(area)}>
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                              <path d="M6 3.5A1.5 1.5 0 0 1 7.5 2h7A1.5 1.5 0 0 1 16 3.5v9A1.5 1.5 0 0 1 14.5 14h-7A1.5 1.5 0 0 1 6 12.5v-9Zm-2 4A1.5 1.5 0 0 1 5.5 6H5v6.5A3.5 3.5 0 0 0 8.5 16H13v.5a1.5 1.5 0 0 1-1.5 1.5h-6A1.5 1.5 0 0 1 4 16.5v-9Z" />
                            </svg>
                          </BoardActionIconButton>
                          <BoardActionIconButton title="Edit duty card" onClick={() => openEditDutyModal(area)}>
                            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                              <path d="M14.7 2.3a2 2 0 0 1 2.8 2.8l-8.9 8.9a2 2 0 0 1-.8.5l-3 .9a.8.8 0 0 1-1-1l.9-3a2 2 0 0 1 .5-.8l8.9-8.9Zm1.4 2.1a.8.8 0 0 0-1.2-1.1L13.9 4.3 15 5.4l1.1-1Zm-2.3 2.2L6.1 14.3l-1.3.4.4-1.3 7.7-7.7.9.9Z" />
                            </svg>
                          </BoardActionIconButton>
                        </>
                      )}
                      <span className="text-xs font-bold bg-white/60 rounded-full px-2 py-0.5">{assigned.length}</span>
                    </div>
                  </div>

                  {/* Assigned mentor chips */}
                  <div className="flex flex-wrap gap-1 min-h-[24px]">
                    {assigned.length === 0 ? (
                      <span className="text-xs opacity-50 italic">Unassigned</span>
                    ) : assigned.map(v => (
                      <button
                        key={v.id}
                        onClick={() => handleEdit(v)}
                        title={`Edit ${v.name}`}
                        className="text-[11px] font-semibold bg-white/70 hover:bg-white rounded-full px-2 py-0.5 transition-colors truncate max-w-[90px]"
                      >
                        {v.name_hi || v.name}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => openManageDuty(area)}
                    className="mt-auto text-xs font-bold bg-white/80 hover:bg-white rounded-xl py-1.5 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 fill-current" aria-hidden="true">
                      <path d="M10 10.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.3 6a5.3 5.3 0 0 1 10.6 0 .8.8 0 0 1-.8.8H5.5a.8.8 0 0 1-.8-.8ZM15.6 3a.9.9 0 0 1 .9.9v1h1a.9.9 0 1 1 0 1.8h-1v1a.9.9 0 1 1-1.8 0v-1h-1a.9.9 0 0 1 0-1.8h1v-1a.9.9 0 0 1 .9-.9Z" />
                    </svg>
                    Manage
                  </button>
                  {!area._fromDB && <div className="text-[10px] opacity-60 text-center">Drag to reorder</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── DUTY MANAGE MODAL ────────────────────────────────────────────────── */}
      {manageDuty && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setManageDuty(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl fade-in">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-bold text-forest-700 text-base">{manageDuty.emoji} {manageDuty.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">Check mentors to assign this duty</div>
              </div>
              <button onClick={() => setManageDuty(null)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-1">
              {volunteers
                .filter(v => !(v.roles || []).includes('Admin'))
                .map(v => (
                  <label key={v.id} className="flex items-center gap-3 py-2 px-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-saffron-500 shrink-0"
                      checked={dutyDraft.includes(v.id)}
                      onChange={e => {
                        setDutyDraft(prev => e.target.checked ? [...prev, v.id] : prev.filter(id => id !== v.id));
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900">{v.name}</div>
                      {v.name_hi && <div className="text-xs text-gray-400">{v.name_hi}</div>}
                    </div>
                    {v.availability && (
                      <span className={`ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full font-semibold ${AVAIL_COLORS[v.availability] || 'bg-gray-100 text-gray-600'}`}>
                        {v.availability}
                      </span>
                    )}
                  </label>
                ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={saveDutyAssignments} className="btn-primary flex-1 text-sm py-2.5">Save Assignments</button>
              <button onClick={() => setManageDuty(null)} className="btn-outline flex-1 text-sm py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {dutyModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setDutyModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl fade-in">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="font-bold text-forest-700 text-base">
                {editingDutyKey ? 'Edit Duty' : 'Add New Duty'}
              </div>
              <button onClick={() => setDutyModalOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>

            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Emoji</label>
                <input
                  className="input-field"
                  value={dutyForm.emoji}
                  onChange={e => setDutyForm(p => ({ ...p, emoji: e.target.value }))}
                  placeholder="📌"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Duty Name *</label>
                <input
                  className="input-field"
                  value={dutyForm.label}
                  onChange={e => setDutyForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. Morning Assembly"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Responsibility Text *</label>
                <input
                  className="input-field"
                  value={dutyForm.stdText}
                  onChange={e => setDutyForm(p => ({ ...p, stdText: e.target.value }))}
                  placeholder="e.g. 📌 Morning assembly supervision"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Matching Aliases (optional)</label>
                <input
                  className="input-field"
                  value={dutyForm.aliasesText}
                  onChange={e => setDutyForm(p => ({ ...p, aliasesText: e.target.value }))}
                  placeholder="e.g. assembly, morning prayer"
                />
                <p className="text-[11px] text-gray-400 mt-1">Comma-separated keywords used to auto-match similar responsibility text.</p>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Card Color</label>
                <div className="grid grid-cols-8 gap-1.5">
                  {DUTY_COLOR_OPTIONS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setDutyForm(p => ({ ...p, color }))}
                      className={`h-7 rounded-lg border-2 ${color} ${dutyForm.color === color ? 'ring-2 ring-offset-1 ring-saffron-400' : ''}`}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={saveDutyDefinition} className="btn-primary flex-1 text-sm py-2.5">
                {editingDutyKey ? 'Save Changes' : 'Add Duty'}
              </button>
              <button onClick={() => setDutyModalOpen(false)} className="btn-outline flex-1 text-sm py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MENTOR EDIT / ADD FORM ────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl fade-in border border-gray-100 my-4">
            <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-3 border-b border-gray-100 bg-slate-50/70">
              <h3 className="font-semibold text-forest-700 text-lg">{editingId ? t('admin.editVolunteer') : t('admin.addVolunteer')}</h3>
              <button onClick={() => { setShowForm(false); setEditingId(null); setErrors({}); }} className="text-gray-400 hover:text-gray-600 text-2xl p-1 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="px-5 sm:px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Name (English) *</label>
                <input className={`input-field ${errors.name ? 'border-red-400' : ''}`} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Name (Hindi / नाम)</label>
                <input className="input-field" value={form.name_hi} onChange={e => setForm(p => ({ ...p, name_hi: e.target.value }))} />
              </div>

              {/* PIN + Mobile */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">PIN * (4 digits)</label>
                <input type="text" inputMode="numeric" maxLength={6} className={`input-field ${errors.pin ? 'border-red-400' : ''}`} value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} />
                {errors.pin && <p className="text-red-500 text-xs mt-1">{errors.pin}</p>}
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Mobile</label>
                <input type="tel" className="input-field" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value }))} />
              </div>

              {/* City + Availability */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">City</label>
                <input className="input-field" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Availability</label>
                <Select
                  value={form.availability}
                  onChange={val => setForm(p => ({ ...p, availability: val }))}
                  options={[
                    { value: '', label: 'Not specified' },
                    { value: 'Full', label: 'Full (all days & nights)' },
                    { value: 'Day', label: 'Day only' },
                    { value: 'Night', label: 'Night only' },
                    { value: 'From 4 May', label: 'From 4 May onwards' },
                  ]}
                  size="sm"
                />
              </div>

              {/* Roles */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-2">Roles *</label>
                <div className="flex flex-wrap gap-2 p-2 rounded-xl border border-gray-200 bg-white">
                  {ROLES.map(r => (
                    <label key={r} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-saffron-500"
                        checked={form.roles?.includes(r) || false}
                        onChange={e => {
                          const prev = form.roles || [];
                          setForm(p => ({ ...p, roles: e.target.checked ? [...prev, r] : prev.filter(x => x !== r) }));
                        }}
                      />
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[r] || 'bg-gray-100 text-gray-600'}`}>{r}</span>
                    </label>
                  ))}
                </div>
                {errors.roles && <p className="text-red-500 text-xs mt-1">{errors.roles}</p>}
              </div>

              {/* Per-session class assignment — Class Teachers only */}
              {(form.roles || []).includes('Class Teacher') && (
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-gray-600">
                      Per-Session Class Assignment
                    </label>
                    {form.session_classes?.['1'] && (
                      <button
                        type="button"
                        onClick={() => {
                          const code = form.session_classes['1'];
                          setForm(p => ({
                            ...p,
                            session_classes: Object.fromEntries(sessionKeys.map(k => [k, code])),
                          }));
                        }}
                        className="text-[11px] font-semibold text-saffron-700 hover:underline"
                      >
                        Apply Session 1 to all
                      </button>
                    )}
                  </div>
                  {classOptions.length === 0 ? (
                    <div className="text-xs text-gray-400 p-3 rounded-xl border border-dashed border-gray-200">
                      No classes found. Add classes in Operations {'>'} Classes first.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sessionKeys.map(key => {
                        const value = form.session_classes?.[key] || '';
                        return (
                          <div key={key} className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-gray-200 bg-white">
                            <span className="text-xs font-semibold text-gray-700 w-44 sm:w-48 shrink-0">
                              {sessionLabels[key]}
                            </span>
                            <div className="flex flex-wrap gap-1.5 flex-1">
                              <button
                                type="button"
                                onClick={() => setForm(p => ({
                                  ...p,
                                  session_classes: { ...p.session_classes, [key]: '' },
                                }))}
                                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${!value
                                    ? 'border-gray-400 bg-gray-100 text-gray-700'
                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                  }`}
                              >
                                — Unassigned
                              </button>
                              {classOptions.map(opt => {
                                const selected = value === opt;
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setForm(p => ({
                                      ...p,
                                      session_classes: { ...p.session_classes, [key]: opt },
                                    }))}
                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${selected
                                        ? 'border-saffron-500 bg-saffron-50 text-saffron-700'
                                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                      }`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">
                    Each teaching session can be a different student class. Leave a session as
                    <span className="font-semibold"> Unassigned</span> if the teacher does not teach that slot.
                  </p>
                </div>
              )}

              {/* Assigned Activity */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">Assigned Activity</label>
                <Select value={form.assigned_activity} onChange={val => setForm(p => ({ ...p, assigned_activity: val }))} options={activityOptions} placeholder="Select activity" size="sm" />
              </div>

              {/* Responsibilities — interactive chip list */}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-600 block mb-2">
                  Responsibilities <span className="font-normal text-gray-400">(shown in mentor's Duties tab)</span>
                </label>
                {form.responsibilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {form.responsibilities.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-700 shadow-sm">
                        {r}
                        <button type="button" onClick={() => removeResp(i)} className="text-gray-400 hover:text-red-500 ml-0.5 font-bold">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 py-2 text-sm"
                    placeholder="e.g. 🧘 Yoga supervision (girls)"
                    value={newResp}
                    onChange={e => setNewResp(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addResp())}
                  />
                  <button type="button" onClick={addResp} className="btn-secondary px-4 py-2 text-sm">+ Add</button>
                </div>
                <p className="text-xs text-gray-400 mt-1">Tip: Start with an emoji for the Duties Board to group it automatically (e.g. 🧘 🙏 📚 🎵 🪙).</p>
              </div>

              {/* Deduction rights */}
              <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input type="checkbox" id="deduction" className="w-5 h-5 accent-saffron-500"
                  checked={form.has_deduction_rights} onChange={e => setForm(p => ({ ...p, has_deduction_rights: e.target.checked }))} />
                <label htmlFor="deduction" className="font-semibold text-gray-700 cursor-pointer">
                  {t('admin.deductionRights')} (can subtract points from students)
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 px-5 sm:px-6 pb-5">
              <button onClick={handleSave} className="btn-primary text-sm px-6 py-2.5">{t('common.save')}</button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setErrors({}); }} className="btn-outline text-sm px-6 py-2.5">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Mentor"
        message="Are you sure you want to remove this mentor? They will no longer be able to log in."
        danger
        onConfirm={() => { deleteVolunteer(deleteId); setDeleteId(null); }}
        onCancel={() => setDeleteId(null)}
        confirmLabel={t('common.delete')}
      />

      <ConfirmDialog
        open={!!deleteDuty}
        title="Delete Board"
        message={`Are you sure you want to delete "${deleteDuty?.label || 'this board'}"? This will also remove this duty assignment from mentors.`}
        danger
        onConfirm={deleteDutyArea}
        onCancel={() => setDeleteDuty(null)}
        confirmLabel={t('common.delete')}
      />
    </div>
  );
}
