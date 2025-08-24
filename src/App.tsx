import React, { useEffect, useMemo, useState } from 'react'

/**
 * App – Gestor de Canciones (PWA)
 * - Responsive fix para móvil:
 *   - overflow-x-hidden en contenedor raíz
 *   - grid-cols-1 en móvil, lg:grid-cols-3 en desktop
 *   - min-w-0 en secciones para permitir encogimiento
 *   - header con flex-wrap
 *   - <pre> con break-words / max-w-full / overflow-x-auto
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
    return so
