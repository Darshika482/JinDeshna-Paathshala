import { mockStudents } from './mockStudents.js';
import { mockVolunteers } from './mockVolunteers.js';

export const mockTransactions = [
  { id: 't1', student_id: 's1', student_name: 'Arjun Sharma', volunteer_id: 'v4', volunteer_name: 'Dinesh Kumar', activity: 'Early Riser', type: 'Coin', points: 5, coin_count: 1, day: 1, slot: 1, timestamp: '2024-06-01T06:00:00', notes: '', flagged: false },
  { id: 't2', student_id: 's2', student_name: 'Priya Patel', volunteer_id: 'v5', volunteer_name: 'Naresh Singh', activity: 'Yoga', type: 'Digital', points: 5, coin_count: 0, day: 1, slot: 1, timestamp: '2024-06-01T07:00:00', notes: '', flagged: false },
  { id: 't3', student_id: 's3', student_name: 'Rahul Gupta', volunteer_id: 'v6', volunteer_name: 'Kamlesh Joshi', activity: 'Class Answer', type: 'Coin', points: 5, coin_count: 1, day: 1, slot: 1, timestamp: '2024-06-01T10:30:00', notes: '', flagged: false },
  { id: 't4', student_id: 's1', student_name: 'Arjun Sharma', volunteer_id: 'v2', volunteer_name: 'Suresh Patel', activity: 'Morning Puja', type: 'Coin', points: 5, coin_count: 1, day: 1, slot: 1, timestamp: '2024-06-01T07:30:00', notes: '', flagged: false },
  { id: 't5', student_id: 's4', student_name: 'Ananya Singh', volunteer_id: 'v2', volunteer_name: 'Suresh Patel', activity: 'Misbehaviour', type: 'Deduction', points: -5, coin_count: 0, day: 1, slot: 1, timestamp: '2024-06-01T07:45:00', notes: 'Disturbing others during puja', flagged: false },
  { id: 't6', student_id: 's5', student_name: 'Vikram Joshi', volunteer_id: 'v8', volunteer_name: 'Rakesh Mehta', activity: 'Slot 1 Submission', type: 'Submission', points: 15, coin_count: 3, day: 1, slot: 1, timestamp: '2024-06-01T12:35:00', notes: '', flagged: false },
  { id: 't7', student_id: 's6', student_name: 'Kavya Nair', volunteer_id: 'v9', volunteer_name: 'Umesh Nair', activity: 'Evening Program', type: 'Coin', points: 5, coin_count: 1, day: 1, slot: 3, timestamp: '2024-06-01T19:30:00', notes: '', flagged: true },
  { id: 't8', student_id: 's7', student_name: 'Rohan Mehta', volunteer_id: 'v6', volunteer_name: 'Kamlesh Joshi', activity: 'Helping Others', type: 'Digital', points: 5, coin_count: 0, day: 1, slot: 2, timestamp: '2024-06-01T14:30:00', notes: '', flagged: false },
];

export const mockCoinDistributions = [
  { id: 'cd1', activity: 'Early Riser', volunteer_id: 'v4', volunteer_name: 'Dinesh Kumar', coins_sent: 50, day: 1, slot: 1, timestamp: '2024-06-01T05:30:00' },
  { id: 'cd2', activity: 'Morning Puja', volunteer_id: 'v2', volunteer_name: 'Suresh Patel', coins_sent: 80, day: 1, slot: 1, timestamp: '2024-06-01T07:00:00' },
  { id: 'cd3', activity: 'Class Session', volunteer_id: 'v6', volunteer_name: 'Kamlesh Joshi', coins_sent: 75, day: 1, slot: 1, timestamp: '2024-06-01T09:00:00' },
  { id: 'cd4', activity: 'Class Session', volunteer_id: 'v7', volunteer_name: 'Prakash Verma', coins_sent: 75, day: 1, slot: 1, timestamp: '2024-06-01T09:05:00' },
  { id: 'cd5', activity: 'Afternoon Bhakti', volunteer_id: 'v10', volunteer_name: 'Ganesh Rao', coins_sent: 100, day: 1, slot: 2, timestamp: '2024-06-01T13:50:00' },
  { id: 'cd6', activity: 'Afternoon Class', volunteer_id: 'v7', volunteer_name: 'Prakash Verma', coins_sent: 100, day: 1, slot: 2, timestamp: '2024-06-01T15:40:00' },
  { id: 'cd7', activity: 'Evening Program', volunteer_id: 'v9', volunteer_name: 'Umesh Nair', coins_sent: 80, day: 1, slot: 3, timestamp: '2024-06-01T18:50:00' },
  { id: 'cd8', activity: 'Games', volunteer_id: 'v4', volunteer_name: 'Dinesh Kumar', coins_sent: 80, day: 1, slot: 3, timestamp: '2024-06-01T16:50:00' },
];

export const mockCoinReturns = [
  { id: 'cr1', slot: 1, volunteer_id: 'v4', volunteer_name: 'Dinesh Kumar', coins_returned: 32, day: 1, timestamp: '2024-06-01T12:35:00' },
  { id: 'cr2', slot: 1, volunteer_id: 'v2', volunteer_name: 'Suresh Patel', coins_returned: 55, day: 1, timestamp: '2024-06-01T12:40:00' },
  { id: 'cr3', slot: 1, volunteer_id: 'v6', volunteer_name: 'Kamlesh Joshi', coins_returned: 40, day: 1, timestamp: '2024-06-01T12:45:00' },
  { id: 'cr4', slot: 1, volunteer_id: 'v7', volunteer_name: 'Prakash Verma', coins_returned: 42, day: 1, timestamp: '2024-06-01T12:50:00' },
];
