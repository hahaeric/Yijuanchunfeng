"""Cache page OCR evidence from a local manifest; never edit application text.

The manifest is local, ignored data: [{"id": ..., "path": ...}]. Dependencies
are provided by the workspace runtime (or a task-local --dependency-dir).
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time


def is_non_body_text(text):
    return bool(text.strip()) and not any('\u3400' <= c <= '\u9fff' or '\U00020000' <= c <= '\U000323af' for c in text)


def select_pages(spec, total):
    if total < 1:
        raise ValueError('PDF has no pages')
    if not spec:
        return list(range(1, total + 1))
    result = []
    for part in spec.split(','):
        bounds = part.strip().split('-')
        if len(bounds) == 1:
            result.append(int(bounds[0]))
        elif len(bounds) == 2:
            start, end = map(int, bounds)
            if start > end:
                raise ValueError('Reversed page range')
            result.extend(range(start, end + 1))
        else:
            raise ValueError('Invalid page range')
    if any(page < 1 or page > total for page in result):
        raise ValueError('Requested page outside PDF')
    return list(dict.fromkeys(result))


def is_current_evidence(path, digest, page):
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
        return (data.get('sourceSha256') == digest and data.get('page') == page
                and isinstance(data.get('lines'), list)
                and len(data.get('imageSize', [])) == 2)
    except (OSError, ValueError, AttributeError, TypeError):
        return False


def body_boxes(boxes, image_height, minimum_ratio):
    return [box for box in boxes
            if max(point[1] for point in box) - min(point[1] for point in box)
            >= image_height * minimum_ratio]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--book', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--dependency-dir')
    parser.add_argument('--body-min-height', type=float, default=0,
                        help='Minimum region height / page height in body pages; 0 recognizes every region')
    parser.add_argument('--force', action='store_true', help='Re-read selected cached pages')
    parser.add_argument('--pages', help='One-based pages or ranges, e.g. 4,12-20; default is all pages')
    args = parser.parse_args()
    if args.dependency_dir:
        sys.path.insert(0, str(Path(args.dependency_dir).resolve()))
    from pypdf import PdfReader
    from rapidocr_onnxruntime import RapidOCR
    import numpy as np

    manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8-sig'))
    entry = next(item for item in manifest if item['id'] == args.book)
    pdf_path = Path(entry['path'])
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    reader = PdfReader(pdf_path)
    pages = select_pages(args.pages, len(reader.pages))
    folder = Path(args.output) / args.book
    folder.mkdir(parents=True, exist_ok=True)
    engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=2)
    for number in pages:
        target = folder / f'{number:04}.json'
        if not args.force and is_current_evidence(target, digest, number):
            continue
        started = time.monotonic()
        page = reader.pages[number - 1]
        images = list(page.images)
        if not images:
            text = page.extract_text()
            if is_non_body_text(text):
                data = {'bookId': args.book, 'page': number, 'sourceSha256': digest,
                        'imageSize': [float(page.mediabox.width), float(page.mediabox.height)],
                        'kind': 'non-body-text-layer', 'sourceText': text, 'lines': []}
                temporary = target.with_suffix('.partial')
                temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
                temporary.replace(target)
                print(f'{args.book} {number}: non-body text layer retained', flush=True)
                continue
            raise ValueError(f'No raster image on page {number}; render this page before OCR')
        image = max(images, key=lambda item: item.image.width * item.image.height).image.convert('RGB')
        if image.width > 2400:
            image.thumbnail((2400, 4000))
        pixels = np.array(image)
        minimum_ratio = args.body_min_height if number >= entry.get('bodyStart', 1) else 0
        excluded_boxes = []
        if minimum_ratio:
            detected, _ = engine.auto_text_det(pixels)
            detected = detected or []
            selected = body_boxes(detected, image.height, minimum_ratio)
            excluded_boxes = [box.tolist() for box in detected if all(box is not kept for kept in selected)]
            recognized, _ = engine.text_rec(engine.get_crop_img_list(pixels, selected)) if selected else ([], 0)
            lines = [[box.tolist(), text, float(confidence)]
                     for box, (text, confidence) in zip(selected, recognized)
                     if confidence >= engine.text_score]
        else:
            lines, _elapsed = engine(pixels)
        data = {'bookId': args.book, 'page': number, 'sourceSha256': digest,
                'imageSize': list(image.size), 'bodyMinHeight': minimum_ratio,
                'excludedBoxes': excluded_boxes, 'lines': lines or []}
        temporary = target.with_suffix('.partial')
        temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        temporary.replace(target)
        print(f'{args.book} {number}/{len(reader.pages)}: {len(lines or [])} regions, {time.monotonic()-started:.1f}s', flush=True)


if __name__ == '__main__':
    main()
