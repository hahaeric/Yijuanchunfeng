import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[1] / 'mobile/scripts/edition_evidence.py'
spec = importlib.util.spec_from_file_location('edition_evidence', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def region(x, y, width, height, text):
    return [[[x, y], [x + width, y], [x + width, y + height], [x, y + height]], text, .95]


class EditionEvidenceTests(unittest.TestCase):
    def test_row_crop_keeps_missed_glyph_spaces_and_stays_inside_page(self):
        row = {'regions': [{'box': region(1, 1, 80, 80, '孟')[0]}, {'box': region(800, 1, 80, 80, '子')[0]}]}
        self.assertEqual(module.row_rectangle(row, (850, 2800)), (0, 0, 850, 83))

    def test_small_pinyin_notes_and_side_labels_are_not_body(self):
        page = {'bookId': 'test', 'page': 12, 'imageSize': [2000, 2800], 'lines': [
            region(200, 200, 400, 35, 'meng zi yue'),
            region(200, 250, 700, 80, '孟子曰：“仁义而已矣。”'),
            region(200, 2400, 1200, 35, '注释：①解释'),
            region(10, 300, 60, 120, '孟子'),
            region(1900, 300, 60, 120, '孟子'),
        ]}
        rows = module.extract_body_rows(page)
        self.assertEqual([r['text'] for r in rows], ['孟子曰：“仁义而已矣。”'])
        self.assertEqual(rows[0]['page'], 12)

    def test_separate_single_character_regions_keep_reading_order(self):
        page = {'bookId': 'test', 'page': 1, 'imageSize': [2000, 2800], 'lines': [
            region(600, 250, 80, 80, '女'), region(200, 250, 80, 80, '窈'),
            region(400, 252, 80, 78, '淑'), region(300, 248, 80, 82, '窕'),
        ]}
        self.assertEqual(module.extract_body_rows(page)[0]['text'], '窈窕淑女')

    def test_overlapping_detection_is_deduplicated_but_poetic_repetition_is_not(self):
        regions = [{'box': r[0], 'text': r[1]} for r in [
            region(200, 250, 200, 80, '子曰：“学'), region(350, 250, 600, 80, '学而时习之'),
        ]]
        self.assertEqual(module.join_regions(regions), '子曰：“学而时习之')
        separate = [{'box': r[0], 'text': r[1]} for r in [
            region(200, 250, 80, 80, '关'), region(300, 250, 80, 80, '关'),
        ]]
        self.assertEqual(module.join_regions(separate), '关关')

    def test_variant_alignment_keeps_original_glyph_and_supplementary_han(self):
        rows = [{'id': 'a', 'page': 4, 'text': '後，𬤊。'}]
        text, positions = module.han_index(rows, {'後': '后'})
        self.assertEqual(text, '后𬤊')
        self.assertEqual([p['glyph'] for p in positions], ['後', '𬤊'])
        self.assertEqual([p['index'] for p in positions], [0, 2])
        with self.assertRaises(ValueError):
            module.han_index(rows, {'後': '后来'})

    def test_missing_pages_remain_visible_in_review_material(self):
        with tempfile.TemporaryDirectory() as folder:
            page = {'bookId': 'test', 'page': 1, 'imageSize': [100, 200], 'lines': []}
            (Path(folder) / '0001.json').write_text(json.dumps(page), encoding='utf-8')
            rows, missing = module.load_rows(folder, 1, 3)
            self.assertEqual(rows, [])
            self.assertEqual(missing, [2, 3])


if __name__ == '__main__':
    unittest.main()
