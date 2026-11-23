import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const OpenCC = require('opencc-js');
const simplify = OpenCC.Converter({from:'tw',to:'cn'});
const {applyReviewedChanges,applyStructuralChanges} = require('./reviewed-text.cjs');
const corpus = require('../src/data/classics.json');
const read = name => JSON.parse(fs.readFileSync(new URL(`../../docs/edition-review/${name}.json`,import.meta.url),'utf8'));
const evidence = read('four-books-evidence');
const configs = {
  mengzi:{name:'孟子',publisher:'东南大学出版社',published:'2015-10',printing:'第2版',isbn:'978-7-5641-6002-9',reviewer:'陈红映'},
  shijing:{name:'诗经',publisher:'南京大学出版社',published:'2014-05',printing:'第1版',isbn:'978-7-305-13127-1'},
  shangshu:{name:'尚书',publisher:'东南大学出版社',published:'2015-10',printing:'第2版',isbn:'978-7-5641-6003-6',reviewer:'陈红映'},
  zhouyi:{name:'易经',publisher:'南京大学出版社',published:'2014-05',printing:'第1版',isbn:'978-7-305-13127-1'}
};
let lessons=[];
const books=evidence.books.map(book=>{
  const c=configs[book.id];
  const pages=new Map(book.lessons.map(l=>[l.id,l]));
  const changed=applyReviewedChanges(corpus.lessons.filter(l=>l.bookId===book.id),read(book.id).corrections,simplify);
  lessons.push(...changed.map(l=>{
    const proof=pages.get(l.id);
    if(!proof?.pages.length)throw new Error(`Missing source pages: ${l.id}`);
    return {id:l.id,bookId:l.bookId,chapter:l.chapter,section:l.section||'',unitLabel:l.unitLabel,text:l.text,sourcePdfPages:proof.pages};
  }));
  return {id:book.id,sourcePdfPages:book.bodyPdfPages,edition:{id:`deng-qitong-${book.id}-${c.published}`,annotator:'邓启铜',...c,
    method:'用户提供扫描PDF，经OCR辅助差异核对整理；保留适合客户端阅读的分段与句读，非逐字人工校勘版。',
    sources:[{filename:`用户提供《${c.name}》扫描PDF`,sha256:book.sourceSha256}]}};
});
lessons=applyStructuralChanges(lessons,read('structural-changes').changes);
const additions=read('additional-passages').lessons;
for(const item of additions){
  const candidates=lessons.filter(l=>l.bookId===item.bookId&&l.chapter===item.afterChapter);
  if(!candidates.length)throw new Error(`Missing insertion anchor ${item.afterChapter}`);
  const index=lessons.findIndex(l=>l.id===candidates.at(-1).id);
  const {afterChapter,...lesson}=item;
  lessons.splice(index+1,0,lesson);
}
const lost=lessons.find(l=>l.bookId==='shangshu'&&l.text.includes('帝厘下土'));
if(!lost)throw new Error('Missing 汩作篇序');
lost.chapter='虞书·汩作九共槁饫';lost.text='帝厘下土，方设居方，别生分类。作《汩作》《九共》九篇、《槁饫》。';lost.sourcePdfPages=[44];
for(const l of lessons){
  if(l.bookId==='zhouyi'){l.chapter=l.chapter.replaceAll('遯','遁');l.section=l.section.replaceAll('遯','遁');}
  if(/[<>0-9a-zA-Z]/.test(l.text))throw new Error(`Unresolved source marker ${l.id}`);
}
const edition={id:'four-supplied-pdf-editions',annotator:'邓启铜',method:'OCR辅助差异核对，原页复核实字修改及篇序；拼音仍为自动注音。'};
const output=JSON.stringify({version:1,edition,books,lessons},null,2)+'\n';
const destination=new URL('../src/data/four-books-text.json',import.meta.url);
if(process.argv.includes('--check')){if(fs.readFileSync(destination,'utf8').replace(/\r\n/g,'\n')!==output)throw new Error('Four-book text requires rebuilding');}
else fs.writeFileSync(destination,output);
