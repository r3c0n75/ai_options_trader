import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

import alpaca_trading

class TestAlpacaMLEG(unittest.TestCase):
    @patch('httpx.post')
    def test_submit_options_order_limit_price(self, mock_post):
        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 201
        mock_response.json.return_value = {"id": "test_order_id", "status": "accepted"}
        mock_post.return_value = mock_response

        legs = [
            {"symbol": "USO240417P00112000", "side": "SELL", "ratio_qty": 1},
            {"symbol": "USO240417P00111000", "side": "BUY", "ratio_qty": 1}
        ]
        
        # Test Credit Spread (Negative limit price)
        limit_price = -0.30
        alpaca_trading.submit_options_order("Put Credit Spread", legs, quantity=1, limit_price=limit_price)
        
        args, kwargs = mock_post.call_args
        payload = kwargs['json']
        
        self.assertEqual(payload['type'], 'limit')
        self.assertEqual(payload['limit_price'], '-0.3')
        self.assertEqual(payload['order_class'], 'mleg')
        print("✓ submit_options_order sent correct negative limit_price for credit")

    @patch('httpx.patch')
    def test_replace_order_limit_price(self, mock_patch):
        # Mock successful response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "test_order_id", "status": "accepted"}
        mock_patch.return_value = mock_response
        
        limit_price = -0.45
        alpaca_trading.replace_order("test_order_id", limit_price=limit_price, qty=2)
        
        args, kwargs = mock_patch.call_args
        payload = kwargs['json']
        
        self.assertEqual(payload['limit_price'], '-0.45')
        self.assertEqual(payload['qty'], '2')
        print("✓ replace_order sent correct negative limit_price for credit")

if __name__ == '__main__':
    unittest.main()
