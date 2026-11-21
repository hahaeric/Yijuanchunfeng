"""Render local PDF crops for reviewing OCR differences; never edits book text."""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def select_differences(differences, operations, ids=None):
    selected = []
    for index, difference in enumerate(differences):
        if difference['op'] not in operations or ids is not None and index not in ids:
            continue
        selected.append((index, difference))
    return selected


def characters_match(row):
    # The recognizer omits inter-token whitespace from word boxes. Han offsets
    # remain identical; any other discrepancy invalidates a proof crop.
    return ''.join(''.join(c['text'] for c in row['characters']).split()) == ''.join(row['text'].split())


def crop_rectangle(box, row_rectangle, image_size, margin=450):
    center = sum(point[0] for point in box) / len(box)
    width, height = image_size
    return (max(0, int(center) - margin), max(0, row_rectangle[1] - 15),
            min(width, int(center) + margin + 100), min(height, row_rectangle[3] + 15))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['manifest', 'book', 'diffs', 'evidence', 'output', 'font']:
        parser.add_argument('--' + name, required=True)
    parser.add_argument('--dependency-dir')
    parser.add_argument('--character-map', required=True)
    parser.add_argument('--operations', default='replace,insert,delete')
    parser.add_argument('--ids', help='Comma-separated difference indexes')
    args = parser.parse_args()
    if args.dependency_dir:
        sys.path.insert(0, args.dependency_dir)
    from PIL import Image, ImageDraw, ImageFont
    from pypdf import PdfReader
    from edition_evidence import is_han

    book = next(b for b in json.loads(Path(args.manifest).read_text('utf-8')) if b['id'] == args.book)
    character_map = json.loads(Path(args.character_map).read_text('utf-8'))
    locations = []
    digest = None
    for page in range(book['bodyStart'], book['bodyEnd'] + 1):
        data = json.loads((Path(args.evidence) / args.book / f'{page:04}.json').read_text('utf-8'))
        if data['page'] != page or data['bookId'] != args.book:
            raise ValueError('Mismatched evidence page')
        digest = digest or data['sourceSha256']
        if data['sourceSha256'] != digest:
            raise ValueError('Mixed source revisions')
        for row in data['rows']:
            if not characters_match(row):
                raise ValueError('Character boxes do not match recognized text')
            for char in row['characters']:
                for glyph in char['text']:
                    if is_han(glyph):
                        if len(character_map.get(glyph, glyph)) != 1:
                            raise ValueError('Non-character normalization')
                        locations.append((page, char['box'], row['rectangle'], data['imageSize']))
    differences = json.loads(Path(args.diffs).read_text('utf-8'))
    ids = set(map(int, args.ids.split(','))) if args.ids else None
    selected = select_differences(differences, set(args.operations.split(',')), ids)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)
    if hashlib.sha256(Path(book['path']).read_bytes()).hexdigest() != digest:
        raise ValueError('PDF no longer matches OCR evidence')
    reader = PdfReader(book['path'])
    font = ImageFont.truetype(args.font, 20)
    cache = {}
    for chunk in range(0, len(selected), 20):
        group = selected[chunk:chunk + 20]
        sheet = Image.new('RGB', (1400, len(group) * 150), '#f4f4f4')
        draw = ImageDraw.Draw(sheet)
        for offset, (index, difference) in enumerate(group):
            page, box, rectangle, size = locations[min(difference['sourceStart'], len(locations) - 1)]
            if page not in cache:
                cache = {page: next(iter(reader.pages[page - 1].images)).image.convert('RGB').resize(tuple(size))}
            crop = cache[page].crop(crop_rectangle(box, rectangle, size))
            crop.thumbnail((1380, 105))
            sheet.paste(crop, (10, offset * 150 + 35))
            label = f"{index} PDF{page}  {difference['old']} → {difference['source']}   {difference['context'][:36]}"
            draw.text((10, offset * 150 + 2), label, fill='black', font=font)
        path = output / f'{args.book}-{chunk // 20:02}.png'
        sheet.save(path)
        print(path, flush=True)


if __name__ == '__main__':
    main()
