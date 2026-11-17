import React, { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseReady } from './supabase'

const roleNames = { admin: 'Administrador', manager: 'Gerente', technician: 'Técnico' }
const statusNames = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída', blocked: 'Bloqueada' }

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [tasks, setTasks] = useState([])
  const [reports, setReports] = useState([])
  const [clients, setClients] = useState([])
  const [team, setTeam] = useState([])
  const [tab, setTab] = useState('tasks')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const isManager = profile && ['admin', 'manager'].includes(profile.role)

  useEffect(() => {
    if (!supabaseReady) { setLoading(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setTasks([]); setLoading(false); return }
    loadData()
  }, [session])

  async function loadData() {
    setLoading(true); setError('')
    const { data: p, error: pe } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (pe) { setError('Não foi possível carregar seu perfil: ' + pe.message); setLoading(false); return }
    if (!p.active) { setError('Seu acesso está inativo. Procure o administrador.'); await supabase.auth.signOut(); setLoading(false); return }
    setProfile(p)
    const [t, r, c, u] = await Promise.all([
      supabase.from('tasks').select('*, jobs(name)').order('created_at', { ascending: false }),
      supabase.from('reports').select('*, tasks(title)').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('profiles').select('id,full_name,role,active').order('full_name')
    ])
    if (t.error) setError(t.error.message)
    setTasks(t.data || []); setReports(r.data || []); setClients(c.data || [])
    setTeam(u.data || [])
    setLoading(false)
  }

  async function login(e) {
    e.preventDefault(); setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setBusy(false)
  }
  async function logout() { await supabase.auth.signOut() }

  async function createTask(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { error } = await supabase.from('tasks').insert({
      title: f.get('title'), description: f.get('description') || null,
      assigned_to: f.get('assigned_to') || null, due_date: f.get('due_date') || null,
      priority: f.get('priority'), created_by: session.user.id
    })
    if (error) setError(error.message); else { e.currentTarget.reset(); loadData() }
  }

  async function updateTask(task, status) {
    const { error } = await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', task.id)
    if (error) setError(error.message); else loadData()
  }

  async function uploadPhoto(task, phase, file) {
    if (!file) return
    const path = `${task.id}/${session.user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: upError } = await supabase.storage.from('cca-fotos').upload(path, file, { contentType: file.type })
    if (upError) { setError(upError.message); return }
    const { error: dbError } = await supabase.from('task_photos').insert({
      task_id: task.id, uploaded_by: session.user.id, phase, storage_path: path
    })
    if (dbError) setError(dbError.message); else setError('Foto enviada com sucesso.')
  }

  async function createReport(e) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const { error } = await supabase.from('reports').insert({
      task_id: f.get('task_id') || null, author_id: session.user.id,
      summary: f.get('summary'), hours: f.get('hours') ? Number(f.get('hours')) : null,
      status: 'submitted'
    })
    if (error) setError(error.message); else { e.currentTarget.reset(); loadData() }
  }

  async function reviewReport(report, status) {
    const { error } = await supabase.from('reports').update({ status }).eq('id', report.id)
    if (error) setError(error.message); else loadData()
  }

  if (!supabaseReady) return <SetupScreen />
  if (!session) return <main className="login-shell"><section className="login-card">
    <div className="brand-mark">CCA</div><p className="eyebrow">CCA AUTOMAÇÃO</p><h1>Gestão de serviços</h1>
    <p className="muted">Entre com seu e-mail e senha para acessar sua área.</p>
    <form onSubmit={login} className="stack"><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></label><button disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button></form>
    {error && <p className="error">{error}</p>}
  </section></main>

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><span className="brand-mark small">CCA</span><div><b>CCA Gestão</b><small>Automação</small></div></div>
      <nav>{[['tasks','Tarefas'],['reports','Relatórios'],...(isManager ? [['clients','Clientes'],['team','Equipe']] : [])].map(([id,label])=><button key={id} className={tab===id?'nav-active':''} onClick={()=>setTab(id)}>{label}</button>)}</nav>
      <div className="side-user"><b>{profile.full_name}</b><small>{roleNames[profile.role]}</small><button className="secondary" onClick={logout}>Sair</button></div>
    </aside>
    <main className="content"><header><div><p className="eyebrow">PAINEL DE CONTROLE</p><h1>{tab==='tasks'?'Tarefas':tab==='reports'?'Relatórios':tab==='clients'?'Clientes':'Equipe'}</h1></div><button className="secondary refresh" onClick={loadData}>Atualizar</button></header>
      {error && <div className="notice">{error}</div>}
      {loading ? <p>Carregando informações…</p> : <>
      {tab==='tasks' && <><div className="stats"><Stat label="Total de tarefas" value={tasks.length}/><Stat label="Pendentes" value={tasks.filter(x=>x.status==='pending').length}/><Stat label="Concluídas" value={tasks.filter(x=>x.status==='completed').length}/></div>
        {isManager && <section className="panel"><h2>Nova tarefa</h2><form className="form-grid" onSubmit={createTask}><label>Título<input name="title" required /></label><label>Responsável<select name="assigned_to"><option value="">Não atribuído</option>{team.filter(x=>x.role==='technician'&&x.active).map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label><label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="low">Baixa</option></select></label><label>Prazo<input name="due_date" type="date"/></label><label className="wide">Descrição<textarea name="description" rows="2"/></label><button>Criar tarefa</button></form></section>}
        <section className="task-list">{tasks.map(task=><article className="panel task" key={task.id}><div className="task-head"><div><span className="pill">{statusNames[task.status]}</span><h3>{task.title}</h3><p className="muted">{task.description || 'Sem descrição'} {task.due_date ? `• Prazo: ${task.due_date}` : ''}</p></div><span className={`priority ${task.priority}`}>{task.priority==='high'?'Alta':task.priority==='low'?'Baixa':'Normal'}</span></div>
          <div className="task-actions"><label>Status<select value={task.status} onChange={e=>updateTask(task,e.target.value)}><option value="pending">Pendente</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="blocked">Bloqueada</option></select></label>
          {['before','during','after'].map(phase=><label className="upload" key={phase}>{phase==='before'?'Foto antes':phase==='during'?'Foto durante':'Foto depois'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>uploadPhoto(task,phase,e.target.files[0])}/></label>)}</div>
        </article>)}</section>
      </>}
      {tab==='reports' && <><section className="panel"><h2>Novo relatório diário</h2><form className="form-grid" onSubmit={createReport}><label>Tarefa<select name="task_id"><option value="">Sem tarefa vinculada</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>Horas trabalhadas<input name="hours" type="number" min="0" step="0.25"/></label><label className="wide">Resumo do serviço<textarea name="summary" rows="3" required/></label><button>Enviar relatório</button></form></section><section className="task-list">{reports.map(r=><article className="panel" key={r.id}><div className="task-head"><div><h3>{r.tasks?.title || 'Relatório diário'}</h3><p className="muted">{r.summary}</p><small>{r.report_date} • {r.hours ?? '—'} horas</small></div><span className="pill">{r.status}</span></div>{isManager && r.status==='submitted' && <div className="task-actions"><button onClick={()=>reviewReport(r,'approved')}>Aprovar</button><button className="danger" onClick={()=>reviewReport(r,'rejected')}>Rejeitar</button></div>}</article>)}</section></>}
      {tab==='clients' && <section className="panel"><h2>Clientes cadastrados</h2>{clients.map(c=><p className="list-row" key={c.id}><b>{c.name}</b><span>{c.phone || c.email || c.address || 'Sem contato informado'}</span></p>)}</section>}
      {tab==='team' && <section className="panel"><h2>Equipe</h2>{team.map(u=><p className="list-row" key={u.id}><b>{u.full_name}</b><span>{roleNames[u.role]} • {u.active?'Ativo':'Inativo'}</span></p>)}</section>}
      </>}
    </main>
  </div>
}

function Stat({label,value}) { return <div className="stat"><small>{label}</small><strong>{value}</strong></div> }
function SetupScreen() { return <main className="login-shell"><section className="login-card"><div className="brand-mark">CCA</div><h1>Configuração necessária</h1><p>Adicione a URL e a Publishable key do Supabase nas variáveis de ambiente da Vercel ou no arquivo <code>.env.local</code>.</p><p className="muted">Use VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Nunca use uma chave secret no navegador.</p></section></main> }
