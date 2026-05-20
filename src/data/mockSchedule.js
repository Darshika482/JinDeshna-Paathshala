const baseSchedule = [
  { id: 'sch1',  name: 'Wake Up',                   name_hi: 'जागरण',                              start_time: '05:15', end_time: '05:20', venue: 'Dormitory',    coins: 50,  type: 'base', session: 'morning',   materials: ['Whistle', 'Attendance sheet'], notes: 'Students must be up by 5:15 AM. Ring bell twice.' },
  { id: 'sch2',  name: 'Prayer & Yoga',              name_hi: 'प्रार्थना एवं योग कक्षा',            start_time: '05:20', end_time: '06:00', venue: 'Main Ground',  coins: 0,   type: 'base', session: 'morning',   materials: ['Yoga mats', 'Sound system'], notes: 'Digital points only. No physical coins.' },
  { id: 'sch3',  name: 'Morning Routine',            name_hi: 'स्नान आदि नित्य कार्य',              start_time: '06:00', end_time: '07:00', venue: 'Dormitory',    coins: 0,   type: 'base', session: 'morning',   materials: [], notes: '' },
  { id: 'sch4',  name: 'Jinendra Abhishek Pujan',   name_hi: 'जिनेन्द्र अभिषेक-पूजन',             start_time: '07:00', end_time: '08:15', venue: 'Temple Hall',  coins: 80,  type: 'base', session: 'morning',   materials: ['Puja thali', 'Flowers', 'Incense'], notes: 'All students must attend with proper attire.' },
  { id: 'sch5',  name: 'Gurudev Pravachan (Senior)', name_hi: 'गुरुदेव श्री प्रवचन (सीनियर वर्ग)', start_time: '08:20', end_time: '08:40', venue: 'Satsang Hall', coins: 0,   type: 'base', session: 'morning',   materials: ['Sound system'], notes: 'Senior group only.' },
  { id: 'sch6',  name: 'Breakfast (Junior)',         name_hi: 'अल्पाहार (जूनियर वर्ग)',             start_time: '08:30', end_time: '08:55', venue: 'Dining Hall',  coins: 0,   type: 'base', session: 'morning',   materials: [], notes: 'Junior group breakfast. Discipline points given here.' },
  { id: 'sch7',  name: 'Breakfast (Senior)',         name_hi: 'अल्पाहार (सीनियर वर्ग)',             start_time: '08:40', end_time: '09:00', venue: 'Dining Hall',  coins: 0,   type: 'base', session: 'morning',   materials: [], notes: 'Senior group breakfast. Discipline points given here.' },
  { id: 'sch8',  name: 'First Teaching Class',       name_hi: 'प्रथम शिक्षण कक्षा',                start_time: '09:00', end_time: '09:45', venue: 'Classrooms',   coins: 100, type: 'base', session: 'morning',   materials: ['Notebooks', 'Pens', 'Whiteboard'], notes: 'Class teachers award points for answers.' },
  { id: 'sch9',  name: 'Second Teaching Class',      name_hi: 'द्वितीय शिक्षण कक्षा',              start_time: '09:45', end_time: '10:30', venue: 'Classrooms',   coins: 100, type: 'base', session: 'morning',   materials: ['Notebooks', 'Pens', 'Whiteboard'], notes: 'Class teachers award points for answers.' },
  { id: 'sch10', name: 'Group Classes (Morning)',    name_hi: 'सामूहिक कक्षायें',                   start_time: '10:35', end_time: '11:20', venue: 'Classrooms',   coins: 80,  type: 'base', session: 'morning',   materials: ['Activity sheets'], notes: '' },
  { id: 'sch11', name: 'Lunch & Rest',               name_hi: 'भोजन एवं विश्राम',                  start_time: '11:30', end_time: '14:00', venue: 'Dining Hall',  coins: 0,   type: 'base', session: 'afternoon', materials: [], notes: '' },
  { id: 'sch12', name: 'Competition / Creative',     name_hi: 'प्रतियोगिता / रचनात्मक गतिविधियाँ', start_time: '14:00', end_time: '15:00', venue: 'Activity Area',coins: 100, type: 'base', session: 'afternoon', materials: ['Art supplies', 'Activity sheets'], notes: 'Competition or creative activities for all groups.' },
  { id: 'sch13', name: 'Afternoon Snacks',           name_hi: 'अल्पाहार',                           start_time: '15:00', end_time: '15:25', venue: 'Dining Hall',  coins: 0,   type: 'base', session: 'afternoon', materials: [], notes: '' },
  { id: 'sch14', name: 'Teaching Class',             name_hi: 'शिक्षण कक्षा',                       start_time: '15:30', end_time: '16:15', venue: 'Classrooms',   coins: 80,  type: 'base', session: 'afternoon', materials: ['Notebooks', 'Pens'], notes: '' },
  { id: 'sch15', name: 'Group Classes (Afternoon)',  name_hi: 'सामूहिक कक्षायें',                   start_time: '16:15', end_time: '17:00', venue: 'Classrooms',   coins: 80,  type: 'base', session: 'afternoon', materials: ['Activity sheets'], notes: '' },
  { id: 'sch16', name: 'Dinner, Sports & Fun Time',  name_hi: 'भोजन, खेलकूद एवं Fun-Time',          start_time: '17:00', end_time: '18:50', venue: 'Sports Ground', coins: 50, type: 'base', session: 'evening',   materials: ['Sports equipment', 'First aid kit'], notes: 'Dinner followed by team sports and free time.' },
  { id: 'sch17', name: 'Jinendra Bhakti',            name_hi: 'जिनेन्द्र भक्ति',                   start_time: '19:00', end_time: '19:30', venue: 'Satsang Hall', coins: 80,  type: 'base', session: 'evening',   materials: ['Song books', 'Instruments', 'Sound system'], notes: 'Students get points for active participation.' },
  { id: 'sch18', name: 'Khojoge to Paoge',           name_hi: 'खोजोगे तो पाओगे',                   start_time: '19:30', end_time: '19:40', venue: 'Satsang Hall', coins: 30,  type: 'base', session: 'evening',   materials: [], notes: '' },
  { id: 'sch19', name: 'Moral Story Video',          name_hi: 'नैतिक शिक्षा कहानी वीडियो',          start_time: '19:40', end_time: '19:50', venue: 'Satsang Hall', coins: 0,   type: 'base', session: 'evening',   materials: ['Projector', 'Screen'], notes: '' },
  { id: 'sch20', name: 'Cultural Program',           name_hi: 'सांस्कृतिक कार्यक्रम',              start_time: '19:50', end_time: '20:50', venue: 'Main Stage',   coins: 80,  type: 'base', session: 'evening',   materials: ['Stage setup', 'Mics', 'Lights'], notes: 'Cultural programs, skits, and talent show.' },
  { id: 'sch21', name: 'Daily Camp Highlights',      name_hi: 'शिविर की दैनिक झलकियाँ',            start_time: '20:50', end_time: '21:00', venue: 'Main Stage',   coins: 0,   type: 'base', session: 'evening',   materials: [], notes: '' },
  { id: 'sch22', name: 'Milk / Water & Rest',        name_hi: 'दूध/पानी एवं विश्राम',              start_time: '21:00', end_time: '21:20', venue: 'Dormitory',    coins: 0,   type: 'base', session: 'night',     materials: [], notes: 'All students must be in their rooms by 9:20 PM.' },
];

export const mockSchedule = {};
for (let day = 1; day <= 6; day++) {
  mockSchedule[day] = baseSchedule.map(item => ({
    ...item,
    id: `${item.id}_d${day}`,
    day,
  }));
}

// Add special activities for some days
mockSchedule[1].push({
  id: 'special1_d1', day: 1, name: 'Opening Ceremony', name_hi: 'उद्घाटन समारोह',
  start_time: '18:00', end_time: '19:00', venue: 'Main Ground',
  coins: 50, type: 'special', session: 'evening',
  materials: ['Flags', 'Garlands', 'Sound system', 'Chairs'],
  notes: 'Welcome ceremony for all students and parents.'
});
mockSchedule[3].push({
  id: 'special2_d3', day: 3, name: 'Cultural Night', name_hi: 'सांस्कृतिक रात',
  start_time: '20:00', end_time: '22:00', venue: 'Main Stage',
  coins: 60, type: 'special', session: 'evening',
  materials: ['Costumes', 'Props', 'Extra mics', 'Decorations'],
  notes: 'Students perform prepared skits and dances.'
});
mockSchedule[6].push({
  id: 'special3_d6', day: 6, name: 'Closing Ceremony & Prize Distribution', name_hi: 'समापन समारोह व पुरस्कार वितरण',
  start_time: '17:00', end_time: '19:00', venue: 'Main Ground',
  coins: 0, type: 'special', session: 'evening',
  materials: ['Trophies', 'Certificates', 'Gifts', 'Decorations'],
  notes: 'Final ceremony. Parents invited.'
});
