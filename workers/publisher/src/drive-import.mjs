import {fail} from './auth.mjs';
const mime=new Set(['image/png','image/jpeg','image/webp']);
export function assertDriveId(id){if(typeof id!=='string'||!/^[\w-]{10,150}$/.test(id))fail(400,'drive_id_invalid','Invalid Drive file ID');return id;}
export async function driveImageMetadata({id,token,fetcher=fetch}){
 assertDriveId(id);
 if(!token)fail(503,'drive_token_missing','Drive read-only credential required');
 const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,name,mimeType,size,trashed';
 const res=await fetcher(url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(12000)});
 if(!res.ok)fail(502,'drive_read_failed','Drive metadata not accessible');
 const file=await res.json();
 if(file.id!==id||file.trashed||!mime.has(file.mimeType))fail(422,'drive_image_invalid','Unsupported Drive image');
 if(!Number.isSafeInteger(Number(file.size))||Number(file.size)>10000000||Number(file.size)<1)fail(413,'drive_image_large','10MB image limit');
 return file;
}
export async function driveImageWebp({id,token,images,fetcher=fetch}){
 const file=await driveImageMetadata({id,token,fetcher});
 if(!images?.input)fail(503,'images_binding_missing','Server WebP converter is not configured');
 const res=await fetcher('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
 if(!res.ok)fail(502,'drive_download_failed','Drive image download failed');
 const data=new Uint8Array(await res.arrayBuffer());
 if(data.length>10000000)fail(413,'drive_image_large','10MB image limit');
 const result=await images.input(data).transform({width:2048,height:2048,fit:'scale-down'}).output({format:'image/webp'});
 const webp=new Uint8Array(await (await result.response()).arrayBuffer());
 if(webp.length<12||String.fromCharCode(...webp.slice(0,4))!=='RIFF'||String.fromCharCode(...webp.slice(8,12))!=='WEBP')fail(502,'webp_invalid','WebP conversion failed');
 return {file,webp};
}
