import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import prisma from './prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this'
const JWT_ACCESS_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m'
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '30d'

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function generateAccessToken(userId, role) {
  return jwt.sign(
    { userId, role, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_ACCESS_EXPIRY }
  )
}

export function generateRefreshToken() {
  return jwt.sign(
    { tokenId: uuidv4(), type: 'refresh' },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRY }
  )
}

export async function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.type !== 'access') throw new Error('Invalid token type')
    return decoded
  } catch (error) {
    return null
  }
}

export async function verifyRefreshToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.type !== 'refresh') throw new Error('Invalid token type')
    return decoded
  } catch (error) {
    return null
  }
}

export async function saveRefreshToken(userId, refreshToken) {
  const decoded = jwt.decode(refreshToken)
  const expiresAt = new Date(decoded.exp * 1000)
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
  
  return prisma.session.create({
    data: {
      userId,
      refreshTokenHash,
      expiresAt,
    },
  })
}

export async function findValidSession(userId, refreshToken) {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  })
  
  for (const session of sessions) {
    const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash)
    if (isValid) return session
  }
  
  return null
}

export async function revokeSession(sessionId) {
  return prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllUserSessions(userId) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  res.cookies.set('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes
    path: '/',
  })
  
  res.cookies.set('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  })
}

export function clearAuthCookies(res) {
  res.cookies.delete('accessToken')
  res.cookies.delete('refreshToken')
}

export async function getCurrentUser(req) {
  const accessToken = req.cookies.get('accessToken')?.value
  
  if (!accessToken) return null
  
  const decoded = await verifyAccessToken(accessToken)
  if (!decoded) return null
  
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      termsAcceptedAt: true,
    },
  })
  
  return user
}

export async function requireAuth(req) {
  const user = await getCurrentUser(req)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireAdmin(req) {
  const user = await requireAuth(req)
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden: Admin only')
  }
  return user
}