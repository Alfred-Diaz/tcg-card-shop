// Lightweight file-backed store.
// In production, swap this for Postgres/MySQL — the query shapes below
// (getOrders, saveOrders, etc.) are the seam to replace.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const ORDER_STATUSES = [
  'Pending Payment', 'Paid', 'Processing',
  'Ready for Release', 'Released/Completed', 'Canceled'
];
const ORDER_TYPES = ['Sealed Product', 'Singles', 'Mixed (Sealed+Singles)', 'Pre-Order', 'Event Entry'];
const SHIPPING_METHODS = ['Store Pick Up', 'Book Your Own Rider', 'LBC Shipping', 'J&T Express', 'Other Courier'];
const PAYMENT_METHODS = ['Mobile Payment', 'Bank Transfer', 'Credit Card'];
const SLA_TARGET_MINUTES = 20; // 15-20 min target from the SDD; 20 = upper bound

function load() {
  if (!fs.existsSync(DB_PATH)) seed();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function save(db) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors the Smartsheet formula:
// =IF(OR(Start="",End=""),"",(End_h*60+End_m)-(Start_h*60+Start_m))
function computeHandlingMinutes(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

// Mirrors: =IF(Minutes="","N/A",IF(Minutes<=20,"On Target","Delayed"))
function computeSlaStatus(minutes) {
  if (minutes === null || minutes === undefined) return 'N/A';
  return minutes <= SLA_TARGET_MINUTES ? 'On Target' : 'Delayed';
}

function seed() {
  const db = {
    nextOrderSeq: 1005,
    orders: [
      {
        id: 1, orderId: 'HM-1001', customerName: 'Jerico Villanueva',
        orderDate: todayISO(), orderStatus: 'Processing', orderType: 'Sealed Product',
        totalAmountPHP: 4200, shippingMethod: 'Store Pick Up', paymentMethod: 'Mobile Payment',
        teamLead: 'Anna Cruz', assignedEmployee: 'Marco Reyes', dateAssigned: todayISO(),
        handlingStartTime: '09:12', handlingEndTime: null, handlingMinutes: null, slaStatus: 'N/A',
        releaseDate: null, notes: '1x MTG Bloomburrow booster box'
      },
      {
        id: 2, orderId: 'HM-1002', customerName: 'Dianne Ocampo',
        orderDate: todayISO(), orderStatus: 'Released/Completed', orderType: 'Singles',
        totalAmountPHP: 1350, shippingMethod: 'LBC Shipping', paymentMethod: 'Bank Transfer',
        teamLead: 'Anna Cruz', assignedEmployee: 'Marco Reyes', dateAssigned: todayISO(),
        handlingStartTime: '08:40', handlingEndTime: '08:57', handlingMinutes: 17, slaStatus: 'On Target',
        releaseDate: todayISO(), notes: '4x FAB singles, sleeved on request'
      },
      {
        id: 3, orderId: 'HM-1003', customerName: 'Paolo Santos',
        orderDate: todayISO(), orderStatus: 'Ready for Release', orderType: 'Mixed (Sealed+Singles)',
        totalAmountPHP: 2680, shippingMethod: 'J&T Express', paymentMethod: 'Mobile Payment',
        teamLead: 'Anna Cruz', assignedEmployee: 'Bea Lim', dateAssigned: todayISO(),
        handlingStartTime: '09:05', handlingEndTime: '09:38', handlingMinutes: 33, slaStatus: 'Delayed',
        releaseDate: null, notes: 'Large order, 12 line items'
      },
      {
        id: 4, orderId: 'HM-1004', customerName: 'Kristine Uy',
        orderDate: todayISO(), orderStatus: 'Paid', orderType: null,
        totalAmountPHP: 900, shippingMethod: 'Store Pick Up', paymentMethod: 'Credit Card',
        teamLead: null, assignedEmployee: null, dateAssigned: null,
        handlingStartTime: null, handlingEndTime: null, handlingMinutes: null, slaStatus: 'N/A',
        releaseDate: null, notes: 'Awaiting triage'
      }
    ],
    employees: [
      { id: 1, name: 'Anna Cruz', role: 'Team Lead', teamLead: null, status: 'Active', shift: 'Morning', avgHandlingTime: 14, dailyCapacity: 28, notes: 'Opens the shift, triages queue' },
      { id: 2, name: 'Marco Reyes', role: 'Order Fulfillment Staff', teamLead: 'Anna Cruz', status: 'Active', shift: 'Morning', avgHandlingTime: 16, dailyCapacity: 26, notes: '' },
      { id: 3, name: 'Bea Lim', role: 'Order Fulfillment Staff', teamLead: 'Anna Cruz', status: 'Active', shift: 'Morning', avgHandlingTime: 19, dailyCapacity: 24, notes: 'Handles large/mixed orders' },
      { id: 4, name: 'Owner', role: 'Admin/Owner', teamLead: null, status: 'Active', shift: '-', avgHandlingTime: null, dailyCapacity: null, notes: 'Reviews SLA trends weekly' }
    ]
  };
  save(db);
  return db;
}

module.exports = {
  ORDER_STATUSES, ORDER_TYPES, SHIPPING_METHODS, PAYMENT_METHODS, SLA_TARGET_MINUTES,
  load, save, nowTime, todayISO, computeHandlingMinutes, computeSlaStatus, seed
};
