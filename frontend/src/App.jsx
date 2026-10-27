import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpRight, BarChart3, BookOpen, Check, ChevronDown, ClipboardList, Download, ExternalLink, Eye, LayoutDashboard, LogOut, Menu, PieChart, Plus, QrCode, Search, Settings2, Shapes, Store, UtensilsCrossed, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { request, setEstablishment } from './services/api.js';

const money = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v || 0);
const mediaBase = new URL(import.meta.env.VITE_API_URL || '/', location.origin).origin;
const imageUrl = (url) => {
  if (!url) return '';
  try { return new URL(url, mediaBase).href; } catch { return ''; }
};
function App(){return <BrowserRouter><Routes><Route path="/m/:slug" element={<PublicMenu/>}/><Route path="*" element={<AdminApp/>}/></Routes></BrowserRouter>}

function AdminApp(){
 const [user,setUser]=useState(null),[establishments,setEstablishments]=useState([]),[active,setActive]=useState(''),[view,setView]=useState('overview'),[busy,setBusy]=useState(true),[notice,setNotice]=useState(''),[mobileNav,setMobileNav]=useState(false);
 const activeItem=establishments.find(e=>e.id===active); const say=(msg)=>{setNotice(msg);setTimeout(()=>setNotice(''),3500)};
 useEffect(()=>{request('/auth/me').then(({user})=>setUser(user)).catch(()=>setUser(null)).finally(()=>setBusy(false))},[]);
 useEffect(()=>{if(!user)return;request('/establishments').then(rows=>{setEstablishments(rows);if(user.role==='platform_admin')setActive('');else if(rows.length)setActive(old=>old||rows[0].id)}).catch(e=>say(e.message))},[user]);
 useEffect(()=>setEstablishment(active),[active]);
 async function login(email,password){const data=await request('/auth/login',{method:'POST',body:JSON.stringify({email,password})});setUser(data.user);say('Bem-vindo ao seu painel.');}
 async function register(payload){const data=await request('/auth/register',{method:'POST',body:JSON.stringify(payload)});setUser(data.user);say('Conta criada com sucesso.');}
 async function logout(){await request('/auth/logout',{method:'POST'});setUser(null);setEstablishments([]);setActive('')}
 if(busy)return <div className="loading-screen"><span className="spinner-border text-success"/><span>Preparando seu espaço…</span></div>;
 if(!user)return <Login onLogin={login} onRegister={register}/>;
 const isPlatformAdmin=user.role==='platform_admin';const nav=isPlatformAdmin?[
  ['overview','Vis\u00e3o da plataforma',LayoutDashboard],
  ['establishments','Estabelecimentos',Store],
]:[
  ['overview','Vis\u00e3o geral',LayoutDashboard],
  ['establishments','Estabelecimentos',Store],
  ['categories','Categorias',Shapes],
  ['products','Produtos',UtensilsCrossed],
  ['reports','Relat\u00f3rios',ClipboardList],
  ['settings','Meu card\u00e1pio',Settings2],
];
 return <div className="admin-shell">
   <aside className={`sidebar ${mobileNav?'open':''}`}><Link to="/" className="brand"><img src="/logo.svg"/><span className="brand-tag">{isPlatformAdmin?'ADMINISTRA\u00c7\u00c3O DA PLATAFORMA':'PAINEL DO RESTAURANTE'}</span></Link><div className="side-caption">MENU PRINCIPAL</div><nav>{nav.map(([id,label,Icon])=><button className={`side-link ${view===id?'selected':''}`} onClick={()=>{setView(id);setMobileNav(false)}} key={id}><Icon size={18}/><span>{label}</span>{id==='overview'&&<span className="nav-dot"/>}</button>)}</nav><div className="sidebar-bottom"><button className="user-menu" onClick={logout}><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div className="user-info"><strong>{user.name}</strong><span>{isPlatformAdmin?'Administrador da plataforma':'Respons\u00e1vel pelo estabelecimento'}</span></div><LogOut size={17}/></button></div></aside>
   {mobileNav&&<button className="nav-scrim" aria-label="Fechar menu" onClick={()=>setMobileNav(false)}/>}
   <main className="admin-main"><header className="topbar"><button className="icon-button menu-trigger" onClick={()=>setMobileNav(v=>!v)}><Menu/></button><div className="breadcrumbs">Workspace <span>/</span> <b>{nav.find(n=>n[0]===view)?.[1]}</b></div><div className="top-actions"><InstallButton/>{isPlatformAdmin?<div className="platform-context"><span>VISÃO GLOBAL</span></div>:activeItem&&<div className="active-store"><span className="live-dot"/>{activeItem.name}</div>}<div className="top-avatar">{user.name?.[0]?.toUpperCase()}</div></div></header>
    <div className="content-wrap">{view==='overview'&&(isPlatformAdmin?<PlatformOverview/>:<Overview establishments={establishments} active={activeItem} setActive={setActive} go={setView} say={say}/>)}{view==='establishments'&&<Establishments platformAdmin={isPlatformAdmin} data={establishments} reload={()=>request('/establishments').then(setEstablishments)} say={say}/>}{!isPlatformAdmin&&view==='categories'&&<Manager type="categories" active={activeItem} say={say}/>}{!isPlatformAdmin&&view==='products'&&<Manager type="products" active={activeItem} say={say}/>}{!isPlatformAdmin&&view==='reports'&&<Reports active={activeItem}/>}{!isPlatformAdmin&&view==='settings'&&<Settings active={activeItem} reload={()=>request('/establishments').then(setEstablishments)} say={say}/>}</div>
   </main>{notice&&<div className="toast-message"><Check size={17}/>{notice}</div>}
 </div>
}

function InstallButton(){const [prompt,setPrompt]=useState(null);useEffect(()=>{const save=e=>{e.preventDefault();setPrompt(e)};window.addEventListener('beforeinstallprompt',save);return()=>window.removeEventListener('beforeinstallprompt',save)},[]);if(!prompt)return null;return <button className="install-button" onClick={async()=>{await prompt.prompt();setPrompt(null)}}><Download size={14}/> Instalar app</button>}
function Login({onLogin,onRegister}) {
  const [registering,setRegistering]=useState(false),[name,setName]=useState(''),[establishmentName,setEstablishmentName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      if(registering)await onRegister({name,establishment_name:establishmentName,email,password});
      else await onLogin(email,password);
    } catch(e) { setError(e.message); } finally { setBusy(false); }
  }
  function toggleMode() { setRegistering(value=>!value);setError(''); }
  return <div className="login-page">
    <div className="login-brand"><img src="/logo.svg"/><InstallButton/><div className="login-visual"><div className="visual-orbit orbit-a"/><div className="visual-orbit orbit-b"/><div className="visual-label"><UtensilsCrossed size={22}/> CADA PRATO CONTA UMA HIST&Oacute;RIA</div><div className="visual-copy">Seu card&aacute;pio,<br/><em>do seu jeito.</em></div><p>Uma experi&ecirc;ncia digital para o seu estabelecimento.</p><div className="food-illustration"><div className="plate"><div className="greens"/><div className="tomato t1"/><div className="tomato t2"/><div className="bread"/><div className="leaf l1"/><div className="leaf l2"/></div></div><span className="floating-note">Feito com carinho <span>&#10035;</span></span></div></div>
    <div className="login-panel"><div className="login-form-wrap">
      <div className="eyebrow">&Aacute;REA DO RESTAURANTE</div>
      <h1>{registering?'Comece pelo seu estabelecimento.':<>Que bom ter voc&ecirc; por aqui.</>}</h1>
      <p className="muted-copy">{registering?<>Crie sua conta para montar e gerenciar seu card&aacute;pio.</>:<>Entre para cuidar do seu card&aacute;pio.</>}</p>
      <form onSubmit={submit}>
        {registering&&<>
          <label className="form-label">Seu nome</label><input className="form-control" autoComplete="name" required minLength="2" maxLength="120" placeholder="Nome do respons&aacute;vel" value={name} onChange={e=>setName(e.target.value)}/>
          <label className="form-label mt-3">Nome do estabelecimento</label><input className="form-control" required minLength="2" maxLength="120" placeholder="Ex.: Cantina da Massa" value={establishmentName} onChange={e=>setEstablishmentName(e.target.value)}/>
        </>}
        <label className="form-label mt-3">Seu e-mail</label><input className="form-control" type="email" autoComplete="email" required maxLength="254" placeholder="voce@restaurante.com.br" value={email} onChange={e=>setEmail(e.target.value)}/>
        <label className="form-label mt-3">Sua senha</label><input className="form-control" type="password" autoComplete={registering?'new-password':'current-password'} required minLength={registering?12:1} maxLength="200" placeholder={registering?'Pelo menos 12 caracteres':'Digite sua senha'} value={password} onChange={e=>setPassword(e.target.value)}/>
        {registering&&<small className="register-hint">Use uma senha com pelo menos 12 caracteres.</small>}
        {error&&<div className="form-error">{error}</div>}
        <button className="btn btn-primary w-100 login-submit" disabled={busy}>{busy?'Aguarde...':registering?'Criar conta':'Entrar'} <ArrowUpRight size={17}/></button>
      </form>
      <div className="login-switch">{registering?<>J&aacute; tem uma conta?</>:<>Primeira vez por aqui?</>} <button type="button" onClick={toggleMode}>{registering?'Entrar':'Criar conta'}</button></div>
      <div className="login-foot"><span>&copy; {new Date().getFullYear()} Mesa Viva</span><span>Seguro e protegido <span className="secure-dot"/></span></div>
    </div></div>
  </div>;
}
function PageHeading({eyebrow,title,description,action}){return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>}
function PlatformOverview() {
  const [establishments,setEstablishments]=useState(null);
  const [error,setError]=useState('');
  useEffect(()=>{request('/platform/overview').then(data=>setEstablishments(data.establishments)).catch(e=>setError(e.message));},[]);
  const monthly=useMemo(()=>{
    if(!establishments)return [];
    const now=new Date();
    return Array.from({length:6},(_,index)=>{
      const date=new Date(now.getFullYear(),now.getMonth()-5+index,1);
      const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0');
      return {key,label:date.toLocaleDateString('pt-BR',{month:'short'}).replace('.',''),total:establishments.filter(item=>(item.created_at||'').slice(0,7)===key).length};
    });
  },[establishments]);
  if(error)return <><PageHeading eyebrow={'ADMINISTRA\u00c7\u00c3O DA PLATAFORMA'} title={'Painel da plataforma'} description={'Acompanhe os estabelecimentos e a atividade do sistema.'}/><Empty text={error}/></>;
  if(!establishments)return <div className="loading-screen"><span className="spinner-border text-success"/><span>Carregando dados da plataforma...</span></div>;
  const published=establishments.filter(item=>Boolean(item.published)).length;
  const unpublished=establishments.length-published;
  const maxMonthly=Math.max(1,...monthly.map(item=>item.total));
  const publishedPercent=establishments.length?Math.round(published/establishments.length*100):0;
  return <>
    <PageHeading eyebrow={'ADMINISTRA\u00c7\u00c3O DA PLATAFORMA'} title={'Painel da plataforma'} description={'Acompanhe os estabelecimentos e a atividade do sistema.'}/>
    <div className="stats-grid platform-admin-stats">
      <Stat icon={Store} tint="mint" label="Estabelecimentos" value={establishments.length} hint="cadastrados na plataforma"/>
      <Stat icon={Eye} tint="lavender" label={'Card\u00e1pios publicados'} value={published} hint="estabelecimentos ativos"/>
      <Stat icon={ClipboardList} tint="peach" label={'Ainda n\u00e3o publicados'} value={unpublished} hint={'aguardando publica\u00e7\u00e3o'}/>
    </div>
    <div className="platform-dashboard-grid">
      <section className="panel-card platform-chart-card">
        <div className="panel-title"><div><h3>Novos estabelecimentos</h3><p>{'\u00daltimos seis meses'}</p></div><span className="panel-title-icon"><BarChart3 size={18}/></span></div>
        <div className="monthly-chart" role="img" aria-label="Novos estabelecimentos por m\u00eas nos \u00faltimos seis meses">
          {monthly.map(item=><div className="month-column" key={item.key}><strong>{item.total}</strong><div className="month-bar-track"><span className="month-bar" style={{height:(item.total?Math.max(8,item.total/maxMonthly*100):0)+'%'}}/></div><small>{item.label}</small></div>)}
        </div>
      </section>
      <section className="panel-card platform-chart-card">
        <div className="panel-title"><div><h3>{'Publica\u00e7\u00e3o dos card\u00e1pios'}</h3><p>{'Situa\u00e7\u00e3o dos estabelecimentos'}</p></div><span className="panel-title-icon"><PieChart size={18}/></span></div>
        <div className="publication-chart">
          <div className="publication-donut" role="img" aria-label={published+' de '+establishments.length+' estabelecimentos publicados'} style={{background:'conic-gradient(#176b52 0 '+publishedPercent+'%, #e9eee7 '+publishedPercent+'% 100%)'}}><div><strong>{establishments.length}</strong><small>total</small></div></div>
          <div className="publication-legend"><div><span className="legend-dot published-dot"/><span>Publicados</span><strong>{published}</strong></div><div><span className="legend-dot draft-dot"/><span>{'N\u00e3o publicados'}</span><strong>{unpublished}</strong></div></div>
        </div>
      </section>
    </div>
  </>;
}
function Overview({establishments,active,setActive,go,say}){const [cats,setCats]=useState([]),[products,setProducts]=useState([]);useEffect(()=>{if(!active){setCats([]);setProducts([]);return}setEstablishment(active.id);request('/categories').then(setCats).catch(()=>{});request('/products').then(setProducts).catch(()=>{})},[active?.id]);const link=active?`${location.origin}/m/${active.slug}`:'';async function copy(){try{await navigator.clipboard.writeText(link);say('Link copiado para a área de transferência.')}catch{say(link)}}return <><PageHeading eyebrow="SEGUNDA-FEIRA, SEU CARDÁPIO EM DIA" title="Visão geral" description="Tudo pronto para deixar sua casa ainda mais convidativa." action={<button className="btn btn-primary" onClick={()=>go('products')}><Plus size={17}/> Novo produto</button>}/>{!establishments.length?<div className="empty-hero"><div className="empty-icon"><Store/></div><h2>Vamos abrir as portas?</h2><p>Cadastre seu primeiro estabelecimento para começar a montar um cardápio cheio de personalidade.</p><button className="btn btn-primary" onClick={()=>go('establishments')}><Plus size={17}/> Cadastrar estabelecimento</button></div>:<><div className="welcome-banner"><div className="banner-pattern"/><div className="welcome-content"><div className="welcome-chip"><span className="live-dot"/> SEU ESPAÇO DIGITAL</div><h2>{active?`Olá, ${active.name}!`:'Escolha seu estabelecimento'}</h2><p>Seu cardápio está a um clique de encantar alguém hoje.</p>{active&&<div className="banner-actions"><a href={link} target="_blank" rel="noreferrer" className="btn btn-light"><Eye size={16}/> Ver cardápio <ExternalLink size={14}/></a><button className="banner-copy" onClick={copy}><ClipboardList size={15}/> Copiar link</button></div>}</div><div className="banner-plate"><div className="plate-mini"><span>✳</span><b>feito<br/>fresco</b></div></div><div className="banner-select"><span>ESTABELECIMENTO</span><div className="select-wrap"><Store size={15}/><select value={active?.id||''} onChange={e=>setActive(e.target.value)}>{establishments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={15}/></div></div></div><div className="stats-grid"><Stat icon={UtensilsCrossed} tint="mint" label="Produtos no cardápio" value={products.length} hint="itens cadastrados"/><Stat icon={Shapes} tint="peach" label="Categorias" value={cats.length} hint="grupos organizados"/><Stat icon={Eye} tint="lavender" label="Status do cardápio" value={active?.published?'Publicado':'Rascunho'} hint={active?.published?'visível para seus clientes':'só você consegue visualizar'} status/></div><div className="overview-lower"><div className="panel-card quick-panel"><div className="panel-title"><div><h3>Atalhos para criar</h3><p>Um passo de cada vez, seu cardápio ganha forma.</p></div><span className="panel-title-icon"><Plus size={17}/></span></div><div className="quick-links"><button onClick={()=>go('products')}><span className="quick-icon peach"><UtensilsCrossed/></span><span><b>Adicionar produto</b><small>Apresente uma novidade</small></span><ArrowUpRight/></button><button onClick={()=>go('categories')}><span className="quick-icon mint"><Shapes/></span><span><b>Criar categoria</b><small>Organize suas delícias</small></span><ArrowUpRight/></button><button onClick={()=>go('settings')}><span className="quick-icon lavender"><Settings2/></span><span><b>Personalizar cardápio</b><small>Deixe com a sua cara</small></span><ArrowUpRight/></button></div></div><div className="panel-card public-panel"><div className="public-top"><div className="qr-icon"><QrCode/></div><div><h3>Seu cardápio público</h3><p>Pronto para compartilhar com o mundo.</p></div></div><div className="public-url"><span>{active?`${location.host}/m/${active.slug}`:'Configure seu link'}</span><button onClick={copy} disabled={!active}><ClipboardList size={15}/></button></div><div className="public-foot"><span><span className="live-dot"/> {active?.published?'Link ativo e funcionando':'Publique para ativar o link'}</span><button className="text-link" onClick={()=>go('settings')}>Configurar <ArrowUpRight size={14}/></button></div></div></div></>}</>}
function Stat({icon:Icon,tint,label,value,hint,status}){return <div className="stat-card"><div className={`stat-icon ${tint}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className={`stat-value ${status?'status-value':''}`}>{status&&<span className={`status-mark ${value==='Publicado'?'published':''}`}/>}{value}</div><div className="stat-hint">{hint}</div></div>}

function Establishments({data,reload,say,platformAdmin=false}) {
  const [form,setForm]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
  async function save(e) {
    e.preventDefault();setBusy(true);
    try { await request('/establishments/'+form.id,{method:'PUT',body:JSON.stringify(form)});setForm(null);await reload();say('Estabelecimento atualizado com sucesso.'); }
    catch(e) { say(e.message); } finally { setBusy(false); }
  }
  async function remove(item) {
    if(!confirm('Excluir '+item.name+' e todo o card\u00e1pio? Esta a\u00e7\u00e3o tamb\u00e9m remove o acesso do respons\u00e1vel e n\u00e3o pode ser desfeita.'))return;
    try { await request('/establishments/'+item.id,{method:'DELETE'});await reload();say('Estabelecimento exclu?do.'); }
    catch(e) { say(e.message); }
  }
  const visible=data.filter(item=>item.name.toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageHeading eyebrow={platformAdmin?'ADMINISTRA??O DA PLATAFORMA':'MEU ESTABELECIMENTO'} title={'Estabelecimentos'} description={platformAdmin?'Consulte os estabelecimentos e abra seus links p\u00fablicos.':'Consulte e atualize os dados do seu estabelecimento.'}/>
    <div className="panel-card table-panel">
      <div className="table-head"><div><h3>{platformAdmin?'Estabelecimentos da plataforma':'Seu estabelecimento'} <span className="count-pill">{data.length}</span></h3><p>{platformAdmin?'Links p?blicos e remo??o de estabelecimentos.':'Dados vinculados a sua conta.'}</p></div><div className="table-search"><Search size={15}/><input placeholder="Buscar estabelecimento" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      {visible.length?<div className="responsive-table"><table className="table align-middle"><thead><tr><th>ESTABELECIMENTO</th><th>{'LINK P\u00daBLICO'}</th><th>{'A\u00c7\u00c3O'}</th></tr></thead><tbody>{visible.map(item=><tr key={item.id}><td><div className="table-name"><div className="store-avatar"><Store size={17}/></div><strong>{item.name}</strong></div></td><td><a className="menu-link" href={'/m/'+item.slug} target="_blank" rel="noreferrer">/m/{item.slug}<ExternalLink size={14}/></a></td><td><div className="row-actions">{platformAdmin?<button onClick={()=>remove(item)} title="Excluir estabelecimento" aria-label={'Excluir '+item.name}><X size={16}/></button>:<button onClick={()=>setForm(item)} title="Editar estabelecimento" aria-label={'Editar '+item.name}><Settings2 size={16}/></button>}</div></td></tr>)}</tbody></table></div>:<Empty text={data.length?'Nenhum estabelecimento encontrado.':'Nenhum estabelecimento cadastrado.'}/>}
    </div>
    {!platformAdmin&&form&&<Modal title={'Editar estabelecimento'} close={()=>setForm(null)}><form onSubmit={save} className="edit-form"><label>Nome do estabelecimento<input className="form-control" required minLength="2" maxLength="120" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>{'Descri\u00e7\u00e3o'}<textarea className="form-control" rows="3" maxLength="1000" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>{'Endere\u00e7o'}<input className="form-control" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Telefone<input className="form-control" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label><div className="modal-actions"><button type="button" className="btn btn-outline-secondary" onClick={()=>setForm(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy}>{busy?'Salvando...':'Salvar altera\u00e7\u00f5es'}</button></div></form></Modal>}
  </>;
}
function Reports({active}) {
  const [products,setProducts] = useState([]);
  const [categories,setCategories] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!active) { setProducts([]); setCategories([]); setLoading(false); return () => { cancelled = true; }; }
    setLoading(true);
    setError('');
    setEstablishment(active.id);
    Promise.all([request('/products'),request('/categories')])
      .then(([productRows,categoryRows]) => { if (!cancelled) { setProducts(productRows); setCategories(categoryRows); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [active?.id]);

  if (!active) return <><PageHeading eyebrow={'RELAT\u00d3RIOS'} title={'Relat\u00f3rios do card\u00e1pio'} description={'Consulte os produtos e categorias do seu estabelecimento.'}/><Empty text={'Cadastre um estabelecimento para gerar o relat\u00f3rio do card\u00e1pio.'}/></>;
  if (loading) return <div className="loading-screen"><span className="spinner-border text-success"/><span>{'Carregando relat\u00f3rio...'}</span></div>;
  if (error) return <><PageHeading eyebrow={'RELAT\u00d3RIOS'} title={'Relat\u00f3rios do card\u00e1pio'} description={active.name}/><Empty text={error}/></>;

  const available = products.filter(product => Boolean(product.available));
  const unavailable = products.length - available.length;
  const featured = products.filter(product => Boolean(product.featured)).length;
  const perCategory = categories.map(category => {
    const rows = products.filter(product => product.category_id === category.id);
    return { ...category, total: rows.length, available: rows.filter(product => Boolean(product.available)).length };
  });

  return <>
    <PageHeading eyebrow={'RELAT\u00d3RIOS DO ESTABELECIMENTO'} title={'Relat\u00f3rio do card\u00e1pio'} description={active.name}/>
    <div className="stats-grid">
      <Stat icon={UtensilsCrossed} tint="mint" label="Produtos" value={products.length} hint="itens cadastrados"/>
      <Stat icon={Eye} tint="lavender" label={'Dispon\u00edveis'} value={available.length} hint={'vis\u00edveis no card\u00e1pio'}/>
      <Stat icon={Shapes} tint="peach" label={'Indispon\u00edveis'} value={unavailable} hint="ocultos temporariamente"/>
    </div>
    <div className="panel-card table-panel report-panel">
      <div className="table-head"><div><h3>Produtos por categoria</h3><p>{categories.length} categorias e {featured} produtos em destaque.</p></div></div>
      {perCategory.length ? <div className="responsive-table"><table className="table align-middle"><thead><tr><th>CATEGORIA</th><th>PRODUTOS</th><th>{'DISPON\u00cdVEIS'}</th></tr></thead><tbody>{perCategory.map(category => <tr key={category.id}><td><strong>{category.name}</strong></td><td>{category.total}</td><td>{category.available}</td></tr>)}</tbody></table></div> : <Empty text={'Nenhuma categoria cadastrada.'}/>}
    </div>
    <div className="panel-card table-panel report-panel">
      <div className="table-head"><div><h3>{'Itens do card\u00e1pio'}</h3><p>{'Pre\u00e7o e disponibilidade de cada produto.'}</p></div></div>
      {products.length ? <div className="responsive-table"><table className="table align-middle"><thead><tr><th>PRODUTO</th><th>CATEGORIA</th><th>{'PRE\u00c7O'}</th><th>STATUS</th></tr></thead><tbody>{products.map(product => <tr key={product.id}><td><strong>{product.name}</strong></td><td>{product.category_name}</td><td>{money(product.promotional_price ?? product.price)}</td><td><span className={'table-status ' + (product.available?'on':'')}><span/>{product.available?'Dispon\u00edvel':'Indispon\u00edvel'}</span></td></tr>)}</tbody></table></div> : <Empty text={'Nenhum produto cadastrado.'}/>}
    </div>
  </>;
}
function Manager({type,active,say,platformAdmin}){const category=type==='categories',[items,setItems]=useState([]),[categories,setCategories]=useState([]),[form,setForm]=useState(null),[busy,setBusy]=useState(false),[search,setSearch]=useState('');const base=category?'/categories':'/products';async function load(){if(!active)return;setEstablishment(active.id);const data=await request(base);setItems(data);if(category)setCategories(data);else setCategories(await request('/categories'))}useEffect(()=>{load().catch(e=>say(e.message))},[active?.id,type]);function fresh(){return category?{name:'',description:'',active:true,sort_order:items.length}:{category_id:categories[0]?.id||'',name:'',description:'',price:'',promotional_price:'',available:true,featured:false,image_url:''}}async function save(e){e.preventDefault();setBusy(true);try{const payload=category?{...form,active:!!form.active,sort_order:Number(form.sort_order||0)}:{...form,price:Number(form.price),promotional_price:form.promotional_price===''?null:Number(form.promotional_price),available:!!form.available,featured:!!form.featured};await request(form.id?`${base}/${form.id}`:base,{method:form.id?'PUT':'POST',body:JSON.stringify(payload)});setForm(null);await load();say(category?'Categoria salva com sucesso.':'Produto salvo com sucesso.')}catch(e){say(e.message)}finally{setBusy(false)}}async function remove(item){if(!confirm(`Excluir “${item.name}”?`))return;try{await request(`${base}/${item.id}`,{method:'DELETE'});await load();say('Item removido.')}catch(e){say(e.message)}}async function upload(e){const file=e.target.files?.[0];if(!file)return;e.target.value='';const body=new FormData();body.append('image',file);try{const out=await request('/uploads',{method:'POST',body});setForm(current=>({...current,image_url:out.url}));say('Imagem enviada.')}catch(err){say(err.message)}}const visible=items.filter(i=>i.name.toLowerCase().includes(search.toLowerCase()));return <><PageHeading eyebrow={category?'ORGANIZAÇÃO DO CARDÁPIO':'SABORES DA CASA'} title={category?'Categorias':'Produtos'} description={category?'Organize o cardápio em grupos fáceis de explorar.':'Apresente seus pratos com todos os detalhes que merecem.'} action={<button className="btn btn-primary" onClick={()=>setForm(fresh())} disabled={!active}><Plus size={17}/> {category?'Nova categoria':'Novo produto'}</button>}/>{!active?<Empty text={platformAdmin?'Selecione um estabelecimento no topo para gerenciar seus dados.':'Cadastre um estabelecimento antes de continuar.'}/>:<div className="panel-card table-panel"><div className="table-head"><div><h3>{category?'Todas as categorias':'Todos os produtos'} <span className="count-pill">{items.length}</span></h3><p>{category?'Categorias visíveis no seu cardápio.':'Produtos cadastrados neste estabelecimento.'}</p></div><div className="table-search"><Search size={15}/><input placeholder="Buscar" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>{items.length?<div className="responsive-table"><table className="table align-middle"><thead><tr>{!category&&<th>PRODUTO</th>}<th>{category?'CATEGORIA':'DESCRIÇÃO'}</th>{!category&&<th>PREÇO</th>}<th>STATUS</th><th></th></tr></thead><tbody>{visible.map(item=><tr key={item.id}>{!category&&<td><div className="product-name-cell">{item.image_url?<img src={imageUrl(item.image_url)}/>:<span className="food-placeholder"><UtensilsCrossed size={16}/></span>}<div><strong>{item.name}</strong>{item.featured&&<small className="featured-tag">✦ Em destaque</small>}</div></div></td>}<td>{category?<div><strong>{item.name}</strong><small className="cell-subtitle">{item.description||'Sem descrição'}</small></div>:<div><strong>{item.category_name}</strong><small className="cell-subtitle">{item.description||'Sem descrição'}</small></div>}</td>{!category&&<td><strong>{item.promotional_price!=null?money(item.promotional_price):money(item.price)}</strong>{item.promotional_price!=null&&<small className="old-price">{money(item.price)}</small>}</td>}<td><span className={`table-status ${(category?item.active:item.available)?'on':''}`}><span/>{(category?item.active:item.available)?'Ativo':'Pausado'}</span></td><td><div className="row-actions"><button onClick={()=>setForm({...item,price:item.price??'',promotional_price:item.promotional_price??''})} title="Editar"><Settings2 size={16}/></button><button onClick={()=>remove(item)} title="Excluir"><X size={16}/></button></div></td></tr>)}</tbody></table></div>:<Empty text={category?'Crie sua primeira categoria para organizar os produtos.':'Seu cardápio está esperando os primeiros sabores.'}/>}</div>}{form&&<Modal title={`${form.id?'Editar':'Novo'} ${category?'categoria':'produto'}`} close={()=>setForm(null)}><form className="edit-form" onSubmit={save}>{category?<><label>Nome da categoria<input className="form-control" autoFocus required maxLength="100" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Descrição<textarea className="form-control" maxLength="500" rows="3" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label><label>Posição no cardápio<input className="form-control" type="number" min="0" step="1" value={form.sort_order??0} onChange={e=>setForm({...form,sort_order:Number(e.target.value)})}/></label><label className="check-line"><input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Categoria visível no cardápio</label></>:<><label>Nome do produto<input className="form-control" autoFocus required maxLength="120" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Categoria<select className="form-select" required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Descrição<textarea className="form-control" rows="3" maxLength="1000" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-row"><label>Preço (R$)<input className="form-control" type="number" min="0" step="0.01" required value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label><label>Preço promocional<input className="form-control" type="number" min="0" step="0.01" value={form.promotional_price} onChange={e=>setForm({...form,promotional_price:e.target.value})}/></label></div><label>Imagem do produto<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={upload}/><small className="form-hint">PNG, JPG ou WebP até 5 MB.</small></label>{form.image_url&&<div className="image-preview-actions"><img className="upload-preview" src={imageUrl(form.image_url)} alt="Pr?via da imagem do produto"/><button type="button" className="image-remove-button" onClick={()=>setForm(current=>({...current,image_url:''}))}>Remover imagem</button></div>}<div className="check-group"><label className="check-line"><input type="checkbox" checked={!!form.available} onChange={e=>setForm({...form,available:e.target.checked})}/> Disponível</label><label className="check-line"><input type="checkbox" checked={!!form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Em destaque</label></div></>}<div className="modal-actions"><button type="button" className="btn btn-outline-secondary" onClick={()=>setForm(null)}>Cancelar</button><button className="btn btn-primary" disabled={busy||(!category&&!categories.length)}>{busy?'Salvando…':`Salvar ${category?'categoria':'produto'}`}</button></div></form></Modal>}</>}

function Settings({active,reload,say,platformAdmin}){const [form,setForm]=useState(active),[busy,setBusy]=useState(false),[qr,setQr]=useState(false);useEffect(()=>setForm(active),[active]);if(!active)return <><PageHeading eyebrow={platformAdmin?'CONFIGURA\u00c7\u00c3O DA PLATAFORMA':'IDENTIDADE DA SUA CASA'} title={platformAdmin?'Configurar estabelecimento':'Meu card\u00e1pio'} description={platformAdmin?'Selecione um estabelecimento no topo para configurar sua identidade visual.':'Personalize a vitrine que seus clientes v\u00e3o conhecer.'}/><Empty text={platformAdmin?'Selecione um estabelecimento no topo para continuar.':'Cadastre um estabelecimento para personalizar seu card\u00e1pio.'}/></>;async function save(e){e.preventDefault();setBusy(true);try{await request(`/establishments/${active.id}`,{method:'PUT',body:JSON.stringify(form)});await reload();say('Seu cardápio foi atualizado.')}catch(e){say(e.message)}finally{setBusy(false)}}async function upload(e,key){const file=e.target.files?.[0];if(!file)return;e.target.value='';const body=new FormData();body.append('image',file);try{const out=await request('/uploads',{method:'POST',body});setForm(current=>({...current,[key]:out.url}));say('Imagem enviada.')}catch(err){say(err.message)}}const link=`${location.origin}/m/${active.slug}`;return <><PageHeading eyebrow="IDENTIDADE DA SUA CASA" title="Meu cardápio" description="Personalize a vitrine que seus clientes vão conhecer." action={<a href={link} target="_blank" rel="noreferrer" className="btn btn-outline-secondary"><Eye size={17}/> Pré-visualizar</a>}/><form onSubmit={save} className="settings-layout"><div className="settings-main"><section className="panel-card settings-card"><div className="settings-card-head"><span className="settings-step">01</span><div><h3>Apresente sua casa</h3><p>Conte um pouco sobre o que torna seu lugar especial.</p></div></div><div className="edit-form"><label>Nome do estabelecimento<input className="form-control" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Uma descrição com sabor<textarea className="form-control" rows="3" maxLength="1000" placeholder="Conte sobre a cozinha, os ingredientes ou a história da casa…" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}/></label><div className="form-row"><label>Endereço<input className="form-control" value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></label><label>Telefone<input className="form-control" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></label></div></div></section><section className="panel-card settings-card"><div className="settings-card-head"><span className="settings-step">02</span><div><h3>Vista com suas cores</h3><p>Escolha tons que combinam com a identidade da sua marca.</p></div></div><div className="form-row color-row"><label>Cor principal<div className="color-input"><input type="color" value={form.primary_color||'#176b52'} onChange={e=>setForm({...form,primary_color:e.target.value})}/><span>{form.primary_color}</span></div></label><label>Cor de destaque<div className="color-input"><input type="color" value={form.accent_color||'#e7a83e'} onChange={e=>setForm({...form,accent_color:e.target.value})}/><span>{form.accent_color}</span></div></label></div></section><section className="panel-card settings-card"><div className="settings-card-head"><span className="settings-step">03</span><div><h3>Imagens da sua marca</h3><p>Use imagens leves e nítidas, com até 5 MB.</p></div></div><div className="form-row image-fields"><div className="image-field"><label>Logotipo<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e,'logo_url')}/></label>{form.logo_url&&<div className="image-preview-actions"><img className="brand-preview" src={imageUrl(form.logo_url)} alt="Pr?via do logotipo"/><button type="button" className="image-remove-button" onClick={()=>setForm(current=>({...current,logo_url:''}))}>Remover imagem</button></div>}</div><div className="image-field"><label>Imagem de capa<input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e,'cover_url')}/></label>{form.cover_url&&<div className="image-preview-actions"><img className="cover-preview" src={imageUrl(form.cover_url)} alt="Pr?via da imagem de capa"/><button type="button" className="image-remove-button" onClick={()=>setForm(current=>({...current,cover_url:''}))}>Remover imagem</button></div>}</div></div></section><div className="settings-save"><button className="btn btn-primary" disabled={busy}>{busy?'Salvando…':'Salvar alterações'}</button></div></div><aside className="settings-side"><div className="panel-card publish-card"><div className="publish-illustration"><BookOpen size={24}/><span>✳</span></div><div className="eyebrow">PUBLICAÇÃO</div><h3>{form.published?'Sua vitrine está no ar!':'Quase pronto para abrir!'}</h3><p>{form.published?'O público pode acessar seu menu.':'Ative a publicação quando seu cardápio estiver pronto.'}</p><label className="publish-toggle"><span><b>Cardápio publicado</b><small>Visível para qualquer pessoa</small></span><input type="checkbox" checked={!!form.published} onChange={e=>setForm({...form,published:e.target.checked})}/><i/></label><button type="button" className="public-link-button" onClick={()=>{setQr(true);}}><QrCode size={17}/> Ver QR Code <ArrowUpRight size={15}/></button><a className="side-preview" href={link} target="_blank" rel="noreferrer">Abrir cardápio público <ExternalLink size={14}/></a></div><div className="link-info"><span className="link-info-icon"><ClipboardList size={17}/></span><div><b>Link exclusivo</b><span>{link.replace(location.origin,'')}</span></div><button onClick={async()=>{await navigator.clipboard.writeText(link);say('Link copiado.')}}><ClipboardList size={15}/></button></div></aside></form>{qr&&<Modal title="Compartilhe seu cardápio" close={()=>setQr(false)}><div className="qr-modal"><QRCodeSVG value={link} size={220} level="H" includeMargin/><h3>Aponte a câmera e abra.</h3><p>Imprima o QR Code ou compartilhe seu link nas redes sociais.</p><button className="btn btn-primary" onClick={()=>window.print()}><Download size={16}/> Imprimir QR Code</button></div></Modal>}</>}

function Modal({ title, children, close }) {
  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    const bodyPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const computedPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) document.body.style.paddingRight = (computedPaddingRight + scrollbarWidth) + 'px';

    function handleKey(event) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      document.body.style.paddingRight = bodyPaddingRight;
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><h2 id="modal-title">{title}</h2><button className="icon-button" aria-label="Fechar detalhes" onClick={close}><X size={19} /></button></header>
        {children}
      </section>
    </div>
  );
}
function Empty({text}){return <div className="empty-state"><div><BookOpen size={22}/></div><p>{text}</p></div>}

function PublicMenu() {
  const { pathname } = useLocation();
  const slug = pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [selected, setSelected] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    let mounted = true;
    let hasData = false;
    const loadMenu = () => request('/public/' + slug)
      .then((freshData) => {
        if (!mounted) return;
        hasData = true;
        setData(freshData);
        setError('');
      })
      .catch((e) => { if (mounted && !hasData) setError(e.message); })
      .finally(() => { if (mounted) setLoading(false); });
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) loadMenu();
    };
    loadMenu();
    const online = () => { setOffline(false); loadMenu(); };
    const down = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', down);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      mounted = false;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', down);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [slug]);

  const grouped = useMemo(
    () => data?.categories.map((category) => ({
      ...category,
      products: data.products.filter((product) => product.category_id === category.id),
    })) || [],
    [data],
  );

  function openProduct(product, categoryName) {
    setSelectedProduct({ ...product, categoryName });
  }

  function handleProductKey(event, product, categoryName) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openProduct(product, categoryName);
    }
  }

  if (loading) return <div className="loading-screen"><span className="spinner-border text-success" /></div>;
  if (error) return <div className="public-error"><img src="/logo.svg" /><div className="error-doodle">{'\u2733'}</div><h1>{offline ? 'Sem conex\u00e3o com a internet' : 'Card\u00e1pio n\u00e3o encontrado'}</h1><p>{offline ? 'Este card\u00e1pio n\u00e3o est\u00e1 salvo neste dispositivo. Conecte-se \u00e0 internet e tente novamente.' : error}</p><a href="/" className="btn btn-primary">{'Voltar ao in\u00edcio'}</a></div>;

  const establishment = data.establishment;
  const style = { '--menu-primary': establishment.primary_color, '--menu-accent': establishment.accent_color };

  return (
    <div className="public-menu" style={style}>
      {offline && <div className="offline-strip">{'Voc\u00ea est\u00e1 offline. O card\u00e1pio salvo pode estar desatualizado.'}</div>}
      <header className="public-topbar">
        <a href="#top"><img src="/logo.svg" alt="Mesa Viva" /></a>
        <InstallButton />
        <span>{'UM CARD\u00c1PIO FEITO PARA VOC\u00ca'}</span>
      </header>
      <section className="public-hero" id="top">
        {establishment.cover_url && <img className="public-cover" src={imageUrl(establishment.cover_url)} alt="" />}
        <div className="hero-scrim" />
        <div className="public-hero-inner">
          <div className="public-brand-avatar">
            {establishment.logo_url ? <img src={imageUrl(establishment.logo_url)} alt={establishment.name} /> : <span>{establishment.name[0]}</span>}
          </div>
          <div className="public-eyebrow"><span /> FEITO COM CARINHO</div>
          <h1>{establishment.name}</h1>
          {establishment.description && <p>{establishment.description}</p>}
          <div className="public-contact">
            {establishment.address && <span>{establishment.address}</span>}
            {establishment.phone && <a href={'tel:' + establishment.phone.replace(/\D/g, '')}>{establishment.phone}</a>}
          </div>
        </div>
        <div className="hero-spark">{'\u2733'}</div>
      </section>
      <nav className="category-nav" aria-label={'Categorias do card\u00e1pio'}>
        {grouped.map((category) => <a key={category.id} className={selected === category.id ? 'active' : ''} href={'#category-' + category.id} onClick={() => setSelected(category.id)}>{category.name}</a>)}
      </nav>
      <main className="public-content">
        <div className="menu-section-heading"><div><span className="eyebrow">{'ESCOLHIDO PARA VOC\u00ca'}</span><h2>{'Nosso card\u00e1pio'}</h2></div><span className="menu-leaf">{'\u2733'}</span></div>
        {grouped.length === 0 ? <Empty text={'O card\u00e1pio est\u00e1 sendo preparado. Volte em breve.'} /> : grouped.map((category) => (
          <section className="menu-category" key={category.id} id={'category-' + category.id}>
            <div className="category-heading">
              <div><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div>
              <span>{category.products.length} {category.products.length === 1 ? 'op\u00e7\u00e3o' : 'op\u00e7\u00f5es'}</span>
            </div>
            <div className="public-products">
              {category.products.map((product) => (
                <article
                  className={'public-product ' + (!product.available ? 'unavailable' : '')}
                  key={product.id}
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  aria-label={'Ver detalhes de ' + product.name}
                  onClick={() => openProduct(product, category.name)}
                  onKeyDown={(event) => handleProductKey(event, product, category.name)}
                >
                  {product.image_url ? <img className="public-product-image" src={imageUrl(product.image_url)} alt="" /> : <div className="public-product-image no-product-image" aria-hidden="true"><UtensilsCrossed /></div>}
                  <div className="public-product-info">
                    {product.featured && <span className="featured-label">QUERIDINHO DA CASA</span>}
                    <h4>{product.name}</h4>
                    <p>{product.description || 'Preparado com ingredientes selecionados.'}</p>
                    <span className="product-details-hint">Ver detalhes <ArrowUpRight size={13} /></span>
                    <div className="product-price">
                      {product.promotional_price != null && <del>{money(product.price)}</del>}
                      <strong>{money(product.promotional_price ?? product.price)}</strong>
                      {!product.available && <span className="unavailable-label">{'Indispon\u00edvel no momento'}</span>}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
      <footer className="public-footer"><img src="/logo.svg" alt="Mesa Viva" /><span>{'Um bom encontro come\u00e7a \u00e0 mesa.'}</span><small>{'Card\u00e1pio digital por Mesa Viva'}</small></footer>
      {selectedProduct && (
        <Modal title={selectedProduct.name} close={() => setSelectedProduct(null)}>
          <div className="product-detail">
            <span className="product-detail-category">{selectedProduct.categoryName}</span>
            {selectedProduct.image_url
              ? <img className="product-detail-image" src={imageUrl(selectedProduct.image_url)} alt={selectedProduct.name} />
              : <div className="product-detail-image product-detail-placeholder" aria-hidden="true"><UtensilsCrossed size={34} /></div>}
            {selectedProduct.featured && <span className="featured-label">QUERIDINHO DA CASA</span>}
            <p>{selectedProduct.description || 'Preparado com ingredientes selecionados.'}</p>
            <div className="product-detail-price">
              {selectedProduct.promotional_price != null && <del>{money(selectedProduct.price)}</del>}
              <strong>{money(selectedProduct.promotional_price ?? selectedProduct.price)}</strong>
            </div>
            {!selectedProduct.available && <p className="product-detail-unavailable">{'Indispon\u00edvel no momento'}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default App;
