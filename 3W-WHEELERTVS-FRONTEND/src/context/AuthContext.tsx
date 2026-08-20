import React, { createContext, useContext, useState, useEffect } from "react";
import { apiClient, ApiError } from "../api/client";
import type { StaffMember } from "../types";

interface UserGranularPermissions {
  canEditAttendanceTime: boolean;
  canEditInvoices: boolean;
  canEditPricing: boolean;
  canBulkSelectResponses?: boolean;
}

interface User {
  _id: string;
  id?: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  mobile?: string;
  department?: string;
  position?: string;
  lastLogin?: string;
  customRole?: any;
  permissions?: string[];
  tenantId?: string;
  granularPermissions?: UserGranularPermissions;
}

interface TenantSettings {
  logo?: string;
  primaryColor?: string;
  companyEmail?: string;
  companyPhone?: string;
  showCustomerPortal?: boolean;
}

interface TenantSubscription {
  plan: string;
  maxUsers: number;
  maxForms: number;
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  companyName: string;
  isActive: boolean;
  internalTrackingEnabled?: boolean;
  allowedTenantIds?: string[];
  settings?: TenantSettings;
  subscription?: TenantSubscription;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  login: (
    email: string,
    password: string,
    tenantSlug?: string,
    location?: any,
  ) => Promise<boolean>;
  signup: (signupData: {
    name: string;
    slug: string;
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  updateTenant: (tenant: Tenant | null) => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  tenant: null,
  login: async () => false,
  signup: async () => false,
  logout: () => { },
  isAuthenticated: false,
  loading: false,
  error: null,
  updateTenant: () => { },
  updateUser: () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // === INSTANT HYDRATION: Load from localStorage immediately (no network wait) ===
  const [user, setUser] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem("cached_user");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  const [tenant, setTenant] = useState<Tenant | null>(() => {
    try {
      const cached = localStorage.getItem("tenant_info");
      return cached ? JSON.parse(cached) : null;
    } catch { return null; }
  });
  // If we have cached user data, skip the loading spinner entirely
  const hasCachedAuth = !!localStorage.getItem("auth_token") && !!localStorage.getItem("cached_user");
  const [loading, setLoading] = useState(!hasCachedAuth);
  const [error, setError] = useState<string | null>(null);

  const updateTenantState = (nextTenant: Tenant | null) => {
    setTenant(nextTenant);
    if (nextTenant) {
      localStorage.setItem("tenant_info", JSON.stringify(nextTenant));
    } else {
      localStorage.removeItem("tenant_info");
    }
  };

  const updateUserState = (updatedUser: Partial<User>) => {
    if (user) {
      const merged = { ...user, ...updatedUser };
      setUser(merged);
      try { localStorage.setItem("cached_user", JSON.stringify(merged)); } catch {}
    }
  };

  const isAuthenticated = !!user;

  // Background refresh: validate token & get fresh data (stale-while-revalidate)
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem("auth_token");
      const storedTenant = localStorage.getItem("tenant_info");

      if (token) {
        try {
          const response = await apiClient.getProfile();
          setUser(response.user);
          // Persist user data for instant hydration on next visit
          try { localStorage.setItem("cached_user", JSON.stringify(response.user)); } catch {}

          if (response.tenant) {
            updateTenantState(response.tenant);
          } else if (storedTenant) {
            const parsedTenant = JSON.parse(storedTenant);
            setTenant(parsedTenant);

            // If tenant exists but doesn't have _id, try to fetch it (only for superadmin)
            if (
              parsedTenant &&
              !parsedTenant._id &&
              response.user.tenantId &&
              response.user.role === "superadmin"
            ) {
              try {
                const tenantResponse = await apiClient.getTenant(
                  response.user.tenantId,
                );
                updateTenantState(tenantResponse.tenant);
              } catch (tenantErr) {
                console.warn("Failed to fetch tenant information:", tenantErr);
                // Keep the stored tenant if fetch fails
              }
            }
          } else if (
            response.user.tenantId &&
            response.user.role === "superadmin"
          ) {
            // No stored tenant but user has tenantId, try to fetch it (only for superadmin)
            try {
              const tenantResponse = await apiClient.getTenant(
                response.user.tenantId,
              );
              updateTenantState(tenantResponse.tenant);
            } catch (tenantErr) {
              console.warn("Failed to fetch tenant information:", tenantErr);
            }
          }
        } catch (err) {
          // Token expired or invalid — clear everything
          apiClient.clearToken();
          localStorage.removeItem("cached_user");
          setUser(null);
          updateTenantState(null);
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (
    email: string,
    password: string,
    tenantSlug?: string,
    location?: any,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.login({
        email,
        password,
        ...(tenantSlug && { tenantSlug }),
        ...(location && { location }),
      });

      setUser(response.user);
      updateTenantState(response.tenant || null);
      // Cache user for instant hydration on next visit
      try { localStorage.setItem("cached_user", JSON.stringify(response.user)); } catch {}

      // Clear guest session info if a regular user logs in
      localStorage.removeItem("guest_auth_token");
      localStorage.removeItem("guest_email");
      localStorage.removeItem("guest_form_id");
      localStorage.removeItem("guest_expires_at");

      // Store sessionLogId for logout tracking
      if (response.sessionLogId) {
        localStorage.setItem("session_log_id", response.sessionLogId);
      }

      setLoading(false);
      return response;
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 400 || err.status === 401) {
          setError("Incorrect email or password.");
        } else {
          const serverMessage =
            (err.response && (err.response as { message?: string }).message) ||
            err.message ||
            "Login failed. Please try again.";
          setError(serverMessage);
        }
      } else {
        setError("Login failed. Please try again.");
      }
      return false;
    }
  };

  const signup = async (signupData: {
    name: string;
    slug: string;
    companyName: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.signup(signupData);
      setLoading(false);
      return true;
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        const serverMessage =
          (err.response && (err.response as { message?: string }).message) ||
          err.message ||
          "Signup failed. Please try again.";
        setError(serverMessage);
      } else {
        setError("Signup failed. Please try again.");
      }
      return false;
    }
  };

  const logout = () => {
    const sessionLogId = localStorage.getItem("session_log_id");
    apiClient.logout(sessionLogId || undefined);
    localStorage.removeItem("session_log_id");
    setUser(null);
    updateTenantState(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        login,
        signup,
        logout,
        isAuthenticated,
        loading,
        error,
        updateTenant: updateTenantState,
        updateUser: updateUserState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
