import React, { useEffect, useMemo, useState } from 'react'

/**
 * App – Gestor de Canciones (PWA)
 * - Basado en FASE UNO, con banner de instalación y ajustes para Tailwind/Vite.
 * - Almacena datos en localStorage (offline by default).
 */

// ----------------- Tipos -----------------
type UUID = string;

type SectionLine = {
  kind: 'chords' | 'lyrics' | 'mixed';
  chords?: string;
  lyrics?: string;
};

type Section = { id: UUID; name: string; lines: SectionLine[] };

export type Song = {
  id: UUID;
  title: string;
  artist?: string;
  key: string;
  preferSharps: boolean;
  sections: Section[];
};

type SetlistItem = { songId: UUID; transpose: number };

type Setlist = { id: UUID; name: string; items: SetlistItem[] };

type Settings = { theme: 'light' | 'dark' | 'system'; preferSharpsGlobal: boolean };

// ----------------- Utilidades Música -----------------
const SHARPS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;
const FLATS  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"] as const;
const NOTE_TO_INDEX: Record<string, number> = {
  C:0, 'B#':0,
  'C#':1, Db:1,
  D:2,
  'D#':3, Eb:3,
  E:4, Fb:4,
  F:5, 'E#':5,
  'F#':6, Gb:6,
  G:7,
  'G#':8, Ab:8,
  A:9,
  'A#':10, Bb:10,
  B:11, Cb:11,
}
const CHORD_RE = /^([A-G])(#{1}|b{1})?([^\s/|]*)?(?:\/([A-G])(#{1}|b{1})?)?$/
function clamp12(n:number){ let x=n%12; if(x<0) x+=12; return x }
function uid(): UUID { // @ts-ignore
  return (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as UUID }

export type ParsedChord = { root:string; ext:string; bass?:string }
function parseChord(token:string): ParsedChord | null {
  if (!token) return null
  if (token === 'N.C.' || token === 'NC') return { root: token, ext: '' }
  const m = token.match(CHORD_RE); if (!m) return null
  const [_, r, acc, ext, br, bacc] = m
  const root = r + (acc ?? '')
  const bass = br ? br + (bacc ?? '') : undefined
  return { root, ext: ext ?? '', bass }
}
function formatNoteFromIndex(idx:number, preferSharps:boolean){ return (preferSharps?SHARPS:FLATS)[clamp12(idx)] }
function transposeNote(note:string, steps:number, preferSharps:boolean){
  if (note==='N.C.'||note==='NC') return note
  const idx = NOTE_TO_INDEX[note]; if (idx===undefined) return note
  return formatNoteFromIndex(idx+steps, preferSharps)
}
function transposeChordToken(token:string, steps:number, preferSharps:boolean){
  const parsed = parseChord(token); if(!parsed) return token
  if(parsed.root==='N.C.'||parsed.root==='NC') return token
  const idx = NOTE_TO_INDEX[parsed.root]; if(idx===undefined) return token
  const newRoot = formatNoteFromIndex(idx+steps, preferSharps)
  const newBass = parsed.bass ? transposeNote(parsed.bass, steps, preferSharps) : undefined
  return newRoot + (parsed.ext ?? '') + (newBass ? '/' + newBass : '')
}
function transposeChordLine(line:string, steps:number, preferSharps:boolean){
  return (line||'').replace(/[^\s]+/g, tok => transposeChordToken(tok, steps, preferSharps))
}

// ----------------- Hooks -----------------
function useLocalStorage<T>(key:string, initial:T){
  const [value, setValue] = useState<T>(()=>{
    try{ const raw=localStorage.getItem(key); return raw? JSON.parse(raw) as T : initial }catch{ return initial }
  })
  useEffect(()=>{ try{ localStorage.setItem(key, JSON.stringify(value)) }catch{} }, [key, value])
  return [value, setValue] as const
}

// ----------------- Datos demo -----------------
const seedSong = (): Song => ({
  id: uid(), title: 'Tus Ojos Revelan (Demo)', artist: 'Ejemplo', key: 'G', preferSharps: true,
  sections: [
    { id: uid(), name: 'Intro', lines: [ { kind:'chords', chords: '| G - Em - D - C |' } ] },
    { id: uid(), name: 'Verso', lines: [
      { kind:'chords', chords: '| G - D/F# - Em - D - C - Am - D |' },
      { kind:'lyrics', lyrics:[ 'Tus ojos revelan que yo','Nada puedo esconder','Que no soy nada sin Ti','Oh fiel Señor' ].join('\n') }
    ]},
    { id: uid(), name: 'Coro', lines: [
      { kind:'chords', chords: '| G - Em - Am - C |' },
      { kind:'lyrics', lyrics:[ 'Lleva mi vida a una sola verdad','Que cuando me miras','Nada puedo ocultar' ].join('\n') }
    ]},
  ]
})

// ----------------- Componentes de UI -----------------
function classNames(...xs:(string|false|undefined|null)[]){ return xs.filter(Boolean).join(' ') }
function ToolbarButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>){ const {className, ...rest}=props; return (
  <button {...rest} className={classNames('px-3 py-1.5 rounded-xl border text-sm shadow-sm hover:shadow active:scale-[0.98] transition border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900', className)} />)}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>){ const {className, ...rest}=props; return (
  <input {...rest} className={classNames('px-3 py-2 rounded-xl border w-full border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900', className)} />)}
function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>){ const {className, ...rest}=props; return (
  <textarea {...rest} className={classNames('px-3 py-2 rounded-xl border w-full min-h-[120px] font-mono border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900', className)} />)}

// ----------------- App -----------------
export default function App(){
  const [settings, setSettings] = useLocalStorage<Settings>('settings_v1', { theme:'system', preferSharpsGlobal:true })
  const [songs, setSongs] = useLocalStorage<Song[]>('songs_v1', [seedSong()])
  const [setlists, setSetlists] = useLocalStorage<Setlist[]>('setlists_v1', [])
  const [tab, setTab] = useState<'songs'|'setlists'|'settings'>('songs')
  const [query, setQuery] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<UUID|null>(songs[0]?.id ?? null)
  const [selectedSetlistId, setSelectedSetlistId] = useState<UUID|null>(null)

  // Sincroniza tema
  useEffect(()=>{
    const root = document.documentElement
    const sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = settings.theme==='dark' || (settings.theme==='system' && sysDark)
    root.classList.toggle('dark', isDark)
    root.classList.add('bg-neutral-50','dark:bg-neutral-950')
  }, [settings.theme])

  // Banner de instalación (A2HS)
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  useEffect(()=>{
    const handler = (e:any)=>{ e.preventDefault(); setInstallEvt(e); setShowInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return ()=> window.removeEventListener('beforeinstallprompt', handler)
  },[])

  const filteredSongs = useMemo(()=>{
    const q = query.trim().toLowerCase(); if(!q) return songs
    return songs.filter(s => (
      s.title.toLowerCase().includes(q) || (s.artist?.toLowerCase().includes(q) ?? false) ||
      s.sections.some(sec => sec.lines.some(l => (l.chords??'').toLowerCase().includes(q) || (l.lyrics??'').toLowerCase().includes(q)))
    ))
  }, [songs, query])

  function addSong(){ const s:Song={ id:uid(), title:'Nueva Canción', artist:'', key:'C', preferSharps: settings.preferSharpsGlobal, sections:[{ id:uid(), name:'Intro', lines:[{ kind:'chords', chords:'| C - F - G - C |'}]}]}; setSongs(p=>[s,...p]); setSelectedSongId(s.id); setTab('songs') }
  function removeSong(id:UUID){ setSongs(p=>p.filter(s=>s.id!==id)); if(selectedSongId===id) setSelectedSongId(null) }
  function updateSong(u:Song){ setSongs(p=>p.map(s=>s.id===u.id?u:s)) }

  function addSetlist(){ const sl:Setlist={ id:uid(), name:'Nueva Setlist', items:[] }; setSetlists(p=>[sl,...p]); setSelectedSetlistId(sl.id); setTab('setlists') }
  function updateSetlist(u:Setlist){ setSetlists(p=>p.map(s=>s.id===u.id?u:s)) }
  function removeSetlist(id:UUID){ setSetlists(p=>p.filter(s=>s.id!==id)); if(selectedSetlistId===id) setSelectedSetlistId(null) }

  function downloadJSON(filename:string, data:unknown){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url) }
  async function pickJSONFile():Promise<unknown|null>{ return await new Promise(res=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange=()=>{ const f=inp.files?.[0]; if(!f) return res(null); const fr=new FileReader(); fr.onload=()=>{ try{ res(JSON.parse(String(fr.result))) }catch{ res(null) } }; fr.readAsText(f) }; inp.click() }) }

  async function exportAll(){ downloadJSON('canciones_setlists.json', { songs, setlists, settings }) }
  async function importAll(){ const data=await pickJSONFile(); if(!data||typeof data!=='object') return; const o=data as any; if(Array.isArray(o.songs)) setSongs(o.songs); if(Array.isArray(o.setlists)) setSetlists(o.setlists); if(o.settings) setSettings(o.settings) }

  return (
    <div className="min-h-screen text-neutral-900 dark:text-neutral-100">
      <header className="sticky top-0 z-30 backdrop-blur bg-white/70 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="text-xl font-semibold">🎵 Gestor de Canciones</div>
          <nav className="ml-4 flex gap-2">
            {[
              { key:'songs', label:'Canciones' },
              { key:'setlists', label:'Setlists' },
              { key:'settings', label:'Ajustes' },
            ].map(t => (
              <ToolbarButton key={t.key as string} onClick={()=>setTab(t.key as any)} className={classNames(tab===t.key && 'bg-neutral-100 dark:bg-neutral-800')}>{t.label}</ToolbarButton>
            ))}
          </nav>
          <div className="ml-auto flex gap-2 items-center">
            {showInstall && (
              <ToolbarButton onClick={async()=>{ if(!installEvt) return; installEvt.prompt(); const { outcome } = await installEvt.userChoice; setShowInstall(false); setInstallEvt(null) }}>➕ Instalar</ToolbarButton>
            )}
            <ToolbarButton title="Exportar todo (JSON)" onClick={exportAll}>Exportar</ToolbarButton>
            <ToolbarButton title="Importar JSON" onClick={importAll}>Importar</ToolbarButton>
            <div className="flex items-center gap-1">
              <span className="text-xs opacity-70">♯</span>
              <label className="inline-flex items-center cursor-pointer select-none">
                <input type="checkbox" checked={settings.preferSharpsGlobal} onChange={e=>setSettings({...settings, preferSharpsGlobal:e.target.checked})} className="sr-only" />
                <span className="w-10 h-6 bg-neutral-300 dark:bg-neutral-700 rounded-full relative">
                  <span className={classNames('absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-neutral-900 rounded-full transition', settings.preferSharpsGlobal && 'translate-x-4')}></span>
                </span>
              </label>
              <span className="text-xs opacity-70">♭</span>
            </div>
            <ToolbarButton onClick={()=>setSettings({...settings, theme: settings.theme==='dark'?'light':'dark'})}>
              {settings.theme==='dark' ? '☀️ Claro' : '🌙 Oscuro'}
            </ToolbarButton>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-4 grid lg:grid-cols-3 gap-4">
        {tab==='songs' && (
          <>
            <section className="lg:col-span-1 border rounded-2xl p-3 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
              <div className="flex gap-2 mb-2">
                <Input placeholder="Buscar…" value={query} onChange={e=>setQuery(e.target.value)} />
                <ToolbarButton onClick={addSong}>+ Añadir</ToolbarButton>
              </div>
              <ul className="space-y-1 max-h-[70vh] overflow-auto pr-1">
                {filteredSongs.map(s=> (
                  <li key={s.id} className={classNames('rounded-xl p-2 cursor-pointer border', s.id===selectedSongId ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-400 dark:border-neutral-700' : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900')} onClick={()=>setSelectedSongId(s.id)}>
                    <div className="font-medium">{s.title}</div>
                    <div className="text-xs opacity-70">{s.artist || '—'} · Tónica: {s.key}</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:col-span-2 border rounded-2xl p-4 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
              {selectedSongId ? (
                <SongPanel key={selectedSongId} song={songs.find(s=>s.id===selectedSongId)!} onChange={updateSong} onDelete={()=>removeSong(selectedSongId)} preferSharpsGlobal={settings.preferSharpsGlobal} />
              ) : (<div className="opacity-70">Selecciona o crea una canción…</div>)}
            </section>
          </>
        )}

        {tab==='setlists' && (
          <>
            <section className="lg:col-span-1 border rounded-2xl p-3 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
              <div className="flex gap-2 mb-2">
                <ToolbarButton onClick={addSetlist}>+ Nueva</ToolbarButton>
              </div>
              <ul className="space-y-1 max-h-[70vh] overflow-auto pr-1">
                {setlists.map(s=> (
                  <li key={s.id} className={classNames('rounded-xl p-2 cursor-pointer border', s.id===selectedSetlistId ? 'bg-neutral-100 dark:bg-neutral-900 border-neutral-400 dark:border-neutral-700' : 'border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-900')} onClick={()=>setSelectedSetlistId(s.id)}>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs opacity-70">{s.items.length} ítem(s)</div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:col-span-2 border rounded-2xl p-4 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
              {selectedSetlistId ? (
                <SetlistPanel key={selectedSetlistId} setlist={setlists.find(x=>x.id===selectedSetlistId)!} songs={songs} onChange={updateSetlist} onDelete={()=>removeSetlist(selectedSetlistId)} preferSharpsGlobal={settings.preferSharpsGlobal} />
              ) : (<div className="opacity-70">Selecciona o crea una setlist…</div>)}
            </section>
          </>
        )}

        {tab==='settings' && (
          <section className="lg:col-span-3 border rounded-2xl p-4 bg-white dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold mb-3">Ajustes</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
                <div className="font-medium mb-2">Preferencia de accidentales</div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2"><input type="radio" name="acc" checked={settings.preferSharpsGlobal} onChange={()=>setSettings({...settings, preferSharpsGlobal:true})} /><span>Usar ♯ (C, C#, D…)</span></label>
                  <label className="inline-flex items-center gap-2"><input type="radio" name="acc" checked={!settings.preferSharpsGlobal} onChange={()=>setSettings({...settings, preferSharpsGlobal:false})} /><span>Usar ♭ (C, Db, D…)</span></label>
                </div>
              </div>
              <div className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
                <div className="font-medium mb-2">Tema</div>
                <div className="flex items-center gap-3">
                  {(['light','dark','system'] as const).map(t => (
                    <label key={t} className="inline-flex items-center gap-2"><input type="radio" name="theme" checked={settings.theme===t} onChange={()=>setSettings({...settings, theme:t})} /><span>{t==='light'?'Claro':t==='dark'?'Oscuro':'Sistema'}</span></label>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl border p-3 mt-4 border-neutral-200 dark:border-neutral-800">
              <div className="font-medium mb-2">Respaldo</div>
              <div className="flex gap-2">
                <ToolbarButton onClick={exportAll}>Exportar JSON</ToolbarButton>
                <ToolbarButton onClick={importAll}>Importar JSON</ToolbarButton>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="max-w-6xl mx-auto px-4 pb-6">
        <div className="text-xs opacity-60">PWA lista para build y deploy en GitHub Pages.</div>
      </footer>
    </div>
  )
}

// ----------------- Subcomponentes: Canción & Setlist -----------------
function SongPanel({ song, onChange, onDelete, preferSharpsGlobal }:{ song:Song; onChange:(s:Song)=>void; onDelete:()=>void; preferSharpsGlobal:boolean }){
  const [mode, setMode] = useState<'view'|'edit'>('view')
  const [viewKind, setViewKind] = useState<'mixed'|'chords'|'lyrics'>('mixed')
  const [transpose, setTranspose] = useState(0)
  const preferSharps = song.preferSharps ?? preferSharpsGlobal
  function patch(p:Partial<Song>){ onChange({ ...song, ...p }) }
  function addSection(){ const sec:Section={ id:uid(), name:'Sección', lines:[{ kind:'chords', chords:'| C - G - Am - F |'}] }; patch({ sections:[...song.sections, sec] }) }
  function removeSection(id:UUID){ patch({ sections: song.sections.filter(s=>s.id!==id) }) }
  function updateSection(id:UUID, update:Partial<Section>){ patch({ sections: song.sections.map(s=>s.id===id?{...s,...update}:s) }) }
  function moveSection(id:UUID, dir:-1|1){ const idx=song.sections.findIndex(s=>s.id===id); if(idx<0) return; const arr=[...song.sections]; const j=idx+dir; if(j<0||j>=arr.length) return; [arr[idx], arr[j]]=[arr[j], arr[idx]]; patch({ sections:arr }) }
  function downloadJSON(filename:string, data:unknown){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url) }
  async function pickJSONFile():Promise<unknown|null>{ return await new Promise(res=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange=()=>{ const f=inp.files?.[0]; if(!f) return res(null); const fr=new FileReader(); fr.onload=()=>{ try{ res(JSON.parse(String(fr.result))) }catch{ res(null) } }; fr.readAsText(f) }; inp.click() }) }
  function exportSong(){ downloadJSON(`${song.title||'cancion'}.json`, song) }
  async function importSongReplace(){ const data=await pickJSONFile(); if(!data||typeof data!=='object') return; const s=data as Song; if(!s.id) s.id=song.id; onChange({ ...song, ...s }) }
  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <Input value={song.title} onChange={e=>patch({ title:e.target.value })} className="max-w-[18rem]" />
        <Input placeholder="Artista" value={song.artist ?? ''} onChange={e=>patch({ artist:e.target.value })} className="max-w-[14rem]" />
        <Input placeholder="Tónica" value={song.key} onChange={e=>patch({ key:e.target.value })} className="w-24" />
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={song.preferSharps} onChange={e=>patch({ preferSharps:e.target.checked })} /> Preferir ♯</label>
        <div className="ml-auto flex gap-2">
          <ToolbarButton onClick={()=>setMode(mode==='view'?'edit':'view')}>{mode==='view'?'✍️ Editar':'👁️ Ver'}</ToolbarButton>
          <ToolbarButton onClick={exportSong}>Exportar</ToolbarButton>
          <ToolbarButton onClick={importSongReplace}>Importar (reemplazar)</ToolbarButton>
          <ToolbarButton onClick={onDelete}>Eliminar</ToolbarButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="inline-flex items-center gap-2 text-sm">
          <span>Vista:</span>
          {(['mixed','chords','lyrics'] as const).map(k=> (
            <label key={k} className="inline-flex items-center gap-1"><input type="radio" name="v" checked={viewKind===k} onChange={()=>setViewKind(k)} /><span>{k==='mixed'?'Mixta':k==='chords'?'Acordes':'Letra'}</span></label>
          ))}
        </div>
        <div className="inline-flex items-center gap-2 text-sm">
          <span>Transponer:</span>
          <ToolbarButton onClick={()=>setTranspose(t=>t-1)}>−1</ToolbarButton>
          <div className="px-3 py-1 rounded-lg border border-neutral-300 dark:border-neutral-700">{transpose}</div>
          <ToolbarButton onClick={()=>setTranspose(t=>t+1)}>+1</ToolbarButton>
          <ToolbarButton onClick={()=>setTranspose(0)}>Reset</ToolbarButton>
        </div>
      </div>

      {mode==='edit' ? (
        <div className="space-y-4">
          {song.sections.map((sec, idx)=> (
            <div key={sec.id} className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-2 mb-2">
                <Input value={sec.name} onChange={e=>updateSection(sec.id,{ name:e.target.value })} className="max-w-[16rem]" />
                <div className="ml-auto flex gap-2">
                  <ToolbarButton onClick={()=>moveSection(sec.id,-1)} title="Subir">↑</ToolbarButton>
                  <ToolbarButton onClick={()=>moveSection(sec.id,1)} title="Bajar">↓</ToolbarButton>
                  <ToolbarButton onClick={()=>removeSection(sec.id)} title="Eliminar">🗑️</ToolbarButton>
                </div>
              </div>
              {sec.lines.map((ln,i)=> (
                <div key={i} className="grid md:grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-xs opacity-70 mb-1">Acordes (usa | y - si quieres)</div>
                    <TextArea value={ln.chords ?? ''} onChange={e=>{ const lines=[...sec.lines]; lines[i]={...lines[i], chords:e.target.value, kind: lines[i].kind==='lyrics'? 'mixed' : (lines[i].kind||'chords')} as SectionLine; updateSection(sec.id,{ lines }) }} />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Letra</div>
                    <TextArea value={ln.lyrics ?? ''} onChange={e=>{ const lines=[...sec.lines]; lines[i]={...lines[i], lyrics:e.target.value, kind: lines[i].kind==='chords'? 'mixed' : (lines[i].kind||'lyrics')} as SectionLine; updateSection(sec.id,{ lines }) }} />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <ToolbarButton onClick={()=>updateSection(sec.id, { lines:[...sec.lines, { kind:'chords', chords:'| C - G - Am - F |'} ] })}>+ Línea de acordes</ToolbarButton>
                <ToolbarButton onClick={()=>updateSection(sec.id, { lines:[...sec.lines, { kind:'lyrics', lyrics:''} ] })}>+ Línea de letra</ToolbarButton>
                <ToolbarButton onClick={()=>updateSection(sec.id, { lines:[...sec.lines, { kind:'mixed', chords:'| C - G |', lyrics:''} ] })}>+ Línea mixta</ToolbarButton>
              </div>
            </div>
          ))}
          <ToolbarButton onClick={addSection}>+ Añadir sección</ToolbarButton>
        </div>
      ) : (
        <div className="space-y-6">
          {song.sections.map(sec=> (
            <div key={sec.id}>
              <h3 className="font-semibold tracking-wide uppercase text-xs opacity-70 mb-1">{sec.name}</h3>
              {sec.lines.map((ln,i)=> (
                <div key={i} className="mb-4">
                  {(viewKind==='chords'||viewKind==='mixed') && !!ln.chords && (
                    <pre className="font-mono whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      {ln.chords.split('\n').map((line, idx)=> (
                        <div key={idx}>{transposeChordLine(line, transpose, song.preferSharps ?? true)}</div>
                      ))}
                    </pre>
                  )}
                  {(viewKind==='lyrics'||viewKind==='mixed') && !!ln.lyrics && (
                    <div className="whitespace-pre-wrap leading-7">{ln.lyrics}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SetlistPanel({ setlist, songs, onChange, onDelete, preferSharpsGlobal }:{ setlist:Setlist; songs:Song[]; onChange:(s:Setlist)=>void; onDelete:()=>void; preferSharpsGlobal:boolean }){
  const [mode, setMode] = useState<'view'|'edit'>('view')
  function patch(p:Partial<Setlist>){ onChange({ ...setlist, ...p }) }
  function addSongToSetlist(songId:UUID){ patch({ items:[...setlist.items, { songId, transpose:0 }] }) }
  function removeItem(idx:number){ const items=[...setlist.items]; items.splice(idx,1); patch({ items }) }
  function moveItem(idx:number, dir:-1|1){ const j=idx+dir; if(j<0||j>=setlist.items.length) return; const items=[...setlist.items]; [items[idx], items[j]]=[items[j], items[idx]]; patch({ items }) }
  function downloadJSON(filename:string, data:unknown){ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url) }
  async function pickJSONFile():Promise<unknown|null>{ return await new Promise(res=>{ const inp=document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange=()=>{ const f=inp.files?.[0]; if(!f) return res(null); const fr=new FileReader(); fr.onload=()=>{ try{ res(JSON.parse(String(fr.result))) }catch{ res(null) } }; fr.readAsText(f) }; inp.click() }) }
  function exportSetlist(){ downloadJSON(`${setlist.name||'setlist'}.json`, setlist) }
  async function importSetlistReplace(){ const data=await pickJSONFile(); if(!data||typeof data!=='object') return; const sl=data as Setlist; if(!sl.id) sl.id=setlist.id; onChange({ ...setlist, ...sl }) }
  const songMap = useMemo(()=> Object.fromEntries(songs.map(s=>[s.id, s])) as Record<string,Song>, [songs])
  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <Input value={setlist.name} onChange={e=>patch({ name:e.target.value })} className="max-w-[18rem]" />
        <div className="ml-auto flex gap-2">
          <ToolbarButton onClick={()=>setMode(mode==='view'?'edit':'view')}>{mode==='view'?'✍️ Editar':'👁️ Ver'}</ToolbarButton>
          <ToolbarButton onClick={exportSetlist}>Exportar</ToolbarButton>
          <ToolbarButton onClick={importSetlistReplace}>Importar (reemplazar)</ToolbarButton>
          <ToolbarButton onClick={onDelete}>Eliminar</ToolbarButton>
        </div>
      </div>
      {mode==='edit' ? (
        <div className="space-y-3">
          <div className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
            <div className="font-medium mb-2">Añadir canción</div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[40vh] overflow-auto">
              {songs.map(s=> (
                <button key={s.id} onClick={()=>addSongToSetlist(s.id)} className="text-left p-2 rounded-lg border hover:bg-neutral-50 dark:hover:bg-neutral-900 border-neutral-200 dark:border-neutral-800">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-xs opacity-70">{s.artist || '—'}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
            <div className="font-medium mb-2">Orden de setlist</div>
            <ol className="space-y-2">
              {setlist.items.map((it, idx)=>{
                const s = songMap[it.songId]; if(!s) return (<li key={idx} className="p-2 rounded-lg border border-red-300 text-red-700">(Canción no encontrada)</li>)
                return (
                  <li key={idx} className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="font-medium flex-1">{s.title}</div>
                      <div className="text-xs opacity-70">{s.artist || '—'}</div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">Transponer</span>
                        <ToolbarButton onClick={()=>{ const items=[...setlist.items]; items[idx] = { ...items[idx], transpose: items[idx].transpose - 1 }; patch({ items }) }}>−1</ToolbarButton>
                        <div className="px-2 py-1 rounded-md border border-neutral-300 dark:border-neutral-700 min-w-[2ch] text-center">{it.transpose}</div>
                        <ToolbarButton onClick={()=>{ const items=[...setlist.items]; items[idx] = { ...items[idx], transpose: items[idx].transpose + 1 }; patch({ items }) }}>+1</ToolbarButton>
                      </div>
                      <ToolbarButton onClick={()=>moveItem(idx,-1)}>↑</ToolbarButton>
                      <ToolbarButton onClick={()=>moveItem(idx,1)}>↓</ToolbarButton>
                      <ToolbarButton onClick={()=>removeItem(idx)}>🗑️</ToolbarButton>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {setlist.items.map((it, idx)=>{
            const s = songMap[it.songId]; if(!s) return null
            return (
              <div key={idx} className="rounded-xl border p-3 border-neutral-200 dark:border-neutral-800">
                <div className="font-semibold mb-2">{s.title} <span className="opacity-60 font-normal">({s.artist || '—'})</span></div>
                {s.sections.map(sec=> (
                  <div key={sec.id} className="mb-4">
                    <div className="text-xs opacity-70 uppercase tracking-wide mb-1">{sec.name}</div>
                    {sec.lines.map((ln,i)=> (
                      <div key={i}>
                        {!!ln.chords && (
                          <pre className="font-mono whitespace-pre-wrap bg-neutral-50 dark:bg-neutral-900 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 mb-2">
                            {ln.chords.split('\n').map((line,j)=> (
                              <div key={j}>{transposeChordLine(line, it.transpose, s.preferSharps ?? preferSharpsGlobal)}</div>
                            ))}
                          </pre>
                        )}
                        {!!ln.lyrics && (
                          <div className="whitespace-pre-wrap opacity-80 mb-3">{ln.lyrics}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
