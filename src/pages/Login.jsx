import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Lock, Eye, EyeOff, ShieldCheck, FlaskConical, Package, FileText } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const loginSpores = useMemo(
    () =>
      Array.from({ length: 28 }, () => ({
        left: `${Math.random() * 100}%`,
        bottom: `${Math.random() * 14 - 4}px`,
        size: `${2 + Math.random() * 5}px`,
        color: Math.random() > 0.5 ? 'rgba(201,168,76,0.72)' : 'rgba(64,145,108,0.72)',
        delay: `${Math.random() * 15}s`,
        duration: `${11 + Math.random() * 10}s`,
      })),
    []
  );

  const fromUrl = searchParams.get('from_url');
  const normalizedEmail = email.trim();
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const showEmailValidation = emailTouched && normalizedEmail.length > 0 && !isEmailValid;
  const handleEmailChange = (e) => {
    const rawValue = e.target.value;
    const sanitizedValue = rawValue.replace(/[^a-zA-Z0-9@._+-]/g, '').slice(0, 254);
    setEmail(sanitizedValue);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isEmailValid) {
      setEmailTouched(true);
      setError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      setIsRedirecting(true);
      await new Promise((resolve) => setTimeout(resolve, 900));

      if (fromUrl) {
        window.location.href = decodeURIComponent(fromUrl);
        return;
      }

      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    setResetMessage('');

    if (!normalizedEmail) {
      setError('Enter your email first to reset your password.');
      return;
    }
    if (!isEmailValid) {
      setEmailTouched(true);
      setError('Please enter a valid email address.');
      return;
    }

    setIsResetting(true);
    try {
      const redirectTo = `${window.location.origin}${createPageUrl('set-password')}`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
      if (resetError) throw resetError;

      setResetMessage('Password reset link sent. Check your email inbox.');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="adm-root min-h-screen flex items-center justify-center p-4 sm:p-6">
      <style>{`
        .adm-root {
          overflow: hidden;
          background: #0f0608;
          font-family: 'DM Sans', sans-serif;
          position: relative;
        }
        .adm-bg {
          position: fixed;
          inset: 0;
          z-index: 0;
          overflow: hidden;
        }
        .adm-bg-base {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 72% 58% at 8% 14%, #4a0d1a 0%, transparent 55%),
            radial-gradient(ellipse 62% 52% at 92% 86%, #0d2e1c 0%, transparent 50%),
            radial-gradient(ellipse 40% 40% at 50% 50%, #1a0810 0%, transparent 65%),
            #0f0608;
        }
        .adm-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .adm-orb {
          position: absolute;
          border-radius: 9999px;
          filter: blur(88px);
          animation: adm-drift ease-in-out infinite alternate;
        }
        .adm-orb-1 {
          width: 530px;
          height: 530px;
          background: radial-gradient(circle, rgba(123,28,46,0.52), transparent 70%);
          top: -130px;
          left: -90px;
          animation-duration: 23s;
        }
        .adm-orb-2 {
          width: 580px;
          height: 580px;
          background: radial-gradient(circle, rgba(45,106,79,0.42), transparent 70%);
          bottom: -170px;
          right: -105px;
          animation-duration: 27s;
          animation-delay: -9s;
        }
        .adm-sweep {
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent);
          animation: adm-sweep 13s linear infinite;
        }
        .adm-spore {
          position: absolute;
          border-radius: 9999px;
          opacity: 0;
          animation: adm-spore linear infinite;
        }
        .adm-botanical {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }
        .adm-shell {
          position: relative;
          z-index: 10;
          width: min(1020px, 96vw);
          min-height: 580px;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 38px 96px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,168,76,0.14);
          animation: adm-rise 0.9s cubic-bezier(0.16,1,0.3,1) both;
        }
        .adm-left {
          background: linear-gradient(155deg, #5a1220 0%, #3d0c16 45%, #1f0a0e 100%);
          border-right: 1px solid rgba(201,168,76,0.12);
          position: relative;
          overflow: hidden;
        }
        .adm-left:before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2.5px;
          background: linear-gradient(90deg,#a32438,#c9a84c,#40916c,#c9a84c,#a32438);
          background-size: 200% 100%;
          animation: adm-shimmer 5s linear infinite;
        }
        .adm-right {
          background: #fdf6ec;
          position: relative;
          overflow: hidden;
        }
        .adm-right:before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(123,28,46,0.04) 1.5px, transparent 1.5px);
          background-size: 26px 26px;
        }
        .adm-right:after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2.5px;
          background: linear-gradient(90deg,#7b1c2e,#2d6a4f);
          opacity: .65;
        }
        .adm-login-btn {
          border-radius: 9999px;
          background: linear-gradient(135deg,#4e0f1c 0%,#a32438 60%,#8b2040 100%);
          box-shadow: 0 4px 20px rgba(123,28,46,0.45);
        }
        .adm-login-btn:hover {
          box-shadow: 0 8px 28px rgba(123,28,46,0.5);
        }
        @keyframes adm-drift {
          0% { transform: translate(0,0) scale(1); }
          40% { transform: translate(26px,-20px) scale(1.03); }
          100% { transform: translate(-16px,30px) scale(0.98); }
        }
        @keyframes adm-sweep {
          0% { top: -1px; }
          100% { top: 100%; }
        }
        @keyframes adm-spore {
          0% { opacity: 0; transform: translateY(0) rotate(0deg); }
          12% { opacity: 0.72; }
          88% { opacity: 0.25; }
          100% { opacity: 0; transform: translateY(-64vh) rotate(180deg); }
        }
        @keyframes adm-rise {
          from { opacity: 0; transform: translateY(42px) scale(0.96); }
          to { opacity: 1; transform: none; }
        }
        @keyframes adm-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
      <div className="adm-bg" aria-hidden>
        <div className="adm-bg-base" />
        <div className="adm-grid" />
        <div className="adm-orb adm-orb-1" />
        <div className="adm-orb adm-orb-2" />
        <div className="adm-sweep" />
        <svg
          className="adm-botanical"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M58 900 C58 700 98 580 48 382 C18 250 68 120 34 20" stroke="rgba(45,106,79,0.3)" strokeWidth="2" fill="none" />
          <ellipse cx="38" cy="220" rx="70" ry="28" fill="rgba(45,106,79,0.25)" transform="rotate(-38 38 220)" />
          <ellipse cx="68" cy="340" rx="80" ry="30" fill="rgba(45,106,79,0.18)" transform="rotate(25 68 340)" />
          <ellipse cx="18" cy="480" rx="68" ry="26" fill="rgba(45,106,79,0.22)" transform="rotate(-50 18 480)" />
          <ellipse cx="88" cy="600" rx="74" ry="28" fill="rgba(45,106,79,0.15)" transform="rotate(18 88 600)" />
          <path d="M1392 0 C1392 200 1352 340 1406 540 C1426 640 1386 760 1416 900" stroke="rgba(45,106,79,0.3)" strokeWidth="2" fill="none" />
          <ellipse cx="1402" cy="180" rx="78" ry="30" fill="rgba(45,106,79,0.22)" transform="rotate(35 1402 180)" />
          <ellipse cx="1372" cy="320" rx="82" ry="31" fill="rgba(45,106,79,0.18)" transform="rotate(-28 1372 320)" />
          <ellipse cx="1422" cy="460" rx="70" ry="27" fill="rgba(45,106,79,0.20)" transform="rotate(48 1422 460)" />
          <ellipse cx="1382" cy="600" rx="76" ry="29" fill="rgba(45,106,79,0.15)" transform="rotate(-20 1382 600)" />
        </svg>
        {loginSpores.map((spore, idx) => (
          <div
            key={idx}
            className="adm-spore"
            style={{
              left: spore.left,
              bottom: spore.bottom,
              width: spore.size,
              height: spore.size,
              background: spore.color,
              animationDelay: spore.delay,
              animationDuration: spore.duration,
            }}
          />
        ))}
      </div>
      {isRedirecting && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-28 h-28">
            <div className="absolute inset-0 rounded-full border-4 border-blue-100/40" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-sky-400 border-r-blue-500 animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-b-indigo-500 border-l-cyan-400 animate-spin [animation-direction:reverse] [animation-duration:1.2s]" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.9)] animate-pulse" />
            </div>
          </div>
        </div>
      )}

      <div className="adm-shell grid grid-cols-1 lg:grid-cols-2">
        <div className="adm-left p-8 sm:p-10 lg:p-12 text-white hidden lg:flex">
          <div className="relative z-10 h-full flex flex-col">
            <div className="w-20 h-20 rounded-full bg-[#fdf6ec]/18 backdrop-blur-sm border border-white/30 flex items-center justify-center ring-1 ring-black/10 shadow-md overflow-hidden">
              <img src="/logo.png" alt="System Logo" className="w-17 h-17 object-contain" />
            </div>

            <div className="mt-10">
              <p className="mb-3 text-[0.76rem] tracking-[0.28em] text-[#c9a84ca8] uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                GMBD · MBB Program
              </p>
              <h1 className="text-[1.9rem] font-bold tracking-tight text-[#e8f0ff]" style={{ fontFamily: "'Playfair Display', serif" }}>
                GMBD MBB Lab Inventory
              </h1>
              <p className="mt-3 text-[0.9rem] text-[#dcebff85] leading-7 max-w-md">
                Centralized tracking for chemicals, consumables, and usage logs across laboratory workflows.
              </p>
            </div>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 text-[#dcebffb3]">
                <FlaskConical className="w-5 h-5 text-[#c9a84c]" />
                <span className="text-[0.86rem]">Chemical inventory lifecycle tracking</span>
              </div>
              <div className="flex items-center gap-3 text-[#dcebffb3]">
                <Package className="w-5 h-5 text-[#c9a84c]" />
                <span className="text-[0.86rem]">Consumable stock monitoring</span>
              </div>
              <div className="flex items-center gap-3 text-[#dcebffb3]">
                <FileText className="w-5 h-5 text-[#c9a84c]" />
                <span className="text-[0.86rem]">Complete usage audit history</span>
              </div>
            </div>

            <div className="mt-auto pt-10 border-t border-[#c9a84c14] flex items-center gap-2 text-xs text-[#c9a84c80]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <ShieldCheck className="w-4 h-4 text-[#40916c]" />
              <span>Restricted administrative access via secure authentication</span>
            </div>
          </div>
        </div>

        <div className="adm-right p-6 sm:p-8 lg:p-12 flex items-center">
          <Card className="relative z-10 w-full border-0 shadow-none bg-transparent">
            <CardHeader className="space-y-2 px-0 pt-0 text-left pb-3">
              <p className="inline-flex items-center gap-2 w-fit px-3 py-1 rounded-full border border-[#d9c3c7] text-[#8a5e67] text-[0.74rem]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#9f1f37]" />
                UPLB · Los Baños, Laguna
              </p>
              <CardTitle className="text-[1.95rem] tracking-[-0.03em] text-[#1a0a0e]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Welcome Back
              </CardTitle>
              <CardDescription className="text-[#7a5a60]">Sign in with your admin account</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {resetMessage && (
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-800">
                    <AlertDescription>{resetMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[0.8rem] font-semibold text-[#3a2028] tracking-[0.08em] uppercase">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#c0a0a8]" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={handleEmailChange}
                      onBlur={() => setEmailTouched(true)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      inputMode="email"
                      pattern="[A-Za-z0-9@._+\-]+"
                      className={`pl-11 pr-4 h-[52px] rounded-full border-2 bg-white text-[#1a0a0e] placeholder:text-[#c0a8ae] focus:ring-4 ${
                        showEmailValidation
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                          : 'border-[#e5d0d4] focus:border-[#7b1c2e] focus:ring-[#7b1c2e1a]'
                      }`}
                      aria-invalid={showEmailValidation}
                      required
                    />
                  </div>
                  {showEmailValidation && (
                    <p className="text-xs text-red-600 pl-1">Please enter a valid email address.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[0.8rem] font-semibold text-[#3a2028] tracking-[0.08em] uppercase">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#c0a0a8]" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="pl-11 pr-10 h-[52px] rounded-full border-2 border-[#e5d0d4] bg-white text-[#1a0a0e] placeholder:text-[#c0a8ae] focus:border-[#7b1c2e] focus:ring-4 focus:ring-[#7b1c2e1a]"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#b6929a] hover:text-[#7b1c2e]"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={isLoading || isRedirecting || isResetting}
                      className="text-xs font-medium text-[#7b1c2e] hover:text-[#a32438] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isResetting ? 'Sending reset link...' : 'Forgot Password?'}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="adm-login-btn w-full h-[52px] text-sm font-semibold text-[#f5e6c8] transition-all duration-200"
                  disabled={isLoading || isRedirecting || (normalizedEmail.length > 0 && !isEmailValid)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
