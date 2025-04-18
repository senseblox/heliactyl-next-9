import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  RefreshCcw,
  ArrowRight,
  CreditCard
} from 'lucide-react';
import axios from 'axios';

export default function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  const [error, setError] = useState(null);

  useEffect(() => {
    const verifyCheckout = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        if (!sessionId) {
          throw new Error('No session ID found');
        }

        // Verify the checkout session
        await axios.get(`/api/v5/billing/verify-checkout?session_id=${sessionId}`);
        
        setStatus('success');
        // Redirect after 3 seconds
        setTimeout(() => {
          navigate('/billing');
        }, 3000);
      } catch (err) {
        console.error('Verification failed:', err);
        setError(err.response?.data?.error || 'Failed to verify payment');
        setStatus('error');
      }
    };

    verifyCheckout();
  }, [searchParams, navigate]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <div className="text-center">
            <RefreshCcw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
            <p className="text-neutral-400">
              Please wait while we verify your payment...
            </p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Successful!</h2>
            <p className="text-neutral-400 mb-4">
              Your credit balance has been updated.
            </p>
            <p className="text-sm text-neutral-500">
              Redirecting you back to billing...
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Verification Failed</h2>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => navigate('/billing')}
              >
                Return to Billing
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={() => window.location.reload()}
              >
                Try Again
                <RefreshCcw className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-neutral-950 items-center justify-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="flex items-center justify-center mb-6">
          <CreditCard className="w-6 h-6 mr-2 text-neutral-400" />
          <h1 className="text-2xl font-bold">Payment Processing</h1>
        </div>
        {renderContent()}
      </Card>
    </div>
  );
}