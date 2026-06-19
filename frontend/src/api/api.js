import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
});

// Add a response interceptor to handle session expiry (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Check if we recently clicked "Stay Login"
      const lastStay = parseInt(localStorage.getItem("tradex_stay_login_timestamp") || "0");
      const now = Date.now();
      
      // If it was more than 15 minutes ago, it's a real session expiry
      if (now - lastStay > 15 * 60 * 1000) {
        // Trigger the custom event that SessionTimeout listens for
        window.dispatchEvent(new Event("tradex_auth_expired"));
      }
      
      // Always reject so components don't hang in a loading state
    }
    return Promise.reject(error);
  }
);

export default api;
