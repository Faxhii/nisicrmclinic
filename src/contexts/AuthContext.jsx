import { createContext, useContext, useState, useCallback } from 'react';
import { AuthService } from '../services/dataService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => AuthService.getSession());

  const login = useCallback((username, password) => {
    const session = AuthService.login(username, password);
    if (session) {
      setUser(session);
      return { success: true };
    }
    return { success: false, error: 'Invalid username or password' };
  }, []);

  const logout = useCallback(() => {
    AuthService.logout();
    setUser(null);
  }, []);

  const hasPermission = useCallback((permission) => {
    if (!user) return false;
    return AuthService.hasPermission(permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
