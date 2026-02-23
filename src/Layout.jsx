import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { supabase } from '@/lib/supabaseClient';
import {
  LayoutDashboard,
  FlaskConical,
  Package,
  FileText,
  BarChart3,
  Users,
  Settings,
  Info,
  LogOut,
  Menu,
  X,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Toaster } from 'sonner';
import GlobalSearch from '@/components/layout/GlobalSearch';
import { AnimatePresence, motion } from 'framer-motion';

const publicPages = ['StudentUse', 'Login', 'set-password'];
const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navRef = useRef(null);
  const navListRef = useRef(null);
  const [activePillStyle, setActivePillStyle] = useState({ top: 0, left: 0, width: 0, height: 0, opacity: 0 });

  useEffect(() => {
    checkAuth();
  }, [currentPageName]);

  const checkAuth = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      const currentUser = data?.session?.user ?? null;

      if (currentUser) {
        setUser(currentUser);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, role, is_active, avatar_url')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile load error:', profileError);
          setUserProfile({
            full_name:
              currentUser.user_metadata?.full_name ||
              currentUser.email?.split('@')[0] ||
              'User',
            role: 'admin',
            avatar_url: null,
          });
        } else if (profile) {
          setUserProfile(profile);
        } else {
          setUserProfile({
            full_name:
              currentUser.user_metadata?.full_name ||
              currentUser.email?.split('@')[0] ||
              'User',
            role: 'admin',
            avatar_url: null,
          });
        }
      } else if (!publicPages.includes(currentPageName)) {
        const from = encodeURIComponent(window.location.href);
        window.location.href = `${createPageUrl('Login')}?from_url=${from}`;
        return;
      }
    } catch (error) {
      if (!publicPages.includes(currentPageName)) {
        const from = encodeURIComponent(window.location.href);
        window.location.href = `${createPageUrl('Login')}?from_url=${from}`;
        return;
      }
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    await supabase.auth.signOut();
    window.location.href = createPageUrl('Login');
  };

  const navigation = [
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutDashboard },
    { name: 'Chemicals', page: 'Chemicals', icon: FlaskConical },
    { name: 'Consumables', page: 'Consumables', icon: Package },
    { name: 'Usage Logs', page: 'UsageLogs', icon: FileText },
    { name: 'Reports', page: 'Reports', icon: BarChart3 },
  ];

  if (userProfile?.role === 'super_admin') {
    navigation.push({ name: 'Admin Management', page: 'AdminManagement', icon: Users });
  }

  navigation.push({ name: 'Settings', page: 'Settings', icon: Settings });
  navigation.push({ name: 'About', page: 'About', icon: Info });

  useEffect(() => {
    const navEl = navRef.current;
    const navListEl = navListRef.current;
    if (!navEl || !navListEl) return;
    let rafId = null;

    const updatePillPosition = () => {
      const activeEl = navListEl.querySelector(`[data-nav-page="${currentPageName}"]`);
      if (!activeEl) return;

      setActivePillStyle({
        top: activeEl.offsetTop,
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
        height: activeEl.offsetHeight,
        opacity: 1,
      });
    };

    rafId = window.requestAnimationFrame(updatePillPosition);
    window.addEventListener('resize', updatePillPosition);
    navEl.addEventListener('scroll', updatePillPosition, { passive: true });

    const resizeObserver = new ResizeObserver(updatePillPosition);
    resizeObserver.observe(navEl);
    resizeObserver.observe(navListEl);

    if (document?.fonts?.ready) {
      document.fonts.ready.then(updatePillPosition).catch(() => {});
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePillPosition);
      navEl.removeEventListener('scroll', updatePillPosition);
      resizeObserver.disconnect();
    };
  }, [currentPageName, sidebarOpen, navigation.length]);

  if (publicPages.includes(currentPageName)) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPageName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const showGlobalSearch = currentPageName === 'Dashboard';

  return (
    <div className="min-h-screen bg-slate-50">
      {isLoggingOut && (
        <div className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200/30" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-indigo-500 animate-spin" />
            <div className="absolute inset-3 rounded-full border-4 border-transparent border-b-cyan-400 border-l-blue-500 animate-spin [animation-direction:reverse] [animation-duration:1.1s]" />
          </div>
        </div>
      )}
      <Toaster position="top-right" richColors />
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-full w-64 bg-gradient-to-b from-[#2a0310] via-[#1a0008] to-[#090504]
        transform transition-transform duration-300 ease-out
        lg:translate-x-0 shadow-xl
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -left-20 w-72 h-72 rounded-full bg-[#8a1d35]/20 blur-3xl" />
          <div className="absolute -bottom-28 -right-20 w-64 h-64 rounded-full bg-[#1f6a4b]/20 blur-3xl" />
        </div>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3 px-5 py-5 border-b border-[#c9a84c1f]">
            <img src="/logo.png" alt="System Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="font-bold text-[#f4efe7]">GMBD MBB</h1>
              <p className="text-xs text-[#b9a8ac]">Lab Inventory</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto lg:hidden text-[#b9a8ac] hover:text-[#f4efe7] hover:bg-[#ffffff14]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav ref={navRef} className="relative z-10 flex-1 px-3 py-4 overflow-y-auto no-scrollbar">
            <div ref={navListRef} className="relative flex flex-col gap-1">
              <div
                className="pointer-events-none absolute rounded-lg bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] shadow-[0_6px_20px_rgba(123,28,46,0.35)] transition-all duration-300 ease-out"
                style={{
                  transform: `translateY(${activePillStyle.top}px)`,
                  left: `${activePillStyle.left}px`,
                  width: `${activePillStyle.width}px`,
                  height: `${activePillStyle.height}px`,
                  opacity: activePillStyle.opacity,
                }}
              />
              {navigation.map((item) => {
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    data-nav-page={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      relative z-10 flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200
                      outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0
                      ${isActive 
                        ? 'text-[#f4efe7]'
                        : 'text-[#b7a7ab] hover:bg-[#ffffff0f] hover:text-[#f4efe7]'
                      }
                    `}
                  >
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-[#e1c562]' : 'text-[#a7959b]'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="relative z-10 p-4 border-t border-[#c9a84c1f]">
            <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-[#ffffff08]">
              <Avatar className="w-9 h-9 ring-2 ring-[#ffffff1a]">
                {userProfile?.avatar_url && (
                  <AvatarImage src={userProfile.avatar_url} alt="Profile" className="object-cover" />
                )}
                <AvatarFallback className="bg-[#7b1c2e] text-[#f4efe7] text-sm font-medium">
                  {getInitials(userProfile?.full_name || user?.user_metadata?.full_name || user?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#f4efe7] truncate">
                  {userProfile?.full_name || user?.user_metadata?.full_name || user?.email || 'User'}
                </p>
                <p className="text-xs text-[#b9a8ac] capitalize">
                  {userProfile?.role?.replace('_', ' ') || 'Admin'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>

            {showGlobalSearch ? (
              <div className="flex-1 max-w-xl mx-4">
                <GlobalSearch />
              </div>
            ) : (
              <div className="flex-1" />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="w-8 h-8">
                    {userProfile?.avatar_url && (
                      <AvatarImage src={userProfile.avatar_url} alt="Profile" className="object-cover" />
                    )}
                    <AvatarFallback className="bg-blue-600 text-white text-xs">
                      {getInitials(userProfile?.full_name || user?.user_metadata?.full_name || user?.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block text-sm font-medium">
                    {userProfile?.full_name || user?.user_metadata?.full_name || user?.email || 'User'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm">
                  <p className="font-medium">{userProfile?.full_name || user?.user_metadata?.full_name || user?.email || 'User'}</p>
                  <p className="text-xs text-slate-500 capitalize">{userProfile?.role?.replace('_', ' ') || 'Admin'}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl('Settings')} className="cursor-pointer">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPageName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}






