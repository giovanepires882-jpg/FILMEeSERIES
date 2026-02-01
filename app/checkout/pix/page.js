'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, RefreshCw, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function CheckoutPixPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [mpPaymentId, setMpPaymentId] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState(null)
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    let interval
    if (mpPaymentId && polling) {
      interval = setInterval(() => {
        checkPaymentStatus()
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [mpPaymentId, polling])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    }
  }

  const createPayment = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/billing/pix/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json()

      if (res.ok) {
        setQrCode({
          base64: data.qrCodeBase64,
          text: data.qrCodeText,
          amount: data.amount,
        })
        setMpPaymentId(data.mpPaymentId)
        setPaymentStatus('PENDING')
        setPolling(true)
        toast.success('QR Code gerado!')
      } else {
        toast.error(data.error || 'Erro ao gerar QR Code')
      }
    } catch (error) {
      toast.error('Erro ao criar pagamento')
    } finally {
      setLoading(false)
    }
  }

  const checkPaymentStatus = async () => {
    if (!mpPaymentId) return

    try {
      const res = await fetch(`/api/billing/status?mpPaymentId=${mpPaymentId}`)
      if (res.ok) {
        const data = await res.json()
        setPaymentStatus(data.payment.status)

        if (data.payment.status === 'APPROVED') {
          setPolling(false)
          toast.success('Pagamento aprovado! Sua assinatura foi ativada.')
          setTimeout(() => {
            router.push('/')
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Error checking status:', error)
    }
  }

  const copyToClipboard = () => {
    if (qrCode?.text) {
      navigator.clipboard.writeText(qrCode.text)
      toast.success('Código copiado!')
    }
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <Link href="/account">
            <Button variant="ghost" className="text-white">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-2 text-center">Assinar com PIX</h1>
        <p className="text-gray-400 text-center mb-8">
          Valor: R$ {process.env.NEXT_PUBLIC_SUBSCRIPTION_PRICE || '15,00'} - 30 dias de acesso
        </p>

        {!qrCode ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-300 mb-6">
              Clique no botão abaixo para gerar o QR Code do PIX e realizar o pagamento.
            </p>
            <Button
              size="lg"
              className="bg-red-600 hover:bg-red-700"
              onClick={createPayment}
              disabled={loading}
            >
              {loading ? 'Gerando...' : 'Gerar QR Code PIX'}
            </Button>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-8">
            {paymentStatus === 'APPROVED' ? (
              <div className="text-center">
                <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Pagamento Aprovado!</h2>
                <p className="text-gray-300">Sua assinatura foi ativada com sucesso.</p>
                <p className="text-gray-400 text-sm mt-2">Redirecionando...</p>
              </div>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">QR Code PIX</h2>
                  <p className="text-gray-400">Escaneie o QR Code ou copie o código</p>
                </div>

                {/* QR Code Image */}
                <div className="flex justify-center mb-6">
                  <div className="bg-white p-4 rounded-lg">
                    <img
                      src={`data:image/png;base64,${qrCode.base64}`}
                      alt="QR Code PIX"
                      className="w-64 h-64"
                    />
                  </div>
                </div>

                {/* Copy Code */}
                <div className="mb-6">
                  <label className="text-gray-300 text-sm mb-2 block">Código PIX Copia e Cola</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={qrCode.text}
                      readOnly
                      className="flex-1 bg-gray-800 text-white px-4 py-2 rounded border border-gray-700 text-sm"
                    />
                    <Button onClick={copyToClipboard} variant="outline">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Status */}
                <div className="text-center">
                  {paymentStatus === 'PENDING' && (
                    <div className="flex items-center justify-center gap-2 text-yellow-500">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Aguardando pagamento...</span>
                    </div>
                  )}
                  <p className="text-gray-400 text-sm mt-2">
                    O pagamento pode levar alguns segundos para ser confirmado
                  </p>
                </div>

                {/* Manual Check */}
                <div className="mt-6 text-center">
                  <Button
                    variant="ghost"
                    onClick={checkPaymentStatus}
                    className="text-gray-400 hover:text-white"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar Status Manualmente
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-gray-900/50 rounded-lg p-6">
          <h3 className="text-white font-semibold mb-2">Informações importantes:</h3>
          <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
            <li>O pagamento é processado automaticamente após confirmação</li>
            <li>A assinatura é válida por 30 dias a partir da aprovação</li>
            <li>Você pode renovar a qualquer momento</li>
            <li>Não há cobrança automática</li>
          </ul>
        </div>
      </div>
    </div>
  )
}