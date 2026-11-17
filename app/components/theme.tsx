"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';

type Theme='light'|'dark'|'system';
const key='lensy.theme';
const valid=(value:unknown):Theme=>value==='light'||value==='dark'?value:'system';
const ThemeContext=createContext<{theme:Theme;ready:boolean;setTheme:(theme:Theme)=>void}>({theme:'system',ready:false,setTheme:()=>{}});

export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setSelected]=useState<Theme>('system');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  let selected:Theme='system';
  try{selected=valid(localStorage.getItem(key));}catch{}
  const apply=()=>{
   document.documentElement.dataset.theme=selected==='system'?(media.matches?'dark':'light'):selected;
   document.documentElement.dataset.themePreference=selected;
   setSelected(selected);
   setReady(true);
  };
  const choose=(event:Event)=>{selected=valid((event as CustomEvent).detail);apply();};
  const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null){selected=valid(event.newValue);apply();}};
  apply();media.addEventListener('change',apply);window.addEventListener('lensy-theme',choose);window.addEventListener('storage',sync);
  return()=>{media.removeEventListener('change',apply);window.removeEventListener('lensy-theme',choose);window.removeEventListener('storage',sync);};
 },[]);
 function setTheme(value:Theme){try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new CustomEvent('lensy-theme',{detail:value}));}
 return <ThemeContext.Provider value={{theme,ready,setTheme}}>{children}</ThemeContext.Provider>;
}
export default function ThemeSwitch(){
 const {theme,ready,setTheme}=useContext(ThemeContext),Icon=theme==='dark'?Moon:theme==='light'?Sun:Monitor;
 return <label className="theme-control" title="Color theme"><Icon size={15} aria-hidden="true"/><select aria-label="Color theme" disabled={!ready} value={theme} onChange={event=>setTheme(valid(event.target.value))}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
