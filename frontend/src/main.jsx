import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import './index.css'
import App from './App.jsx'
import {
  ToastContainer
} from "react-toastify";

import "react-toastify/dist/ReactToastify.css";

import {
  ThemeProvider
} from "./context/ThemeContext";
import {
  StockProvider
} from "./context/StockContext";

const queryClient = new QueryClient();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StockProvider>
          <App />
        </StockProvider>
      </ThemeProvider>
    </QueryClientProvider>
    <ToastContainer
      position="top-right"
      autoClose={3000}
      newestOnTop
      closeOnClick
      pauseOnHover
    />
  </StrictMode>,
)
