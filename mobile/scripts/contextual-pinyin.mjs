// Shared classical readings for generated editions.
const chineseNumerals = new Set([..."零〇一二三四五六七八九十百千万亿两"]);
const isHan = (character) => /\p{Script=Han}/u.test(character);

function overridePhrase(text, units, phrase, reading) {
  const characters = [...text];
  const phraseCharacters = [...phrase];
  const syllables = Array.isArray(reading) ? reading : reading.split(" ");
  const hanCount = phraseCharacters.filter(isHan).length;
  if (syllables.length !== hanCount) {
    throw new Error(`拼音校订数量与词组不匹配：${phrase}（${reading}）`);
  }
  for (let index = 0; index <= characters.length - phraseCharacters.length; index += 1) {
    if (!phraseCharacters.every((character, offset) => characters[index + offset] === character)) continue;
    let syllableIndex = 0;
    phraseCharacters.forEach((character, offset) => {
      units[index + offset] = isHan(character) ? syllables[syllableIndex++] : "";
    });
  }
}

function overrideCharacterInPhrase(text, units, phrase, character, reading) {
  const characters = [...text];
  const phraseCharacters = [...phrase];
  for (let index = 0; index <= characters.length - phraseCharacters.length; index += 1) {
    if (!phraseCharacters.every((item, offset) => characters[index + offset] === item)) continue;
    phraseCharacters.forEach((item, offset) => {
      if (item === character) units[index + offset] = reading;
    });
  }
}

function overrideCharacter(text, units, character, reading, predicate = () => true) {
  const characters = [...text];
  characters.forEach((current, index) => {
    if (current === character && predicate(characters, index)) units[index] = reading;
  });
}

export function applyContextualPinyin(bookId, chapter, text, pinyinUnits) {
  const units = [...pinyinUnits];
  const phrase = (value, reading) => overridePhrase(text, units, value, reading);
  const phraseCharacter = (value, character, reading) => overrideCharacterInPhrase(text, units, value, character, reading);

  // 这些字在古文中常由自动注音器按现代常用义误判，优先校正通篇词义明确的用法。
  overrideCharacter(text, units, "率", "shuài");
  phrase("彀率", "gòu lǜ");

  overrideCharacter(text, units, "载", "zài");
  overrideCharacter(text, units, "载", "zǎi", (characters, index) =>
    index > 0 && chineseNumerals.has(characters[index - 1]));
  phrase("乘四载", "chéng sì zǎi");

  overrideCharacter(text, units, "行", "xíng");
  phrase("太行", "tài háng");
  phrase("行列", "háng liè");

  overrideCharacter(text, units, "予", "yú");
  phrase("何以予之", "hé yǐ yǔ zhī");

  // 《论语》中“女”作第二人称代词时读 rǔ；“女子”“女乐”仍是名词读 nǚ。
  if (bookId === "lunyu") {
    overrideCharacter(text, units, "女", "rǔ", (characters, index) =>
      !(characters[index + 1] === "子" || characters[index + 1] === "乐"));
  }
  if (bookId === "mengzi") {
    for (const value of ["掌与女乘", "舍女所学", "之女家", "予及女偕亡"]) {
      phrase(value, value === "予及女偕亡"
        ? "yú jí rǔ xié wáng"
        : value === "掌与女乘" ? "zhǎng yǔ rǔ chéng" : value === "舍女所学" ? "shě rǔ suǒ xué" : "zhī rǔ jiā");
    }
    phrase("二女女焉", "èr nǚ nǜ yān");
  }

  // 数量之间的“有”通“又”，读 yòu。
  overrideCharacter(text, units, "有", "yòu", (characters, index) =>
    index > 0 && index + 1 < characters.length
      && chineseNumerals.has(characters[index - 1])
      && chineseNumerals.has(characters[index + 1]));

  // “乘”作车乘单位读 shèng，动词乘坐仍读 chéng。
  overrideCharacter(text, units, "乘", "shèng", (characters, index) =>
    index > 0 && chineseNumerals.has(characters[index - 1]));
  phrase("畜马乘", "xù mǎ shèng");

  for (const value of ["道之以政", "道之以德"]) {
    phrase(value, value === "道之以政" ? "dǎo zhī yǐ zhèng" : "dǎo zhī yǐ dé");
  }
  phraseCharacter("求之与", "与", "yú");

  for (const value of ["吾日三省吾身", "退而省其私", "春省耕", "秋省敛", "帝省其山", "省此徐土", "屡省乃成", "往省括", "省厥躬", "王省惟岁", "昏定而晨省", "适馔省醴", "省方观民", "后不省方", "恐惧修省", "术省之", "省于其君"]) {
    phraseCharacter(value, "省", "xǐng");
  }

  phraseCharacter("尔丕克远省", "省", "xǐng");
  phraseCharacter("永观省", "省", "xǐng");

  for (const value of ["默而识之", "多见而识之", "多学而识之", "小子识之"]) {
    phraseCharacter(value, "识", "zhì");
  }

  for (const value of ["衣锦", "衣轻裘", "衣敝缊袍", "衣狐貉", "衣夫锦", "衣帛"]) {
    phraseCharacter(value, "衣", "yì");
  }
  phrase("衣敝缊袍", "yì bì yùn páo");
  if (bookId === "liji" && chapter === "玉藻") phraseCharacter("缁布衣锦缘", "衣", "yī");

  if (bookId === "mengzi" && chapter === "滕文公上") overrideCharacter(text, units, "冠", "guàn");
  if (bookId === "liji" && chapter === "冠义") {
    overrideCharacter(text, units, "冠", "guàn");
    phraseCharacter("玄冠", "冠", "guān");
  }
  for (const value of ["冠者五六人", "许子冠乎", "冠素", "奚冠", "丈夫之冠", "将冠子", "冠者至", "冠者未至", "冠而不醴", "既冠于次", "可以冠子", "可以冠，", "冠醮", "冠醴", "父没而冠", "已冠而字之", "已冠扫地", "古者冠礼", "敬冠事", "故冠于阼", "古者重冠", "重冠故行", "冠者，礼之始", "故冠而后", "因丧服而冠", "始于冠", "冠者不栉", "服而冠", "飨冠者", "遂冠归", "冠章甫", "士弁而冠"]) {
    phraseCharacter(value, "冠", "guàn");
  }

  for (const value of ["吾少", "少之时", "少者", "少连", "少师", "少傅", "少保", "少皞", "少艾", "少牢", "少男", "少女"]) {
    phraseCharacter(value, "少", "shào");
  }

  phrase("大夫", "dà fū");
  phrase("称物平施", "chèn wù píng shī");
  phrase("称事", "chèn shì");
  phrase("絜矩", "xié jǔ");
  phrase("数罟", "cù gǔ");
  phrase("事君数", "shì jūn shuò");
  phrase("朋友数", "péng yǒu shuò");
  phrase("将子无怒", "qiāng zǐ wú nù");
  phrase("将仲子", "qiāng zhòng zǐ");
  phrase("将将", "qiāng qiāng");
  overrideCharacter(text, units, "与", "yú", (characters, index) =>
    ["？", "?", "！", "!"].includes(characters[index + 1]));
  for (const value of ["岁不我与", "不我与", "谁与", "参与昴", "与娱"]) {
    phraseCharacter(value, "与", "yǔ");
  }
  for (const value of ["于予与何诛", "夫子圣者与", "道之将行也与", "道之将废也与", "南方之强与", "北方之强与"]) {
    phraseCharacter(value, "与", "yú");
  }

  return units;
}
