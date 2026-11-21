import {driveRequest,connected} from '../lib/korea-cv-client.mjs';
import {exportSavedCVasA4} from '../lib/korea-cv-pdf.mjs';
const button=document.createElement('button');
button.type='button';button.textContent='In / Save as PDF A4';button.className='kcv-pdf-action';
button.style.cssText='padding:12px 16px;background:#123f68;color:#fff;border:0;border-radius:9px;cursor:pointer';
const container=document.querySelector('#saved-panel .kcv-actions');
container?.append(button);
button.addEventListener('click',async()=>{
  const selected=(document.getElementById('kcv-select') as HTMLSelectElement)?.value;
  if(!selected||!connected()){alert('Hãy kết nối Google Drive và chọn CV đã lưu.');return;}
  const popup=window.open('','_blank');
  if(!popup){alert('Cho phép mở cửa sổ in PDF trong trình duyệt.');return;}
  popup.document.body.textContent='Đang tải phiên bản đã lưu từ Google Drive...';
  try{
    const data=await driveRequest(import.meta.env.PUBLIC_KOREA_CV_API_URL,'/'+selected);
    if(!data.cv)throw new Error('Không có dữ liệu đã lưu');
    exportSavedCVasA4(data.cv,popup);
  }catch(error){popup.close();alert('Không thể xuất PDF: '+(error instanceof Error?error.message:'Không xác định'));}
});
