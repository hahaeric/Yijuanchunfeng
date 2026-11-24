"""Regression checks for separating Guliang source evidence."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('guliang', Path(__file__).resolve().parents[1] / 'mobile/scripts/extract-guliang-evidence.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class GuliangEvidenceTests(unittest.TestCase):
    def test_remove_apparatus_preserve_punctuation_and_rare_glyphs(self):
        self.assertEqual(module.clean_body('元年①，春，王正月②。'), '元年，春，王正月。')
        self.assertEqual(module.clean_body('曰：“不正。《春秋》”𫗧㊿'), '曰：“不正。《春秋》”𫗧')

    def test_year_heading_requires_complete_title(self):
        self.assertEqual(module.year_heading('隐公元年').groups(), ('隐公','元'))
        self.assertEqual(module.year_heading('昭公三十二年').groups(), ('昭公','三十二'))
        self.assertIsNone(module.year_heading('元年，春，王正月。'))
        self.assertIsNone(module.year_heading('春秋榖梁传'))

    def test_square_and_circle_markers_are_distinguished_from_body_characters(self):
        from PIL import Image, ImageDraw
        image = Image.new('RGB', (2000, 3000), 'white')
        draw = ImageDraw.Draw(image)
        draw.rectangle((230, 500, 290, 560), fill='black')
        draw.ellipse((230, 800, 290, 860), fill='black')
        # Normal-size body text must not be treated as a margin marker.
        draw.rectangle((230, 1100, 310, 1190), fill='black')
        markers = module.marker_candidates(image)
        self.assertEqual([m['kind'] for m in markers], ['经', '传'])

    def test_inline_note_is_removed_even_when_it_is_the_only_detected_glyph(self):
        row={'text':'馈','y':100,'rectangle':[0,60,80,140],
             'characters':[{'text':'馈','box':[[10,70],[60,70],[60,130],[10,130]]}]}
        note={'y':100,'rectangle':[15,75,55,125]}
        self.assertEqual(module.remove_inline_apparatus(row,[note]),('', ['馈']))
        self.assertEqual(module.remove_inline_apparatus(row,[]),('馈', []))


if __name__ == '__main__':
    unittest.main()
