import { useEffect, useRef, useState } from 'react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import { usePathshalaStore } from '../../store/usePathshalaStore.js';
import ConfirmDialog from '../../components/common/ConfirmDialog.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────
const PATHSHALA_TYPES = ['Daily', 'Weekly', 'Half-Yearly', 'Summer / Vacation-based'];
const CLASS_OPTIONS   = ['Kids Group', 'Children Group', 'Senior Group'];
const GENDER_OPTIONS  = ['Male', 'Female'];
const AGE_GROUP_OPTIONS = ['2–5 yrs', '6–10 yrs', '11–15 yrs', '15–21 yrs'];

// ─── Excel template helper (ExcelJS) ─────────────────────────────────────────
async function downloadExcelTemplate(pathshalaCode, pathshalaName) {
  const ExcelJS = (await import('exceljs')).default;
  const wb  = new ExcelJS.Workbook();
  const ws  = wb.addWorksheet('Students');

  ws.columns = [
    { header: 'Student Name',          key: 'name',        width: 28 },
    { header: "Father/Mother's Name",  key: 'parent',      width: 28 },
    { header: 'Mobile Number',         key: 'mobile',      width: 16 },
    { header: 'Gender',                key: 'gender',      width: 12 },
    { header: 'Age',                   key: 'age',         width: 8  },
    { header: 'Age Group',             key: 'age_group',   width: 16 },
    { header: 'Class Group',           key: 'class_group', width: 20 },
  ];

  // Header row styling
  const headerRow = ws.getRow(1);
  headerRow.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } };
  headerRow.height = 22;
  headerRow.alignment = { vertical: 'middle' };

  // Sample rows
  const samples = [
    ['Arham Jain',  'Vikram Jain',  '9179105875', 'Male',   '9',  '6–10 yrs', 'Children Group'],
    ['Aarvi Jain',  'Sachin Jain',  '7067514988', 'Female', '11', '11–15 yrs','Senior Group'],
  ];
  samples.forEach(r => ws.addRow(r));

  // Dropdowns + borders for rows 2–101
  for (let i = 2; i <= 101; i++) {
    ws.getCell(`D${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"Male,Female"'],
      showErrorMessage: true, errorTitle: 'Invalid', error: 'Choose Male or Female',
    };
    ws.getCell(`F${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"2–5 yrs,6–10 yrs,11–15 yrs,15–21 yrs"'],
      showErrorMessage: true, errorTitle: 'Invalid', error: 'Choose an age group',
    };
    ws.getCell(`G${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: ['"Kids Group,Children Group,Senior Group"'],
      showErrorMessage: true, errorTitle: 'Invalid', error: 'Choose a class group',
    };

    // Subtle alternating fill
    if (i % 2 === 0) {
      for (let col = 1; col <= 7; col++) {
        ws.getCell(i, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F8E9' } };
      }
    }
  }

  // Border on all header cells
  for (let col = 1; col <= 7; col++) {
    ws.getCell(1, col).border = {
      top: { style: 'medium' }, bottom: { style: 'medium' },
      left: { style: 'thin'  }, right:  { style: 'thin'  },
    };
  }

  // Info sheet
  const info = wb.addWorksheet('Instructions');
  info.getCell('A1').value = `Template for: ${pathshalaName} (Code: ${pathshalaCode})`;
  info.getCell('A1').font  = { bold: true, size: 13 };
  info.getCell('A3').value = 'Columns D, F, G have dropdown lists — click a cell to see options.';
  info.getCell('A4').value = 'Roll numbers are auto-generated on upload (PPSS format).';
  info.getCell('A5').value = 'Only Student Name is required. All other columns are optional.';
  info.columns = [{ width: 60 }];

  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `pathshala-${pathshalaCode}-template.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => (typeof o === 'string' ? o : o.value) === value);
  const label    = selected ? (typeof selected === 'string' ? selected : selected.label) : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:border-forest-400 focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors"
      >
        <span className={label ? 'text-gray-800' : 'text-gray-400'}>{label ?? placeholder}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          <li
            onClick={() => { onChange(''); setOpen(false); }}
            className="px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 cursor-pointer"
          >
            {placeholder}
          </li>
          {options.map(opt => {
            const v = typeof opt === 'string' ? opt : opt.value;
            const l = typeof opt === 'string' ? opt : opt.label;
            return (
              <li
                key={v}
                onClick={() => { onChange(v); setOpen(false); }}
                className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2
                  ${value === v ? 'bg-forest-50 text-forest-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                {value === v && <span className="text-forest-600">✓</span>}
                {l}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────
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

const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500 transition-colors';
const ta  = inp + ' resize-none';

const EMPTY_FORM = {
  paathshala_name: '', address: '',
  teacher1_name: '', teacher1_mobile: '', teacher1_address: '',
  teacher2_name: '', teacher2_mobile: '', teacher2_address: '',
  mandal_president_name: '', mandal_president_mobile: '',
  mandal_secretary_name: '', mandal_secretary_mobile: '',
  description: '', pathshala_type: '',
  classes_conducted: [],
  students_2_5: '', students_6_10: '', students_11_15: '', students_15_21: '',
  other_details: '', special_activities: '',
};

const EMPTY_STUDENT = { name: '', parent_name: '', mobile: '', gender: '', age: '', age_group: '', class_group: '' };

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

// ─── Pathshala Form Modal ─────────────────────────────────────────────────────
function PathshalaFormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...EMPTY_FORM, ...initial } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const set     = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const toggleClass = cls =>
    setForm(f => ({
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
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-forest-800 to-forest-700 text-white flex-shrink-0">
          <div>
            <h2 className="font-bold text-lg">{initial ? 'Edit Pathshala' : 'Register New Pathshala'}</h2>
            <p className="text-forest-300 text-xs mt-0.5">All fields except name are optional</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <SectionHead>Basic Information</SectionHead>
            <Field label="Pathshala Name" required>
              <input className={inp} value={form.paathshala_name} onChange={e => set('paathshala_name', e.target.value)} placeholder="e.g. Shri Veetraag Vigyan Pathshala" />
            </Field>
            <Field label="Address / Location">
              <textarea className={ta} rows={2} value={form.address} onChange={e => set('address', e.target.value)} placeholder="Village / Town, District, State" />
            </Field>
            <Field label="Pathshala Description">
              <textarea className={ta} rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
            </Field>
          </div>

          {/* Teacher 1 */}
          <div className="space-y-4">
            <SectionHead>Primary Teacher / Instructor</SectionHead>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teacher Name">
                <input className={inp} value={form.teacher1_name} onChange={e => set('teacher1_name', e.target.value)} />
              </Field>
              <Field label="Mobile Number">
                <input className={inp} type="tel" value={form.teacher1_mobile} onChange={e => set('teacher1_mobile', e.target.value)} />
              </Field>
            </div>
            <Field label="Correspondence Address">
              <textarea className={ta} rows={2} value={form.teacher1_address} onChange={e => set('teacher1_address', e.target.value)} />
            </Field>
          </div>

          {/* Teacher 2 */}
          <div className="space-y-4">
            <SectionHead>Secondary Teacher / Instructor</SectionHead>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Teacher Name">
                <input className={inp} value={form.teacher2_name} onChange={e => set('teacher2_name', e.target.value)} />
              </Field>
              <Field label="Mobile Number">
                <input className={inp} type="tel" value={form.teacher2_mobile} onChange={e => set('teacher2_mobile', e.target.value)} />
              </Field>
            </div>
            <Field label="Correspondence Address">
              <textarea className={ta} rows={2} value={form.teacher2_address} onChange={e => set('teacher2_address', e.target.value)} />
            </Field>
          </div>

          {/* Mandal */}
          <div className="space-y-4">
            <SectionHead>Mandal Details</SectionHead>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mandal President Name">
                <input className={inp} value={form.mandal_president_name} onChange={e => set('mandal_president_name', e.target.value)} />
              </Field>
              <Field label="President Mobile">
                <input className={inp} type="tel" value={form.mandal_president_mobile} onChange={e => set('mandal_president_mobile', e.target.value)} />
              </Field>
              <Field label="Mandal Secretary Name">
                <input className={inp} value={form.mandal_secretary_name} onChange={e => set('mandal_secretary_name', e.target.value)} />
              </Field>
              <Field label="Secretary Mobile">
                <input className={inp} type="tel" value={form.mandal_secretary_mobile} onChange={e => set('mandal_secretary_mobile', e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Type & Structure */}
          <div className="space-y-4">
            <SectionHead>Type & Structure</SectionHead>
            <Field label="Type of Pathshala">
              <CustomSelect
                value={form.pathshala_type}
                onChange={val => set('pathshala_type', val)}
                options={PATHSHALA_TYPES}
                placeholder="Select pathshala type…"
              />
            </Field>
            <Field label="Classes Conducted">
              <div className="flex flex-wrap gap-2 mt-1">
                {CLASS_OPTIONS.map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => toggleClass(cls)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${form.classes_conducted.includes(cls)
                        ? 'bg-forest-700 text-white border-forest-700'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-forest-400'}`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Student Count */}
          <div className="space-y-4">
            <SectionHead>Student Count (Age-wise)</SectionHead>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[['students_2_5','2–5 yrs'],['students_6_10','6–10 yrs'],['students_11_15','11–15 yrs'],['students_15_21','15–21 yrs']].map(([key, label]) => (
                <Field key={key} label={label}>
                  <input className={inp} type="number" min="0" value={form[key]} onChange={e => set(key, e.target.value)} placeholder="0" />
                </Field>
              ))}
            </div>
          </div>

          {/* Additional */}
          <div className="space-y-4">
            <SectionHead>Additional Details</SectionHead>
            <Field label="Other Details / Activities">
              <textarea className={ta} rows={2} value={form.other_details} onChange={e => set('other_details', e.target.value)} />
            </Field>
            <Field label="Special Activities">
              <textarea className={ta} rows={2} value={form.special_activities} onChange={e => set('special_activities', e.target.value)} />
            </Field>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 flex-shrink-0">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : initial ? 'Update Pathshala' : 'Register Pathshala'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Student Modal ────────────────────────────────────────────────────────
function StudentFormModal({ pathshala, onSave, onClose }) {
  const [form, setForm]   = useState(EMPTY_STUDENT);
  const [saving, setSaving] = useState(false);
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Student name is required'); return; }
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-forest-800 to-forest-700 text-white">
          <div>
            <h2 className="font-bold">Add Student</h2>
            <p className="text-xs text-forest-300 mt-0.5">{pathshala.paathshala_name}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
          <div className="text-xs text-gray-500 bg-forest-50 rounded-lg p-2.5 border border-forest-100">
            Roll No will be auto-generated: <span className="font-mono font-bold text-forest-700">{String(pathshala.paathshala_code).padStart(2,'0')}XX</span>
          </div>
        </form>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 rounded-lg bg-forest-700 text-white text-sm font-semibold hover:bg-forest-800 disabled:opacity-50 transition-colors">
            {saving ? 'Adding…' : 'Add Student'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ pathshala, onImport }) {
  const { importStudentsFromCSV } = usePathshalaStore();
  const [dragging, setDragging]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const fileRef = useRef();

  const processFile = async (file) => {
    if (!file) return;
    setLoading(true);

    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    if (isXlsx) {
      // Parse xlsx via ExcelJS
      try {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        const buf = await file.arrayBuffer();
        await wb.xlsx.load(buf);
        const ws = wb.worksheets[0];
        const rows = [];
        ws.eachRow((row, idx) => {
          if (idx === 1) return; // skip header
          const vals = row.values; // 1-indexed
          const name = String(vals[1] ?? '').trim();
          if (!name) return;
          rows.push({
            name,
            parent_name:  String(vals[2] ?? '').trim(),
            mobile:       String(vals[3] ?? '').trim(),
            gender:       String(vals[4] ?? '').trim(),
            age:          vals[5] ? parseInt(vals[5]) : undefined,
            age_group:    String(vals[6] ?? '').trim(),
            class_group:  String(vals[7] ?? '').trim(),
          });
        });
        if (!rows.length) { toast.error('No student rows found in file'); setLoading(false); return; }
        const result = await importStudentsFromCSV(pathshala, rows);
        onImport(result);
      } catch (err) {
        toast.error('Failed to read xlsx: ' + err.message);
      }
      setLoading(false);
      return;
    }

    // CSV
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async ({ data }) => {
        const rows = data.map(row => ({
          name:         (row['Student Name'] || row['Name'] || row['name'] || '').trim(),
          parent_name:  (row["Father/Mother's Name"] || row['Father Name'] || row['Parent Name'] || '').trim(),
          mobile:       (row['Mobile Number'] || row['Mobile'] || '').trim(),
          gender:       (row['Gender'] || row['gender'] || '').trim(),
          age:          row['Age'] ? parseInt(row['Age']) : undefined,
          age_group:    (row['Age Group'] || '').trim(),
          class_group:  (row['Class Group'] || '').trim(),
        })).filter(r => r.name);

        if (!rows.length) { toast.error('No valid rows found'); setLoading(false); return; }
        const result = await importStudentsFromCSV(pathshala, rows);
        onImport(result);
        setLoading(false);
      },
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors
        ${dragging ? 'border-forest-400 bg-forest-50' : 'border-gray-200 bg-gray-50 hover:border-forest-300 hover:bg-forest-50/50'}`}
    >
      {loading ? (
        <div className="text-gray-400 text-sm">⏳ Importing students…</div>
      ) : (
        <>
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm font-medium text-gray-600 mb-1">Drop your file here or</p>
          <label className="cursor-pointer text-sm font-semibold text-forest-700 underline hover:text-forest-900">
            browse to upload
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => processFile(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-gray-400 mt-2">Supports .csv and .xlsx</p>
        </>
      )}
    </div>
  );
}

// ─── Pathshala Detail ─────────────────────────────────────────────────────────
function PathshalaDetail({ pathshala, students, onBack, onEdit }) {
  const { addStudentToPathshala, deleteStudent } = usePathshalaStore();
  const [showAddStudent, setShowAddStudent]       = useState(false);
  const [csvResult, setCsvResult]                 = useState(null);
  const [deleteStudentId, setDeleteStudentId]     = useState(null);
  const [templateLoading, setTemplateLoading]     = useState(false);

  const myStudents = students
    .filter(s => s.paathshala_code === pathshala.paathshala_code)
    .sort((a, b) => String(a.roll_no).localeCompare(String(b.roll_no)));

  const handleAddStudent = async (form) => {
    const result = await addStudentToPathshala(pathshala, form);
    if (result.success) { toast.success(`Added! Roll No: ${result.rollNo}`); setShowAddStudent(false); }
    else toast.error(result.error || 'Failed to add student');
  };

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    try {
      await downloadExcelTemplate(pathshala.paathshala_code, pathshala.paathshala_name);
      toast.success('Excel template downloaded');
    } catch (e) {
      toast.error('Could not generate template');
    }
    setTemplateLoading(false);
  };

  const handleExport = () => {
    if (!myStudents.length) { toast.error('No students to export'); return; }
    const rows = myStudents.map(s => [s.roll_no, s.name, s.parent_name || s.father_name || '', s.mobile || '', s.gender || '', s.age || '', s.age_group || '', s.class_group || '']);
    const headers = ['Roll No', 'Student Name', "Father/Mother's Name", 'Mobile', 'Gender', 'Age', 'Age Group', 'Class Group'];
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `pathshala-${pathshala.paathshala_code}-students.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleImport = (result) => {
    setCsvResult(result);
    if (result.success) toast.success(`${result.count} students imported!`);
    else toast.error(result.error || 'Import failed');
  };

  const handleDeleteStudent = async (id) => {
    const r = await deleteStudent(id);
    if (r.success) toast.success('Student removed');
    else toast.error(r.error);
    setDeleteStudentId(null);
  };

  return (
    <div className="space-y-5">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-forest-700 transition-colors font-medium">
        ← Back to all Paathshalas
      </button>

      {/* Info card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-forest-700 to-forest-900 text-white font-bold rounded-xl w-14 h-14 flex items-center justify-center text-lg flex-shrink-0 shadow">
              {pathshala.paathshala_code}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{pathshala.paathshala_name}</h2>
              {pathshala.address && <p className="text-sm text-gray-500 mt-0.5">{pathshala.address}</p>}
            </div>
          </div>
          <button onClick={onEdit} className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:border-forest-500 hover:text-forest-700 transition-colors">
            Edit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {pathshala.teacher1_name && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Primary Teacher</div>
              <div className="font-semibold text-gray-800">{pathshala.teacher1_name}</div>
              {pathshala.teacher1_mobile && <div className="text-gray-500 text-xs">{pathshala.teacher1_mobile}</div>}
            </div>
          )}
          {pathshala.teacher2_name && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Secondary Teacher</div>
              <div className="font-semibold text-gray-800">{pathshala.teacher2_name}</div>
              {pathshala.teacher2_mobile && <div className="text-gray-500 text-xs">{pathshala.teacher2_mobile}</div>}
            </div>
          )}
          {pathshala.mandal_president_name && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Mandal President</div>
              <div className="font-semibold text-gray-800">{pathshala.mandal_president_name}</div>
              {pathshala.mandal_president_mobile && <div className="text-gray-500 text-xs">{pathshala.mandal_president_mobile}</div>}
            </div>
          )}
          {pathshala.pathshala_type && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Type</div>
              <div className="font-semibold text-gray-800">{pathshala.pathshala_type}</div>
            </div>
          )}
          {pathshala.classes_conducted?.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-0.5">Classes</div>
              <div className="font-semibold text-gray-800">{pathshala.classes_conducted.join(', ')}</div>
            </div>
          )}
        </div>
      </div>

      {/* Students section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Section header */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-700 text-lg">Students</h3>
            <span className="bg-forest-100 text-forest-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {myStudents.length} enrolled
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadTemplate}
              disabled={templateLoading}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <span>📥</span> {templateLoading ? 'Generating…' : 'Excel Template'}
            </button>
            {myStudents.length > 0 && (
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <span>📤</span> Export CSV
              </button>
            )}
            <button onClick={() => setShowAddStudent(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-forest-700 text-white rounded-lg hover:bg-forest-800 transition-colors">
              <span>+</span> Add Student
            </button>
          </div>
        </div>

        {/* Upload zone */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bulk Upload</p>
          <UploadZone pathshala={pathshala} onImport={handleImport} />
          {csvResult && (
            <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${csvResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {csvResult.success ? `✓ ${csvResult.count} students imported successfully` : `✗ ${csvResult.error}`}
            </div>
          )}
        </div>

        {/* Table */}
        {myStudents.length === 0 ? (
          <div className="py-10 text-center text-gray-400 px-5">
            <div className="text-4xl mb-2">👥</div>
            <div className="text-sm font-medium">No students yet</div>
            <div className="text-xs mt-1">Add manually or upload the Excel template above</div>
            <div className="text-xs text-forest-600 mt-1">Roll numbers: <span className="font-mono">{String(pathshala.paathshala_code).padStart(2,'0')}01</span>, <span className="font-mono">{String(pathshala.paathshala_code).padStart(2,'0')}02</span>…</div>
          </div>
        ) : (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 text-left">Roll No</th>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Father/Mother</th>
                  <th className="px-5 py-3 text-left">Mobile</th>
                  <th className="px-5 py-3 text-left">Gender</th>
                  <th className="px-5 py-3 text-left">Group</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {myStudents.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="font-mono font-bold text-forest-700 bg-forest-50 px-2 py-0.5 rounded text-xs">{s.roll_no}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3 text-gray-500">{s.parent_name || s.father_name || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{s.mobile || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{s.gender || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{s.class_group || s.group || '—'}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => setDeleteStudentId(s.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddStudent && (
        <StudentFormModal pathshala={pathshala} onSave={handleAddStudent} onClose={() => setShowAddStudent(false)} />
      )}
      {deleteStudentId && (
        <ConfirmDialog
          message="Remove this student from the pathshala?"
          onConfirm={() => handleDeleteStudent(deleteStudentId)}
          onCancel={() => setDeleteStudentId(null)}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminPathshala() {
  const { paathshalas, students, loading, fetchPathashalas, addPathshala, updatePathshala, deletePathshala } = usePathshalaStore();
  const [selected, setSelected]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteId, setDeleteId]     = useState(null);
  const [search, setSearch]         = useState('');

  useEffect(() => { fetchPathashalas(); }, []);

  useEffect(() => {
    if (selected) {
      const updated = paathshalas.find(p => p.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [paathshalas]);

  const filtered = paathshalas.filter(p =>
    !search ||
    p.paathshala_name.toLowerCase().includes(search.toLowerCase()) ||
    p.paathshala_code.includes(search) ||
    (p.teacher1_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    if (editTarget) {
      const r = await updatePathshala(editTarget.id, form);
      if (r.success) { toast.success('Pathshala updated'); setShowForm(false); setEditTarget(null); }
      else toast.error(r.error);
    } else {
      const r = await addPathshala(form);
      if (r.success) { toast.success(`Registered! Code: ${r.code}`); setShowForm(false); }
      else toast.error(r.error);
    }
  };

  const handleDelete = async (id) => {
    const r = await deletePathshala(id);
    if (r.success) { toast.success('Deleted'); setSelected(null); }
    else toast.error(r.error);
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center"><div className="text-4xl mb-2">⏳</div><div>Loading…</div></div>
      </div>
    );
  }

  // Detail view
  if (selected && !showForm) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <PathshalaDetail
          pathshala={selected}
          students={students}
          onBack={() => setSelected(null)}
          onEdit={() => { setEditTarget(selected); setShowForm(true); }}
        />
        {showForm && (
          <PathshalaFormModal
            initial={editTarget}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditTarget(null); }}
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Paathshala Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {paathshalas.length} paathshala{paathshalas.length !== 1 ? 's' : ''} registered
            &nbsp;·&nbsp; {students.length} students enrolled
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true); }}
          className="px-4 py-2.5 bg-forest-700 text-white rounded-xl font-semibold text-sm hover:bg-forest-800 transition-colors shadow-sm"
        >
          + Register Pathshala
        </button>
      </div>

      {/* Search */}
      {paathshalas.length > 4 && (
        <input
          className="w-full mb-5 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500"
          placeholder="Search by name, code or teacher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Empty */}
      {paathshalas.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <div className="text-6xl mb-4">🕌</div>
          <div className="font-bold text-xl text-gray-600 mb-1">No Paathshalas Registered</div>
          <div className="text-sm mb-5">Register the first paathshala to get started</div>
          <button
            onClick={() => setShowForm(true)}
            className="px-6 py-2.5 bg-forest-700 text-white rounded-xl font-semibold text-sm hover:bg-forest-800 transition-colors"
          >
            Register First Pathshala
          </button>
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p => {
          const count = students.filter(s => s.paathshala_code === p.paathshala_code).length;
          return (
            <div
              key={p.id}
              onClick={() => setSelected(p)}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-forest-200 transition-all cursor-pointer group"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-gradient-to-br from-forest-700 to-forest-900 text-white font-bold rounded-xl w-11 h-11 flex items-center justify-center text-sm flex-shrink-0 shadow-sm group-hover:shadow">
                    {p.paathshala_code}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 truncate leading-snug">{p.paathshala_name}</div>
                    {p.address && <div className="text-xs text-gray-400 truncate mt-0.5">{p.address}</div>}
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-500">
                  {p.teacher1_name && (
                    <div className="flex items-center gap-1.5">
                      <span>👤</span>
                      <span className="truncate">{p.teacher1_name}</span>
                      {p.teacher1_mobile && <span className="text-gray-400 ml-auto">{p.teacher1_mobile}</span>}
                    </div>
                  )}
                  {p.pathshala_type && (
                    <div className="flex items-center gap-1.5">
                      <span>🕐</span><span>{p.pathshala_type}</span>
                    </div>
                  )}
                  {p.classes_conducted?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span>📚</span><span className="truncate">{p.classes_conducted.join(', ')}</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs bg-forest-50 text-forest-700 font-bold px-2.5 py-1 rounded-full">
                    {count} student{count !== 1 ? 's' : ''}
                  </span>
                  <div className="flex gap-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditTarget(p); setShowForm(true); }} className="text-xs text-gray-400 hover:text-forest-700 transition-colors">Edit</button>
                    <button onClick={() => setDeleteId(p.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Delete</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <PathshalaFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
      {deleteId && (
        <ConfirmDialog
          message="Delete this pathshala? Enrolled students will not be removed."
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}
