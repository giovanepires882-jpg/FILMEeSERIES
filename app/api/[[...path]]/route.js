// Runtime para suportar crypto e HMAC
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import * as auth from '@/lib/auth'
import * as subscription from '@/lib/subscription'
import * as mp from '@/lib/mercadopago'
import { fetchAndParseM3U } from '@/lib/m3u-parser'
import { z } from 'zod'
import crypto from 'crypto'

// ============ HEALTH & READY ============
async function handleHealth() {
  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() })
}

async function handleReady() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ready', database: 'connected' })
  } catch (error) {
    return NextResponse.json({ status: 'error', database: 'disconnected' }, { status: 503 })
  }
}

// ============ AUTH ============
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  acceptTerms: z.boolean(),
})

async function handleRegister(req) {
  try {
    const body = await req.json()
    const { email, password, name, acceptTerms } = registerSchema.parse(body)
    
    if (!acceptTerms) {
      return NextResponse.json({ error: 'Você deve aceitar os termos' }, { status: 400 })
    }
    
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: 'Email já cadastrado' }, { status: 400 })
    }
    
    const passwordHash = await auth.hashPassword(password)
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: 'USER',
        termsAcceptedAt: new Date(),
        subscription: {
          create: {
            status: 'INACTIVE',
          },
        },
      },
    })
    
    const accessToken = auth.generateAccessToken(user.id, user.role)
    const refreshToken = auth.generateRefreshToken()
    await auth.saveRefreshToken(user.id, refreshToken)
    
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    
    auth.setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    console.error('Register error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao criar conta' }, { status: 500 })
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

async function handleLogin(req) {
  try {
    const body = await req.json()
    const { email, password } = loginSchema.parse(body)
    
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    
    const valid = await auth.verifyPassword(password, user.passwordHash)
    if (!valid) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 })
    }
    
    const accessToken = auth.generateAccessToken(user.id, user.role)
    const refreshToken = auth.generateRefreshToken()
    await auth.saveRefreshToken(user.id, refreshToken)
    
    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    })
    
    auth.setAuthCookies(response, accessToken, refreshToken)
    return response
  } catch (error) {
    console.error('Login error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao fazer login' }, { status: 500 })
  }
}

async function handleRefresh(req) {
  try {
    const refreshToken = req.cookies.get('refreshToken')?.value
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
    }
    
    const decoded = await auth.verifyRefreshToken(refreshToken)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    
    // Encontrar sessão válida
    const session = await auth.findValidSession(decoded.userId || '', refreshToken)
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 401 })
    }
    
    // Revogar sessão antiga
    await auth.revokeSession(session.id)
    
    // Criar nova
    const user = await prisma.user.findUnique({ where: { id: session.userId } })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }
    
    const newAccessToken = auth.generateAccessToken(user.id, user.role)
    const newRefreshToken = auth.generateRefreshToken()
    await auth.saveRefreshToken(user.id, newRefreshToken)
    
    const response = NextResponse.json({ success: true })
    auth.setAuthCookies(response, newAccessToken, newRefreshToken)
    return response
  } catch (error) {
    console.error('Refresh error:', error)
    return NextResponse.json({ error: 'Failed to refresh' }, { status: 500 })
  }
}

async function handleLogout(req) {
  try {
    const user = await auth.getCurrentUser(req)
    if (user) {
      await auth.revokeAllUserSessions(user.id)
    }
    
    const response = NextResponse.json({ success: true })
    auth.clearAuthCookies(response)
    return response
  } catch (error) {
    const response = NextResponse.json({ success: true })
    auth.clearAuthCookies(response)
    return response
  }
}

async function handleMe(req) {
  try {
    const user = await auth.getCurrentUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const sub = await subscription.getSubscriptionInfo(user.id)
    
    return NextResponse.json({
      user,
      subscription: sub,
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}

// ============ CATEGORIES ============
async function handleGetCategories() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: { vods: { where: { isActive: true } } },
        },
      },
    })
    
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('Categories error:', error)
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
  }
}

// ============ VODS ============
async function handleGetVods(req) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50) // Max 50
    
    const where = {
      isActive: true,
      ...(q && {
        title: {
          contains: q,
          mode: 'insensitive',
        },
      }),
      ...(category && {
        category: {
          slug: category,
        },
      }),
    }
    
    // Se tem busca, limitar a 100 resultados para velocidade
    const maxResults = q ? 100 : undefined
    
    const [vods, total] = await Promise.all([
      prisma.vodItem.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          posterUrl: true,
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: maxResults ? Math.min(limit, maxResults) : limit,
      }),
      // Count otimizado - se busca, limitar
      q ? Promise.resolve(Math.min(await prisma.vodItem.count({ where }), maxResults)) : prisma.vodItem.count({ where }),
    ])
    
    return NextResponse.json({
      vods,
      pagination: {
        page,
        limit,
        total: Math.min(total, maxResults || total),
        totalPages: Math.ceil(Math.min(total, maxResults || total) / limit),
      },
    })
  } catch (error) {
    console.error('VODs error:', error)
    return NextResponse.json({ error: 'Failed to fetch VODs' }, { status: 500 })
  }
}

async function handleGetVodById(vodId) {
  try {
    const vod = await prisma.vodItem.findUnique({
      where: { id: vodId },
      select: {
        id: true,
        title: true,
        description: true,
        posterUrl: true,
        isActive: true,
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        createdAt: true,
      },
    })
    
    if (!vod || !vod.isActive) {
      return NextResponse.json({ error: 'VOD not found' }, { status: 404 })
    }
    
    return NextResponse.json({ vod })
  } catch (error) {
    console.error('VOD by ID error:', error)
    return NextResponse.json({ error: 'Failed to fetch VOD' }, { status: 500 })
  }
}

// ============ STREAM (GATING) ============
async function handleGetStream(req, vodId) {
  try {
    const user = await auth.requireAuth(req)
    
    // Check subscription
    const hasAccess = await subscription.checkActiveSubscription(user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Assinatura inativa ou expirada' }, { status: 403 })
    }
    
    // Get VOD
    const vod = await prisma.vodItem.findUnique({
      where: { id: vodId },
      select: { streamUrl: true, isActive: true },
    })
    
    if (!vod || !vod.isActive) {
      return NextResponse.json({ error: 'VOD not found' }, { status: 404 })
    }
    
    return NextResponse.json({ url: vod.streamUrl })
  } catch (error) {
    console.error('Stream error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to get stream' }, { status: 500 })
  }
}

// ============ PROGRESS ============
async function handleGetProgress(req) {
  try {
    const user = await auth.requireAuth(req)
    
    const progress = await prisma.watchProgress.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        vod: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            category: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    })
    
    return NextResponse.json({ progress })
  } catch (error) {
    console.error('Progress error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch progress' }, { status: 500 })
  }
}

const progressSchema = z.object({
  positionSeconds: z.number().min(0),
  durationSeconds: z.number().min(0),
})

async function handleSaveProgress(req, vodId) {
  try {
    const user = await auth.requireAuth(req)
    const body = await req.json()
    const { positionSeconds, durationSeconds } = progressSchema.parse(body)
    
    const progress = await prisma.watchProgress.upsert({
      where: {
        userId_vodId: {
          userId: user.id,
          vodId,
        },
      },
      update: {
        positionSeconds,
        durationSeconds,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        vodId,
        positionSeconds,
        durationSeconds,
      },
    })
    
    return NextResponse.json({ success: true, progress })
  } catch (error) {
    console.error('Save progress error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Failed to save progress' }, { status: 500 })
  }
}

// ============ FAVORITES ============
async function handleGetFavorites(req) {
  try {
    const user = await auth.requireAuth(req)
    
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        vod: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            category: {
              select: { name: true, slug: true },
            },
          },
        },
      },
    })
    
    return NextResponse.json({ favorites })
  } catch (error) {
    console.error('Favorites error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
  }
}

async function handleAddFavorite(req, vodId) {
  try {
    const user = await auth.requireAuth(req)
    
    const favorite = await prisma.favorite.create({
      data: {
        userId: user.id,
        vodId,
      },
    })
    
    return NextResponse.json({ success: true, favorite })
  } catch (error) {
    console.error('Add favorite error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to add favorite' }, { status: 500 })
  }
}

async function handleRemoveFavorite(req, vodId) {
  try {
    const user = await auth.requireAuth(req)
    
    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        vodId,
      },
    })
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove favorite error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to remove favorite' }, { status: 500 })
  }
}

// ============ BILLING ============
async function handlePixCheckout(req) {
  try {
    const user = await auth.requireAuth(req)
    
    if (!user.termsAcceptedAt) {
      return NextResponse.json({ error: 'Você deve aceitar os termos' }, { status: 400 })
    }
    
    // Idempotência: verificar se existe pagamento PENDING recente (últimos 15 min)
    const recentPayment = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        status: 'PENDING',
        createdAt: {
          gte: new Date(Date.now() - 15 * 60 * 1000),
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    if (recentPayment && recentPayment.qrCodeBase64) {
      return NextResponse.json({
        mpPaymentId: recentPayment.mpPaymentId,
        qrCodeBase64: recentPayment.qrCodeBase64,
        qrCodeText: recentPayment.qrCodeText,
        amount: recentPayment.amount.toString(),
        status: recentPayment.status,
      })
    }
    
    // Criar novo pagamento
    const amount = parseFloat(process.env.SUBSCRIPTION_PRICE || '15.00')
    const planDays = parseInt(process.env.SUBSCRIPTION_DAYS || '30')
    
    const mpPayment = await mp.createPixPayment({
      userId: user.id,
      amount,
      planDays,
    })
    
    // Salvar no DB
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        mpPaymentId: mpPayment.id.toString(),
        amount,
        planDays,
        status: 'PENDING',
        qrCodeBase64: mpPayment.qrCodeBase64,
        qrCodeText: mpPayment.qrCodeText,
      },
    })
    
    return NextResponse.json({
      mpPaymentId: payment.mpPaymentId,
      qrCodeBase64: payment.qrCodeBase64,
      qrCodeText: payment.qrCodeText,
      amount: payment.amount.toString(),
      status: payment.status,
    })
  } catch (error) {
    console.error('PIX checkout error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erro ao criar pagamento' }, { status: 500 })
  }
}

async function handleBillingStatus(req) {
  try {
    const user = await auth.requireAuth(req)
    const { searchParams } = new URL(req.url)
    const mpPaymentId = searchParams.get('mpPaymentId')
    
    if (!mpPaymentId) {
      return NextResponse.json({ error: 'Missing mpPaymentId' }, { status: 400 })
    }
    
    const payment = await prisma.payment.findUnique({
      where: { mpPaymentId },
    })
    
    if (!payment || payment.userId !== user.id) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    
    // Opcional: consultar MP se ainda PENDING
    if (payment.status === 'PENDING') {
      try {
        const mpDetails = await mp.getPaymentDetails(mpPaymentId)
        if (mpDetails.status !== payment.status) {
          // Atualizar
          const updated = await prisma.payment.update({
            where: { mpPaymentId },
            data: { status: mpDetails.status.toUpperCase() },
          })
          return NextResponse.json({ payment: updated })
        }
      } catch (err) {
        console.error('Error fetching MP status:', err)
      }
    }
    
    return NextResponse.json({ payment })
  } catch (error) {
    console.error('Billing status error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to get billing status' }, { status: 500 })
  }
}

async function handleGetPayments(req) {
  try {
    const user = await auth.requireAuth(req)
    
    const payments = await prisma.payment.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        mpPaymentId: true,
        amount: true,
        planDays: true,
        status: true,
        createdAt: true,
        paidAt: true,
      },
    })
    
    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Get payments error:', error)
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}

// ============ WEBHOOK MERCADO PAGO ============
async function handleMercadoPagoWebhook(req) {
  try {
    const body = await req.json()
    const xSignature = req.headers.get('x-signature')
    const xRequestId = req.headers.get('x-request-id')
    
    console.log('🔔 Webhook received:', JSON.stringify({ body, xSignature, xRequestId }, null, 2))
    
    // Extrair resourceId
    const resourceId = body.data?.id || body.id
    if (!resourceId) {
      console.error('❌ No resourceId in webhook')
      return NextResponse.json({ error: 'No resourceId' }, { status: 400 })
    }
    
    console.log('📋 Processing payment ID:', resourceId)
    
    // Validar assinatura
    if (xSignature && xRequestId) {
      const isValid = mp.validateWebhookSignature({
        xSignature,
        xRequestId,
        resourceId: resourceId.toString(),
        body,
      })
      
      if (!isValid) {
        console.error('❌ Invalid signature')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
      console.log('✅ Signature validated')
    } else {
      console.warn('⚠️ No signature headers, skipping validation')
    }
    
    // Idempotência
    const action = body.action || 'payment.updated'
    const eventKey = `${xRequestId || 'no-req-id'}:${action}:${resourceId}`
    
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { eventKey },
    })
    
    if (existingEvent) {
      console.log('ℹ️ Event already processed:', eventKey)
      return NextResponse.json({ success: true, message: 'Already processed' })
    }
    
    // Salvar evento (JSON como string)
    await prisma.webhookEvent.create({
      data: {
        provider: 'mercadopago',
        requestId: xRequestId || 'unknown',
        resourceId: resourceId.toString(),
        action,
        eventKey,
        rawJson: JSON.stringify(body),
        receivedAt: new Date(),
      },
    })
    console.log('💾 Event saved')
    
    // Se for evento de teste, retornar sem processar
    if (body.type === 'test' || action.startsWith('test.')) {
      console.log('🧪 Test event, skipping processing')
      return NextResponse.json({ success: true, message: 'Test event received' })
    }
    
    // Consultar pagamento no MP
    console.log('🔍 Fetching payment details from MP...')
    const mpPayment = await mp.getPaymentDetails(resourceId)
    console.log('📦 MP Payment:', JSON.stringify({
      id: mpPayment.id,
      status: mpPayment.status,
      metadata: mpPayment.metadata,
      external_reference: mpPayment.external_reference
    }, null, 2))
    
    // Encontrar pagamento interno
    const payment = await prisma.payment.findUnique({
      where: { mpPaymentId: resourceId.toString() },
    })
    
    if (!payment) {
      console.error('❌ Payment not found in DB:', resourceId)
      return NextResponse.json({ success: true, message: 'Payment not found locally' })
    }
    
    console.log('💳 Local payment found:', {
      id: payment.id,
      userId: payment.userId,
      currentStatus: payment.status,
      planDays: payment.planDays
    })
    
    // Atualizar status
    const newStatus = mpPayment.status.toUpperCase()
    console.log(`🔄 Updating payment status: ${payment.status} → ${newStatus}`)
    
    await prisma.payment.update({
      where: { mpPaymentId: resourceId.toString() },
      data: {
        status: newStatus,
        ...(newStatus === 'APPROVED' && { paidAt: new Date() }),
      },
    })
    
    // Se aprovado, ativar assinatura
    if (newStatus === 'APPROVED') {
      console.log('✅ Payment APPROVED! Activating subscription...')
      try {
        const activatedSub = await subscription.activateSubscription(payment.userId, payment.planDays)
        console.log('🎉 Subscription activated!', {
          userId: payment.userId,
          status: activatedSub.status,
          endAt: activatedSub.endAt
        })
      } catch (error) {
        console.error('❌ Error activating subscription:', error)
        throw error
      }
    }
    
    // Se refund/chargeback, suspender
    if (['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(newStatus)) {
      console.log('⚠️ Payment refunded/cancelled, suspending subscription')
      await subscription.suspendSubscription(payment.userId)
      console.log('🚫 Subscription suspended for user:', payment.userId)
    }
    
    // Marcar evento como processado
    await prisma.webhookEvent.updateMany({
      where: { eventKey },
      data: { processedAt: new Date() },
    })
    
    console.log('✅ Webhook processed successfully!')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('❌ Webhook processing error:', error)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}

// ============ ADMIN ============
async function handleAdminSync(req) {
  try {
    const user = await auth.requireAdmin(req)
    
    const m3uUrl = process.env.M3U_URL
    if (!m3uUrl) {
      return NextResponse.json({ error: 'M3U_URL not configured' }, { status: 500 })
    }
    
    const startedAt = new Date()
    let syncLog
    
    try {
      // Parse M3U
      const items = await fetchAndParseM3U(m3uUrl)
      console.log(`Parsed ${items.length} items from M3U`)
      
      let itemsUpserted = 0
      let itemsInactivated = 0
      
      const externalIds = new Set()
      
      // Upsert items
      for (const item of items) {
        externalIds.add(item.externalId)
        
        // Upsert category
        const category = await prisma.category.upsert({
          where: { slug: item.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
          update: { name: item.category },
          create: {
            name: item.category,
            slug: item.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          },
        })
        
        // Upsert VOD
        await prisma.vodItem.upsert({
          where: { externalId: item.externalId },
          update: {
            title: item.title,
            posterUrl: item.posterUrl,
            categoryId: category.id,
            streamUrl: item.streamUrl,
            isActive: true,
          },
          create: {
            externalId: item.externalId,
            title: item.title,
            posterUrl: item.posterUrl,
            categoryId: category.id,
            streamUrl: item.streamUrl,
            isActive: true,
          },
        })
        
        itemsUpserted++
      }
      
      // Inativar itens que sumiram
      const inactivated = await prisma.vodItem.updateMany({
        where: {
          externalId: { notIn: Array.from(externalIds) },
          isActive: true,
        },
        data: { isActive: false },
      })
      
      itemsInactivated = inactivated.count
      
      syncLog = await prisma.syncLog.create({
        data: {
          startedAt,
          finishedAt: new Date(),
          itemsUpserted,
          itemsInactivated,
          status: 'SUCCESS',
          message: `Synced ${itemsUpserted} items, inactivated ${itemsInactivated}`,
        },
      })
      
      return NextResponse.json({ success: true, syncLog })
    } catch (error) {
      console.error('Sync error:', error)
      
      syncLog = await prisma.syncLog.create({
        data: {
          startedAt,
          finishedAt: new Date(),
          itemsUpserted: 0,
          itemsInactivated: 0,
          status: 'FAIL',
          message: error.message,
        },
      })
      
      return NextResponse.json({ error: 'Sync failed', details: error.message, syncLog }, { status: 500 })
    }
  } catch (error) {
    console.error('Admin sync error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }
}

async function handleAdminSyncLogs(req) {
  try {
    const user = await auth.requireAdmin(req)
    
    const logs = await prisma.syncLog.findMany({
      orderBy: { startedAt: 'desc' },
      take: 50,
    })
    
    return NextResponse.json({ logs })
  } catch (error) {
    console.error('Admin sync logs error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 })
  }
}

async function handleAdminUsers(req) {
  try {
    const user = await auth.requireAdmin(req)
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        subscription: {
          select: {
            status: true,
            startAt: true,
            endAt: true,
          },
        },
        _count: {
          select: {
            payments: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Admin users error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

async function handleAdminToggleVod(req) {
  try {
    const user = await auth.requireAdmin(req)
    const body = await req.json()
    const { vodId, isActive } = body
    
    if (!vodId) {
      return NextResponse.json({ error: 'vodId required' }, { status: 400 })
    }
    
    const vod = await prisma.vodItem.update({
      where: { id: vodId },
      data: { isActive: !!isActive },
    })
    
    return NextResponse.json({ success: true, vod })
  } catch (error) {
    console.error('Admin toggle VOD error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to toggle VOD' }, { status: 500 })
  }
}

async function handleAdminDeleteVods(req) {
  try {
    const user = await auth.requireAdmin(req)
    const body = await req.json()
    const { categoryId, deleteAll } = body
    
    if (deleteAll) {
      // Deletar todos os VODs
      const result = await prisma.vodItem.deleteMany({})
      return NextResponse.json({ success: true, deleted: result.count })
    } else if (categoryId) {
      // Deletar por categoria
      const result = await prisma.vodItem.deleteMany({
        where: { categoryId }
      })
      return NextResponse.json({ success: true, deleted: result.count })
    } else {
      return NextResponse.json({ error: 'Specify categoryId or deleteAll' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin delete VODs error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to delete VODs' }, { status: 500 })
  }
}

async function handleAdminSyncWithUrl(req) {
  try {
    const user = await auth.requireAdmin(req)
    const body = await req.json()
    const { m3uUrl } = body
    
    if (!m3uUrl) {
      return NextResponse.json({ error: 'M3U URL required' }, { status: 400 })
    }
    
    const startedAt = new Date()
    
    try {
      // Parse M3U
      const items = await fetchAndParseM3U(m3uUrl)
      console.log(`Parsed ${items.length} items from M3U`)
      
      let itemsUpserted = 0
      let itemsInactivated = 0
      
      const externalIds = new Set()
      
      // Upsert items
      for (const item of items) {
        externalIds.add(item.externalId)
        
        // Upsert category
        const category = await prisma.category.upsert({
          where: { slug: item.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
          update: { name: item.category },
          create: {
            name: item.category,
            slug: item.category.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          },
        })
        
        // Upsert VOD
        await prisma.vodItem.upsert({
          where: { externalId: item.externalId },
          update: {
            title: item.title,
            posterUrl: item.posterUrl,
            categoryId: category.id,
            streamUrl: item.streamUrl,
            isActive: true,
          },
          create: {
            externalId: item.externalId,
            title: item.title,
            posterUrl: item.posterUrl,
            categoryId: category.id,
            streamUrl: item.streamUrl,
            isActive: true,
          },
        })
        
        itemsUpserted++
      }
      
      // Inativar itens que sumiram
      const inactivated = await prisma.vodItem.updateMany({
        where: {
          externalId: { notIn: Array.from(externalIds) },
          isActive: true,
        },
        data: { isActive: false },
      })
      
      itemsInactivated = inactivated.count
      
      const syncLog = await prisma.syncLog.create({
        data: {
          startedAt,
          finishedAt: new Date(),
          itemsUpserted,
          itemsInactivated,
          status: 'SUCCESS',
          message: `Synced ${itemsUpserted} items, inactivated ${itemsInactivated}`,
        },
      })
      
      return NextResponse.json({ success: true, syncLog })
    } catch (error) {
      console.error('Sync error:', error)
      
      const syncLog = await prisma.syncLog.create({
        data: {
          startedAt,
          finishedAt: new Date(),
          itemsUpserted: 0,
          itemsInactivated: 0,
          status: 'FAIL',
          message: error.message,
        },
      })
      
      return NextResponse.json({ error: 'Sync failed', details: error.message, syncLog }, { status: 500 })
    }
  } catch (error) {
    console.error('Admin sync with URL error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 })
  }
}

async function handleAdminGetVods(req) {
  try {
    const user = await auth.requireAdmin(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const categoryId = searchParams.get('categoryId') || ''
    
    const where = categoryId ? { categoryId } : {}
    
    const [vods, total] = await Promise.all([
      prisma.vodItem.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vodItem.count({ where }),
    ])
    
    return NextResponse.json({
      vods,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error('Admin get VODs error:', error)
    if (error.message === 'Unauthorized' || error.message === 'Forbidden: Admin only') {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    return NextResponse.json({ error: 'Failed to get VODs' }, { status: 500 })
  }
}

// ============ ROUTER ============
export async function GET(req, { params }) {
  const path = params.path?.join('/') || ''
  
  // Health
  if (path === 'health') return handleHealth()
  if (path === 'ready') return handleReady()
  
  // Auth
  if (path === 'me') return handleMe(req)
  
  // Categories
  if (path === 'categories') return handleGetCategories()
  
  // VODs
  if (path === 'vods') return handleGetVods(req)
  if (path.startsWith('vods/') && path.split('/').length === 2) {
    const vodId = path.split('/')[1]
    return handleGetVodById(vodId)
  }
  
  // Stream
  if (path.startsWith('stream/') && path.split('/').length === 2) {
    const vodId = path.split('/')[1]
    return handleGetStream(req, vodId)
  }
  
  // Progress
  if (path === 'progress') return handleGetProgress(req)
  
  // Favorites
  if (path === 'favorites') return handleGetFavorites(req)
  
  // Billing
  if (path === 'billing/status') return handleBillingStatus(req)
  if (path === 'billing/payments') return handleGetPayments(req)
  
  // Admin
  if (path === 'admin/sync/logs') return handleAdminSyncLogs(req)
  if (path === 'admin/users') return handleAdminUsers(req)
  if (path === 'admin/vods') return handleAdminGetVods(req)
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function POST(req, { params }) {
  const path = params.path?.join('/') || ''
  
  // Auth
  if (path === 'auth/register') return handleRegister(req)
  if (path === 'auth/login') return handleLogin(req)
  if (path === 'auth/refresh') return handleRefresh(req)
  if (path === 'auth/logout') return handleLogout(req)
  
  // Progress
  if (path.startsWith('progress/') && path.split('/').length === 2) {
    const vodId = path.split('/')[1]
    return handleSaveProgress(req, vodId)
  }
  
  // Favorites
  if (path.startsWith('favorites/') && path.split('/').length === 2) {
    const vodId = path.split('/')[1]
    return handleAddFavorite(req, vodId)
  }
  
  // Billing
  if (path === 'billing/pix/checkout') return handlePixCheckout(req)
  
  // Webhook
  if (path === 'webhooks/mercadopago') return handleMercadoPagoWebhook(req)
  
  // Admin
  if (path === 'admin/playlist/sync') return handleAdminSync(req)
  if (path === 'admin/playlist/sync-url') return handleAdminSyncWithUrl(req)
  if (path === 'admin/vod/toggle') return handleAdminToggleVod(req)
  if (path === 'admin/vods/delete') return handleAdminDeleteVods(req)
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export async function DELETE(req, { params }) {
  const path = params.path?.join('/') || ''
  
  // Favorites
  if (path.startsWith('favorites/') && path.split('/').length === 2) {
    const vodId = path.split('/')[1]
    return handleRemoveFavorite(req, vodId)
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}