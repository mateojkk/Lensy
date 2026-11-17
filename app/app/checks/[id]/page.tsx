import LensyApp from '../../../workspace';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <LensyApp checkId={id}/>;}
