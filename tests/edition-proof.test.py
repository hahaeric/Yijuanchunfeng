import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('proof', Path(__file__).resolve().parents[1] / 'mobile/scripts/render-edition-differences.py')
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


class ProofTests(unittest.TestCase):
    def test_recognizer_whitespace_is_not_a_glyph_offset(self):
        row = {'text': '者王① ,谓人', 'characters': [{'text': '者王①,谓人'}]}
        self.assertTrue(proof.characters_match(row))
        row['characters'][0]['text'] = '者玉①,谓人'
        self.assertFalse(proof.characters_match(row))

    def test_review_selection_preserves_original_difference_indexes(self):
        differences = [{'op': 'insert'}, {'op': 'delete'}, {'op': 'replace'}]
        self.assertEqual(proof.select_differences(differences, {'replace', 'insert'}, {2}), [(2, differences[2])])

    def test_crop_is_clamped_to_source_page(self):
        box = [[0, 0], [30, 0], [30, 20], [0, 20]]
        self.assertEqual(proof.crop_rectangle(box, [0, 0, 40, 50], [100, 60]), (0, 0, 100, 60))

    def test_crop_keeps_neighboring_glyphs_and_annotation_context(self):
        box = [[900, 500], [1000, 500], [1000, 580], [900, 580]]
        self.assertEqual(proof.crop_rectangle(box, [100, 490, 1700, 590], [2000, 2800]), (500, 475, 1500, 605))


if __name__ == '__main__':
    unittest.main()
