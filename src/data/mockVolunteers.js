// Demo volunteer data — replace with your actual volunteer list via Admin > Volunteers,
// or import from CSV via Admin > Operations.
// PINs shown here are examples only. Change all PINs before running a real camp.

export const mockVolunteers = [
  {
    id: 't01', name: 'Demo Teacher A', name_hi: 'डेमो शिक्षक A', pin: '1001',
    roles: ['Class Teacher'], assigned_class: '1A', assigned_classes: ['1A'],
    session_classes: { '1': '1A', '2': '1A', '3': '1A' },
    has_deduction_rights: false, responsibilities: ['📚 Class 1A teaching'],
  },
  {
    id: 't02', name: 'Demo Teacher B', name_hi: 'डेमो शिक्षक B', pin: '1002',
    roles: ['Class Teacher'], assigned_class: '1B', assigned_classes: ['1B'],
    session_classes: { '1': '1B', '2': '1B', '3': '1B' },
    has_deduction_rights: false, responsibilities: ['📚 Class 1B teaching'],
  },
  {
    id: 't03', name: 'Demo Teacher C', name_hi: 'डेमो शिक्षक C', pin: '1003',
    roles: ['Class Teacher'], assigned_class: '2A', assigned_classes: ['2A'],
    session_classes: { '1': '2A', '2': '2A', '3': '2A' },
    has_deduction_rights: false, responsibilities: ['📚 Class 2A teaching'],
  },
  {
    id: 'm01', name: 'Demo Mentor 1', name_hi: 'डेमो मेंटर 1', pin: '2001',
    roles: ['Zone Mentor'], assigned_classes: [],
    session_classes: {},
    has_deduction_rights: false,
    responsibilities: ['📦 Zone A supervision', '🪙 Coin distribution'],
  },
  {
    id: 'm02', name: 'Demo Mentor 2', name_hi: 'डेमो मेंटर 2', pin: '2002',
    roles: ['Zone Mentor'], assigned_classes: [],
    session_classes: {},
    has_deduction_rights: true,
    responsibilities: ['📦 Zone B supervision'],
  },
  {
    id: 'c01', name: 'Demo Coordinator', name_hi: 'डेमो समन्वयक', pin: '3001',
    roles: ['Activity Coordinator'], assigned_classes: [],
    session_classes: {},
    has_deduction_rights: false,
    responsibilities: ['🎯 Activity coordination'],
  },
];
