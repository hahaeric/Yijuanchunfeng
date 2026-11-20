"""Recognize joined body rows with PP-OCRv5 and keep first-pass evidence intact."""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

from edition_evidence import extract_body_rows, row_rectangle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--book', required=True)
    parser.add_argument('--evidence', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--models', required=True)
    parser.add_argument('--dependency-dir')
    args = parser.parse_args()
    if args.dependency_dir:
        sys.path.insert(0, str(Path(args.dependency_dir).resolve()))
    from pypdf import PdfReader
    from rapidocr import RapidOCR, OCRVersion, ModelType, LangRec, EngineType
    from rapidocr.ch_ppocr_rec.typings import TextRecInput
    import numpy as np

    manifest = json.loads(Path(args.manifest).read_text(encoding='utf-8-sig'))
    entry = next(e for e in manifest if e['id'] == args.book)
    reader = PdfReader(entry['path'])
    digest = hashlib.sha256(Path(entry['path']).read_bytes()).hexdigest()
    engine = RapidOCR(params={
        'Global.use_det': False, 'Global.use_cls': False,
        'Rec.ocr_version': OCRVersion.PPOCRV5, 'Rec.model_type': ModelType.SERVER,
        'Rec.lang_type': LangRec.CH, 'Rec.engine_type': EngineType.ONNXRUNTIME,
        'EngineConfig.onnxruntime.intra_op_num_threads': 2,
        'EngineConfig.onnxruntime.inter_op_num_threads': 2,
        'Global.model_root_dir': str(Path(args.models).resolve())})
    recognizer = engine._load_rec_model()
    folder = Path(args.output) / args.book
    folder.mkdir(parents=True, exist_ok=True)
    for number in range(entry.get('bodyStart', 1), entry.get('bodyEnd', len(reader.pages)) + 1):
        first_pass = Path(args.evidence) / args.book / f'{number:04}.json'
        waiting_since = time.monotonic()
        while not first_pass.exists():
            if time.monotonic() - waiting_since > 600:
                raise TimeoutError(f'First-pass evidence not ready: {first_pass}')
            time.sleep(2)
        original = first_pass.read_bytes()
        geometry_digest = hashlib.sha256(original).hexdigest()
        target = folder / first_pass.name
        if target.exists():
            cached = json.loads(target.read_text(encoding='utf-8'))
            if (cached.get('sourceSha256') == digest and cached.get('geometrySha256') == geometry_digest
                    and cached.get('recognizer') == 'PP-OCRv5-server-joined-rows-v1'):
                continue
        data = json.loads(original)
        if data['sourceSha256'] != digest:
            raise ValueError(f'First-pass evidence belongs to another source: {first_pass}')
        rows = extract_body_rows(data)
        rectangles, crops = [], []
        started = time.monotonic()
        if rows:
            image = max(reader.pages[number - 1].images, key=lambda item: item.image.width * item.image.height).image.convert('RGB')
            image = image.resize(tuple(data['imageSize']))
            rectangles = [row_rectangle(row, image.size) for row in rows]
            crops = [np.array(image.crop(rectangle)) for rectangle in rectangles]
            recognized = recognizer(TextRecInput(img=crops, return_word_box=True))
            boxes = np.array([[[left, top], [right, top], [right, bottom], [left, bottom]]
                              for left, top, right, bottom in rectangles], dtype=np.float32)
            recognized = engine.cal_rec_boxes(crops, boxes, recognized, return_single_char_box=True)
            for i, row in enumerate(rows):
                row['firstPassText'] = row['text']
                row['text'] = recognized.txts[i]
                row['confidence'] = float(recognized.scores[i])
                row['rectangle'] = list(rectangles[i])
                row['characters'] = [{'text': text, 'confidence': float(score),
                                      'box': [[float(x), float(y)] for x, y in box]}
                                     for text, score, box in recognized.word_results[i]]
        result = {'bookId': args.book, 'page': number, 'sourceSha256': digest,
                  'geometrySha256': geometry_digest, 'recognizer': 'PP-OCRv5-server-joined-rows-v1',
                  'imageSize': data['imageSize'], 'rows': rows}
        temporary = target.with_suffix('.partial')
        temporary.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
        temporary.replace(target)
        print(f"{args.book} v5 page {number}: {len(rows)} body rows, {time.monotonic()-started:.1f}s", flush=True)


if __name__ == '__main__':
    main()
