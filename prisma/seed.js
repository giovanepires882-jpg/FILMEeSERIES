const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')
  
  const adminEmail = process.env.ADMIN_EMAIL || 'giovanepires17@hotmail.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  
  // Criar admin
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  })
  
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12)
    
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'Administrador',
        role: 'ADMIN',
        termsAcceptedAt: new Date(),
      },
    })
    
    // Criar subscription para admin
    await prisma.subscription.create({
      data: {
        userId: admin.id,
        status: 'ACTIVE',
        startAt: new Date(),
        endAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
      },
    })
    
    console.log('✅ Admin criado:', admin.email)
  } else {
    console.log('ℹ️ Admin já existe:', adminEmail)
  }
  
  // Criar playlist source
  const source = await prisma.playlistSource.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Playlist Principal',
    },
  })
  
  console.log('✅ Playlist source criada')
  
  console.log('🎉 Seed concluído!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
