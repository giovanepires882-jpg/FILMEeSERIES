import prisma from './prisma'

export async function checkActiveSubscription(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })
  
  if (!subscription) return false
  
  if (subscription.status !== 'ACTIVE') return false
  
  if (!subscription.endAt) return false
  
  if (subscription.endAt <= new Date()) {
    // Expirou, atualizar status
    await prisma.subscription.update({
      where: { userId },
      data: { status: 'EXPIRED' },
    })
    return false
  }
  
  return true
}

export async function activateSubscription(userId, days = 30) {
  const now = new Date()
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })
  
  if (!subscription) {
    throw new Error('Subscription not found')
  }
  
  let newEndAt
  
  // Se já está ativo e não expirou, estender
  if (subscription.status === 'ACTIVE' && subscription.endAt && subscription.endAt > now) {
    newEndAt = new Date(subscription.endAt)
    newEndAt.setDate(newEndAt.getDate() + days)
  } else {
    // Nova ativação
    newEndAt = new Date(now)
    newEndAt.setDate(newEndAt.getDate() + days)
  }
  
  return prisma.subscription.update({
    where: { userId },
    data: {
      status: 'ACTIVE',
      startAt: subscription.startAt || now,
      endAt: newEndAt,
    },
  })
}

export async function suspendSubscription(userId) {
  return prisma.subscription.update({
    where: { userId },
    data: { status: 'SUSPENDED' },
  })
}

export async function getSubscriptionInfo(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  })
  
  if (!subscription) return null
  
  const isActive = await checkActiveSubscription(userId)
  
  return {
    ...subscription,
    isActive,
  }
}