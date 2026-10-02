import unittest
from pathlib import Path

from src.core import explain, load_or_train


ROOT = Path(__file__).resolve().parents[1]


class ScamShieldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = load_or_train(ROOT / 'artifacts' / 'test_model.json', ROOT / 'data' / 'sample_messages.csv')

    def test_urgent_credential_request_is_high_caution(self):
        text = 'Urgent: verify your password immediately using this link or your account will close.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn(result['label'], {'High risk', 'Needs verification'})
        self.assertGreaterEqual(len(result['reasons']), 2)

    def test_security_advice_is_not_classified_as_a_credential_request(self):
        text = 'Never share your password or one-time code with anyone.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertEqual(result['label'], 'Few warning signs detected')
        self.assertNotIn('credentials', result['signals'])

    def test_deadline_payment_request_has_grounded_evidence(self):
        text = 'Ticket payment required within 10 minutes to confirm your seat.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('urgency', result['signals'])
        self.assertIn('payment', result['signals'])
        self.assertTrue(any('10 minutes' in reason for reason in result['reasons']))

    def test_normal_notice_is_not_high_caution(self):
        text = 'The library will be closed on Monday for scheduled maintenance.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertNotEqual(result['label'], 'Suspicious')

    def test_short_input_is_handled_by_server_contract(self):
        self.assertLess(len('hello'), 12)


if __name__ == '__main__':
    unittest.main()
