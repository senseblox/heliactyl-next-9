import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { loadStripe } from '@stripe/stripe-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  Package,
  CreditCard,
  AlertCircle,
  RefreshCw,
  Check,
  Wallet,
  Receipt,
  ArrowRight
} from 'lucide-react';
import axios from 'axios';

const stripePromise = loadStripe('pk_live_51Qq17fIA6aM8I5eWUx8JXkMTO80l1RObcNKB3qFG2Ootbw4EsHCBpBxuZZEUcYXWQoUthYCSk2zmf6Pwg5716zrn00ggGDlkqr');

export default function BillingStore() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('coins');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutAmount, setCheckoutAmount] = useState(5);
  const [error, setError] = useState(null);
  const [loadingPurchases, setLoadingPurchases] = useState({});
  const [completedPurchases, setCompletedPurchases] = useState({});

  // Existing query hooks remain the same
  const { data: billingInfo, isLoading: loadingBilling } = useQuery({
    queryKey: ['billing-info'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v5/billing/info');
      return data;
    }
  });

  const { data: userCoins } = useQuery({
    queryKey: ['user-coins'],
    queryFn: async () => {
      const { data } = await axios.get('/api/coins');
      return data.coins;
    }
  });

  const { data: creditBalance } = useQuery({
    queryKey: ['credit-balance'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v5/billing/info');
      return data.balances?.credit_usd || 0;
    }
  });

  const { data: transactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const { data } = await axios.get('/api/v5/billing/transactions');
      return data.transactions || [];
    }
  });

  const handleCheckout = async (amount) => {
    try {
      setError(null);
      setIsCheckingOut(true);
      
      const { data } = await axios.post('/api/v5/billing/checkout', {
        amount_usd: amount
      });

      const stripe = await stripePromise;
      const { error } = await stripe.redirectToCheckout({
        sessionId: data.sessionId
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (err) {
      setError(err.message);
      setIsCheckingOut(false);
    }
  };

  const handleCoinPurchase = async (packageId) => {
    try {
      setError(null);
      setLoadingPurchases(prev => ({ ...prev, [`coin-${packageId}`]: true }));
      
      await axios.post('/api/v5/billing/purchase-coins', {
        package_id: packageId
      });
      
      await queryClient.invalidateQueries(['user-coins']);
      await queryClient.invalidateQueries(['credit-balance']);
      await queryClient.invalidateQueries(['transactions']);
      
      setCompletedPurchases(prev => ({ ...prev, [`coin-${packageId}`]: true }));
      setTimeout(() => {
        setCompletedPurchases(prev => ({ ...prev, [`coin-${packageId}`]: false }));
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to purchase coins');
    } finally {
      setLoadingPurchases(prev => ({ ...prev, [`coin-${packageId}`]: false }));
    }
  };

  const handleBundlePurchase = async (bundleId) => {
    try {
      setError(null);
      setLoadingPurchases(prev => ({ ...prev, [`bundle-${bundleId}`]: true }));
      
      await axios.post('/api/v5/billing/purchase-bundle', {
        bundle_id: bundleId
      });
      
      await queryClient.invalidateQueries(['user-coins']);
      await queryClient.invalidateQueries(['credit-balance']);
      await queryClient.invalidateQueries(['transactions']);
      
      setCompletedPurchases(prev => ({ ...prev, [`bundle-${bundleId}`]: true }));
      setTimeout(() => {
        setCompletedPurchases(prev => ({ ...prev, [`bundle-${bundleId}`]: false }));
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to purchase bundle');
    } finally {
      setLoadingPurchases(prev => ({ ...prev, [`bundle-${bundleId}`]: false }));
    }
  };

  if (loadingBilling) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-[#95a1ad]" />
        </div>
      </div>
    );
  }

  const getPurchaseButtonContent = (type, id) => {
    const key = `${type}-${id}`;
    if (loadingPurchases[key]) {
      return <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Processing...</>;
    }
    if (completedPurchases[key]) {
      return <><Check className="w-4 h-4 mr-2" />Done!</>;
    }
    return (
      <>
        {type === 'coin' ? <Coins className="w-4 h-4 mr-2" /> : <Package className="w-4 h-4 mr-2" />}
        {type === 'coin' ? 'Purchase with Credit' : 'Purchase Bundle'}
      </>
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-screen-2xl mx-auto">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="text-[#95a1ad]">Purchase our amazing offers on extra coins, resources and packages</p>
        </div>
        <div className="flex items-center gap-4 hidden">
          <div className="py-2 px-4 border border-[#2e3337] rounded-md flex items-center">
            <Wallet className="w-4 h-4 mr-2 text-[#95a1ad]" />
            <span>{userCoins?.toLocaleString() || 0} XEC</span>
          </div>
          <div className="py-2 px-4 border border-[#2e3337] rounded-md flex items-center">
            <CreditCard className="w-4 h-4 mr-2 text-[#95a1ad]" />
            <span>${creditBalance?.toFixed(2) || '0.00'} USD</span>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 text-red-500 p-3 flex items-start">
          <AlertCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Custom tabs implementation */}
      <div className="space-y-6">
        <div className="border-b border-[#2e3337]">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('coins')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'coins' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              <Coins className="w-4 h-4" />
              Balance Top-up
            </button>
            <button
              onClick={() => setActiveTab('bundles')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'bundles' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              <Package className="w-4 h-4" />
              Bundles & Deals
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'transactions' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Transactions
            </button>
          </div>
        </div>

        {/* Coins Tab Content */}
        {activeTab === 'coins' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {billingInfo?.coin_packages?.map((pkg) => (
                <div key={pkg.amount} className="border border-[#2e3337] rounded-lg bg-transparent">
                  <div className="p-4 pb-3 border-b border-[#2e3337]">
                    <h3 className="font-normal text-lg">{pkg.amount.toLocaleString()} coins</h3>
                    <p className="text-sm text-[#95a1ad]">${pkg.price_usd.toFixed(2)} USD</p>
                  </div>
                  <div className="p-4 pb-3">
                    <p className="text-sm text-[#95a1ad]">
                      {(pkg.amount / pkg.price_usd).toFixed(0)} coins per USD
                    </p>
                  </div>
                  <div className="p-4 pt-2">
                    <button
                      className={`w-full py-2 flex items-center justify-center rounded-md font-medium text-sm transition active:scale-95 ${
                        creditBalance < pkg.price_usd || loadingPurchases[`coin-${pkg.amount}`]
                          ? 'bg-white/20 text-white/60 cursor-not-allowed'
                          : 'bg-white text-black hover:bg-white/90'
                      }`}
                      onClick={() => handleCoinPurchase(pkg.amount)}
                      disabled={creditBalance < pkg.price_usd || loadingPurchases[`coin-${pkg.amount}`]}
                    >
                      {getPurchaseButtonContent('coin', pkg.amount)}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <h3 className="font-normal text-lg">Add Credit Balance</h3>
                <p className="text-sm text-[#95a1ad]">
                  Purchase credit balance for your Altare account
                </p>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-5 gap-2">
                  {[1, 3, 5, 10, 20].map((amount) => (
                    <button
                      key={amount}
                      className={`py-2 rounded-md font-medium text-sm transition active:scale-95 ${
                        checkoutAmount === amount
                          ? 'bg-white text-black'
                          : 'border border-[#2e3337] text-[#95a1ad] hover:text-white hover:bg-white/5'
                      }`}
                      onClick={() => setCheckoutAmount(amount)}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 pt-2">
                <button
                  className={`w-full py-2 flex items-center justify-center rounded-md font-medium text-sm transition active:scale-95 ${
                    isCheckingOut
                      ? 'bg-white/20 text-white/60 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-white/90'
                  }`}
                  onClick={() => handleCheckout(checkoutAmount)}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Add ${checkoutAmount} Credit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bundles Tab Content */}
        {activeTab === 'bundles' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(billingInfo?.bundles || {}).map(([id, bundle]) => (
              <div key={id} className="border border-[#2e3337] rounded-lg bg-transparent">
                <div className="p-4 pb-3 border-b border-[#2e3337]">
                  <h3 className="font-normal text-lg">{bundle.name}</h3>
                  <p className="text-sm text-[#95a1ad]">${bundle.price_usd} USD</p>
                </div>
                <div className="p-4 pb-3 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>RAM</span>
                      <span>{(bundle.resources.ram / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Disk</span>
                      <span>{(bundle.resources.disk / 1024).toFixed(0)} GB</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CPU</span>
                      <span>{bundle.resources.cpu}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Servers</span>
                      <span>{bundle.resources.servers}</span>
                    </div>
                    {bundle.resources.coins > 0 && (
                      <div className="flex justify-between text-sm text-green-500">
                        <span>Bonus Coins</span>
                        <span>+{bundle.resources.coins.toLocaleString()} coins</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4 pt-2">
                  <button
                    className={`w-full py-2 flex items-center justify-center rounded-md font-medium text-sm transition active:scale-95 ${
                      creditBalance < bundle.price_usd || loadingPurchases[`bundle-${id}`]
                        ? 'bg-white/20 text-white/60 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                    onClick={() => handleBundlePurchase(id)}
                    disabled={creditBalance < bundle.price_usd || loadingPurchases[`bundle-${id}`]}
                  >
                    {getPurchaseButtonContent('bundle', id)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Transactions Tab Content */}
        {activeTab === 'transactions' && (
          <div className="border border-[#2e3337] rounded-lg bg-transparent">
            <div className="p-4 pb-3 border-b border-[#2e3337]">
              <h3 className="font-normal text-lg">Transaction History</h3>
            </div>
            <div className="p-4">
              <div className="h-[500px] overflow-y-auto pr-2">
                {loadingTransactions ? (
                  <div className="flex justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#95a1ad]" />
                  </div>
                ) : transactions?.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="flex items-center justify-between p-4 bg-[#222427] border border-[#2e3337] rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#1a1c1e] border border-white/5">
                            {transaction.type === 'credit_purchase' ? (
                              <CreditCard className="w-4 h-4 text-[#95a1ad]" />
                            ) : transaction.type === 'coin_purchase' ? (
                              <Coins className="w-4 h-4 text-[#95a1ad]" />
                            ) : (
                              <Package className="w-4 h-4 text-[#95a1ad]" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {transaction.type === 'credit_purchase'
                                ? 'Added Credit'
                                : transaction.type === 'coin_purchase'
                                ? 'Purchased Coins'
                                : 'Purchased Bundle'}
                            </p>
                            <p className="text-xs text-[#95a1ad]">
                              {new Date(transaction.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className={transaction.amount >= 0 ? 'text-green-500' : 'text-red-500'}>
                              {transaction.amount >= 0 ? '+' : ''}{transaction.amount.toLocaleString()}
                              {transaction.type === 'credit_purchase' ? ' USD' : ' Coins'}
                            </p>
                            <p className="text-xs text-[#95a1ad]">
                              ID: {transaction.id}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[#95a1ad]" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Receipt className="w-8 h-8 text-[#95a1ad] mx-auto mb-2" />
                    <p className="text-[#95a1ad]">No transactions yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}