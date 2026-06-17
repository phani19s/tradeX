import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// Add a response interceptor to handle session expiry (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Trigger the custom event that SessionTimeout listens for
      window.dispatchEvent(new Event("tradex_auth_expired"));
      
      // Optionally reject with a specific message that pages can ignore
      // so they don't show "Failed to load profile" toasts
      return new Promise(() => {}); 
    }
    return Promise.reject(error);
  }
);

export default api;
