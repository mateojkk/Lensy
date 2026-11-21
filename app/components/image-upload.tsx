"use client";
import {useEffect,useRef,useState} from 'react';
import {ImagePlus,UploadCloud,X} from 'lucide-react';

export default function ImageUpload({file,disabled,onChange,onError}:{file:File|null;disabled:boolean;onChange:(file:File|null)=>void;onError:(message:string)=>void}){
 const input=useRef<HTMLInputElement>(null),[preview,setPreview]=useState(''),[dragging,setDragging]=useState(false);
 useEffect(()=>{if(!file){setPreview('');return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 function select(files:FileList|null){
  if(disabled||!files?.length)return;
  if(files.length!==1){onError('Choose one image at a time.');return;}
  const next=files[0];
  if(!['image/png','image/jpeg','image/webp','image/gif'].includes(next.type)){onError('Choose a PNG, JPEG, WebP or GIF image.');return;}
  if(!next.size||next.size>5*1024*1024){onError('Choose a non-empty image up to 5 MB.');return;}
  onError('');onChange(next);
 }
 return <div className="image-upload">
  <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Upload image" aria-describedby="image-upload-note" disabled={disabled} hidden onChange={e=>{select(e.target.files);e.target.value='';}}/>
  {file?<div className="selected-image"><img src={preview||undefined} alt="Selected image preview"/><div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB</span></div><button className="icon-button" aria-label="Remove image" disabled={disabled} onClick={()=>onChange(null)}><X size={18}/></button></div>:<div className={`image-drop-area ${dragging?'is-dragging':''}`} onDragOver={e=>{e.preventDefault();if(!disabled)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);select(e.dataTransfer.files);}}>
   <UploadCloud size={27} strokeWidth={1.4}/><strong>Drop an image here</strong><span>PNG, JPEG, WebP or GIF · up to 5 MB</span><button className="secondary-button" disabled={disabled} onClick={()=>input.current?.click()}><ImagePlus size={16}/>Choose image</button>
  </div>}
  <p id="image-upload-note" className="input-note upload-disclosure">When you start a check, your image gets a public Litterbox link for 1 hour so Telegraph can read it. Your saved result stays private until you share it.</p>
 </div>;
}
