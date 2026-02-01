const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixSubscriptions() {
  console.log('🔧 Corrigindo assinaturas...')
  
  // Buscar todos os pagamentos APROVADOS
  const approvedPayments = await prisma.payment.findMany({
    where: { status: 'APPROVED' },
    include: { user: { include: { subscription: true } } }
  })
  
  console.log(`📊 Encontrados ${approvedPayments.length} pagamentos aprovados`)
  
  for (const payment of approvedPayments) {
    const sub = payment.user.subscription
    
    // Se a assinatura não está ativa, ativar
    if (sub && sub.status !== 'ACTIVE') {
      const now = new Date()
      const endAt = new Date(now)
      endAt.setDate(endAt.getDate() + payment.planDays)
      
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'ACTIVE',
          startAt: payment.paidAt || payment.createdAt,
          endAt: endAt
        }
      })
      
      console.log(`✅ Assinatura ativada para: ${payment.user.email} (até ${endAt.toISOString()})`)
    } else if (sub && sub.status === 'ACTIVE') {
      console.log(`ℹ️  Assinatura já ativa: ${payment.user.email}`)
    }
  }
  
  console.log('✨ Concluído!')
  await prisma.$disconnect()
}

fixSubscriptions().catch(console.error)
