"""Read-only helpers for comparing scan evidence with existing classical text.

The result is review material, never publication text. Punctuation and unusual
glyphs remain verbatim so OCR substitutions cannot silently become corrections.
"""
import json
from pathlib import Path


def is_han(char):
    return '\u3400' <= char <= '\u9fff' or '\U00020000' <= char <= '\U000323af'


def bounds(box):
    return (min(p[0] for p in box), min(p[1] for p in box),
            max(p[0] for p in box), max(p[1] for p in box))


def join_regions(regions):
    """Only remove duplicate characters when detection boxes physically overlap."""
    result = ''
    previous_right = None
    for region in sorted(regions, key=lambda r: bounds(r['box'])[0]):
        left, _, right, _ = bounds(region['box'])
        text = region['text']
        if previous_right is not None and left < previous_right:
            overlap = next((n for n in range(min(len(result), len(text), 8), 0, -1)
                            if result[-n:] == text[:n]), 0)
            text = text[overlap:]
        result += text
        previous_right = right
    return result


def extract_body_rows(data, minimum_height=.018, left_margin=.06, right_margin=.94):
    width, height = data['imageSize']
    rows = []
    for box, text, confidence in data['lines']:
        left, top, right, bottom = bounds(box)
        center_x = (left + right) / 2
        size = bottom - top
        if not (height * minimum_height <= size <= height * .055
                and width * left_margin <= center_x <= width * right_margin
                and any(is_han(c) for c in text)):
            continue
        center_y = (top + bottom) / 2
        row = next((r for r in rows if abs(r['y'] - center_y) <= height * .009), None)
        if row is None:
            row = {'y': center_y, 'regions': []}
            rows.append(row)
        row['regions'].append({'box': box, 'text': text, 'confidence': confidence})
    result = []
    for index, row in enumerate(sorted(rows, key=lambda r: r['y'])):
        result.append({'id': f"{data['bookId']}:{data['page']}:{index}",
                       'bookId': data['bookId'], 'page': data['page'],
                       'y': row['y'], 'text': join_regions(row['regions']),
                       'regions': sorted(row['regions'], key=lambda r: bounds(r['box'])[0])})
    return result


def han_index(rows, character_map=None):
    character_map = character_map or {}
    text, locations = [], []
    for row in rows:
        for index, char in enumerate(row['text']):
            if is_han(char):
                normalized = character_map.get(char, char)
                # Index mapping must remain one character to one source glyph.
                if len(normalized) != 1:
                    raise ValueError(f'Non-character alignment mapping: {char}')
                text.append(normalized)
                locations.append({'rowId': row['id'], 'page': row['page'], 'index': index, 'glyph': char})
    return ''.join(text), locations


def load_rows(folder, first_page, last_page):
    rows, missing = [], []
    for number in range(first_page, last_page + 1):
        path = Path(folder) / f'{number:04}.json'
        if not path.exists():
            missing.append(number)
            continue
        data = json.loads(path.read_text(encoding='utf-8'))
        if data['page'] != number:
            raise ValueError(f'Mismatched OCR page: {path}')
        rows.extend(extract_body_rows(data))
    return rows, missing
