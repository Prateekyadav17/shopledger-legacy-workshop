'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const pricing = require('../lib/pricing');
const invoice = require('../lib/invoice');
const reports = require('../lib/reports');

test('invoice figures match the GST breakdown and total used to bill an order', function () {
  const items = [
    { id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, sku: 'TEA-1', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  const billed = pricing.computeTotals(items, 'WELCOME');
  const invoiceFigures = invoice.computeInvoiceFigures({
    id: 5,
    items: items,
    coupon: 'WELCOME'
  });

  assert.equal(invoiceFigures.subtotal, billed.subtotal);
  assert.equal(invoiceFigures.discount, billed.discount);
  assert.equal(invoiceFigures.tax, billed.tax);
  assert.equal(invoiceFigures.cgst, billed.cgst);
  assert.equal(invoiceFigures.sgst, billed.sgst);
  assert.equal(invoiceFigures.total, billed.total);
  assert.deepEqual(invoiceFigures.rows.map(function (row) {
    return { gstPercent: row.gstPercent, lineTax: row.lineTax };
  }), billed.lines.map(function (line) {
    return { gstPercent: line.gstPercent, lineTax: line.tax };
  }));
});

test('invoice HSN 1006 figures match the order pricing GST figures', function () {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const invoiceFigures = invoice.computeInvoiceFigures({
    id: 1,
    items: items,
    coupon: ''
  });

  assert.equal(billed.subtotal, 100);
  assert.equal(billed.tax, 5);
  assert.equal(billed.cgst, 2.5);
  assert.equal(billed.sgst, 2.5);
  assert.equal(billed.total, 105);

  assert.equal(invoiceFigures.subtotal, 100);
  assert.equal(invoiceFigures.rows[0].gstPercent, 5);
  assert.equal(invoiceFigures.rows[0].lineTax, 5);
  assert.equal(invoiceFigures.tax, 5);
  assert.equal(invoiceFigures.cgst, 2.5);
  assert.equal(invoiceFigures.sgst, 2.5);
  assert.equal(invoiceFigures.total, 105);
});

test('invoice percent coupon figures match the discount cap and tax used by order pricing', function () {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 2000, qty: 1 }];
  const billed = pricing.computeTotals(items, 'SAVE10');
  const invoiceFigures = invoice.computeInvoiceFigures({
    id: 2,
    items: items,
    coupon: 'SAVE10'
  });

  assert.equal(billed.discount, 150);
  assert.equal(billed.tax, 92.5);
  assert.equal(billed.total, 1942.5);

  assert.equal(invoiceFigures.tax, 92.5);
  assert.equal(invoiceFigures.discount, 150);
  assert.equal(invoiceFigures.total, 1942.5);
});

test('reconciliation reports no mismatch when invoice figures use the billed calculation', function () {
  const items = [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }];
  const billed = pricing.computeTotals(items, '');
  const result = reports.getGstReconciliation({
    orders: [{
      id: 3,
      date: '21/11/2026',
      customer: 'Walk-in',
      status: 'completed',
      items: items,
      coupon: '',
      subtotal: billed.subtotal,
      discount: billed.discount,
      tax: billed.tax,
      total: billed.total
    }]
  });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].ledgerTax, 5);
  assert.equal(result.rows[0].invoiceTax, 5);
  assert.equal(result.rows[0].ledgerTotal, 105);
  assert.equal(result.rows[0].invoiceTotal, 105);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});

test('rendered invoice omits the reconciliation notice when its total matches the billed total', function () {
  const html = invoice.render({
    id: 4,
    date: '21/11/2026',
    status: 'completed',
    customer: 'Walk-in',
    paymentMode: 'cash',
    coupon: '',
    total: 105,
    items: [{ id: 1, sku: 'RICE-1', name: 'Rice', hsn: '1006', price: 100, qty: 1 }]
  });

  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
  assert.match(html, /Invoice Total/);
  assert.match(html, /105\.00/);
});
