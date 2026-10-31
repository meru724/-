(()=>{'use strict';
const raw=window.HISTORY_RAW||'',chapters=window.HISTORY_CHAPTERS||{};
let era='',facts=[];raw.split('\n').forEach(line=>{line=line.trim();if(!line)return;if(line[0]==='#'){era=line.slice(1);return;}const p=line.split('|');if(p.length===3)facts.push({id:facts.length,era,year:Number(p[0]),title:p[1],desc:p[2]})});
const eras=[...new Set(facts.map(f=>f.era))],$=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const year=n=>n<0?'紀元前'+Math.abs(n)+'年':n+'年';
const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[ \u3000・･、。，,.。!！?？「」『』（）()\-ー]/g,'').replace(/^(紀元前)(\d+)年$/,(_,__,n)=>'-'+n).replace(/^(\d+)年$/,'$1');
const questions=facts.flatMap(f=>Array.from({length:7},(_,type)=>({id:f.id*7+type,f,type})));
let page='input',currentEra='all',limit={input:3,recall:3,timeline:35},hide=true,q=null,answered=false;
let saved={done:0,correct:0,wrong:[],seen:[]};
try{saved={...saved,...JSON.parse(localStorage.getItem('nihonshi-lab-v1')||'{}')}}catch(e){}
const store=()=>{try{localStorage.setItem('nihonshi-lab-v1',JSON.stringify(saved))}catch(e){}};
const filterFacts=(term='')=>facts.filter(f=>(currentEra==='all'||f.era===currentEra)&&(!term||[f.title,f.desc,String(f.year),year(f.year),f.era].some(x=>x.includes(term))));
function selectSetup(){document.querySelectorAll('.era-select').forEach(el=>{el.innerHTML='<option value="all">全時代</option>'+eras.map(e=>'<option value="'+esc(e)+'">'+esc(e)+'</option>').join('');el.value=currentEra;el.onchange=()=>{currentEra=el.value;document.querySelectorAll('.era-select').forEach(s=>s.value=currentEra);limit={input:3,recall:3,timeline:35};draw();newQuestion()}})}
const group=f=>{const m=new Map();f.forEach(x=>{if(!m.has(x.era))m.set(x.era,[]);m.get(x.era).push(x)});return [...m].map(([era,items])=>({era,items}))};
function yearLink(f,recall){return termHTML(year(f.year),'aqua','年号：'+year(f.year),f.desc,recall)}
function termHTML(word,kind,title,desc,recall){const id=terms.length;terms.push({title,desc,word});return recall&&hide?'<input class="cloze '+kind+'" data-answer="'+esc(word)+'" data-index="'+id+'" aria-label="空欄に答えを入力" placeholder="＿＿＿" autocomplete="off" autocapitalize="off" spellcheck="false">':'<button class="term '+kind+'" data-tid="'+id+'" type="button">'+esc(word)+'</button>'}
let terms=[];
function highlighted(text,f,recall){let pieces=[];const dict=chapters[f.era]?.words||{};let words=[...Object.keys(dict),f.title];words.sort((a,b)=>b.length-a.length);
let found=[];for(const w of words){let start=0;while(true){let at=text.indexOf(w,start);if(at<0)break;if(!found.some(x=>at<x.to&&at+w.length>x.from))found.push({from:at,to:at+w.length,w,secondary:w!==f.title});start=at+w.length}}
found.sort((a,b)=>a.from-b.from);let cursor=0;
for(const x of found){pieces.push(esc(text.slice(cursor,x.from)));pieces.push(termHTML(x.w,x.secondary?'aqua':'orange',x.w,x.secondary?dict[x.w]:f.desc,recall));cursor=x.to}
pieces.push(esc(text.slice(cursor)));return pieces.join('')}
function oneSentence(f,recall){let intro='';const y=yearLink(f,recall),title=termHTML(f.title,'orange',f.title,f.desc,recall);
let detail=highlighted(f.desc,f,recall);
if(/の始まり|の開始|の発足|の成立/.test(f.title))intro='この時代の重要な転換点として、';
else if(/の戦い|の乱|の変|戦争|事件/.test(f.title))intro='政治や社会が揺れ動くなか、';
else if(/条約|法|令|律|詔|制度/.test(f.title))intro='制度や外交関係が変化する過程では、';
else intro='こうした動きのなか、';
return intro+y+'には'+title+'が起こった。'+detail.replace(/。$/,'')+'。'}
function chapterPassages(era,items,recall){let head=chapters[era]||{intro:'この時代の政治・社会・文化の変化を確認しよう。',words:{}};
let ordered=[...items].sort((a,b)=>a.year-b.year||a.id-b.id);
const paragraphs=[];for(let i=0;i<ordered.length;i+=4){let current=ordered.slice(i,i+4);paragraphs.push('<p>'+current.map(f=>oneSentence(f,recall)).join(' ')+'</p>')}
const introduction=head.intro.replace(/([。！？])/g,'$1\n').split('\n').filter(Boolean).map(s=>{let matches=Object.entries(head.words).sort((a,b)=>b[0].length-a[0].length),res='',at=0,all=[];for(const [word,desc] of matches){let pos=s.indexOf(word);while(pos>=0){if(!all.some(x=>pos<x.end&&pos+word.length>x.start))all.push({start:pos,end:pos+word.length,word,desc});pos=s.indexOf(word,pos+word.length)}}all.sort((a,b)=>a.start-b.start);for(const m of all){res+=esc(s.slice(at,m.start))+termHTML(m.word,'aqua',m.word,m.desc,recall);at=m.end}return res+esc(s.slice(at))}).join(' ');
return '<article class="card chapter-card"><div class="chapter-head"><div class="chapter-number">HISTORY READING</div><h3 class="chapter-name">'+esc(era)+'</h3><span class="label">'+ordered.length+'件の出来事</span></div><div class="reader"><div class="lead">'+introduction+'</div>'+paragraphs.join('')+'</div>'+(recall?'<div class="recall-actions"><button class="btn light check-cloze" type="button">この章を答え合わせ</button><button class="btn ghost show-cloze" type="button">この章の答えを表示</button></div><div class="recall-result" aria-live="polite"></div>':'')+'</article>'}
function drawInput(){terms=[];const a=filterFacts($('search').value.trim());const groups=group(a);$('inputList').innerHTML=groups.slice(0,limit.input).map(g=>chapterPassages(g.era,g.items,false)).join('')||'<div class="card">該当する出来事はありません。</div>';$('moreInput').style.display=groups.length>limit.input?'block':'none'}
function drawRecall(){terms=[];const groups=group(filterFacts());$('recallList').innerHTML=groups.slice(0,limit.recall).map(g=>chapterPassages(g.era,g.items,true)).join('')||'<div class="card">該当する出来事はありません。</div>';$('moreRecall').style.display=groups.length>limit.recall?'block':'none'}
function drawTimeline(){terms=[];const a=filterFacts($('timelineSearch').value.trim());$('timelineList').innerHTML=a.slice(0,limit.timeline).map(f=>'<div class="card year-row"><div class="year">'+yearLink(f,false)+'</div><div><div class="event">'+termHTML(f.title,'orange',f.title,f.desc,false)+'</div><div class="desc">'+esc(f.desc)+'</div><div class="label" style="margin-top:8px">'+esc(f.era)+'</div></div></div>').join('')||'<div class="card">該当する出来事はありません。</div>';$('moreTimeline').style.display=a.length>limit.timeline?'block':'none'}
function draw(){if(page==='input')drawInput();if(page==='recall')drawRecall();if(page==='timeline')drawTimeline();stats()}
function stats(){$('factNum').textContent=facts.length.toLocaleString('ja-JP');$('totalNum').textContent=questions.length.toLocaleString('ja-JP');$('countLabel').textContent=questions.length.toLocaleString('ja-JP')+'問';$('doneNum').textContent=(saved.done||0).toLocaleString('ja-JP');$('scoreText').textContent=(saved.done||0)+'問に回答';const score=saved.done?Math.round(saved.correct/saved.done*100):0;$('scoreBar').style.width=score+'%';$('scoreDetail').textContent='正解率 '+score+'% ・ 復習対象 '+saved.wrong.length+'問'}
function mini(t){$('modalTitle').textContent=t.title;$('modalDesc').textContent=t.desc;$('modal').classList.remove('hide')}
document.addEventListener('click',e=>{const t=e.target.closest('[data-tid]');if(t)mini(terms[Number(t.dataset.tid)])});
$('closeModal').onclick=()=> $('modal').classList.add('hide');$('modal').onclick=e=>{if(e.target===$('modal'))$('modal').classList.add('hide')};
function checkChapter(card,reveal){const fields=[...card.querySelectorAll('.cloze')];let correct=0,attempted=0;for(const fld of fields){const expected=fld.dataset.answer;if(reveal){fld.value=expected;fld.classList.remove('good','bad');fld.classList.add('revealed');continue}const value=fld.value.trim();if(!value){fld.classList.remove('good','bad');continue}attempted++;const good=normalize(value)===normalize(expected)||/^[0-9\-]+$/.test(normalize(value))&&normalize(value)===normalize(expected);correct+=good?1:0;fld.classList.toggle('good',good);fld.classList.toggle('bad',!good)}
const result=card.querySelector('.recall-result');if(result)result.textContent=reveal?'答えを表示しました。隠して再挑戦できます。':'入力した'+attempted+'個中 '+correct+'個正解（空欄 '+(fields.length-attempted)+'個）'}
document.addEventListener('click',e=>{let card=e.target.closest('.chapter-card');if(!card)return;if(e.target.closest('.check-cloze'))checkChapter(card,false);if(e.target.closest('.show-cloze'))checkChapter(card,true)});
document.querySelectorAll('[data-page]').forEach(btn=>btn.onclick=()=>{page=btn.dataset.page;document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+page));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===btn));draw();window.scrollTo(0,0);if(page==='quiz'&&!q)newQuestion()});
$('search').oninput=drawInput;$('timelineSearch').oninput=drawTimeline;
$('moreInput').onclick=()=>{limit.input+=2;drawInput()};$('moreRecall').onclick=()=>{limit.recall+=2;drawRecall()};$('moreTimeline').onclick=()=>{limit.timeline+=35;drawTimeline()};
$('hideAll').onclick=()=>{hide=true;drawRecall()};$('showAll').onclick=()=>{hide=false;drawRecall()};
const shuffle=a=>[...a].sort(()=>Math.random()-.5),unique=a=>[...new Set(a)];
function makeQuestion(obj){const f=obj.f,t=obj.type;let c='',answer='',note='';const names=['年号を答える','出来事名を答える','説明から出来事を答える','時代を答える','説明から年号を答える','正誤判定','正誤判定'];
if(t===0){c='「'+f.title+'」が起こった年は？';answer=year(f.year);note='数字だけでもOK。紀元前は「紀元前300年」または「-300」と入力。'}
if(t===1){c=year(f.year)+'に起こった出来事は？';answer=f.title}
if(t===2){c='次の説明に当てはまる出来事は？\n「'+f.desc+'」';answer=f.title}
if(t===3){c='「'+f.title+'」が含まれる学習上の時代区分は？';answer=f.era}
if(t===4){c='次の内容に関する年号は？\n「'+f.desc+'」';answer=year(f.year);note='年号は数字のみで回答可能。'}
if(t===5){c='次の文は正しい？\n「'+f.title+'は'+year(f.year)+'の出来事である」';answer='正しい';note='「正しい」または「誤り」と入力してね。○・×でもOK。'}
if(t===6){const other=facts.find(x=>x.era===f.era&&x.year!==f.year)||facts.find(x=>x.year!==f.year);c='次の文は正しい？\n「'+f.title+'は'+year(other.year)+'の出来事である」';answer='誤り';note='「正しい」または「誤り」と入力してね。○・×でもOK。'}
return {id:obj.id,f,c,answer,note,typeName:names[t],type:t}}
function orderQuestion(){let groups=group(filterFacts()).map(g=>g.items).filter(items=>new Set(items.map(f=>f.year)).size>=4);if(!groups.length)return null;let picked=[];for(const f of shuffle(shuffle(groups)[0])){if(!picked.some(x=>x.year===f.year))picked.push(f);if(picked.length===4)break}
const ordered=[...picked].sort((a,b)=>a.year-b.year);return {id:null,type:'order',f:ordered[0],ordered,options:shuffle(ordered),answer:ordered.map(f=>f.id).join(','),note:'画面の4項目の番号を古い順に入力。例：3 1 4 2',typeName:'年代並べ替え',c:'次の4つの出来事を古い順に並べ、番号を入力しよう。'}}
function clearAnswer(){$('feedback').className='hide';$('answerInput').value='';$('answerInput').disabled=false;$('submitQ').disabled=false;$('giveUp').disabled=false;answered=false;$('nextQ').textContent='次の問題 →'}
function newQuestion(){clearAnswer();const mode=$('mode').value;let pool=questions.filter(x=>(currentEra==='all'||x.f.era===currentEra)&&(mode==='all'||mode==='wrong'||x.type===Number(mode)));if(mode==='wrong')pool=pool.filter(x=>(saved.wrong||[]).includes(x.id));if(mode==='order')q=orderQuestion();else {let unseen=pool.filter(x=>!(saved.seen||[]).includes(x.id));q=(unseen.length||pool.length)?makeQuestion(shuffle(unseen.length?unseen:pool)[0]):null}
$('orderList').innerHTML='';if(!q){$('qLabel').textContent='問題なし';$('question').textContent='この条件では問題がありません。時代や出題形式を選び直してください。';$('quizForm').style.display='none';return}
$('quizForm').style.display='block';$('qLabel').textContent=q.typeName+' ・ '+(mode==='order'?'並べ替え':pool.length.toLocaleString('ja-JP')+'問から出題');$('question').textContent=q.c;$('answerHint').textContent=q.note||'漢字・数字を使って文字入力してね。';$('answerInput').placeholder=q.type==='order'?'例：3 1 4 2':q.type===5||q.type===6?'正しい／誤り':'ここに答えを入力';
if(q.type==='order')$('orderList').innerHTML=q.options.map((f,i)=>'<div class="order-line"><b>'+ (i+1) +'.</b>　'+esc(f.title)+'</div>').join('');
}
function same(a,b){const na=normalize(a),nb=normalize(b);if(na===nb)return true;if(nb==='正しい')return ['○','〇','まる','正','正解','true'].includes(na);if(nb==='誤り')return ['×','x','ばつ','誤','間違い','false'].includes(na);return false}
function correctAnswer(value){if(q.type==='order'){const digits=value.normalize('NFKC').match(/[1-4]/g)||[];return digits.length===4&&new Set(digits).size===4&&digits.map(n=>q.options[Number(n)-1].id).join(',')===q.answer}return same(value,q.answer)}
function record(correct){saved.done=(saved.done||0)+1;if(correct)saved.correct=(saved.correct||0)+1;if(q.id!==null){saved.seen=unique([...(saved.seen||[]),q.id]);saved.wrong=correct?(saved.wrong||[]).filter(i=>i!==q.id):unique([...(saved.wrong||[]),q.id])}store();stats()}
function finish(value,skipped=false){if(answered||!q)return;answered=true;const good=!skipped&&correctAnswer(value);record(good);$('answerInput').disabled=true;$('submitQ').disabled=true;$('giveUp').disabled=true;let expected=q.type==='order'?q.ordered.map(f=>(q.options.indexOf(f)+1)).join(' → '):q.answer;
let explanation=q.type==='order'?q.ordered.map(f=>year(f.year)+' '+f.title).join(' → '):q.f.title+'（'+year(q.f.year)+'）｜'+q.f.desc;
$('feedback').className='answer';$('feedback').innerHTML='<b>'+(good?'✅ 正解！':skipped?'📖 答えを表示':'📌 惜しい！答えを確認しよう')+'</b><div>正答：<strong>'+esc(expected)+'</strong></div><div>'+esc(explanation)+'</div>'; $('nextQ').textContent='次の問題へ →'}
$('quizForm').onsubmit=e=>{e.preventDefault();if(!answered&&$('answerInput').value.trim())finish($('answerInput').value.trim())};
$('giveUp').onclick=()=>finish('',true);$('nextQ').onclick=newQuestion;$('mode').onchange=newQuestion;
$('resetWrong').onclick=()=>{if(confirm('間違えた問題の履歴を削除しますか？')){saved.wrong=[];store();stats();newQuestion()}};
selectSetup();stats();draw();newQuestion();
})();