import crypto from 'crypto'
import axios from 'axios'

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL

export async function createPixPayment({ userId, amount, planDays }) {
  try {
    const response = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      {
        transaction_amount: parseFloat(amount),
        description: `Assinatura ${planDays} dias - VOD Streaming`,
        payment_method_id: 'pix',
        external_reference: `${userId}:plan${planDays}`,
        metadata: {
          userId,
          planDays,
        },
        notification_url: `${APP_BASE_URL}/api/webhooks/mercadopago`,
        payer: {
          email: 'user@example.com',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `${userId}-${Date.now()}`,
        },
      }
    )
    
    return {
      id: response.data.id,
      status: response.data.status,
      qrCodeBase64: response.data.point_of_interaction?.transaction_data?.qr_code_base64,
      qrCodeText: response.data.point_of_interaction?.transaction_data?.qr_code,
    }
  } catch (error) {
    console.error('Mercado Pago API Error:', error.response?.data || error.message)
    throw new Error('Failed to create payment')
  }
}

export async function getPaymentDetails(paymentId) {
  try {
    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        },
      }
    )
    
    return response.data
  } catch (error) {
    console.error('Mercado Pago API Error:', error.response?.data || error.message)
    throw new Error('Failed to fetch payment details')
  }
}

export function validateWebhookSignature({ xSignature, xRequestId, resourceId, body }) {
  if (!MP_WEBHOOK_SECRET) {
    console.warn('MP_WEBHOOK_SECRET not configured, skipping signature validation')
    return true
  }
  
  try {
    // Parse signature: "ts=1234567890,v1=abc123"
    const parts = xSignature.split(',')
    let ts, v1
    
    parts.forEach(part => {
      const [key, value] = part.split('=')
      if (key === 'ts') ts = value
      if (key === 'v1') v1 = value
    })
    
    if (!ts || !v1) {
      console.error('Missing ts or v1 in signature')
      return false
    }
    
    // Create manifest: id:resourceId;request-id:xRequestId;ts:ts;
    const manifest = `id:${resourceId};request-id:${xRequestId};ts:${ts};`
    
    // Calculate HMAC SHA256
    const hmac = crypto.createHmac('sha256', MP_WEBHOOK_SECRET)
    hmac.update(manifest)
    const calculatedSignature = hmac.digest('hex')
    
    // Compare using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(v1, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    )
  } catch (error) {
    console.error('Signature validation error:', error.message)
    return false
  }
}