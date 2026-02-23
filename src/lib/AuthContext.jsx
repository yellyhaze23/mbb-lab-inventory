import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { createPageUrl } from '@/utils';

const AuthContext = createContext();
const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === 'true';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkAppState = async () => {
      try {
        setIsLoadingAuth(true);
        setAuthError(null);

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        const currentUser = data?.session?.user ?? null;
        if (!mounted) return;

        setUser(currentUser);
        setIsAuthenticated(Boolean(currentUser));
      } catch (error) {
        if (!mounted) return;
        setUser(null);
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_required',
          message: error?.message || 'Authentication required',
        });
      } finally {
        if (mounted) setIsLoadingAuth(false);
      }
    };

    checkAppState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(Boolean(session?.user));
      setAuthError(null);
      setIsLoadingAuth(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const logout = async (shouldRedirect = true) => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      window.location.href = createPageUrl('Login');
    }
  };

  const navigateToLogin = () => {
    const from = encodeURIComponent(window.location.href);
    window.location.href = `${createPageUrl('Login')}?from_url=${from}`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};




