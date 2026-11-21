import {connected,driveRequest} from '../lib/korea-cv-client.mjs';
import {createKoreaCvXlsx} from '../lib/korea-cv-xlsx.mjs';
const button=document.createElement('button');
button.type='button';button.textContent='Download Excel .xlsx';button.className='kcv-xlsx-action';
button.style.cssText='background:#145c49;color:white;border:0;border-radius:9px;padding:12px 16px;cursor:pointer';
document.querySelector('#saved-panel .kcv-actions')?.append(button);
button.addEventListener('click',async()=>{
  const selected=(document.getElementById('kcv-select') as HTMLSelectElement)?.value;
  if(!selected||!connected()){alert('Hãy kết nối Google Drive và chọn CV đã lưu.');return;}
  try{
    const data=await driveRequest(import.meta.env.PUBLIC_KOREA_CV_API_URL,'/'+selected);
    if(!data.cv)throw new Error('CV chưa được lưu');
    const blob=createKoreaCvXlsx(data.cv);
    const objectUrl=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=objectUrl;link.download='Korea-CV-'+selected.slice(0,8)+'.xlsx';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
  }catch(error){alert('Không thể tạo Excel: '+(error instanceof Error?error.message:'Không rõ lỗi'));}
});