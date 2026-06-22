import api from "./api";

export const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const getProfile = async () => {
  return await api.get("/auth/profile", getAuthHeaders());
};

export const updateProfile = async (data) => {
  return await api.put("/auth/profile", data, getAuthHeaders());
};

export const changePassword = async (data) => {
  return await api.post("/auth/change-password", data, getAuthHeaders());
};

export const enableEmailTwoFactor = async () => {
  return await api.post("/auth/2fa/email/enable", {}, getAuthHeaders());
};

export const verifyEmailTwoFactor = async (otp) => {
  return await api.post("/auth/2fa/email/verify", { otp }, getAuthHeaders());
};

export const setupGoogleTwoFactor = async () => {
  return await api.post("/auth/2fa/google/setup", {}, getAuthHeaders());
};

export const verifyGoogleTwoFactor = async (otp) => {
  return await api.post("/auth/2fa/google/verify", { otp }, getAuthHeaders());
};

export const disableTwoFactor = async () => {
  return await api.post("/auth/2fa/disable", {}, getAuthHeaders());
};

export const getActiveSessions = async () => {
  return await api.get("/auth/sessions", getAuthHeaders());
};

export const logoutOtherSessions = async () => {
  return await api.post("/auth/sessions/logout-others", {}, getAuthHeaders());
};

export const logoutSession = async (sessionId) => {
  return await api.post(`/auth/sessions/${sessionId}/logout`, {}, getAuthHeaders());
};

export const logoutCurrentSession = async () => {
  return await api.post("/auth/logout", {}, getAuthHeaders());
};

export const sendForgotPasswordOtp = async (email) => {
  return await api.post("/auth/forgot-password/send-otp", { email });
};

export const verifyForgotPasswordOtp = async (email, otp) => {
  return await api.post("/auth/forgot-password/verify-otp", { email, otp });
};

export const resetForgotPassword = async (data) => {
  return await api.post("/auth/forgot-password/reset", data);
};

export const requestWithdrawal = async (data) => {
  return await api.post("/withdrawal/", data, getAuthHeaders());
};

export const getWithdrawalHistory = async () => {
  return await api.get("/withdrawal/history", getAuthHeaders());
};
