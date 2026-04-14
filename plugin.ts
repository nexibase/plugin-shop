export default {
  name: '쇼핑몰',
  description: '상품 판매, 주문, 결제 시스템',
  version: '1.0.0',
  author: 'nexibase',
  authorDomain: 'https://nexibase.com',
  repository: '',
  slug: 'shop',
  defaultEnabled: false,
  myPageMenus: [
    { label: 'nav.orders', icon: 'ClipboardList', subPath: '/mypage/orders' },
    { label: 'nav.wishlist', icon: 'Heart', subPath: '/mypage/wishlist' },
    { label: 'nav.addresses', icon: 'MapPin', subPath: '/mypage/addresses' },
  ],
}
