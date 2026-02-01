'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, Users, PlayCircle, Trash2, Upload, Tv, Film } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { format } from 'date-fns'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [syncLogs, setSyncLogs] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [syncing, setSyncing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState('sync')
  const [loading, setLoading] = useState(true)
  const [m3uUrl, setM3uUrl] = useState('')
  const [deleteCategory, setDeleteCategory] = useState('')
  const [fixingSubscriptions, setFixingSubscriptions] = useState(false)
  const [detectSeries, setDetectSeries] = useState(true)
  const [lastSyncStats, setLastSyncStats] = useState(null)

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
      
      const catRes = await fetch('/api/categories')
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.categories)
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

  const handleSyncWithUrl = async () => {
    if (!m3uUrl.trim()) {
      toast.error('Digite a URL do M3U')
      return
    }

    setSyncing(true)
    setLastSyncStats(null)
    try {
      const res = await fetch('/api/admin/playlist/sync-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ m3uUrl, detectSeries }),
      })

      const data = await res.json()

      if (res.ok) {
        if (data.stats) {
          setLastSyncStats(data.stats)
          toast.success(`Sincronização concluída! ${data.stats.movies} filmes, ${data.stats.series} séries, ${data.stats.episodes} episódios`)
        } else {
          toast.success('Sincronização concluída!')
        }
        setM3uUrl('')
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

  const handleDeleteAll = async () => {
    if (!confirm('Tem certeza que deseja DELETAR TODOS os VODs? Esta ação não pode ser desfeita!')) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/vods/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(`${data.deleted} VODs deletados com sucesso!`)
        loadData()
      } else {
        toast.error(data.error || 'Erro ao deletar')
      }
    } catch (error) {
      toast.error('Erro ao deletar')
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteByCategory = async () => {
    if (!deleteCategory) {
      toast.error('Selecione uma categoria')
      return
    }

    const categoryName = categories.find(c => c.id === deleteCategory)?.name || 'esta categoria'
    
    if (!confirm(`Tem certeza que deseja deletar todos os VODs de "${categoryName}"? Esta ação não pode ser desfeita!`)) {
      return
    }

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/vods/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: deleteCategory }),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(`${data.deleted} VODs deletados com sucesso!`)
        setDeleteCategory('')
        loadData()
      } else {
        toast.error(data.error || 'Erro ao deletar')
      }
    } catch (error) {
      toast.error('Erro ao deletar')
    } finally {
      setDeleting(false)
    }
  }

  const handleFixSubscriptions = async () => {
    if (!confirm('Corrigir todas as assinaturas de pagamentos aprovados?')) {
      return
    }

    setFixingSubscriptions(true)
    try {
      const res = await fetch('/api/admin/subscriptions/fix', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        toast.success(`${data.fixed} assinaturas corrigidas! ${data.alreadyActive} já estavam ativas.`)
        loadData()
      } else {
        toast.error(data.error || 'Erro ao corrigir')
      }
    } catch (error) {
      toast.error('Erro ao corrigir assinaturas')
    } finally {
      setFixingSubscriptions(false)
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

        {activeTab === 'sync' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Sincronizar Playlist Configurada</h2>
              <p className="text-gray-400 mb-4">
                Sincronize com a playlist M3U configurada nas variáveis de ambiente.
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

            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Sincronizar com URL Personalizada</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="m3u-url" className="text-white">URL da Playlist M3U</Label>
                  <Input
                    id="m3u-url"
                    type="url"
                    value={m3uUrl}
                    onChange={(e) => setM3uUrl(e.target.value)}
                    placeholder="http://exemplo.com/playlist.m3u"
                    className="bg-gray-800 text-white border-gray-700"
                    disabled={syncing}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="detect-series"
                    checked={detectSeries}
                    onCheckedChange={(checked) => setDetectSeries(!!checked)}
                    disabled={syncing}
                  />
                  <Label htmlFor="detect-series" className="text-white cursor-pointer flex items-center gap-2">
                    <Tv className="h-4 w-4 text-blue-400" />
                    Detectar Séries e Episódios automaticamente
                  </Label>
                </div>
                <p className="text-gray-500 text-sm ml-6">
                  Quando ativado, identifica padrões como "S01E02", "1x02", "Temporada 1 Ep 2" nos títulos
                </p>
                
                <Button
                  onClick={handleSyncWithUrl}
                  disabled={syncing || !m3uUrl.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {syncing ? 'Sincronizando...' : 'Sincronizar com Esta URL'}
                </Button>
                
                {/* Stats from last sync */}
                {lastSyncStats && (
                  <div className="mt-4 p-4 bg-gray-800 rounded-lg">
                    <h3 className="text-white font-semibold mb-2">Última Sincronização:</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Film className="h-4 w-4 text-green-400" />
                        <span className="text-white">{lastSyncStats.movies} filmes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Tv className="h-4 w-4 text-blue-400" />
                        <span className="text-white">{lastSyncStats.series} séries</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <PlayCircle className="h-4 w-4 text-purple-400" />
                        <span className="text-white">{lastSyncStats.episodes} episódios</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Trash2 className="h-4 w-4 text-red-400" />
                        <span className="text-white">{lastSyncStats.inactivated} inativos</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border-2 border-red-900">
              <h2 className="text-xl font-semibold text-red-500 mb-4">Zona de Perigo - Deletar VODs</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <Label htmlFor="delete-cat" className="text-white">Deletar por Categoria</Label>
                  <div className="flex gap-2">
                    <Select value={deleteCategory} onValueChange={setDeleteCategory}>
                      <SelectTrigger className="bg-gray-800 text-white border-gray-700">
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleDeleteByCategory}
                      disabled={deleting || !deleteCategory}
                      variant="destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deleting ? 'Deletando...' : 'Deletar Categoria'}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t border-red-900 pt-6">
                <p className="text-gray-300 mb-4">
                  <strong>ATENÇÃO:</strong> Esta ação deletará TODOS os VODs do banco de dados.
                </p>
                <Button
                  onClick={handleDeleteAll}
                  disabled={deleting}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {deleting ? 'Deletando...' : 'Deletar TODOS os VODs'}
                </Button>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Histórico de Sincronização</h2>
              {syncLogs.length === 0 ? (
                <p className="text-gray-400">Nenhuma sincronização realizada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="border border-gray-800 rounded p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs ${log.status === 'SUCCESS' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                              {log.status}
                            </span>
                            <span className="text-gray-400 text-sm">
                              {format(new Date(log.startedAt), 'dd/MM/yyyy HH:mm:ss')}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-gray-300">
                            <span className="text-green-400">+{log.itemsUpserted}</span> adicionados,{' '}
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

        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg p-6 border-2 border-yellow-900">
              <h2 className="text-xl font-semibold text-yellow-500 mb-4">🔧 Corrigir Assinaturas</h2>
              <p className="text-gray-300 mb-4">
                Ativa automaticamente as assinaturas de todos os usuários que já pagaram (status APPROVED) mas ainda não foram ativados.
              </p>
              <Button
                onClick={handleFixSubscriptions}
                disabled={fixingSubscriptions}
                className="bg-yellow-600 hover:bg-yellow-700"
              >
                {fixingSubscriptions ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Corrigindo...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Corrigir Assinaturas Agora
                  </>
                )}
              </Button>
            </div>

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
                      <th className="text-left text-gray-400 py-2 px-4">Válida até</th>
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
                          <span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-purple-600' : 'bg-gray-700'} text-white`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`px-2 py-1 rounded text-xs ${u.subscription?.status === 'ACTIVE' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
                            {u.subscription?.status || 'N/A'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-300 text-sm">
                          {u.subscription?.endAt ? format(new Date(u.subscription.endAt), 'dd/MM/yyyy') : '-'}
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
          </div>
        )}
      </div>
    </div>
  )
}
