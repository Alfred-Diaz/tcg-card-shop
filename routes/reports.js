const express = require('express');
const router = express.Router();
const store = require('../lib/store');

// GET /api/reports/orders-by-employee
// STEP 7 (Team Lead): daily review — mirrors the "Orders by Employee" Smartsheet report,
// grouped by Assigned Employee, surfacing status/type/handling time/SLA.
router.get('/orders-by-employee', (req, res) => {
  const db = store.load();
  const groups = {};
  for (const o of db.orders) {
    const key = o.assignedEmployee || 'Unassigned';
    if (!groups[key]) groups[key] = [];
    groups[key].push({
      orderId: o.orderId,
      customerName: o.customerName,
      orderStatus: o.orderStatus,
      orderType: o.orderType,
      handlingMinutes: o.handlingMinutes,
      slaStatus: o.slaStatus
    });
  }
  const delayedCount = db.orders.filter(o => o.slaStatus === 'Delayed').length;
  const stuckCount = db.orders.filter(o => o.orderStatus === 'Processing' && !o.handlingStartTime).length;
  res.json({ groups, summary: { delayedCount, stuckCount, totalOrders: db.orders.length } });
});

module.exports = router;
