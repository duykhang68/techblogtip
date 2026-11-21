// Print-only Korean historical-form-inspired CV. The browser's Save as PDF produces A4.
const esc = (v) => String(v??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const p=(v)=>esc(v)||' ';
const rows=(items,cols)=>(items||[]).map(item=>'<tr>'+cols.map(col=>'<td>'+p(item[col])+'</td>').join('')+'</tr>').join('') || '<tr><td colspan="'+cols.length+'"> </td></tr>';
const table=(title,labels,keys,items)=>'<section><h2>'+esc(title)+'</h2><table><thead><tr>'+labels.map(v=>'<th>'+esc(v)+'</th>').join('')+'</tr></thead><tbody>'+rows(items,keys)+'</tbody></table></section>';
const list=(title,items,format)=>'<section><h2>'+esc(title)+'</h2><ul>'+((items||[]).map(item=>'<li>'+esc(format(item))+'</li>').join('')||'<li> </li>')+'</ul></section>';
const essayLabels=[['growth','성장과정'],['personality','성격'],['schoolSocial','학교생활/사회생활'],['motivation','지원동기/이직사유'],['future','입사 후 포부']];
export function createKoreanA4Html(cv) {
  const c=cv.content||{}, personal=c.personal||{};
  const header='<header><span>KOREA CV MAKER</span><strong>'+esc(cv.targetCompany||'입사지원서')+'</strong><small>지원직무 · '+p(cv.targetRole)+'</small></header>';
  const wrap=(body,cls='')=>'<article class="page '+cls+'">'+header+body+'<footer>본 문서는 지원자가 작성한 개인 이력서이며 특정 회사의 공식 채용 서식이 아닙니다.</footer></article>';
  const personalTable='<section><h1>입사지원서 · 지원자 정보</h1><table class="info"><tbody>'+
    [['성명(한글)',personal.koreanName,'영문성명',personal.englishName],
     ['성명(한자)',personal.hanjaName,'지원직무',cv.targetRole],
     ['연락처',personal.phone,'E-MAIL',personal.email],
     ['주소지',personal.address,'희망근무지',personal.preferredLocation],
     ['입사가능일',personal.availableFrom,'생년월일',personal.dateOfBirth]
    ].map(r=>'<tr><th>'+r[0]+'</th><td>'+p(r[1])+'</td><th>'+r[2]+'</th><td>'+p(r[3])+'</td></tr>').join('')+'</tbody></table></section>';
  const summary=personalTable+
   table('학력사항',['학교명','학위','전공','입학','졸업','학점'],['school','degree','major','from','to','gpa'],c.education)+
   table('경력사항',['근무처','직급','근무시작','종료','담당업무'],['employer','position','from','to','responsibilities'],c.employment)+
   table('자격사항',['자격증','등급','취득일'],['name','level','date'],c.certifications)+
   table('어학사항',['언어','시험','점수','취득일'],['language','test','score','date'],c.languages);
  const essays='<section><h1>자기 소개서</h1>'+essayLabels.map(([key,label])=>'<h2 class="dark">'+label+'</h2><div class="essay">'+p(c.essays?.[key]).replace(/\n/g,'<br>')+'</div>').join('')+'</section>';
  const projects='<section><h1>경력 사항 기술</h1>'+(c.projects||[]).map(item=>
    '<div class="project"><h2>'+p(item.from)+' ~ '+p(item.to)+' / '+p(item.name)+' / '+p(item.role)+'</h2><table><tbody><tr><th>프로젝트</th><td>'+p(item.context)+'</td></tr><tr><th>수행업무</th><td>'+p(item.actions).replace(/\n/g,'<br>')+'</td></tr><tr><th>성과</th><td>'+p(item.results).replace(/\n/g,'<br>')+'</td></tr></tbody></table></div>').join('')+'</section>';
  const details='<section><h1>Others · Skills and Achievements</h1>'+
    list('Awards and Achievement',c.awards,x=>[x.name,x.date].filter(Boolean).join(' · '))+
    list('Training',c.training,x=>[x.name,x.date].filter(Boolean).join(' · '))+
    list('Skill',c.skills,x=>x.name)+
    list('Languages',c.languages,x=>[x.language,x.test,x.score].filter(Boolean).join(' · '))+
    list('Patent',c.patents,x=>[x.name,x.number].filter(Boolean).join(' · '))+
    list('Referees · 동의 받은 추천인',c.referees,x=>[x.name,x.role,x.contact].filter(Boolean).join(' · '))+'</section>';
  const research=table('석·박사과정 중 연구(논문)경력',['지원기관명','연구 기간','연구(논문) 제목','내용'],['institution','period','title','description'],c.research);
  const declaration='<section><h1>지원자 확인</h1><p>지원자는 이 이력서에 기재한 정보가 사실임을 확인합니다.</p><p>작성자: '+p(personal.koreanName||personal.englishName)+'</p></section>';
  const html=[wrap(summary),wrap(essays),wrap(projects),wrap(details),wrap(research),wrap(declaration)].join('');
  return '<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>'+esc(cv.label||'Korean CV')+'</title><style>'+
    '@page{size:A4 portrait;margin:13mm 12mm}*{box-sizing:border-box}body{margin:0;color:#111;font:10.5pt/1.45 "Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR",Arial,sans-serif}'+
    '.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}header{border-bottom:3px solid #123f68;margin-bottom:16px;padding-bottom:6px;display:flex;flex-direction:column;gap:2px}header span{color:#88accb;letter-spacing:2px;font-size:19pt}header strong{color:#09659c;font-size:17pt}header small{font-size:9pt;text-align:right}'+
    'h1{text-align:center;font-size:17pt;margin:12px 0 18px;text-decoration:underline;text-underline-offset:5px}h2{font-size:10pt;margin:14px 0 0;background:#d8e8ef;padding:6px 8px;break-after:avoid}h2.dark{background:#102640;color:white;max-width:45%}'+
    'section{break-inside:auto;margin:12px 0}table{border-collapse:collapse;table-layout:fixed;width:100%;font-size:9pt}th,td{border:1px solid #333;padding:6px;overflow-wrap:break-word;vertical-align:top}th{background:#e2e2e2}td{white-space:pre-wrap}.info th{background:#102640;color:white;width:19%}.info td{width:31%}.essay{border:1px solid #333;min-height:24mm;padding:8px;white-space:pre-wrap;overflow-wrap:break-word}.project{break-inside:avoid;margin-bottom:8mm}.project h2{background:#d8e8ef;margin:0}.project th{width:24%;background:#f3f3f3}li{margin:5px 0}footer{margin-top:16px;border-top:1px solid #ddd;font-size:7pt;color:#777}'+
    '@media screen{body{background:#e8eaed;padding:15px}.page{background:white;width:210mm;min-height:297mm;margin:0 auto 15px;padding:13mm 12mm;box-shadow:0 1px 7px #aaa}}'+
    '</style></head><body>'+html+'</body></html>';
}
export function exportSavedCVasA4(cv,win) {
  if(!win)throw new Error('Popup blocked');
  win.document.open();
  win.document.write(createKoreanA4Html(cv));
  win.document.close();
  win.focus();
  win.print();
}
