import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import api from "../api/api";

const StockContext =
  createContext();

export function StockProvider({
  children,
}) {

  const [stocks, setStocks] =
    useState([]);

  async function fetchStocks() {

    try {

      const response =
        await api.get(
          "/stocks/"
        );

      setStocks(
        response.data
      );

    } catch (error) {

      console.log(error);

    }

  }

  useEffect(() => {

    fetchStocks();

    const timer =
      setInterval(
        fetchStocks,
        3000
      );

    return () =>
      clearInterval(timer);

  }, []);

  return (

    <StockContext.Provider
      value={{
        stocks
      }}
    >

      {children}

    </StockContext.Provider>

  );
}

export function useStocks() {

  return useContext(
    StockContext
  );

}