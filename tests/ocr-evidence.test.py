import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[1] / 'mobile/scripts/ocr-supplied-editions.py'
spec = importlib.util.spec_from_file_location('ocr_evidence', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class OcrEvidenceTests(unittest.TestCase):
    def test_non_raster_chinese_text_is_not_silently_discarded(self):
        self.assertTrue(module.is_non_body_text('Document generated; {"pages":397}'))
        self.assertFalse(module.is_non_body_text('孟子曰：仁义而已矣。'))
        self.assertFalse(module.is_non_body_text(''))

    def test_body_filter_retains_large_single_characters_and_rejects_small_pinyin(self):
        body = [[100, 100], [180, 100], [180, 180], [100, 180]]
        pinyin = [[100, 60], [180, 60], [180, 98], [100, 98]]
        self.assertEqual(module.body_boxes([body, pinyin], 2800, .02), [body])
        self.assertEqual(module.body_boxes([body, pinyin], 2800, 0), [body, pinyin])

    def test_select_pages_keeps_source_order_and_deduplicates(self):
        self.assertEqual(module.select_pages('4,12-14,4,13', 20), [4, 12, 13, 14])
        self.assertEqual(module.select_pages(None, 3), [1, 2, 3])

    def test_invalid_page_selection_cannot_silently_read_other_pages(self):
        for pages in ['0', '21', '8-3', 'a', '1-2-3', '-2']:
            with self.subTest(pages=pages), self.assertRaises(ValueError):
                module.select_pages(pages, 20)

    def test_cache_is_tied_to_source_bytes_and_page_number(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '0001.json'
            path.write_text(json.dumps({'sourceSha256': 'abc', 'page': 1, 'imageSize': [100, 200], 'lines': []}), encoding='utf-8')
            self.assertTrue(module.is_current_evidence(path, 'abc', 1))
            self.assertFalse(module.is_current_evidence(path, 'changed-source', 1))
            self.assertFalse(module.is_current_evidence(path, 'abc', 2))

    def test_interrupted_or_incomplete_cache_is_regenerated(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '0001.json'
            for value in ['{', 'null', '[]', '{"sourceSha256":"abc","page":1}']:
                path.write_text(value, encoding='utf-8')
                self.assertFalse(module.is_current_evidence(path, 'abc', 1))
            self.assertFalse(module.is_current_evidence(Path(folder) / 'missing.json', 'abc', 1))


if __name__ == '__main__':
    unittest.main()
