import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHtml, prepareApp, manifest, compileModel, packReadingData } from '../mobile/scripts/build-iphone-web.mjs';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { serviceWorker, startupClient } from '../mobile/scripts/iphone-startup.mjs';
const require = createRequire(import.meta.url);

test('precompiled web content preserves every lesson, ID, source note and reader helper', () => {
  const native = require('../mobile/src/model.js');
  const source = readFileSync(new URL('../mobile/src/model.js', import.meta.url), 'utf8');
  const packed=JSON.parse(JSON.stringify(packReadingData(native)));
  const context={__iphoneData:{...packed.meta,demoLessons:packed.books.flat()}, module:{exports:{}}};
  vm.runInNewContext(compileModel(source,native),context);
  const web=context.module.exports;
  const plain=value=>JSON.parse(JSON.stringify(value));
  assert.deepEqual(plain(web.demoLessons),plain(native.demoLessons));
  assert.deepEqual(plain(web.demoBooks),plain(native.demoBooks));
  assert.equal(web.contentRevision,native.contentRevision);
  for(const lesson of native.demoLessons) {
    assert.equal(web.getLessonSourceNote(web.demoLessons.find(l=>l.id===lesson.id)),native.getLessonSourceNote(lesson));
    assert.deepEqual(plain(web.getBookPosition(lesson.id)),plain(native.getBookPosition(lesson.id)));
  }
  for(const query of ['大学','子曰','天地']) assert.deepEqual(plain(web.searchLessons(query)),plain(native.searchLessons(query)));
  const {migrateReaderSnapshot}=require('../mobile/src/storage-migration.js');
  const saved={currentIndex:30,readLessonIds:['daxue-1'],pinyinCorrections:{}};
  assert.deepEqual(plain(migrateReaderSnapshot(saved,web.legacyLessons,web.demoLessons,web.contentRevision)),plain(migrateReaderSnapshot(saved,native.legacyLessons,native.demoLessons,native.contentRevision)));
});

test('startup uses saved resources offline and displays retry after failed download', async () => {
  const entries=new Map(), cache={match:async url=>entries.get(url)?.clone(),put:async(url,response)=>entries.set(url,response.clone())};
  let online=true, downloads=0;
  const status={textContent:''},retry={hidden:true};
  const context={window:{},document:{getElementById:id=>id==='startup-status'?status:id==='startup-retry'?retry:{childElementCount:0}},
    performance:{now:()=>0,mark(){}},caches:{open:async()=>cache},navigator:{},setTimeout(){},
    MutationObserver:class{observe(){}},fetch:async url=>{downloads++;if(!online)throw Error('offline');return new Response(JSON.stringify(url==='/meta'?{demoBooks:[]}:[{id:'lesson-1'}]));}};
  const launch=()=>vm.runInNewContext(`(${startupClient.toString()})({files:['/meta','/book-hash']})`,context);
  launch(); await context.window.__iphoneReady;
  assert.equal(downloads,2);
  online=false; launch(); await context.window.__iphoneReady;
  assert.equal(downloads,2);
  assert.equal(context.window.__iphoneData.demoLessons[0].id,'lesson-1');
  entries.clear();launch();await assert.rejects(context.window.__iphoneReady);
  assert.equal(retry.hidden,false);
});

test('worker serves cached shell offline and leaves account API requests untouched', async () => {
  const handlers={}, cached=new Response('offline shell');let network=0;
  const context={self:{location:{origin:'https://reader.test'},addEventListener:(name,fn)=>handlers[name]=fn},
    URL,caches:{open:async()=>({match:async()=>cached})},fetch:()=>{network++;throw Error('offline');}};
  vm.runInNewContext(serviceWorker('release-two',['/','/_expo/new-hash.js']),context);
  let response;
  handlers.fetch({request:{url:'https://reader.test/',method:'GET',mode:'navigate'},respondWith:value=>response=value});
  assert.equal(await (await response).text(),'offline shell');assert.equal(network,0);
  response=null;
  handlers.fetch({request:{url:'https://supabase.test/auth',method:'GET'},respondWith:value=>response=value});
  assert.equal(response,null);
  assert.notEqual(serviceWorker('one',['/']),serviceWorker('two',['/']));
});

test('web-only adaptation removes desktop frame and uses browser refresh', () => {
  const source = readFileSync(new URL('../mobile/App.js', import.meta.url), 'utf8');
  const web = prepareApp(source);
  assert.match(web, /window.location.reload\(\); return;/);
  assert.match(web, /网页更新/);
  assert.doesNotMatch(web, /height: 820/);
  assert.doesNotMatch(web, /minHeight: 760/);
  assert.match(web, /maxWidth: 600/);
});

test('iPhone export provides standalone installation and safe area without disabling zoom', () => {
  const html = prepareHtml('<html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"></head></html>');
  assert.match(html, /lang="zh-CN"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-touch-icon/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /safe-area-inset-bottom/);
  assert.doesNotMatch(html, /user-scalable=no/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
});
