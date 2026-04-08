import axios from 'axios';
import { sendWhatsAppMessage } from './whatsapp.js';

/**
 * Delivery dispatch — provider-agnostic.
 * Supports: 'merchant_driver' (Option A), 'boxy' (Option B), extensible.
 * Configured per-merchant via delivery_provider field.
 */

const BOXY_BASE = process.env.BOXY_API_URL || 'https://api.tryboxy.com/v1';
const boxyHeaders = () => ({
  'Content-Type': 'application/json',
  'api-key': process.env.BOXY_API_KEY,
  'api-secret': process.env.BOXY_API_SECRET,
});

const DELIVERY_PROVIDERS = {
  // Option A: merchant's own driver
  merchant_driver: {
    async dispatch(order, merchant, phoneNumberId) {
      const driverPhone = merchant.driver_phone;
      if (!driverPhone) {
        await sendWhatsAppMessage(phoneNumberId, merchant.phone,
          `🛒 طلب جديد #${order.id?.slice(0,8)}!\n${order.items?.map(i => `• ${i.name} x${i.qty}`).join('\n')}\n📍 ${order.address}\n💰 ${(order.total_iqd||0).toLocaleString()} د\n👤 ${order.customer_name || order.customer_phone}`);
        return { dispatched: true, provider: 'merchant_driver', method: 'merchant_notified' };
      }
      await sendWhatsAppMessage(phoneNumberId, driverPhone,
        `🚚 توصيل جديد!\n📍 ${order.address}\n👤 ${order.customer_name || order.customer_phone}\n📞 ${order.customer_phone}\n🛒 ${order.items?.map(i => `${i.name} x${i.qty}`).join(', ')}\n💰 ${(order.total_iqd||0).toLocaleString()} د (كاش)`);
      await sendWhatsAppMessage(phoneNumberId, merchant.phone,
        `✅ طلب #${order.id?.slice(0,8)} تم إرساله للسائق`);
      return { dispatched: true, provider: 'merchant_driver', method: 'driver_notified' };
    },
    estimatedMinutes: 30,
    fee: 0,
  },

  // Option B: Boxy — 3PL aggregator (1500+ couriers in Iraq)
  boxy: {
    async dispatch(order, merchant, phoneNumberId) {
      const products = (order.items || []).map(i => ({
        name: i.name,
        quantity: i.qty || 1,
        price: i.price_iqd || 0,
      }));
      const payload = {
        service_type: 'same_day',
        pickup_address: merchant.address || merchant.neighborhood,
        pickup_phone: merchant.phone,
        pickup_name: merchant.name_ar || merchant.name,
        destination_address: order.address,
        destination_phone: order.customer_phone,
        destination_name: order.customer_name || order.customer_phone,
        cash_on_delivery: order.total_iqd || 0,
        currency: 'IQD',
        products,
        reference_id: order.id,
        notes: `بقالة order #${order.id?.slice(0,8)}`,
      };
      const res = await axios.post(`${BOXY_BASE}/merchants/orders`, payload, {
        headers: boxyHeaders(),
        timeout: 15000,
      });
      const boxyOrder = res.data;
      await sendWhatsAppMessage(phoneNumberId, merchant.phone,
        `✅ طلب #${order.id?.slice(0,8)} تم إرساله لـ Boxy\n🔖 رقم التتبع: ${boxyOrder.tracking_number || boxyOrder.id || 'pending'}`);
      return {
        dispatched: true,
        provider: 'boxy',
        boxy_order_id: boxyOrder.id,
        tracking_number: boxyOrder.tracking_number,
      };
    },
    estimatedMinutes: 45,
    fee: 3500,
  },
};

export async function dispatchDelivery(order, merchant, phoneNumberId) {
  const providerName = merchant.delivery_provider || 'merchant_driver';
  const provider = DELIVERY_PROVIDERS[providerName];
  if (!provider) {
    console.error(`Unknown delivery provider: ${providerName}`);
    return { dispatched: false, error: 'unknown_provider' };
  }
  try {
    return await provider.dispatch(order, merchant, phoneNumberId);
  } catch (err) {
    console.error(`Delivery dispatch error (${providerName}):`, err.message);
    await sendWhatsAppMessage(phoneNumberId, merchant.phone,
      `⚠️ طلب #${order.id?.slice(0,8)} — التوصيل التلقائي ما اشتغل. وصّله يدوياً.\n📍 ${order.address}\n📞 ${order.customer_phone}`);
    return { dispatched: false, error: err.message, fallback: 'merchant_notified' };
  }
}

export function getDeliveryFee(merchant) {
  const providerName = merchant.delivery_provider || 'merchant_driver';
  return DELIVERY_PROVIDERS[providerName]?.fee || 0;
}

export function getEstimatedTime(merchant) {
  const providerName = merchant.delivery_provider || 'merchant_driver';
  return DELIVERY_PROVIDERS[providerName]?.estimatedMinutes || 30;
}

/**
 * Handle Boxy webhook status updates.
 * Trigger statuses: order new, scheduled, out_for_collecting, collecting,
 * collected, received_warehouse, sorted, transferred_carrier, in_transit.
 */
const BOXY_STATUS_MAP = {
  'out_for_collecting': 'confirmed',
  'collecting': 'confirmed',
  'collected': 'confirmed',
  'in_transit': 'confirmed',
};

export async function handleBoxyWebhook(body) {
  const { reference_id, status, tracking_number } = body;
  if (!reference_id) return { handled: false, reason: 'no_reference_id' };
  const mappedStatus = BOXY_STATUS_MAP[status];
  return {
    handled: true,
    baqala_order_id: reference_id,
    boxy_status: status,
    mapped_status: mappedStatus || null,
    tracking_number,
  };
}

/**
 * Track a Boxy order by ID.
 */
export async function trackBoxyOrder(boxyOrderId) {
  try {
    const res = await axios.get(`${BOXY_BASE}/merchants/orders/${boxyOrderId}`, {
      headers: boxyHeaders(),
      timeout: 10000,
    });
    return res.data;
  } catch (err) {
    console.error('Boxy tracking error:', err.message);
    return null;
  }
}
