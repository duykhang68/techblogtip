import {driveRequest,connected} from '../lib/korea-cv-client.mjs';
import {resolveKoreaCvExport} from '../lib/korea-cv-export-source.mjs';
import {exportSavedCVasA4} from '../lib/korea-cv-pdf.mjs';

const button=document.getElementById('kcv-export-pdf') as HTMLButtonElement;
const source=document.getElementById('kcv-export-source') as HTMLSelectElement;
const feedback=document.getElementById('kcv-export-status') as HTMLElement;
const help=document.getElementById('kcv-export-help') as HTMLElement;
const notify=(message:string,state:'error'|'success'|'info'='info')=>{
  feedback.textContent=message;feedback.dataset.state=state;
};
source?.addEventListener('change',()=>{
  help.textContent=source.value==='draft'
    ?'Đang chọn hồ sơ trên biểu mẫu, gồm cả thay đổi chưa lưu. Không cần Google Drive để xuất.'
    :'Đang chọn phiên bản từ thư viện. Hãy chọn CV đã lưu ở phía trên trước khi xuất.';
  notify(source.value==='draft'?'Sẵn sàng xuất hồ sơ đang soạn.':'Sẵn sàng xuất phiên bản Google Drive đã chọn.');
});
button?.addEventListener('click',async()=>{
  // Open during the user gesture to avoid browser popup blocking on async Drive reads.
  const popup=window.open('','_blank');
  if(!popup){notify('Trình duyệt chặn cửa sổ in. Hãy cho phép popup cho trang này rồi thử lại.','error');return;}
  popup.document.body.textContent='Đang chuẩn bị bản in PDF A4…';
  button.disabled=true;
  try{
    const result=await resolveKoreaCvExport(document,{connected,driveRequest,api:import.meta.env.PUBLIC_KOREA_CV_API_URL});
    exportSavedCVasA4(result.cv,popup);
    notify(result.source==='draft'
      ?'Đã mở bản in từ hồ sơ đang soạn (kể cả thay đổi chưa lưu). Chọn “Save as PDF” trong hộp thoại in.'
      :'Đã mở bản in từ CV đã lưu trên Google Drive. Chọn “Save as PDF” trong hộp thoại in.','success');
  }catch(error){
    popup.close();
    notify('Không thể chuẩn bị PDF: '+(error instanceof Error?error.message:'Lỗi không xác định'),'error');
  }finally{button.disabled=false;}
});
