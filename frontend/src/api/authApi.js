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

export const requestWithdrawal = async (data) => {
  return await api.post("/withdrawal/", data, getAuthHeaders());
};

export const getWithdrawalHistory = async () => {
  return await api.get("/withdrawal/history", getAuthHeaders());
};
