import test from 'node:test';import assert from 'node:assert/strict';
import {createKoreanA4Html} from '../src/lib/korea-cv-pdf.mjs';
test('printable A4 displays six sections and escapes applicant text',()=>{
 const content={personal:{koreanName:'<script>alert(1)</script>'},essays:{growth:'가나다'},education:[],employment:[],certifications:[],languages:[],projects:[],skills:[],awards:[],training:[],patents:[],referees:[],research:[]};
 const html=createKoreanA4Html({targetCompany:'ABC',targetRole:'Engineer',content});
 assert.match(html,/@page\{size:A4 portrait/);
 assert.equal((html.match(/class="page /g)||[]).length,6);
 assert.match(html,/자기 소개서/);
 assert.match(html,/경력 사항 기술/);
 assert.match(html,/석·박사과정/);
 assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/SAMSUNG/i);
});
