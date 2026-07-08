const ORDER_TYPES = ['Sealed Product', 'Singles', 'Mixed (Sealed+Singles)', 'Pre-Order', 'Event Entry'];

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

function statusPill(status) {
  const map = {
    'Pending Payment': 'pill-customer', 'Paid': 'pill-customer',
    'Processing': 'pill-employee', 'Ready for Release': 'pill-employee',
    'Released/Completed': 'pill-teamlead', 'Canceled': 'pill-danger'
  };
  return `<span class="pill ${map[status] || 'pill-customer'}">${status}</span>`;
}

function slaPill(sla) {
  if (sla === 'On Target') return `<span class="pill pill-system">On target</span>`;
  if (sla === 'Delayed') return `<span class="pill pill-danger">Delayed</span>`;
  return `<span class="pill pill-customer">N/A</span>`;
}

function actionsForOrder(o) {
  const btns = [];
  if (!o.orderType) {
    btns.push(`<button class="btn" onclick="triage(${o.id})">Set type</button>`);
  }
  if (o.orderType && !o.assignedEmployee) {
    btns.push(`<button class="btn btn-primary" onclick="assign(${o.id})">Assign</button>`);
  }
  if (o.assignedEmployee && !o.handlingStartTime) {
    btns.push(`<button class="btn" onclick="startHandling(${o.id})">Start</button>`);
  }
  if (o.handlingStartTime && !o.handlingEndTime) {
    btns.push(`<button class="btn" onclick="endHandling(${o.id})">End</button>`);
  }
  if (o.handlingEndTime && o.orderStatus !== 'Released/Completed') {
    btns.push(`<button class="btn btn-primary" onclick="release(${o.id})">Release</button>`);
  }
  return btns.join('') || '<span style="color:var(--ink-soft);font-size:12px">Done</span>';
}

async function loadOrders() {
  const orders = await api('/api/orders');
  const body = document.getElementById('orders-body');
  body.innerHTML = orders.map(o => `
    <tr>
      <td><b>${o.orderId}</b><br><span style="color:var(--ink-soft);font-size:11.5px">${o.totalAmountPHP ? '₱' + o.totalAmountPHP : ''}</span></td>
      <td>${o.customerName}</td>
      <td>${o.orderType || '<span style="color:var(--ink-soft)">—</span>'}</td>
      <td>${statusPill(o.orderStatus)}</td>
      <td>${o.assignedEmployee || '<span style="color:var(--ink-soft)">Unassigned</span>'}</td>
      <td style="font-size:12px;color:var(--ink-soft)">${o.handlingStartTime || '—'} → ${o.handlingEndTime || '—'}${o.handlingMinutes != null ? ` (${o.handlingMinutes}m)` : ''}</td>
      <td>${slaPill(o.slaStatus)}</td>
      <td>${actionsForOrder(o)}</td>
    </tr>
  `).join('');

  const delayed = orders.filter(o => o.slaStatus === 'Delayed').length;
  const active = orders.filter(o => !['Released/Completed', 'Canceled'].includes(o.orderStatus)).length;
  document.getElementById('summary').innerHTML =
    `<span><b>${orders.length}</b> total</span><span><b>${active}</b> active</span><span><b>${delayed}</b> delayed</span>`;
}

async function loadRoster() {
  const employees = await api('/api/employees');
  document.getElementById('roster-body').innerHTML = employees.map(e => `
    <tr>
      <td><b>${e.name}</b></td>
      <td>${e.role}</td>
      <td>${e.status}</td>
      <td>${e.shift || '—'}</td>
      <td>${e.avgHandlingTime ?? '—'}</td>
      <td>${e.dailyCapacity ?? '—'}</td>
      <td>${e.currentAssignedOrdersToday}</td>
    </tr>
  `).join('');
}

async function loadReport() {
  const { groups } = await api('/api/reports/orders-by-employee');
  const container = document.getElementById('report-groups');
  container.innerHTML = Object.entries(groups).map(([employee, rows]) => `
    <div class="group-card">
      <div class="group-title">${employee} <span style="font-weight:400;color:var(--teamlead-600)">(${rows.length})</span></div>
      <table>
        <thead><tr><th>Order</th><th>Customer</th><th>Status</th><th>Type</th><th>Handling</th><th>SLA</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.orderId}</td><td>${r.customerName}</td><td>${statusPill(r.orderStatus)}</td>
              <td>${r.orderType || '—'}</td><td>${r.handlingMinutes != null ? r.handlingMinutes + ' min' : '—'}</td>
              <td>${slaPill(r.slaStatus)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

async function refreshAll() {
  await Promise.all([loadOrders(), loadRoster(), loadReport()]);
}

async function triage(id) {
  const orderType = prompt(`Set order type:\n${ORDER_TYPES.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nEnter number:`);
  const type = ORDER_TYPES[Number(orderType) - 1];
  if (!type) return;
  await api(`/api/orders/${id}/triage`, { method: 'PATCH', body: JSON.stringify({ orderType: type }) });
  toast('Order type set');
  refreshAll();
}

async function assign(id) {
  const assignedEmployee = prompt('Assign to employee (name):', 'Marco Reyes');
  if (!assignedEmployee) return;
  const teamLead = prompt('Team lead assigning this order:', 'Anna Cruz');
  await api(`/api/orders/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ assignedEmployee, teamLead }) });
  toast(`Assigned to ${assignedEmployee}`);
  refreshAll();
}

async function startHandling(id) {
  await api(`/api/orders/${id}/start`, { method: 'POST' });
  toast('Handling started');
  refreshAll();
}

async function endHandling(id) {
  const o = await api(`/api/orders/${id}/end`, { method: 'POST' });
  toast(`Handling ended — ${o.handlingMinutes} min (${o.slaStatus})`);
  refreshAll();
}

async function release(id) {
  await api(`/api/orders/${id}/release`, { method: 'POST' });
  toast('Order released');
  refreshAll();
}

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).classList.add('active');
  });
});

refreshAll();
