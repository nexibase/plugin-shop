export default [
  { label: 'adminMenu.shop', icon: 'ShoppingBag', isGroup: true, children: [
    { label: 'adminMenu.dashboard', icon: 'BarChart3', path: '/admin/shop' },
    { label: 'adminMenu.products', icon: 'Package', path: '/admin/shop/products' },
    { label: 'adminMenu.categories', icon: 'ShoppingBag', path: '/admin/shop/categories' },
    { label: 'adminMenu.orders', icon: 'ClipboardList', path: '/admin/shop/orders' },
    { label: 'adminMenu.sales', icon: 'TrendingUp', path: '/admin/shop/sales' },
    { label: 'adminMenu.reviews', icon: 'Star', path: '/admin/shop/reviews' },
    { label: 'adminMenu.qna', icon: 'MessageSquare', path: '/admin/shop/qna' },
    { label: 'adminMenu.delivery', icon: 'Truck', path: '/admin/shop/delivery' },
    { label: 'adminMenu.settings', icon: 'Settings', path: '/admin/shop/settings' },
  ]},
]
