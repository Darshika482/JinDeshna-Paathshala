export const mockStudents = Array.from({ length: 40 }, (_, i) => {
  const names = [
    'Ankit Shah', 'Priya Jain', 'Rohan Mehta', 'Komal Gandhi', 'Chirag Kothari',
    'Nidhi Parekh', 'Jayesh Doshi', 'Hetal Sanghvi', 'Bhavesh Sheth', 'Sonal Vora',
    'Akash Modi', 'Neha Zaveri', 'Paresh Gada', 'Divya Sancheti', 'Kalpesh Singhi',
    'Pooja Bafna', 'Nitin Lodha', 'Seema Chordia', 'Sanjay Bhandari', 'Varsha Surana',
    'Tushar Shah', 'Ritu Jain', 'Vikram Mehta', 'Swati Gandhi', 'Pradeep Kothari',
    'Kavita Parekh', 'Manish Doshi', 'Sunita Sanghvi', 'Deepak Sheth', 'Anita Vora',
    'Vishal Modi', 'Jyoti Zaveri', 'Rajesh Gada', 'Meena Sancheti', 'Sachin Singhi',
    'Rekha Bafna', 'Hitesh Lodha', 'Khyati Chordia', 'Yash Bhandari', 'Megha Surana'
  ];
  const batches = ['A', 'B', 'C', 'D'];
  const groups = ['Lotus', 'Sunflower', 'Marigold', 'Rose', 'Jasmine'];
  const classes = ['5th', '6th', '7th', '8th', '9th', '10th'];
  const mobPrefixes = ['98', '97', '96', '95', '94', '93', '92', '91', '90', '88', '87', '86', '85', '84', '83', '82', '81', '80', '79', '78', '70'];
  const mob = mobPrefixes[i % mobPrefixes.length] + String(10000000 + ((i * 9876543) % 90000000)).slice(0, 8);
  return {
    id: `s${i + 1}`,
    roll_no: `BSS${String(i + 1).padStart(3, '0')}`,
    name: names[i],
    mobile: mob,
    class: classes[i % classes.length],
    batch: batches[i % batches.length],
    group: groups[i % groups.length],
    checked_in: false,
    total_points: Math.floor(Math.random() * 200) + 50,
    day_points: [
      Math.floor(Math.random() * 40),
      Math.floor(Math.random() * 40),
      Math.floor(Math.random() * 40),
      Math.floor(Math.random() * 40),
      Math.floor(Math.random() * 40),
      Math.floor(Math.random() * 40),
    ]
  };
});
