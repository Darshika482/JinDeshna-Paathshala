import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

function parseEnv(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    env[key] = value;
  }
  return env;
}

function toBool(value) {
  const v = String(value ?? '').trim().toLowerCase();
  return v === 'yes' || v === 'true' || v === '1';
}

function toNullableInt(value) {
  const n = parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizePhone(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function buildStudents(rows) {
  const classTeacherByClass = {
    BA1: { en: 'Br Prateek Bhaiya', hi: 'ब्र. प्रतीक भैया' },
    BA2: { en: 'Br Himanshu Bhaiya', hi: 'ब्र. हिमांशु भैया' },
    BA3: { en: 'Abhinay Ji', hi: 'अभिनय जी' },
    BA4: { en: 'Aman Jain Ji', hi: 'अमन जैन जी' },
    BA5: { en: 'Aniket Jain Ji', hi: 'अनिकेत जैन जी' },
    GA1: { en: 'Pragya Jain Ji', hi: 'प्रज्ञा जैन जी' },
    GA2: { en: 'Aditi', hi: 'अदिति' },
    GA3: { en: 'Lipi Jain Ji', hi: 'लिपि जैन जी' },
    BB1: { en: 'Gautam Gandhar Pradhan Ji', hi: 'गौतम गणधर प्रधान जी' },
    BB2: { en: 'Br Rajesh Bhaiya Ji', hi: 'ब्र. राजेश भैया जी' },
    GB1: { en: 'Khushbu Ji', hi: 'खुशबू जी' },
    BC1: { en: 'Br Shrenik Bhaiya Ji', hi: 'ब्र. श्रीणिक भैया जी' },
    GC1: { en: 'Shrimati Pooja Ji', hi: 'श्रीमती पूजा जी' },
    MD1: { en: 'Shrimati Alka Ji', hi: 'श्रीमती अलका जी' },
  };

  return rows.map((r) => {
    const rollNo = String(r['Roll No'] ?? '').trim();
    const className = String(r['Class'] ?? '').trim();
    const teacher = classTeacherByClass[className] || null;
    const groupText = teacher?.en || String(r['Class Teacher'] ?? '').trim();
    const groupHiText = teacher?.hi || '';

    return {
      id: rollNo,
      roll_no: rollNo,
      name: String(r['Child Name'] ?? '').trim(),
      name_hi: '',
      mobile: normalizePhone(r['Mobile']),
      class: className,
      batch: String(r['Allotted Book'] ?? '').trim(),
      group: groupText,
      group_hi: groupHiText,
      parent_name: String(r['Father Name'] ?? '').trim(),
      mother_name: String(r['Mother Name'] ?? '').trim(),
      city: String(r['City / District'] ?? '').trim(),
      photo_url: '',
      reg_id: String(r['Reg ID'] ?? '').trim(),
      gender: String(r['Gender'] ?? '').trim(),
      age: toNullableInt(r['Age']),
      dob: toIsoDate(r['DOB']),
      whatsapp: normalizePhone(r['WhatsApp']),
      health_issue: toBool(r['Health Issue']),
      health_detail: String(r['Health Detail'] ?? '').trim(),
      pathshala: String(r['Pathshala'] ?? '').trim(),
      prev_shivir: toBool(r['Prev Shivir']),
      kit_given: false,
      total_points: 0,
      day_points: [0, 0, 0, 0, 0, 0],
      checked_in: false,
    };
  });
}

function sqlQuote(value) {
  if (value === null || value === undefined) return 'NULL';
  if (Array.isArray(value)) {
    const arr = value.map((v) => Number.isFinite(v) ? v : 0).join(',');
    return `'{${arr}}'`;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function writeFallbackSql(projectRoot, students) {
  const outPath = path.join(projectRoot, 'supabase', 'generated_students_import.sql');
  const clearSql = [
    'delete from attendance;',
    'delete from attendance_submissions;',
    'delete from transactions;',
    'delete from coin_distributions;',
    'delete from coin_returns;',
    'delete from good_behaviour_logs;',
    'delete from coin_collection_logs;',
    'delete from room_wakeup_assignments;',
    'delete from negative_markings;',
    'delete from students;',
    '',
  ];

  const cols = [
    'id', 'roll_no', 'name', 'name_hi', 'mobile', 'class', 'batch', '"group"', 'group_hi', 'parent_name', 'mother_name',
    'city', 'photo_url', 'reg_id', 'gender', 'age', 'dob', 'whatsapp', 'health_issue', 'health_detail',
    'pathshala', 'prev_shivir', 'kit_given', 'total_points', 'day_points', 'checked_in',
  ];

  const values = students.map((s) => {
    const tuple = [
      s.id, s.roll_no, s.name, s.name_hi, s.mobile, s.class, s.batch, s.group, s.group_hi, s.parent_name, s.mother_name,
      s.city, s.photo_url, s.reg_id, s.gender, s.age, s.dob, s.whatsapp, s.health_issue, s.health_detail,
      s.pathshala, s.prev_shivir, s.kit_given, s.total_points, s.day_points, s.checked_in,
    ];
    return `(${tuple.map(sqlQuote).join(', ')})`;
  });

  const insertSql = [
    `insert into students (${cols.join(', ')}) values`,
    `${values.join(',\n')};`,
    '',
  ];

  fs.writeFileSync(outPath, [...clearSql, ...insertSql].join('\n'), 'utf8');
  return outPath;
}

async function deleteAllRows(supabase, tableName) {
  const { error } = await supabase
    .from(tableName)
    .delete()
    .not('id', 'is', null);
  if (error) {
    throw new Error(`Failed deleting ${tableName}: ${error.message}`);
  }
}

async function insertInChunks(supabase, tableName, rows, chunkSize = 200) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(tableName).insert(chunk);
    if (error) {
      throw new Error(`Insert failed (${tableName}, chunk ${i}-${i + chunk.length - 1}): ${error.message}`);
    }
  }
}

async function main() {
  const projectRoot = path.resolve(process.cwd());
  const envPath = path.join(projectRoot, '.env');
  const csvPath = process.argv[2] || 'C:\\Users\\User\\Desktop\\FINAL_STUDENTS_ONLY_WITH_ALL_DATA.csv';

  if (!fs.existsSync(envPath)) {
    throw new Error(`Missing .env at ${envPath}`);
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const env = parseEnv(envPath);
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env');
  }

  const csvRaw = fs.readFileSync(csvPath, 'utf8');
  const parsed = Papa.parse(csvRaw, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`CSV parse error: ${parsed.errors[0].message}`);
  }

  const rows = parsed.data || [];
  const finalRows = rows.filter((r) => String(r['Roll No'] ?? '').trim() && String(r['Class'] ?? '').trim());
  if (!finalRows.length) {
    throw new Error('No final rows found in CSV (needs Roll No + Class).');
  }

  const students = buildStudents(finalRows);
  const rollSet = new Set(students.map((s) => s.roll_no));
  if (rollSet.size !== students.length) {
    throw new Error('Duplicate roll numbers detected in CSV.');
  }

  const fallbackSqlPath = writeFallbackSql(projectRoot, students);
  // eslint-disable-next-line no-console
  console.log(`Generated SQL fallback: ${fallbackSqlPath}`);

  const keyToUse = supabaseServiceRoleKey || supabaseAnonKey;
  const supabase = createClient(supabaseUrl, keyToUse);

  // Reset operational data first so UI does not show stale records.
  const tablesToClear = [
    'attendance',
    'attendance_submissions',
    'transactions',
    'coin_distributions',
    'coin_returns',
    'good_behaviour_logs',
    'coin_collection_logs',
    'room_wakeup_assignments',
    'negative_markings',
    'students',
  ];

  for (const table of tablesToClear) {
    // eslint-disable-next-line no-console
    console.log(`Clearing ${table}...`);
    await deleteAllRows(supabase, table);
  }

  // eslint-disable-next-line no-console
  console.log(`Importing ${students.length} students...`);
  await insertInChunks(supabase, 'students', students, 200);

  // eslint-disable-next-line no-console
  console.log('Done. Supabase student data reset + imported successfully.');

  const girls = students.filter((s) => s.roll_no.startsWith('G')).length;
  const boys = students.filter((s) => s.roll_no.startsWith('B')).length;
  // eslint-disable-next-line no-console
  console.log(`Girls: ${girls}, Boys: ${boys}, Total: ${students.length}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  // eslint-disable-next-line no-console
  console.error('If this is an RLS error, add SUPABASE_SERVICE_ROLE_KEY in .env, or run supabase/generated_students_import.sql in Supabase SQL Editor.');
  process.exit(1);
});

