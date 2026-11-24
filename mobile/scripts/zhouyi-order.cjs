const sentenceCounts = {
屯:[2,2,2,1,1,1],蒙:[1,1,1,1,1,1],需:[2,2,2,1,1,2],讼:[2,2,1,1,1,1],师:[1,2,1,1,2,2],比:[1,1,1,1,3,1],小畜:[1,1,1,1,1,2],履:[1,1,4,1,1,1],泰:[1,1,1,2,1,1],否:[1,1,1,1,1,1],同人:[1,1,2,2,2,1],大有:[1,1,1,1,2,1],谦:[1,1,1,1,1,2],豫:[1,1,1,1,2,1],随:[2,1,1,2,1,1],蛊:[1,1,1,1,1,1],临:[1,1,2,1,1,1],观:[1,1,1,1,1,1],噬嗑:[1,1,1,1,1,1],贲:[1,1,1,2,1,1],剥:[1,1,1,1,1,2],复:[1,1,1,1,1,1],无妄:[1,1,1,1,1,1],大畜:[1,1,1,1,1,1],颐:[1,1,1,1,1,1],大过:[1,1,1,1,2,1],坎:[1,1,1,1,1,1],离:[1,1,1,1,1,1],咸:[1,1,2,2,1,1],恒:[1,1,1,1,2,1],遁:[1,1,2,1,1,1],大壮:[1,1,1,1,1,2],晋:[2,1,1,1,1,1],明夷:[1,1,1,1,1,2],家人:[1,1,2,1,1,1],睽:[1,1,2,1,1,1],蹇:[1,1,1,1,1,2],解:[1,1,2,1,1,1],损:[1,1,1,1,1,1],益:[1,1,1,1,2,2],夬:[1,1,1,2,1,1],姤:[1,1,1,1,2,1],萃:[1,1,1,1,1,1],升:[1,1,1,1,1,1],困:[1,1,2,2,3,2],井:[2,1,2,1,1,1],革:[1,1,1,1,1,2],鼎:[2,2,1,1,1,1],震:[2,1,1,1,2,2],艮:[1,1,1,1,1,1],渐:[1,1,3,1,1,1],归妹:[2,1,1,1,2,1],丰:[1,1,2,3,1,2],旅:[1,1,2,2,1,2],巽:[2,1,1,1,1,2],兑:[1,1,1,1,1,1],涣:[1,1,1,1,1,1],节:[1,1,1,1,1,1],中孚:[1,1,1,1,1,1],小过:[1,1,1,2,1,1],既济:[1,1,1,1,2,1],未济:[1,1,1,1,1,1]
};

// The supplied PDF places Qian/Kun's complete texts before their commentaries.
// The remaining hexagrams interleave each line with its own Xiang commentary.
// Counts explicitly describe sentence groups, not a guessed equal-size split.
function arrangeZhouyi(lessons) {
  const source = lessons.filter(l => l.bookId === 'zhouyi');
  const chapters = [...new Set(source.filter(l => l.chapter.endsWith('卦')).map(l => l.chapter))];
  if (chapters.length !== 64) throw new Error('周易缺少六十四卦');
  const arranged = [];
  for (const chapter of chapters) {
    const name = chapter.slice(0, -1);
    const body = source.filter(l => l.chapter === chapter);
    const commentaries = source.filter(l => /^(彖传|象传|文言传)/u.test(l.chapter) && l.section.replace(/·\d+$/u, '').replace(/文言$/u, '') === name);
    const decorate = (l, section) => ({...l, chapter, section, unitLabel: section, originalChapter:l.chapter});
    const tuan = commentaries.filter(l => l.chapter.startsWith('彖传')).map(l => decorate(l, '彖传'));
    const xiang = commentaries.filter(l => l.chapter.startsWith('象传'));
    if (tuan.length !== 1 || !xiang.length) throw new Error(`经传对应不完整：${chapter}`);
    if (name === '乾' || name === '坤') {
      arranged.push(...body, ...tuan, ...xiang.map((l,i) => decorate(l, xiang.length > 1 ? ['大象','小象'][i] : '象传')), ...commentaries.filter(l => l.chapter === '文言传').map(l => decorate(l,'文言传')));
      continue;
    }
    const pieces = xiang.flatMap(l => {
      const sentences = l.text.match(/[^。？！]+[。？！]/gu) || [];
      if (sentences.join('') !== l.text) throw new Error(`象传存在未分配文字：${l.id}`);
      return sentences.map((text,i) => ({text, source:l, first:i===0}));
    });
    const counts = [1, ...sentenceCounts[name]];
    if (pieces.length !== counts.reduce((a,b)=>a+b,0) || body.length !== 7) throw new Error(`象传分段不匹配：${chapter}/${pieces.length}`);
    let offset = 0;
    const segments = counts.map((count,i) => {
      const part = pieces.slice(offset,offset+count); offset += count;
      const first = part[0];
      return decorate({...first.source, id:first.first ? first.source.id : `${first.source.id}-xiang-${i}`, sourceLessonId:first.source.id, text:part.map(p=>p.text).join('')}, i === 0 ? '大象' : `${body[i].section}·小象`);
    });
    arranged.push(body[0], ...tuan, segments[0]);
    for(let i=1;i<body.length;i++) arranged.push(body[i],segments[i]);
  }
  arranged.push(...source.filter(l=>!/^(彖传|象传|文言传)/u.test(l.chapter) && !l.chapter.endsWith('卦')));
  for(const l of source) if(!arranged.some(a=>a.id===l.id)) throw new Error(`周易重排丢失ID：${l.id}`);
  let inserted=false;
  return lessons.flatMap(l=>l.bookId!=='zhouyi' ? [l] : inserted ? [] : (inserted=true,arranged));
}
module.exports = {arrangeZhouyi, sentenceCounts};
