import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────
const PATHSHALA_TYPES  = ['Daily', 'Weekly', 'Half-Yearly', 'Summer / Vacation-based'];
const CLASS_OPTIONS    = ['Kids Group', 'Children Group', 'Senior Group'];
const GENDER_OPTIONS   = ['Male', 'Female'];
const AGE_GROUP_OPTIONS = ['2–5 yrs', '6–10 yrs', '11–15 yrs', '15–21 yrs'];

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const PAATHSHALA_CSV_HEADERS = [
  'Pathshala Name', 'Address',
  'Teacher 1 Name', 'Teacher 1 Mobile', 'Teacher 1 Address',
  'Teacher 2 Name', 'Teacher 2 Mobile', 'Teacher 2 Address',
  'Mandal President Name', 'Mandal President Mobile',
  'Mandal Secretary Name', 'Mandal Secretary Mobile',
  'Description', 'Type (Daily/Weekly/Half-Yearly/Summer)',
  'Classes Conducted (comma separated)',
  'Students 2-5 yrs', 'Students 6-10 yrs', 'Students 11-15 yrs', 'Students 15-21 yrs',
  'Other Details', 'Special Activities',
];

const PAATHSHALA_TEMPLATE_ROWS = [
  [
    'Shri Veetraag Vigyan Pathshala', 'Shivpuri, MP',
    'Dr. Bhima Didi', '8878138760', 'Near Jain Mandir, Shivpuri',
    'Dr. Mitu Didi', '8878138760', '',
    'Shri Manish Jain', '9300010113',
    'Shri Pakaj Jain', '9300010113',
    'Bahuboli Pathshala, Bhag 1–3', 'Summer / Vacation-based',
    'Kids Group, Children Group, Senior Group',
    '5', '15', '10', '0',
    'Pravachan, Bhakti', 'Kanth Path Competition',
  ],
];

const STUDENT_CSV_HEADERS = [
  'Student Name', "Father/Mother's Name", 'Mobile Number',
  'Gender', 'Age', 'Age Group', 'Class Group',
];

function buildCSV(headers, rows) {
  return [headers, ...rows]
    .map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

function triggerDownload(filename, content, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['﻿' + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  const label = options.find(o => o === value) || null;
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors">
        <span className={label ? 'text-gray-800' : 'text-gray-400'}>{label ?? placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <li onClick={() => { onChange(''); setOpen(false); }}
            className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer">{placeholder}</li>
          {options.map(opt => (
            <li key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${value === opt ? 'bg-forest-50 text-forest-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}>
              {value === opt && <span className="text-forest-600">✓</span>}
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────
const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors';
const ta  = inp + ' resize-none';

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
function SectionHead({ children }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

const EMPTY_FORM = {
  paathshala_name: '', address: '',
  teacher1_name: '', teacher1_mobile: '', teacher1_address: '',
  teacher2_name: '', teacher2_mobile: '', teacher2_address: '',
  mandal_president_name: '', mandal_president_mobile: '',
  mandal_secretary_name: '', mandal_secretary_mobile: '',
  description: '', pathshala_type: '', classes_conducted: [],
  students_2_5: '', students_6_10: '', students_11_15: '', students_15_21: '',
  other_details: '', special_activities: '',
};

// ─── Pathshala Form Modal ─────────────────────────────────────────────────────
function PathshalaFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleClass = cls => setForm(f => ({
    ...f,
    classes_conducted: f.classes_conducted.includes(cls)
      ? f.classes_conducted.filter(c => c !== cls)
      : [...f.classes_conducted, cls],
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.paathshala_name.trim()) { toast.error('Pathshala name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-forest-800 to-forest-700 text-white flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg">{initial ? 'Edit Pathshala' : 'Register New Pathshala'}</h2>
            <p className="text-forest-300 text-xs mt-0.5">All fields except name are optional</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          <SectionHead>Basic Information</SectionHead>
          <Field label="Pathshala Name" required>
            <input className={inp} value={form.paathshala_name} onChange={e => set('paathshala_name', e.target.value)} placeholder="e.g. Shri Veetraag Vigyan Pathshala" />
          </Field>
          <Field label="Address / Location">
            <textarea className={ta} rows={2} value={form.address} onChange={e => set('address', e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea className={ta} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>

          <SectionHead>Primary Teacher / Instructor</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teacher Name"><input className={inp} value={form.teacher1_name} onChange={e => set('teacher1_name', e.target.value)} /></Field>
            <Field label="Mobile"><input className={inp} type="tel" value={form.teacher1_mobile} onChange={e => set('teacher1_mobile', e.target.value)} /></Field>
          </div>
          <Field label="Correspondence Address"><textarea className={ta} rows={2} value={form.teacher1_address} onChange={e => set('teacher1_address', e.target.value)} /></Field>

          <SectionHead>Secondary Teacher / Instructor</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Teacher Name"><input className={inp} value={form.teacher2_name} onChange={e => set('teacher2_name', e.target.value)} /></Field>
            <Field label="Mobile"><input className={inp} type="tel" value={form.teacher2_mobile} onChange={e => set('teacher2_mobile', e.target.value)} /></Field>
          </div>
          <Field label="Correspondence Address"><textarea className={ta} rows={2} value={form.teacher2_address} onChange={e => set('teacher2_address', e.target.value)} /></Field>

          <SectionHead>Mandal Details</SectionHead>
          <div className="grid grid-cols-2 gap-3">
            <Field label="President Name"><input className={inp} value={form.mandal_president_name} onChange={e => set('mandal_president_name', e.target.value)} /></Field>
            <Field label="President Mobile"><input className={inp} type="tel" value={form.mandal_president_mobile} onChange={e => set('mandal_president_mobile', e.target.value)} /></Field>
            <Field label="Secretary Name"><input className={inp} value={form.mandal_secretary_name} onChange={e => set('mandal_secretary_name', e.target.value)} /></Field>
            <Field label="Secretary Mobile"><input className={inp} type="tel" value={form.mandal_secretary_mobile} onChange={e => set('mandal_secretary_mobile', e.target.value)} /></Field>
          </div>

          <SectionHead>Type & Structure</SectionHead>
          <Field label="Type of Pathshala">
            <CustomSelect value={form.pathshala_type} onChange={v => set('pathshala_type', v)} options={PATHSHALA_TYPES} placeholder="Select type…" />
          </Field>
          <Field label="Classes Conducted">
            <div className="flex flex-wrap gap-2 mt-1">
              {CLASS_OPTIONS.map(cls => (
                <button key={cls} type="button" onClick={() => toggleClass(cls)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                    ${form.classes_conducted.includes(cls) ? 'bg-forest-700 text-white border-forest-700' : 'bg-white text-gray-600 border-gray-300 hover:border-forest-400'}`}>
                  {cls}
                </button>
              ))}
            </div>
          </Field>

          <SectionHead>Student Count (Age-wise)</SectionHead>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['students_2_5','2–5 yrs'],['students_6_10','6–10 yrs'],['students_11_15','11–15 yrs'],['students_15_21','15–21 yrs']].map(([k,l]) => (
              <Field key={k} label={l}><input className={inp} type="number" min="0" value={form[k]} onChange={e => set(k, e.target.value)} placeholder="0" /></Field>
            ))}
          </div>

          <SectionHead>Additional Details</SectionHead>
          <Field label="Other Details / Activities"><textarea className={ta} rows={2} value={form.other_details} onChange={e => set('other_details', e.target.value)} /></Field>
          <Field label="Special Activities"><textarea className={ta} rows={2} value={form.special_activities} onChange={e => set('special_activities', e.target.value)} /></Field>
        </form>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100">Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="px-6 py-2 rounded-lg bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50">
            {saving ? 'Saving…' : initial ? 'Update' : 'Register Pathshala'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function AddStudentModal({ pathshala, onSave, onClose }) {
  const { importStudentsFromCSV } = usePathshalaStore();
  const [form, setForm] = useState({ name: '', parent_name: '', mobile: '', gender: '', age: '', age_group: '', class_group: '' });
  const [saving, setSaving] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState(null);
  const [tab, setTab] = useState('manual'); // 'manual' | 'csv'
  const fileRef = useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleManualSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Student name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  const handleCSVFile = async (file) => {
    if (!file) return;
    setCsvUploading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows = data.map(r => ({
          name:        (r['Student Name']||r['Name']||'').trim(),
          parent_name: (r["Father/Mother's Name"]||r['Father Name']||r['Parent Name']||'').trim(),
          mobile:      (r['Mobile Number']||r['Mobile']||'').trim(),
          gender:      (r['Gender']||'').trim(),
          age:          r['Age'] ? parseInt(r['Age']) : undefined,
          age_group:   (r['Age Group']||'').trim(),
          class_group: (r['Class Group']||'').trim(),
        })).filter(r => r.name);
        if (!rows.length) { toast.error('No valid rows found'); setCsvUploading(false); return; }
        const result = await importStudentsFromCSV(pathshala, rows);
        setCsvResult(result);
        if (result.success) toast.success(`${result.count} students imported!`);
        else toast.error(result.error || 'Import failed');
        setCsvUploading(false);
      },
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadStudentTemplate = () => {
    const csv = buildCSV(STUDENT_CSV_HEADERS, [
      ['Arham Jain', 'Vikram Jain', '9179105875', 'Male', '9', '6–10 yrs', 'Children Group'],
      ['Aarvi Jain', 'Sachin Jain', '7067514988', 'Female', '11', '11–15 yrs', 'Senior Group'],
    ]);
    triggerDownload(`pathshala-${pathshala.paathshala_code}-students-template.csv`, csv);
    toast.success('Student template downloaded');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-forest-800 to-forest-700 text-white">
          <div>
            <h2 className="font-bold">Add Students</h2>
            <p className="text-xs text-forest-300 mt-0.5">{pathshala.paathshala_name} (Code: {pathshala.paathshala_code})</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setTab('manual')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'manual' ? 'border-b-2 border-forest-700 text-forest-700' : 'text-gray-500 hover:text-gray-700'}`}>
            Add Manually
          </button>
          <button onClick={() => setTab('csv')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'csv' ? 'border-b-2 border-forest-700 text-forest-700' : 'text-gray-500 hover:text-gray-700'}`}>
            Upload CSV
          </button>
        </div>

        {tab === 'manual' ? (
          <form onSubmit={handleManualSave} className="p-5 space-y-3">
            <Field label="Student Name" required>
              <input className={inp} value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
            </Field>
            <Field label="Father/Mother's Name">
              <input className={inp} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} />
            </Field>
            <Field label="Mobile Number">
              <input className={inp} type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender">
                <CustomSelect value={form.gender} onChange={v => set('gender', v)} options={GENDER_OPTIONS} placeholder="Select…" />
              </Field>
              <Field label="Age">
                <input className={inp} type="number" min="0" max="25" value={form.age} onChange={e => set('age', e.target.value)} placeholder="—" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age Group">
                <CustomSelect value={form.age_group} onChange={v => set('age_group', v)} options={AGE_GROUP_OPTIONS} placeholder="Select…" />
              </Field>
              <Field label="Class Group">
                <CustomSelect value={form.class_group} onChange={v => set('class_group', v)} options={CLASS_OPTIONS} placeholder="Select…" />
              </Field>
            </div>
            <div className="text-xs text-gray-400 bg-forest-50 rounded-lg p-2 border border-forest-100">
              Roll No auto-generated: <span className="font-mono font-bold text-forest-700">{String(pathshala.paathshala_code).padStart(2,'0')}01</span>, <span className="font-mono font-bold text-forest-700">{String(pathshala.paathshala_code).padStart(2,'0')}02</span>…
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50">
                {saving ? 'Adding…' : 'Add Student'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            <button onClick={downloadStudentTemplate}
              className="w-full flex items-center gap-3 border-2 border-forest-200 hover:border-forest-500 rounded-xl p-3 text-left transition-colors group">
              <div className="w-10 h-10 bg-forest-50 group-hover:bg-forest-100 rounded-lg flex items-center justify-center text-xl flex-shrink-0">📥</div>
              <div>
                <div className="font-semibold text-sm text-gray-800">Download Student CSV Template</div>
                <div className="text-xs text-gray-500">Includes Name, Parent, Mobile, Gender, Age, Group columns</div>
              </div>
            </button>

            <label className="w-full flex items-center gap-3 border-2 border-dashed border-saffron-300 hover:border-saffron-500 rounded-xl p-4 text-left transition-colors cursor-pointer bg-saffron-50 hover:bg-saffron-100">
              <div className="text-2xl">📤</div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-gray-800">{csvUploading ? 'Uploading…' : 'Upload Filled CSV'}</div>
                <div className="text-xs text-gray-500">Click to browse or drop your .csv file here</div>
              </div>
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => handleCSVFile(e.target.files?.[0])} disabled={csvUploading} />
            </label>

            {csvResult && (
              <div className={`px-4 py-3 rounded-xl text-sm font-medium ${csvResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {csvResult.success ? `✓ ${csvResult.count} students imported successfully` : `✗ ${csvResult.error}`}
              </div>
            )}
            <button onClick={onClose} className="w-full py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPathshala() {
  const { paathshalas, students, loading, fetchPathashalas, addPathshala, updatePathshala, deletePathshala, addStudentToPathshala } = usePathshalaStore();
  const [openCode, setOpenCode]         = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [editTarget, setEditTarget]     = useState(null);
  const [deleteId, setDeleteId]         = useState(null);
  const [addStudentsFor, setAddStudentsFor] = useState(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const uploadRef = useRef();

  useEffect(() => { fetchPathashalas(); }, []);

  // ── Paathshala CSV download ───────────────────────────────────────────────
  const downloadOverviewCSV = () => {
    const rows = paathshalas.map(p => {
      const count = students.filter(s => s.paathshala_code === p.paathshala_code).length;
      return [
        p.paathshala_code, p.paathshala_name, p.address || '',
        p.teacher1_name || '', p.teacher1_mobile || '',
        p.teacher2_name || '', p.teacher2_mobile || '',
        p.mandal_president_name || '', p.mandal_president_mobile || '',
        p.pathshala_type || '',
        (p.classes_conducted || []).join(', '),
        count,
      ];
    });
    const csv = buildCSV([
      'Code','Pathshala Name','Address',
      'Teacher 1','Teacher 1 Mobile','Teacher 2','Teacher 2 Mobile',
      'Mandal President','President Mobile',
      'Type','Classes Conducted','Student Count',
    ], rows);
    triggerDownload('paathshalas-overview.csv', csv);
  };

  const downloadFullRosterCSV = () => {
    const rows = [];
    for (const p of paathshalas) {
      const myStudents = students.filter(s => s.paathshala_code === p.paathshala_code);
      if (myStudents.length === 0) {
        rows.push([p.paathshala_code, p.paathshala_name, p.teacher1_name||'', '', '', '', '', '', '']);
      } else {
        for (const s of myStudents) {
          rows.push([
            p.paathshala_code, p.paathshala_name, p.teacher1_name||'',
            s.roll_no||'', s.name||'', s.parent_name||s.father_name||'',
            s.mobile||'', s.gender||'', s.age||'',
          ]);
        }
      }
    }
    const csv = buildCSV([
      'Pathshala Code','Pathshala Name','Teacher',
      'Roll No','Student Name',"Father/Mother's Name",'Mobile','Gender','Age',
    ], rows);
    triggerDownload('paathshalas-full-roster.csv', csv);
  };

  const downloadPathshalaTemplate = () => {
    const csv = buildCSV(PAATHSHALA_CSV_HEADERS, PAATHSHALA_TEMPLATE_ROWS);
    triggerDownload('paathshala-registration-template.csv', csv);
    toast.success('Paathshala registration template downloaded');
  };

  // ── Paathshala CSV upload (bulk register) ─────────────────────────────────
  const handlePathshalaCSVUpload = (file) => {
    if (!file) return;
    setCsvUploading(true);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: async ({ data }) => {
        let added = 0;
        for (const row of data) {
          const name = (row['Pathshala Name'] || row['pathshala_name'] || '').trim();
          if (!name) continue;
          const classes = (row['Classes Conducted (comma separated)'] || '')
            .split(',').map(s => s.trim()).filter(Boolean);
          const result = await addPathshala({
            paathshala_name:          name,
            address:                  row['Address'] || '',
            teacher1_name:            row['Teacher 1 Name'] || '',
            teacher1_mobile:          row['Teacher 1 Mobile'] || '',
            teacher1_address:         row['Teacher 1 Address'] || '',
            teacher2_name:            row['Teacher 2 Name'] || '',
            teacher2_mobile:          row['Teacher 2 Mobile'] || '',
            teacher2_address:         row['Teacher 2 Address'] || '',
            mandal_president_name:    row['Mandal President Name'] || '',
            mandal_president_mobile:  row['Mandal President Mobile'] || '',
            mandal_secretary_name:    row['Mandal Secretary Name'] || '',
            mandal_secretary_mobile:  row['Mandal Secretary Mobile'] || '',
            description:              row['Description'] || '',
            pathshala_type:           row['Type (Daily/Weekly/Half-Yearly/Summer)'] || '',
            classes_conducted:        classes,
            students_2_5:             parseInt(row['Students 2-5 yrs'] || 0) || 0,
            students_6_10:            parseInt(row['Students 6-10 yrs'] || 0) || 0,
            students_11_15:           parseInt(row['Students 11-15 yrs'] || 0) || 0,
            students_15_21:           parseInt(row['Students 15-21 yrs'] || 0) || 0,
            other_details:            row['Other Details'] || '',
            special_activities:       row['Special Activities'] || '',
          });
          if (result.success) added++;
        }
        toast.success(`${added} paathshala${added !== 1 ? 's' : ''} registered`);
        setCsvUploading(false);
      },
    });
    if (uploadRef.current) uploadRef.current.value = '';
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalStudents   = students.length;
  const totalTeachers   = [...new Set(paathshalas.map(p => p.teacher1_name).filter(Boolean))].length;
  const totalPathashalas = paathshalas.length;

  const handleSave = async (form) => {
    if (editTarget) {
      const r = await updatePathshala(editTarget.id, form);
      if (r.success) { toast.success('Updated'); setShowForm(false); setEditTarget(null); }
      else toast.error(r.error);
    } else {
      const r = await addPathshala(form);
      if (r.success) { toast.success(`Registered! Code: ${r.code}`); setShowForm(false); }
      else toast.error(r.error);
    }
  };

  const handleDelete = async (id) => {
    const r = await deletePathshala(id);
    if (r.success) toast.success('Deleted');
    else toast.error(r.error);
    setDeleteId(null);
  };

  const handleAddStudent = async (form) => {
    const r = await addStudentToPathshala(addStudentsFor, form);
    if (r.success) toast.success(`Added! Roll No: ${r.rollNo}`);
    else toast.error(r.error);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center"><div className="text-4xl mb-2">⏳</div><div className="text-sm">Loading…</div></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 bg-slate-50 min-h-full">

      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Paathshala</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadPathshalaTemplate}
            className="px-3 py-1.5 rounded-xl bg-gray-600 text-white text-sm font-semibold hover:bg-gray-700 active:scale-[0.98] transition-all flex items-center gap-1.5">
            ⬇ Registration Template
          </button>
          <label className={`px-3 py-1.5 rounded-xl text-white text-sm font-semibold active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer ${csvUploading ? 'bg-gray-400' : 'bg-saffron-600 hover:bg-saffron-700'}`}>
            {csvUploading ? '⏳ Uploading…' : '⬆ Upload Paathshalas CSV'}
            <input ref={uploadRef} type="file" accept=".csv" className="hidden" onChange={e => handlePathshalaCSVUpload(e.target.files?.[0])} disabled={csvUploading} />
          </label>
          <button onClick={downloadOverviewCSV}
            className="px-3 py-1.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 active:scale-[0.98] transition-all flex items-center gap-1.5">
            ⬇ Overview CSV
          </button>
          <button onClick={downloadFullRosterCSV}
            className="px-3 py-1.5 rounded-xl bg-saffron-600 text-white text-sm font-semibold hover:bg-saffron-700 active:scale-[0.98] transition-all flex items-center gap-1.5">
            ⬇ Full Roster CSV
          </button>
          <button onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="px-3 py-1.5 rounded-xl bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 active:scale-[0.98] transition-all flex items-center gap-1.5">
            + Register Pathshala
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-forest-700 leading-none">{totalPathashalas}</div>
          <div className="text-xs text-gray-500 mt-1">Paathshalas</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-saffron-700 leading-none">{totalTeachers}</div>
          <div className="text-xs text-gray-500 mt-1">Teachers</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-blue-700 leading-none">{totalStudents}</div>
          <div className="text-xs text-gray-500 mt-1">Students Enrolled</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm">
          <div className="text-2xl font-semibold text-violet-700 leading-none">
            {paathshalas.reduce((s,p) => s + (Number(p.students_2_5)||0) + (Number(p.students_6_10)||0) + (Number(p.students_11_15)||0) + (Number(p.students_15_21)||0), 0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Registered (form count)</div>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────────── */}
      {paathshalas.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
          <div className="text-5xl mb-3">🕌</div>
          <div className="font-bold text-gray-700 text-lg mb-1">No Paathshalas Registered</div>
          <div className="text-sm text-gray-500 mb-4">Register manually or upload the CSV template above</div>
          <button onClick={() => setShowForm(true)}
            className="px-5 py-2 bg-forest-700 text-white rounded-xl font-semibold text-sm hover:bg-forest-800">
            + Register First Pathshala
          </button>
        </div>
      )}

      {/* ── Expandable list (same pattern as AdminClasses) ──────────────────── */}
      <div className="space-y-3">
        {paathshalas.map(p => {
          const expanded = openCode === p.paathshala_code;
          const myStudents = students
            .filter(s => s.paathshala_code === p.paathshala_code)
            .sort((a, b) => String(a.roll_no).localeCompare(String(b.roll_no)));

          return (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Clickable header row */}
              <button type="button"
                onClick={() => setOpenCode(expanded ? null : p.paathshala_code)}
                className="w-full text-left p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-forest-700 to-forest-900 text-white font-bold rounded-xl w-10 h-10 flex items-center justify-center text-sm flex-shrink-0">
                    {p.paathshala_code}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{p.paathshala_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.teacher1_name ? `Teacher: ${p.teacher1_name}` : 'No teacher assigned'}
                      {p.pathshala_type ? ` · ${p.pathshala_type}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">Students {myStudents.length}</span>
                  {p.classes_conducted?.length > 0 && (
                    <span className="px-2 py-1 rounded-full bg-forest-100 text-forest-700 font-medium">{p.classes_conducted.join(', ')}</span>
                  )}
                  {p.address && <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium truncate max-w-[160px]">{p.address}</span>}
                  <span className="text-gray-400 text-base ml-1">{expanded ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100">

                  {/* Teacher & Mandal info */}
                  <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {p.teacher1_name && (
                      <div className="rounded-xl border border-gray-200 p-3 bg-slate-50">
                        <div className="font-semibold text-sm text-gray-800">Primary Teacher</div>
                        <div className="text-sm text-gray-700 mt-0.5">{p.teacher1_name}</div>
                        {p.teacher1_mobile && <div className="text-xs text-gray-500">{p.teacher1_mobile}</div>}
                        {p.teacher1_address && <div className="text-xs text-gray-400 mt-0.5">{p.teacher1_address}</div>}
                      </div>
                    )}
                    {p.teacher2_name && (
                      <div className="rounded-xl border border-gray-200 p-3 bg-slate-50">
                        <div className="font-semibold text-sm text-gray-800">Secondary Teacher</div>
                        <div className="text-sm text-gray-700 mt-0.5">{p.teacher2_name}</div>
                        {p.teacher2_mobile && <div className="text-xs text-gray-500">{p.teacher2_mobile}</div>}
                      </div>
                    )}
                    {p.mandal_president_name && (
                      <div className="rounded-xl border border-gray-200 p-3 bg-slate-50">
                        <div className="font-semibold text-sm text-gray-800">Mandal President</div>
                        <div className="text-sm text-gray-700 mt-0.5">{p.mandal_president_name}</div>
                        {p.mandal_president_mobile && <div className="text-xs text-gray-500">{p.mandal_president_mobile}</div>}
                      </div>
                    )}
                  </div>

                  {/* Students section */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs font-semibold text-gray-500">
                        Students ({myStudents.length})
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={e => { e.stopPropagation(); setAddStudentsFor(p); }}
                          className="px-3 py-1 rounded-lg bg-forest-700 text-white text-xs font-semibold hover:bg-forest-800 transition-colors">
                          + Add Students
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setEditTarget(p); setShowForm(true); }}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-gray-600 text-xs hover:bg-gray-50 transition-colors">
                          Edit
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setDeleteId(p.id); }}
                          className="px-3 py-1 rounded-lg border border-red-200 text-red-500 text-xs hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>

                    {myStudents.length === 0 ? (
                      <div className="text-sm text-gray-400 py-2">
                        No students yet — click <strong>+ Add Students</strong> above.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {myStudents.map(s => (
                          <span key={s.id}
                            className="text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-white text-gray-700">
                            {s.roll_no || '—'} • {s.name}
                            {s.gender ? ` (${s.gender[0]})` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showForm && (
        <PathshalaFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
      {addStudentsFor && (
        <AddStudentModal
          pathshala={addStudentsFor}
          onSave={handleAddStudent}
          onClose={() => setAddStudentsFor(null)}
        />
      )}
      {deleteId && (
        <ConfirmDialog
          message="Delete this pathshala? Students will not be removed."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
