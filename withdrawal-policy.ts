export default [
  { model: 'Order',         policy: 'retain',
    reason: '전자상거래법 — 계약/결제/재화공급 기록 5년 보관 의무' },
  { model: 'OrderItem',     policy: 'retain-via-parent', parent: 'Order' },
  { model: 'OrderActivity', policy: 'retain-via-parent', parent: 'Order' },
  { model: 'ProductReview', policy: 'retain',
    reason: 'Public review; aggregates preserved; anonymized via User join' },
  { model: 'ProductQna',    policy: 'retain',
    reason: 'Product info with admin replies; anonymized via User join' },
  { model: 'Wishlist',      policy: 'delete' },
  { model: 'PendingOrder',  policy: 'delete' },
]
