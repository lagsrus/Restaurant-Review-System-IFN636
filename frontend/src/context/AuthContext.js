import React, { createContext, useState, useContext } from 'react';

const AuthContext = createContext();
const AUTH_STORAGE_KEY = 'restaurant-review-user';

function getStoredUser() {
  const serializedUser = sessionStorage.getItem(AUTH_STORAGE_KEY);
  if (!serializedUser) return null;

  let user;
  try {
    user = JSON.parse(serializedUser);
  } catch (error) {
    console.error('Could not restore the saved login session:', error);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  if (
    !user ||
    typeof user !== 'object' ||
    typeof user.token !== 'string' ||
    !['customer', 'owner', 'admin'].includes(user.role)
  ) {
    console.error('Could not restore the saved login session: saved user data is invalid.');
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }

  return user;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser);

  const login = (userData) => {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
