
import React, { useState } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { CreditCard, Loader as LoaderIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Load Stripe publishable key from environment
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

interface StripeCheckoutProps {
  coins: number;
  costUsd: number;
  onClose: () => void;
}

export const StripeCheckout: React.FC<StripeCheckoutProps> = ({ coins, costUsd, onClose }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    
    try {
      // Create checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.uid,
          coins: coins,
          amount: costUsd,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json() as { sessionId?: string };
      const sessionId = data.sessionId;
      
      if (!sessionId) {
        throw new Error('No session ID returned');
      }
      
      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (stripe) {
        // Use the newer Stripe session redirect method
        const { error } = await (stripe as any).redirectToCheckout({ sessionId });
        if (error) {
          console.error('Stripe redirect error:', error);
          alert('Payment failed. Please try again.');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Checkout error:', errorMessage);
      alert('Unable to process payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleCheckout}
      disabled={loading || coins <= 0}
      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold text-lg py-4 rounded-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:from-blue-500 hover:to-blue-400 disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-500/20"
    >
      {loading ? (
        <LoaderIcon size={20} className="animate-spin" />
      ) : (
        <>
          <CreditCard size={20} /> Pay with Card
        </>
      )}
    </button>
  );
};
