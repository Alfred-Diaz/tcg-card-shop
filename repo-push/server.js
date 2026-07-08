const express = require('express');
const path = require('path');
const store = require('./lib/store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/orders', require('./routes/orders'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/reports', require('./routes/reports'));

// STEP 1 automated (System): WooCommerce sends an "order.created" webhook the moment
// checkout completes on highmarketonline.shop. In production, register this URL under
// WooCommerce > Settings > Advanced > Webhooks, topic "Order created", and verify the
// X-WC-Webhook-Signature header against your webhook secret before trusting the payload.
app.post('/api/webhooks/woocommerce', (req, res) => {
  const db = store.load();
  const payload = req.body;
  const order = {
    id: db.orders.length ? Math.max(...db.orders.map(o => o.id)) + 1 : 1,
    orderId: `HM-${db.nextOrderSeq++}`,
    customerName: payload.billing ? `${payload.billing.first_name} ${payload.billing.last_name}` : (payload.customerName || 'Unknown'),
    orderDate: store.todayISO(),
    orderStatus: payload.status === 'processing' ? 'Paid' : 'Pending Payment',
    orderType: null,
    totalAmountPHP: payload.total || 0,
    shippingMethod: (payload.shipping_lines && payload.shipping_lines[0]?.method_title) || 'Store Pick Up',
    paymentMethod: payload.payment_method_title || 'Mobile Payment',
    teamLead: null,
    assignedEmployee: null,
    dateAssigned: null,
    handlingStartTime: null,
    handlingEndTime: null,
    handlingMinutes: null,
    slaStatus: 'N/A',
    releaseDate: null,
    notes: (payload.line_items || []).map(i => `${i.quantity}x ${i.name}`).join(', ')
  };
  db.orders.push(order);
  store.save(db);
  res.status(201).json({ received: true, order });
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'tcg-order-fulfillment-api' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`TCG order fulfillment API running on port ${PORT}`));

module.exports = app;
