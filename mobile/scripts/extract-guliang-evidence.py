"""Extract review candidates from Guliang scans; never writes client data.

Requires local PDF/OCR evidence. Black square/circle margin markers distinguish
the Classic from the Commentary; footnotes and romanized readings are excluded.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def clean_body(text):
    # Superscript footnote numbers are editorial apparatus, not classical text.
    return re.sub(r'[①-⑳㉑-㉟㊱-㊿⓪0-9a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü\s°]', '', text)


def year_heading(text):
    return re.fullmatch(r'([隐桓庄闵僖文宣成襄昭定哀]公)(元|[一二三四五六七八九十有]+)年', clean_body(text))


def black_rectangles(image):
    import cv2
    import numpy as np
    width, height = image.size
    pixels = np.asarray(image.convert('L'))
    mask = (pixels < 110).astype('uint8')
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask)
    result = []
    for i in range(1, count):
        x, y, w, h, area = map(int, stats[i])
        if not (.01 * height <= h <= .026 * height and .7 <= w / h <= 1.4 and area / (w*h) > .36):
            continue
        patch = mask[y:y+h, x:x+w]
        # A solid rectangular outer border has ink in all four corners; a
        # circular Commentary marker does not. Ignore the white glyph inside.
        k = max(2, int(min(w,h) * .16))
        corner = float(np.mean([patch[:k,:k].mean(), patch[:k,-k:].mean(),
                                patch[-k:,:k].mean(), patch[-k:,-k:].mean()]))
        result.append({'y': y+h/2, 'kind': '经' if corner > .48 else '传',
                       'cornerInk': corner, 'ink':area/(w*h), 'rectangle': [x,y,x+w,y+h]})
    return result


def marker_candidates(image, column=None):
    width, height = image.size
    column = width*.115 if column is None else column
    return [r for r in black_rectangles(image)
            if abs(r['rectangle'][0]-column) < width*.017
            and r['rectangle'][3]-r['rectangle'][1] >= height*.014]


def remove_inline_apparatus(row, rectangles):
    text = []
    removed = []
    for char in row.get('characters', []):
        left = min(p[0] for p in char['box'])
        right = max(p[0] for p in char['box'])
        match = [r for r in rectangles if left <= (r['rectangle'][0]+r['rectangle'][2])/2 <= right
                 and abs(r['y']-row['y']) < (row['rectangle'][3]-row['rectangle'][1])*.7]
        if match:
            removed.append(char['text'])
        else:
            text.append(char['text'])
    return ''.join(text) if row.get('characters') else row['text'], removed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--rows', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--dependency-dir')
    parser.add_argument('--allow-partial', action='store_true')
    args = parser.parse_args()
    if args.dependency_dir:
        sys.path.insert(0, str(Path(args.dependency_dir).resolve()))
    from pypdf import PdfReader
    entries = json.loads(Path(args.manifest).read_text(encoding='utf-8-sig'))
    result, pages, problems = [], [], []
    chapter = year = kind = None
    for entry in entries:
        source = Path(entry['path'])
        digest = hashlib.sha256(source.read_bytes()).hexdigest()
        reader = PdfReader(source)
        for number in range(entry['bodyStart'], entry['bodyEnd']+1):
            path = Path(args.rows) / entry['id'] / f'{number:04}.json'
            if not path.exists():
                if args.allow_partial:
                    break
                raise ValueError(f'Missing reviewed geometry: {path}')
            data = json.loads(path.read_text(encoding='utf-8'))
            if data['sourceSha256'] != digest:
                raise ValueError(f'Source changed: {path}')
            cache_path = Path(args.output).parent / 'page-analysis-v2' / entry['id'] / path.name
            signature = hashlib.sha256(path.read_bytes()).hexdigest()
            cached = json.loads(cache_path.read_text(encoding='utf-8')) if cache_path.exists() else None
            width,height = data['imageSize']
            if cached and cached.get('signature') == signature:
                rectangles = cached['rectangles']
            else:
                image = max(reader.pages[number-1].images, key=lambda im: im.image.width*im.image.height).image
                image = image.resize(tuple(data['imageSize']))
                rectangles = black_rectangles(image)
                cache_path.parent.mkdir(parents=True,exist_ok=True)
                cache_path.write_text(json.dumps({'signature':signature,'rectangles':rectangles}),encoding='utf-8')
            squares = [r['rectangle'][0] for r in rectangles if r['cornerInk']>.8 and r['ink']>.6
                       and width*.01 < r['rectangle'][0] < width*.16
                       and r['rectangle'][3]-r['rectangle'][1] >= height*.014]
            lefts = sorted(row['rectangle'][0] for row in data['rows']
                           if width*.01 < row['rectangle'][0] < width*.17)
            column = min(squares) if squares else lefts[0] if lefts else width*.11
            markers = [r for r in rectangles if abs(r['rectangle'][0]-column) < width*.017
                       and r['rectangle'][3]-r['rectangle'][1] >= height*.014]
            apparatus = [r for r in rectangles if r['cornerInk']>.8 and r['ink']>.65
                         and r['rectangle'][0] > column + width*.025]
            pages.append({'volume':entry['id'], 'page':number, 'markers':markers})
            if any(re.search(r'公[（(]元年', clean_body(row['text'])) for row in data['rows']):
                continue  # Illustrated title sheet, not classical body text.
            for row in data['rows']:
                heading = year_heading(row['text'])
                if heading:
                    chapter, year = heading.groups()
                    year += '年'
                    kind = None
                    continue
                if not chapter or not clean_body(row['text']):
                    continue
                matched = [m for m in markers if abs(m['y']-row['y']) < height*.02]
                if matched:
                    kind = min(matched,key=lambda m:abs(m['y']-row['y']))['kind']
                if kind is None:
                    problems.append({'row':row['id'], 'text':row['text'], 'problem':'missing 经/传 marker'})
                    continue
                without_apparatus, removed = remove_inline_apparatus(row, apparatus)
                text = clean_body(without_apparatus)
                if matched and text.startswith(kind) and row['rectangle'][0] <= max(m['rectangle'][2] for m in matched):
                    text = text[1:]
                result.append({'chapter':chapter, 'section':year, 'kind':kind,
                               'text':text, 'sourceText':row['text'], 'removedInlineApparatus':removed,
                               'startsMarker':bool(matched),
                               'volume':entry['id'], 'page':number, 'rowId':row['id'],
                               'rectangle':row['rectangle'], 'confidence':row.get('confidence',0)})
    Path(args.output).write_text(json.dumps({'rows':result,'pages':pages,'problems':problems},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'{len(pages)} pages, {len(result)} rows, {len(problems)} unresolved rows')


if __name__ == '__main__':
    main()
