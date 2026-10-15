import { escapeHtml } from '@/lib/notifications/policy'
import { prisma } from '@/lib/prisma'
const getShopName = async (): Promise<string> => {
  try {
    const setting = await prisma.shopSetting.findUnique({
      where: { key: 'shop_name' }
    });
    return setting?.value || 'NexiBase Shop';
  } catch {
    return 'NexiBase Shop';
  }
};

/**
 * Send the order completion email (customer)
 */
export const renderOrderCompletedEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  totalAmount: number,
  items: { name: string; quantity: number; price: number }[]
) => {


  const shopName = await getShopName();

  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${escapeHtml(item.name)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}개</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price.toLocaleString()}원</td>
    </tr>
  `).join('');

  const mailOptions = {


    subject: `[${escapeHtml(shopName)}] 주문이 완료되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${escapeHtml(shopName)}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${escapeHtml(customerName)}</strong>님!<br>
          주문이 정상적으로 완료되었습니다.
        </p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>결제금액:</strong> ${totalAmount.toLocaleString()}원</p>
        </div>

        <h3 style="color: #333; margin-top: 30px;">주문 상품</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left;">상품명</th>
              <th style="padding: 10px; text-align: center;">수량</th>
              <th style="padding: 10px; text-align: right;">금액</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  return mailOptions
};

/**
 * Send the order status update email (customer)
 */
export const renderOrderStatusEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  newStatus: string,
  trackingNumber?: string
) => {


  const shopName = await getShopName();

  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const statusLabels: Record<string, string> = {
    paid: '결제 완료',
    preparing: '배송 준비중',
    shipping: '배송중',
    delivered: '배송 완료',
    cancelled: '주문 취소',
    refunded: '환불 완료',
  };

  const statusMessages: Record<string, string> = {
    paid: '결제가 완료되었습니다. 곧 배송 준비를 시작합니다.',
    preparing: '상품을 준비하고 있습니다. 잠시만 기다려주세요.',
    shipping: '상품이 발송되었습니다.',
    delivered: '상품이 배송 완료되었습니다. 이용해 주셔서 감사합니다.',
    cancelled: '주문이 취소되었습니다.',
    refunded: '환불이 완료되었습니다.',
  };

  const statusLabel = statusLabels[newStatus] || newStatus;
  const statusMessage = statusMessages[newStatus] || `주문 상태가 "${statusLabel}"(으)로 변경되었습니다.`;

  let trackingHtml = '';
  if (newStatus === 'shipping' && trackingNumber) {
    trackingHtml = `
      <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #333;"><strong>운송장 번호:</strong> ${escapeHtml(trackingNumber)}</p>
      </div>
    `;
  }

  const mailOptions = {


    subject: `[${escapeHtml(shopName)}] 주문 상태 안내 - ${statusLabel} (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${escapeHtml(shopName)}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${escapeHtml(customerName)}</strong>님!
        </p>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문 상태:</strong> ${statusLabel}</p>
        </div>

        <p style="color: #666; font-size: 15px; line-height: 1.6;">
          ${statusMessage}
        </p>

        ${trackingHtml}

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  return mailOptions
};

/**
 * Send the new order email (admin)
 */
export const renderNewOrderEmailToAdmin = async (
  adminEmail: string,
  orderNo: string,
  customerName: string,
  totalAmount: number
) => {


  const shopName = await getShopName();

  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/shop/orders/${orderNo}`;

  const mailOptions = {


    subject: `[${escapeHtml(shopName)}] 새 주문이 접수되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${escapeHtml(shopName)} - 관리자 알림</h2>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin: 0 0 10px; color: #856404;">🛒 새 주문 접수</h3>
          <p style="margin: 0; color: #856404;">
            <strong>${escapeHtml(customerName)}</strong>님이 새로운 주문을 접수했습니다.
          </p>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문자:</strong> ${escapeHtml(customerName)}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>결제금액:</strong> ${totalAmount.toLocaleString()}원</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 확인하기
          </a>
        </div>
      </div>
    `,
  };

  return mailOptions
};

/**
 * Send the order cancellation email (customer)
 */
export const renderOrderCancelledEmail = async (
  email: string,
  customerName: string,
  orderNo: string,
  refundAmount: number,
  cancelReason: string
) => {


  const shopName = await getShopName();

  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shop/orders/${orderNo}`;

  const mailOptions = {


    subject: `[${escapeHtml(shopName)}] 주문이 취소되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${escapeHtml(shopName)}</h2>
        <p style="color: #666; font-size: 16px; line-height: 1.6;">
          안녕하세요, <strong>${escapeHtml(customerName)}</strong>님!<br>
          요청하신 주문이 취소되었습니다.
        </p>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="margin: 0 0 10px; color: #dc2626;">❌ 주문 취소 완료</h3>
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>취소 사유:</strong> ${escapeHtml(cancelReason)}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>환불 금액:</strong> ${refundAmount.toLocaleString()}원</p>
        </div>

        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          카드 결제의 경우 카드사에 따라 3~5 영업일 내에 환불이 진행됩니다.
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 상세 보기
          </a>
        </div>

        <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
          본 메일은 발신전용입니다.
        </p>
      </div>
    `,
  };

  return mailOptions
};

/**
 * Send the order cancellation email (admin)
 */
export const renderOrderCancelledEmailToAdmin = async (
  adminEmail: string,
  orderNo: string,
  customerName: string,
  refundAmount: number,
  cancelReason: string
) => {


  const shopName = await getShopName();

  const orderUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/shop/orders/${orderNo}`;

  const mailOptions = {


    subject: `[${escapeHtml(shopName)}] 주문이 취소되었습니다 (${orderNo})`,
    html: `
      <div style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #333; padding-bottom: 10px;">${escapeHtml(shopName)} - 관리자 알림</h2>

        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h3 style="margin: 0 0 10px; color: #dc2626;">❌ 주문 취소</h3>
          <p style="margin: 0; color: #991b1b;">
            <strong>${escapeHtml(customerName)}</strong>님의 주문이 취소되었습니다.
          </p>
        </div>

        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #333;"><strong>주문번호:</strong> ${orderNo}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>주문자:</strong> ${escapeHtml(customerName)}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>취소 사유:</strong> ${escapeHtml(cancelReason)}</p>
          <p style="margin: 10px 0 0; color: #333;"><strong>환불 금액:</strong> ${refundAmount.toLocaleString()}원</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${orderUrl}"
             style="background-color: #333; color: white; padding: 12px 30px;
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            주문 확인하기
          </a>
        </div>
      </div>
    `,
  };

  return mailOptions
};
