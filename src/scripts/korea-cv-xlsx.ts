import {driveRequest,connected} from '../lib/korea-cv-client.mjs';
import {resolveKoreaCvExport} from '../lib/korea-cv-export-source.mjs';
import {createKoreaCvXlsx} from '../lib/korea-cv-xlsx.mjs';

const button=document.getElementById('kcv-export-xlsx') as HTMLButtonElement;
const feedback=document.getElementById('kcv-export-status') as HTMLElement;
const notify=(message:string,state:'error'|'success'|'info'='info')=>{
  feedback.textContent=message;feedback.dataset.state=state;
};
button?.addEventListener('click',async()=>{
  button.disabled=true;
  try{
    const result=await resolveKoreaCvExport(document,{connected,driveRequest,api:import.meta.env.PUBLIC_KOREA_CV_API_URL});
    const blob=createKoreaCvXlsx(result.cv);
    const objectUrl=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=objectUrl;
    const company=(result.cv.targetCompany||'Ho-so').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,35);
    link.download='Korea-CV-'+company+'.xlsx';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    notify(result.source==='draft'
      ?'Đã tải Excel từ hồ sơ đang soạn, kể cả thay đổi chưa lưu.'
      :'Đã tải Excel từ phiên bản CV đã lưu trên Google Drive.','success');
  }catch(error){
    notify('Không thể tạo Excel: '+(error instanceof Error?error.message:'Lỗi không xác định'),'error');
  }finally{button.disabled=false;}
});
