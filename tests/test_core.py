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

    def test_helpdesk_code_request_is_detected_without_sentence_matching(self):
        text = 'Hello, I am from the IT helpdesk. To finish your account migration, reply with the six-digit code that just arrived on your phone.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('authentication_code', result['signals'])
        self.assertIn('support_impersonation', result['signals'])
        self.assertIn(result['label'], {'High risk', 'Needs verification'})
        self.assertTrue(any('six-digit code' in reason for reason in result['reasons']))

    def test_unfamiliar_authentication_code_paraphrase_is_detected(self):
        text = 'Security operations need you to forward the verification number from your phone to approve the new login.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('authentication_code', result['signals'])

    def test_login_approval_request_has_accurate_explanation(self):
        text = 'Your login approval request is waiting. Approve it now to keep access.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('login_approval', result['signals'])
        self.assertNotIn('authentication_code', result['signals'])
        self.assertTrue(any('approve or authorise a login' in reason for reason in result['reasons']))

    def test_harmless_training_notice_is_not_high_risk_without_evidence(self):
        text = 'Hi Michael, football training is at 6 pm tomorrow. Bring your boots and a bottle of water. See you there!'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertEqual(result['label'], 'Few warning signs detected')
        self.assertEqual(result['signals'], [])
        self.assertTrue(any('No specific scam phrase detected' in reason for reason in result['reasons']))

    def test_protective_security_advice_has_no_misleading_warning_reason(self):
        text = 'Never share your password or one-time code with anyone. Open your bank app only through the official app.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertEqual(result['label'], 'Few warning signs detected')
        self.assertEqual(result['signals'], [])
        self.assertTrue(all('Open your bank' not in reason for reason in result['reasons']))

    def test_payment_amount_is_not_truncated(self):
        text = 'Please send £850 to the supplier today using the invoice details.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertTrue(any('£850' in reason for reason in result['reasons']))

    def test_protective_clause_does_not_hide_separate_code_request(self):
        text = 'Do not call your bank. Send your verification code here.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('authentication_code', result['signals'])
        self.assertNotEqual(result['label'], 'Few warning signs detected')

    def test_code_request_to_stop_transfer_is_not_described_as_payment_request(self):
        text = 'Send your verification code here within 5 minutes to stop a £850 transfer.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertIn('authentication_code', result['signals'])
        self.assertNotIn('payment', result['signals'])

    def test_benign_payment_discussion_is_not_a_payment_request(self):
        text = 'We discussed the rent payment yesterday and agreed no transfer is required.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertNotIn('payment', result['signals'])

    def test_quoted_scam_advice_remains_lower_caution(self):
        text = 'Security awareness: scammers may say send your verification code. Never reply.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertEqual(result['label'], 'Few warning signs detected')
        self.assertEqual(result['signals'], [])

    def test_normal_notice_is_not_high_caution(self):
        text = 'The library will be closed on Monday for scheduled maintenance.'
        result = explain(text, self.model.predict_probability(text), self.model)
        self.assertNotEqual(result['label'], 'Suspicious')

    def test_short_input_is_handled_by_server_contract(self):
        self.assertLess(len('hello'), 12)


if __name__ == '__main__':
    unittest.main()
