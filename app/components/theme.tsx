"use client";
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {Moon,Sun} from 'lucide-react';

type ColorTheme='light'|'dark';
type Theme=ColorTheme|'system';
const key='lensy.theme';
const valid=(value:unknown):Theme=>value==='light'||value==='dark'?value:'system';
const ThemeContext=createContext<{theme:ColorTheme;ready:boolean;setTheme:(theme:ColorTheme)=>void}>({theme:'light',ready:false,setTheme:()=>{}});

export function ThemeProvider({children}:{children:ReactNode}){
 const [theme,setSelected]=useState<ColorTheme>('light');
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  let selected:Theme='system';
  try{selected=valid(localStorage.getItem(key));}catch{}
  const apply=()=>{
   const resolved=selected==='system'?(media.matches?'dark':'light'):selected;
   document.documentElement.dataset.theme=resolved;
   document.documentElement.dataset.themePreference=selected;
   setSelected(resolved);
   setReady(true);
  };
  const choose=(event:Event)=>{selected=valid((event as CustomEvent).detail);apply();};
  const sync=(event:StorageEvent)=>{if(event.key===key||event.key===null){selected=valid(event.newValue);apply();}};
  apply();media.addEventListener('change',apply);window.addEventListener('lensy-theme',choose);window.addEventListener('storage',sync);
  return()=>{media.removeEventListener('change',apply);window.removeEventListener('lensy-theme',choose);window.removeEventListener('storage',sync);};
 },[]);
 function setTheme(value:ColorTheme){try{localStorage.setItem(key,value);}catch{}window.dispatchEvent(new CustomEvent('lensy-theme',{detail:value}));}
 return <ThemeContext.Provider value={{theme,ready,setTheme}}>{children}</ThemeContext.Provider>;
}
export default function ThemeSwitch(){
 const {theme,ready,setTheme}=useContext(ThemeContext),label=theme==='dark'?'Switch to light mode':'Switch to dark mode';
 return <button type="button" className="theme-control" aria-label={label} title={label} disabled={!ready} onClick={()=>setTheme(theme==='dark'?'light':'dark')}><Moon className="theme-moon" size={17} aria-hidden="true"/><Sun className="theme-sun" size={17} aria-hidden="true"/></button>;
}
