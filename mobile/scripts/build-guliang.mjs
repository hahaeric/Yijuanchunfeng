import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {applyContextualPinyin} from './contextual-pinyin.mjs';
const require=createRequire(import.meta.url);
const {pinyin}=require('pinyin-pro');
const OpenCC=require('opencc-js');
const traditional=OpenCC.Converter({from:'cn',to:'tw'});
const corpus=require('../src/data/classics.json');
const input=JSON.parse(fs.readFileSync(new URL('../src/data/guliang-text.json',import.meta.url),'utf8'));
if(input.version!==1 || input.years.length!==242 || input.sources.length!==2)throw new Error('Incomplete Guliang review data');
const dukes=['隐公','桓公','庄公','闵公','僖公','文公','宣公','成公','襄公','昭公','定公','哀公'];
const ids=['yin','huan','zhuang','min','xi','wen','xuan','cheng','xiang','zhao','ding','ai'];
const han=text=>[...text].filter(c=>/\p{Script=Han}/u.test(c)).join('');
function mapClassicAnchors(blocks,legacy){
  const source=blocks.flatMap((b,index)=>b.kind==='经'?[...han(b.text)].map(c=>({c,index})):[]);
  const target=legacy.flatMap((l,index)=>[...han(l.text)].map(c=>({c,index})));
  const dp=Array.from({length:source.length+1},()=>new Uint16Array(target.length+1));
  for(let i=source.length-1;i>=0;i--)for(let j=target.length-1;j>=0;j--)dp[i][j]=source[i].c===target[j].c?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  const anchors=new Map();let i=0,j=0;
  while(i<source.length&&j<target.length){
    if(source[i].c===target[j].c){anchors.set(source[i].index,legacy[target[j].index]);i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;
  }
  return anchors;
}
const normalizeYear=s=>s.replaceAll('有','');
const old=corpus.lessons.filter(l=>l.bookId==='chunqiu').map(l=>({...l,section:normalizeYear(l.section)}));
// The baseline repeats these two labels. IDs, saved notes and text stay intact.
for(const [chapter,duplicate,replacement] of [['文公','十二年','十三年'],['襄公','二十六年','二十七年']]){
  const rows=old.filter(l=>l.chapter===chapter&&l.section===duplicate);
  if(rows.length!==2)throw new Error(`Unexpected legacy year structure: ${chapter}`);
  rows[1].section=replacement;
}
const appended=new Map();
const evidence=[];
for(const year of input.years){
  const legacy=old.filter(l=>l.chapter===year.chapter&&l.section===year.section);
  if(!legacy.length)throw new Error(`Missing legacy year ${year.chapter}${year.section}`);
  const anchors=mapClassicAnchors(year.blocks,legacy);
  let anchor=legacy[0], precedingClassic='';let count=0;
  for(const [blockIndex,block] of year.blocks.entries()){
    if(block.kind==='经'){
      precedingClassic=block.text;
      // Align the whole year's 经 stream monotonically. Repeated short phrases
      // such as 用牲于社 must not attach a June commentary to an autumn event.
      anchor=anchors.get(blockIndex)||anchor;
      continue;
    }
    if(block.kind!=='传'||!block.text.trim()||!precedingClassic)throw new Error(`Unanchored commentary ${year.chapter}${year.section}`);
    count++;
    const id=`chunqiu-guliang-${ids[dukes.indexOf(year.chapter)]}-${year.number}-${count}`;
    const characters=[...block.text];
    const generated=pinyin(block.text,{type:'array'}).map((reading,i)=>/\p{Script=Han}/u.test(characters[i])?reading:'');
    const units=applyContextualPinyin('chunqiu',year.chapter,block.text,generated);
    for(const [i,c]of [...block.text].entries())if(/\p{Script=Han}/u.test(c)&&(!units[i]||/\p{Script=Han}/u.test(units[i])))throw new Error(`Missing reading ${id}/${c}`);
    const lesson={id,bookId:'chunqiu',book:'春秋榖梁传',chapter:year.chapter,section:year.section,unitLabel:`传 · 第${count}则`,contentKind:'commentary',text:block.text,
      traditionalText:traditional(block.text),pinyinUnits:units,sourcePdfVolume:block.volume,sourcePdfPages:block.pages,
      sourceNote:`《榖梁传》；对应经文：${precedingClassic}`,anchorId:anchor.id};
    if([...lesson.traditionalText].length!==[...lesson.text].length||units.length!==[...lesson.text].length)throw new Error(`Misaligned ${id}`);
    const source=input.sources.find(s=>s.volume===block.volume);
    if(!source)throw new Error(`Missing source volume ${id}`);
    lesson.editionSource={annotator:'姚政、邓启铜',scope:'book',sourcePdfVolume:block.volume,sourcePdfPages:block.pages,sources:[source],pinyinMode:'automatic'};
    if(!appended.has(anchor.id))appended.set(anchor.id,[]);
    appended.get(anchor.id).push(lesson);
    evidence.push({id,anchorId:anchor.id,volume:block.volume,pages:block.pages,rowIds:block.rowIds});
  }
}
const lessons=old.flatMap(l=>[{...l,book:'春秋榖梁传',contentKind:'classic',unitLabel:`经 · ${l.unitLabel}`},...(appended.get(l.id)||[])]);
const output={version:1,contentRevision:createHash('sha256').update(JSON.stringify(input)).digest('hex'),sources:input.sources,
  title:'春秋榖梁传',yearCount:input.years.length,classicCount:old.length,commentaryCount:evidence.length,lessons};
const destination=new URL('../src/data/guliang.json',import.meta.url);
const text=JSON.stringify(output,null,2)+'\n';
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8').replace(/\r\n/g,'\n')!==text)throw new Error('Guliang data requires rebuilding');}
else fs.writeFileSync(destination,text);
