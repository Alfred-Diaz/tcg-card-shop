const express = require('express');
const router = express.Router();
const store = require('../lib/store');

// GET /api/employees — includes live "Current Assigned Orders (Today)" count,
// computed the same way the Smartsheet roster sheet would via a COUNTIFS formula.
router.get('/', (req, res) => {
  const db = store.load();
  const today = store.todayISO();
  const employees = db.employees.map(e => {
    const currentAssignedOrdersToday = db.orders.filter(o =>
      o.assignedEmployee === e.name &&
      o.orderDate === today &&
      !['Released/Completed', 'Canceled'].includes(o.orderStatus)
    ).length;
    return { ...e, currentAssignedOrdersToday };
  });
  res.json(employees);
});

router.post('/', (req, res) => {
  const db = store.load();
  const { name, role, teamLead, status, shift, avgHandlingTime, dailyCapacity, notes } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  const employee = {
    id: db.employees.length ? Math.max(...db.employees.map(e => e.id)) + 1 : 1,
    name, role, teamLead: teamLead || null,
    status: status || 'Active', shift: shift || '',
    avgHandlingTime: avgHandlingTime ?? null, dailyCapacity: dailyCapacity ?? null,
    notes: notes || ''
  };
  db.employees.push(employee);
  store.save(db);
  res.status(201).json(employee);
});

router.patch('/:id', (req, res) => {
  const db = store.load();
  const employee = db.employees.find(e => e.id === Number(req.params.id));
  if (!employee) return res.status(404).json({ error: 'Employee not found' });
  const editable = ['name', 'role', 'teamLead', 'status', 'shift', 'avgHandlingTime', 'dailyCapacity', 'notes'];
  for (const key of editable) if (key in req.body) employee[key] = req.body[key];
  store.save(db);
  res.json(employee);
});

module.exports = router;
