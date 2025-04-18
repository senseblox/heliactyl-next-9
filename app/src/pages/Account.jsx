import React, { useState, useEffect } from 'react';
import { User, Coins, Eye, EyeOff, Gift, HelpCircle, Copy, Key, RefreshCw, AlertCircle, ShieldCheck } from 'lucide-react';
import TwoFactorAuth from './TwoFactorAuth';

const AccountPage = () => {
  const [activeTab, setActiveTab] = useState("account");
  const [claimCode, setClaimCode] = useState('');
  const [newCode, setNewCode] = useState('');
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState(null);
  const [coinsBalance, setCoinsBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [sftpPassword, setSftpPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch user data
        const userResponse = await fetch('/api/user');
        const userData = await userResponse.json();
        setUserData(userData);

        // Fetch coins balance
        const coinsResponse = await fetch('/api/coins');
        const coinsData = await coinsResponse.json();
        setCoinsBalance(coinsData.coins);

        // Fetch SFTP password
        const passwordResponse = await fetch('/api/password');
        const passwordData = await passwordResponse.json();
        setSftpPassword(passwordData.password);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    const coinsInterval = setInterval(async () => {
      try {
        const coinsResponse = await fetch('/api/coins');
        const coinsData = await coinsResponse.json();
        setCoinsBalance(coinsData.coins);
      } catch (error) {
        console.error('Failed to fetch coins balance:', error);
      }
    }, 3000);

    return () => clearInterval(coinsInterval);
  }, []);

  const handleClaimCode = async () => {
    if (!claimCode) {
      setMessage({ type: 'error', text: 'Please enter a referral code' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/claim?code=${encodeURIComponent(claimCode)}`);
      const data = await response.json();
      
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: 'Successfully claimed referral code! You received 250 coins.' });
        setClaimCode('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to claim code. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const handleGenerateCode = async () => {
    if (!newCode) {
      setMessage({ type: 'error', text: 'Please enter a code' });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/generate?code=${encodeURIComponent(newCode)}`);
      const data = await response.json();
      
      if (data.error) {
        setMessage({ type: 'error', text: data.error });
      } else {
        setMessage({ type: 'success', text: 'Successfully created referral code!' });
        setNewCode('');
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate code. Please try again.' });
    }
    setIsSubmitting(false);
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }

    try {
      const response = await fetch('/api/password/change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
          confirmPassword: confirmPassword
        })
      });

      const data = await response.json();
      
      if (data.error) {
        setPasswordMessage({ type: 'error', text: data.error });
      } else {
        setPasswordMessage({ type: 'success', text: 'Password updated successfully' });
        setNewPassword('');
        setConfirmPassword('');
        const passwordResponse = await fetch('/api/password');
        const passwordData = await passwordResponse.json();
        setSftpPassword(passwordData.password);
      }
    } catch (error) {
      setPasswordMessage({ type: 'error', text: 'Failed to update password' });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: 'success', text: 'Copied to clipboard!' });
  };

  if (isLoading || !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-[#95a1ad]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-screen-2xl mx-auto">
      {/* User Profile Card - Always visible */}
      <div className="border border-[#2e3337] rounded-lg bg-transparent">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-full bg-[#222427] border border-white/5 flex items-center justify-center overflow-hidden">
              <img 
                src="https://i.imgur.com/YuP6YrU.png" 
                alt={userData.username}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
              <div className="h-full w-full items-center justify-center hidden">
                <User className="h-10 w-10 text-[#95a1ad]" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-semibold">{userData.username}</h3>
                <div className="py-1 px-2 rounded text-xs bg-[#222427] border border-[#2e3337] font-mono">
                  {userData.id}
                </div>
              </div>
              <p className="mt-1 text-[#95a1ad]">
                {userData.email}
              </p>
            </div>
            <div className="flex items-center hidden gap-2 bg-[#222427] border border-[#2e3337] rounded-lg p-3">
              <Coins className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm text-[#95a1ad]">Balance</p>
                <p className="text-lg font-medium">{coinsBalance.toFixed(2)} coins</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Container */}
      <div className="space-y-6">
        <div className="border-b border-[#2e3337]">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'account' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              Account Settings
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'security' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('referrals')}
              className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition ${
                activeTab === 'referrals' 
                  ? 'border-white text-white' 
                  : 'border-transparent text-[#95a1ad] hover:text-white hover:border-white/20'
              }`}
            >
              Referrals
            </button>
          </div>
        </div>

        {/* Account Settings Content */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            {/* SFTP Credentials */}
            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  <h3 className="font-normal text-lg">SFTP Credentials</h3>
                </div>
                <p className="text-sm text-[#95a1ad] mt-1">
                  Your login details for SFTP access
                </p>
              </div>
              <div className="p-4 space-y-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-[#95a1ad] mb-1">Username/Email</p>
                    <div className="flex items-center gap-2">
                      <input
                        value={'discord_' + userData.id + '@gmail.com'}
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none"
                      />
                      <button
                        onClick={() => copyToClipboard('discord_' + userData.id + '@gmail.com')}
                        className="p-2 rounded-md border border-white/5 text-[#95a1ad] hover:text-white hover:bg-white/5 transition active:scale-95"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-[#95a1ad] mb-1">SFTP Username</p>
                    <div className="flex items-center gap-2">
                      <input
                        value="This is available on each server's overview page."
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-[#95a1ad] mb-1">SFTP Password</p>
                    <div className="flex items-center gap-2">
                      <input
                        type={"text"}
                        value={"Set a custom password from the Security tab!"}
                        readOnly
                        className="flex-1 px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab Content */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Password Change */}
            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <h3 className="font-normal text-lg">Change Password</h3>
                <p className="text-sm text-[#95a1ad] mt-1">
                  Set a custom password for SFTP access
                </p>
              </div>
              <div className="p-4 space-y-4">
                <input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none focus:border-white/5 focus:ring-1 focus:ring-white/20 transition-colors"
                />
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none focus:border-white/5 focus:ring-1 focus:ring-white/20 transition-colors"
                />
                <button 
                  onClick={handlePasswordChange}
                  className="px-4 py-2 bg-white text-black hover:bg-white/90 rounded-md font-medium text-sm transition active:scale-95"
                >
                  Update Password
                </button>
                {passwordMessage && (
                  <div className={`rounded-md p-3 flex items-start ${passwordMessage.type === 'error' ? 'border border-red-500/20 bg-red-500/10 text-red-500' : 'border border-green-500/20 bg-green-500/10 text-green-500'}`}>
                    <AlertCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">{passwordMessage.text}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Two-Factor Authentication */}
            <TwoFactorAuth />
          </div>
        )}

        {/* Referrals Content */}
        {activeTab === 'referrals' && (
          <div className="space-y-6">
            {/* Referral Info */}
            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  <h3 className="font-normal text-lg">How Referrals Work</h3>
                </div>
              </div>
              <div className="p-4">
                <div className="bg-[#222427] border border-[#2e3337] rounded-lg p-4">
                  <h3 className="font-medium mb-3">Rewards</h3>
                  <ul className="space-y-2 text-sm text-[#95a1ad]">
                    <li className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-yellow-500" />
                      When someone uses your code, you get <span className="text-yellow-500 font-medium">80 coins</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Gift className="h-4 w-4 text-yellow-500" />
                      They receive <span className="text-yellow-500 font-medium">250 coins</span> for using a referral code
                    </li>
                    <li className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Each user can only claim one referral code
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Generate Code */}
            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <h3 className="font-normal text-lg">Generate Referral Code</h3>
                <p className="text-sm text-[#95a1ad] mt-1">
                  Create a unique code for others to use
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-3">
                <input
                    placeholder="Enter desired code (max 15 chars)"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    maxLength={15}
                    className="flex-1 px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none focus:border-white/5 focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                  <button 
                    onClick={handleGenerateCode}
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition active:scale-95 ${
                      isSubmitting
                        ? 'bg-white/20 text-white/60 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    {isSubmitting ? 'Creating...' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>

            {/* Claim Code */}
            <div className="border border-[#2e3337] rounded-lg bg-transparent">
              <div className="p-4 pb-3 border-b border-[#2e3337]">
                <h3 className="font-normal text-lg">Claim Referral Code</h3>
                <p className="text-sm text-[#95a1ad] mt-1">
                  Enter a referral code to claim 250 coins. The code owner will receive 80 coins.
                </p>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex gap-3">
                  <input
                    placeholder="Enter referral code"
                    value={claimCode}
                    onChange={(e) => setClaimCode(e.target.value)}
                    maxLength={15}
                    className="flex-1 px-3 py-2 bg-[#394047] border border-white/5 rounded-md text-sm focus:outline-none focus:border-white/5 focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                  <button 
                    onClick={handleClaimCode} 
                    disabled={isSubmitting}
                    className={`px-4 py-2 rounded-md font-medium text-sm transition active:scale-95 ${
                      isSubmitting
                        ? 'bg-white/20 text-white/60 cursor-not-allowed'
                        : 'bg-white text-black hover:bg-white/90'
                    }`}
                  >
                    {isSubmitting ? 'Claiming...' : 'Claim Code'}
                  </button>
                </div>
                
                {message && (
                  <div className={`rounded-md p-3 flex items-start ${message.type === 'error' ? 'border border-red-500/20 bg-red-500/10 text-red-500' : 'border border-green-500/20 bg-green-500/10 text-green-500'}`}>
                    {message.type === 'error' ? 
                      <AlertCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" /> : 
                      <HelpCircle className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" />
                    }
                    <span className="text-sm">{message.text}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountPage;