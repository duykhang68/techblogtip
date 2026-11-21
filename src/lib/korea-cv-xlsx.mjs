// Dependency-free OOXML spreadsheet writer. Valid XLSX is a ZIP of XML parts, not renamed CSV.
// The export is created entirely in browser memory from a confirmed Drive record.
const utf8 = new TextEncoder();
const xml=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;':'&quot;',"'":'&apos;'}[ch]));
function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^-1)>>>0;}
function u16(n){return [n&255,(n>>>8)&255];}function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];}
function zip(files){
  const chunks=[],central=[];let offset=0;
  for(const [name,body] of Object.entries(files)){
    const filename=utf8.encode(name),bytes=utf8.encode(body),crc=crc32(bytes);
    const local=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(filename.length),...u16(0),...filename]);
    chunks.push(local,bytes);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(filename.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...filename]));
    offset+=local.length+bytes.length;
  }
  const centralSize=central.reduce((n,x)=>n+x.length,0);
  const end=new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(centralSize),...u32(offset),...u16(0)]);
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function col(n){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
function worksheet(rows){
  const maxCols=Math.max(1,...rows.map(row=>row.length));
  const rendered=rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>{
    const ref=col(j)+(i+1), style=i===0?1:0;
    return '<c r="'+ref+'" t="inlineStr" s="'+style+'"><is><t xml:space="preserve">'+xml(value)+'</t></is></c>';
  }).join('')+'</row>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'+
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'+
    '<sheetFormatPr defaultRowHeight="24"/><cols>'+Array.from({length:maxCols},(_,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(i===0?24:30)+'" customWidth="1"/>').join('')+'</cols>'+
    '<sheetData>'+rendered+'</sheetData><printOptions horizontalCentered="1"/><pageMargins left=".25" right=".25" top=".45" bottom=".45" header=".1" footer=".1"/>'+
    '<pageSetup paperSize="9" orientation="portrait" fitToWidth="1" fitToHeight="0"/><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>'+
    '</worksheet>';
}
function records(items,cols){return (items||[]).map(item=>cols.map(k=>item?.[k]??''));}
export function koreaCvSheets(cv){
  const c=cv.content||{},p=c.personal||{},e=c.essays||{};
  return [
    {name:'01_지원서',rows:[
      ['입사지원서',''],['지원회사',cv.targetCompany||''],['지원직무',cv.targetRole||''],
      ...Object.entries({koreanName:'성명',englishName:'영문성명',hanjaName:'한자',email:'E-MAIL',phone:'연락처',address:'주소지',preferredLocation:'희망근무지',availableFrom:'입사가능일'}).map(([key,label])=>[label,p[key]||'']),
      ['학력 · 학교','학위','전공','입학','졸업','학점'],...records(c.education,['school','degree','major','from','to','gpa']),
      ['경력 · 근무처','직급','기간 시작','종료','업무'],...records(c.employment,['employer','position','from','to','responsibilities']),
      ['자격증','등급','취득일'],...records(c.certifications,['name','level','date']),
      ['언어','시험','점수','취득일'],...records(c.languages,['language','test','score','date'])]},
    {name:'02_자기소개서',rows:[['자기소개서','내용'],...Object.entries({growth:'성장과정',personality:'성격',schoolSocial:'학교생활/사회생활',motivation:'지원동기/이직사유',future:'입사 후 포부'}).map(([key,label])=>[label,e[key]||''])]},
    {name:'03_경력기술',rows:[['프로젝트','역할','시작','종료','개요','수행업무','성과'],...records(c.projects,['name','role','from','to','context','actions','results'])]},
    {name:'04_Others',rows:[['구분','내용','기타'],...['skills','awards','training','patents','referees','languages'].flatMap(key=>(c[key]||[]).map(row=>[key,Object.entries(row).filter(([k])=>k!=='id').map(([k,v])=>k+': '+v).join(' · '),'']))]},
    {name:'05_연구경력',rows:[['지원기관명','연구 기간','연구(논문) 제목','내용'],...records(c.research,['institution','period','title','description'])]},
    {name:'06_확인',rows:[['지원자 확인',''],['작성자',p.koreanName||p.englishName||''],['회사',cv.targetCompany||''],['비고','특정 기업의 공식 지원서가 아닙니다.']]}
  ];
}
export function createKoreaCvXlsx(cv){
  const sheets=koreaCvSheets(cv);
  const files={'[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+sheets.map((s,i)=>'<Override PartName="/xl/worksheets/sheet'+(i+1)+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>').join('')+'</Types>',
  '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>'<sheet name="'+xml(s.name)+'" sheetId="'+(i+1)+'" r:id="rId'+(i+1)+'"/>').join('')+'</sheets></workbook>',
  'xl/_rels/workbook.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((s,i)=>'<Relationship Id="rId'+(i+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+(i+1)+'.xml"/>').join('')+'<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':'<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Malgun Gothic"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF102640"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf></cellXfs></styleSheet>'};
  sheets.forEach((sheet,i)=>{files['xl/worksheets/sheet'+(i+1)+'.xml']=worksheet(sheet.rows);});
  return zip(files);
}
