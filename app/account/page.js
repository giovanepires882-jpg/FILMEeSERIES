'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, LogOut, RefreshCw, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  // Verificar pagamentos pendentes automaticamente
  useEffect(() => {
    if (payments.length > 0 && !subscription?.isActive) {
      checkPendingPayments()
    }
  }, [payments])

  const loadData = async () => {
    try {
      const [meRes, paymentsRes] = await Promise.all([
        fetch('/api/me'),
        fetch('/api/billing/payments'),
      ])

      if (meRes.ok) {
        const data = await meRes.json()
        setUser(data.user)
        setSubscription(data.subscription)
      } else {
        router.push('/login')
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        setPayments(data.payments)
      }
    } catch (error) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // Verificar se há pagamentos aprovados que não ativaram a assinatura
  const checkPendingPayments = async () => {
    setChecking(true)
    
    try {
      // Verificar cada pagamento APPROVED ou PENDING
      for (const payment of payments) {
        if (payment.status === 'APPROVED' || payment.status === 'PENDING') {
          const res = await fetch(`/api/billing/status?mpPaymentId=${payment.mpPaymentId}`)
          if (res.ok) {
            const data = await res.json()
            // Se ativou a assinatura, recarregar dados
            if (data.subscription?.status === 'ACTIVE') {
              toast.success('🎉 Assinatura ativada com sucesso!')
              await loadData()
              break
            }
          }
        }
      }
    } catch (error) {
      console.error('Error checking payments:', error)
    } finally {
      setChecking(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      toast.error('Erro ao sair')
    }
  }

  const handleRefresh = async () => {
    setChecking(true)
    await checkPendingPayments()
    await loadData()
    setChecking(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Carregando...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" className="text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold text-white mb-8">Minha Conta</h1>

        {/* User Info */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4">Informações</h2>
          <div className="space-y-2 text-gray-300">
            <p><span className="font-semibold">Nome:</span> {user?.name || 'Não informado'}</p>
            <p><span className="font-semibold">Email:</span> {user?.email}</p>
            <p><span className="font-semibold">Tipo:</span> {user?.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</p>
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-white">Assinatura</h2>
            <div className="flex items-center gap-2">
              {subscription?.isActive ? (
                <span className="px-3 py-1 bg-green-600 text-white rounded text-sm flex items-center gap-1">
                  <CheckCircle className="h-4 w-4" />
                  Ativa
                </span>
              ) : (
                <span className="px-3 py-1 bg-red-600 text-white rounded text-sm">Inativa</span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleRefresh}
                disabled={checking}
                className="text-gray-400 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          
          {subscription?.isActive ? (
            <div className="space-y-2 text-gray-300">
              <p><span className="font-semibold">Status:</span> Ativa</p>
              {subscription.endAt && (
                <p>
                  <span className="font-semibold">Válida até:</span>{' '}
                  {format(new Date(subscription.endAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <p className="text-gray-300 mb-4">Sua assinatura está inativa. Ative agora para assistir a todo o conteúdo!</p>
              
              {/* Se tem pagamento pendente, mostrar aviso */}
              {payments.some(p => p.status === 'PENDING') && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4 mb-4">
                  <p className="text-yellow-200 text-sm">
                    ⏳ Você tem um pagamento pendente. Assim que confirmado, sua assinatura será ativada automaticamente.
                  </p>
                </div>
              )}
              
              {/* Se tem pagamento aprovado mas assinatura não ativa */}
              {payments.some(p => p.status === 'APPROVED') && !subscription?.isActive && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-4">
                  <p className="text-blue-200 text-sm mb-2">
                    ✅ Pagamento aprovado detectado! Clique para verificar sua assinatura:
                  </p>
                  <Button 
                    onClick={handleRefresh}
                    disabled={checking}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {checking ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Verificar Assinatura
                  </Button>
                </div>
              )}
              
              <Link href="/checkout/pix">
                <Button className="bg-red-600 hover:bg-red-700">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Assinar Agora
                </Button>
              </Link>
            </div>
          )}

          {subscription?.isActive && (
            <div className="mt-4">
              <Link href="/checkout/pix">
                <Button variant="outline" className="border-white text-white hover:bg-white hover:text-black">
                  <CreditCard className="mr-2 h-4 w-4" />
                  Renovar Assinatura
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Payments History */}
        {payments.length > 0 && (
          <div className="bg-gray-900 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold text-white mb-4">Histórico de Pagamentos</h2>
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="border-b border-gray-800 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">R$ {payment.amount}</p>
                      <p className="text-gray-400 text-sm">
                        {format(new Date(payment.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded text-sm ${
                        payment.status === 'APPROVED'
                          ? 'bg-green-600 text-white'
                          : payment.status === 'PENDING'
                          ? 'bg-yellow-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {payment.status === 'APPROVED' && 'Aprovado'}
                      {payment.status === 'PENDING' && 'Pendente'}
                      {payment.status === 'REJECTED' && 'Rejeitado'}
                      {payment.status === 'CANCELLED' && 'Cancelado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logout */}
        <Button
          variant="outline"
          className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair da Conta
        </Button>
      </div>
    </div>
  )
}