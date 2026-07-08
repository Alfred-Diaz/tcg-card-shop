const express = require('express');
const router = express.Router();
const store = require('../lib/store');

function findOrder(db, id) {
  return db.orders.find(o => o.id === Number(id));
}

// GET /api/orders?status=&employee=&type=
router.get('/', (req, res) => {
  const db = store.load();
  let orders = db.orders;
  const { status, employee, type } = req.query;
  if (status) orders = orders.filter(o => o.orderStatus === status);
  if (employee) orders = orders.filter(o => o.assignedEmployee === employee);
  if (type) orders = orders.filter(o => o.orderType === type);
  res.json(orders);
});

// POST /api/orders  — manual entry, or called by the WooCommerce webhook below
// STEP 1 (Customer): order placed on the website
router.post('/', (req, res) => {
  const db = store.load();
  const { customerName, totalAmountPHP, shippingMethod, paymentMethod, notes, orderStatus } = req.body;
  if (!customerName || !totalAmountPHP) {
    return res.status(400).json({ error: 'customerName and totalAmountPHP are required' });
  }
  const order = {
    id: db.orders.length ? Math.max(...db.orders.map(o => o.id)) + 1 : 1,
    orderId: `HM-${db.nextOrderSeq++}`,
    customerName,
    orderDate: store.todayISO(),
    orderStatus: orderStatus && store.ORDER_STATUSES.includes(orderStatus) ? orderStatus : 'Pending Payment',
    orderType: null,
    totalAmountPHP,
    shippingMethod: shippingMethod || 'Store Pick Up',
    paymentMethod: paymentMethod || 'Mobile Payment',
    teamLead: null,
    assignedEmployee: null,
    dateAssigned: null,
    handlingStartTime: null,
    handlingEndTime: null,
    handlingMinutes: null,
    slaStatus: 'N/A',
    releaseDate: null,
    notes: notes || ''
  };
  db.orders.push(order);
  store.save(db);
  res.status(201).json(order);
});

// PATCH /api/orders/:id/triage  { orderType }
// STEP 2 (Team Lead): order triaged, Order Type set
router.patch('/:id/triage', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { orderType } = req.body;
  if (!store.ORDER_TYPES.includes(orderType)) {
    return res.status(400).json({ error: `orderType must be one of: ${store.ORDER_TYPES.join(', ')}` });
  }
  order.orderType = orderType;
  store.save(db);
  res.json(order);
});

// PATCH /api/orders/:id/assign  { teamLead, assignedEmployee }
// STEP 3 (Team Lead): employee assigned — the accountability record
router.patch('/:id/assign', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { teamLead, assignedEmployee } = req.body;
  if (!assignedEmployee) return res.status(400).json({ error: 'assignedEmployee is required' });
  order.teamLead = teamLead || order.teamLead;
  order.assignedEmployee = assignedEmployee;
  order.dateAssigned = store.todayISO();
  order.orderStatus = 'Processing';
  store.save(db);
  res.json(order);
});

// POST /api/orders/:id/start
// STEP 4 (Employee): handling starts
router.post('/:id/start', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.assignedEmployee) return res.status(409).json({ error: 'Order must be assigned before handling can start' });
  order.handlingStartTime = store.nowTime();
  store.save(db);
  res.json(order);
});

// POST /api/orders/:id/end
// STEP 5 (Employee + System): handling ends, System auto-computes minutes + SLA status
router.post('/:id/end', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (!order.handlingStartTime) return res.status(409).json({ error: 'Handling has not started yet' });
  order.handlingEndTime = store.nowTime();
  order.handlingMinutes = store.computeHandlingMinutes(order.handlingStartTime, order.handlingEndTime);
  order.slaStatus = store.computeSlaStatus(order.handlingMinutes);
  order.orderStatus = 'Ready for Release';
  store.save(db);
  res.json(order);
});

// POST /api/orders/:id/release
// STEP 6 (Employee): QC + release
router.post('/:id/release', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  order.releaseDate = store.todayISO();
  order.orderStatus = 'Released/Completed';
  store.save(db);
  res.json(order);
});

// PATCH /api/orders/:id  — generic field edits (notes, payment method, etc.)
router.patch('/:id', (req, res) => {
  const db = store.load();
  const order = findOrder(db, req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const editable = ['customerName', 'totalAmountPHP', 'shippingMethod', 'paymentMethod', 'notes', 'orderStatus'];
  for (const key of editable) if (key in req.body) order[key] = req.body[key];
  store.save(db);
  res.json(order);
});

module.exports = router;
