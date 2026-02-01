'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Users, PlayCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [syncLogs, setSyncLogs] = useState([])
  const [users, setUsers] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState('sync')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadData()
    }
  }, [user, activeTab])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        if (data.user.role !== 'ADMIN') {
          toast.error('Acesso negado')
          router.push('/')
        } else {
          setUser(data.user)
        }
      } else {
        router.push('/login')
      }
    } catch (error) {
      router.push('/login')
    }
  }

  const loadData = async () => {
    try {
      if (activeTab === 'sync') {
        const res = await fetch('/api/admin/sync/logs')
        if (res.ok) {
          const data = await res.json()
          setSyncLogs(data.logs)
        }
      } else if (activeTab === 'users') {
        const res = await fetch('/api/admin/users')
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users)
        }
      }
    } catch (error) {
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/playlist/sync', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Sincronização concluída!')
        loadData()
      } else {
        toast.error(data.error || 'Erro ao sincronizar')
      }
    } catch (error) {
      toast.error('Erro ao sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !user) {
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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" className="text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <Button
            variant={activeTab === 'sync' ? 'default' : 'outline'}
            onClick={() => setActiveTab('sync')}
            className={activeTab === 'sync' ? 'bg-red-600' : 'border-gray-700 text-white'}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Sincronização
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'outline'}
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-red-600' : 'border-gray-700 text-white'}
          >
            <Users className="mr-2 h-4 w-4" />
            Usuários
          </Button>
        </div>

        {/* Sync Tab */}
        {activeTab === 'sync' && (
          <div>
            <div className="bg-gray-900 rounded-lg p-6 mb-6">
              <h2 className="text-xl font-semibold text-white mb-4">Sincronizar Playlist M3U</h2>
              <p className="text-gray-400 mb-4">
                Sincronize o catálogo com a playlist M3U configurada nas variáveis de ambiente.
              </p>
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="bg-red-600 hover:bg-red-700"
              >
                {syncing ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            </div>

            {/* Sync Logs */}
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Histórico de Sincronização</h2>
              {syncLogs.length === 0 ? (
                <p className="text-gray-400">Nenhuma sincronização realizada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {syncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="border border-gray-800 rounded p-4"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                log.status === 'SUCCESS'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-red-600 text-white'
                              }`}
                            >
                              {log.status}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {format(new Date(log.startedAt), 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-300">
                            <span className="text-green-400">+{log.itemsUpserted}</span> adicionados/atualizados,{' '}
                            <span className="text-red-400">-{log.itemsInactivated}</span> inativados
                          </div>
                          {log.message && (
                            <p className="text-gray-400 text-sm mt-1">{log.message}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-gray-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Usuários ({users.length})</h2>
            {users.length === 0 ? (
              <p className="text-gray-400">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left text-gray-400 py-2 px-4">Email</th>
                      <th className="text-left text-gray-400 py-2 px-4">Nome</th>
                      <th className="text-left text-gray-400 py-2 px-4">Role</th>
                      <th className="text-left text-gray-400 py-2 px-4">Assinatura</th>
                      <th className="text-left text-gray-400 py-2 px-4">Pagamentos</th>
                      <th className="text-left text-gray-400 py-2 px-4">Cadastro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-gray-800">
                        <td className="py-3 px-4 text-white text-sm">{u.email}</td>
                        <td className="py-3 px-4 text-gray-300 text-sm">{u.name || '-'}</td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-gray-700'
                            } text-white`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              u.subscription?.status === 'ACTIVE'
                                ? 'bg-green-600'
                                : 'bg-red-600'
                            } text-white`}
                          >
                            {u.subscription?.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">{u._count.payments}</td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {format(new Date(u.createdAt), 'dd/MM/yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}