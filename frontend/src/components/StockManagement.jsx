import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import ConfirmDialog from "./ConfirmDialog";

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(isoString) {
  if (!isoString) return "-";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN");
  } catch (e) {
    return isoString;
  }
}

export default function StockManagement() {
  // Stocks list state
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("symbol");
  const [sortOrder, setSortOrder] = useState("asc");

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  // Modal states
  const [stockModal, setStockModal] = useState({
    isOpen: false,
    mode: "add", // 'add' or 'edit'
    stockId: null,
    symbol: "",
    companyName: "",
    currentPrice: "",
    market: "NSE",
    isActive: true,
    loading: false
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    stockId: null,
    symbol: "",
    loading: false
  });

  const [statusConfirmation, setStatusConfirmation] = useState({
    isOpen: false,
    source: null,
    stock: null,
    symbol: "",
    nextStatus: false,
    loading: false
  });

  // Fetch stocks from API
  async function fetchStocks() {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder
      });

      if (search.trim()) queryParams.append("search", search.trim());
      if (status) queryParams.append("status", status);

      const response = await api.get(`/admin/stocks?${queryParams.toString()}`, getAuthHeaders());
      setStocks(response.data.stocks);
      setTotal(response.data.total);
      setPages(response.data.pages);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to load stocks catalog");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStocks();
  }, [page, search, status, sortBy, sortOrder]);

  // Handle pagination and filters
  function handleSearchChange(e) {
    setSearch(e.target.value);
    setPage(1);
  }

  function handleStatusChange(e) {
    setStatus(e.target.value);
    setPage(1);
  }

  function handleSortByChange(e) {
    setSortBy(e.target.value);
    setPage(1);
  }

  function toggleSortOrder() {
    setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    setPage(1);
  }

  // Open modal to add stock
  function handleOpenAdd() {
    setStockModal({
      isOpen: true,
      mode: "add",
      stockId: null,
      symbol: "",
      companyName: "",
      currentPrice: "",
      market: "NSE",
      isActive: true,
      loading: false
    });
  }

  // Open modal to edit stock
  function handleOpenEdit(stock) {
    setStockModal({
      isOpen: true,
      mode: "edit",
      stockId: stock.id,
      symbol: stock.symbol,
      companyName: stock.company_name,
      currentPrice: stock.current_price.toString(),
      market: stock.market || "NSE",
      isActive: stock.is_active,
      loading: false
    });
  }

  // Save stock (Add or Edit)
  async function handleSaveStock(e) {
    e.preventDefault();

    const priceNum = Number(stockModal.currentPrice);
    if (!stockModal.companyName.trim()) {
      toast.error("Company name cannot be empty");
      return;
    }
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid stock price greater than 0");
      return;
    }

    try {
      setStockModal(prev => ({ ...prev, loading: true }));

      if (stockModal.mode === "add") {
        const symbolClean = stockModal.symbol.trim().toUpperCase();
        if (!symbolClean) {
          toast.error("Stock symbol cannot be empty");
          return;
        }

        const payload = {
          symbol: symbolClean,
          company_name: stockModal.companyName.trim(),
          current_price: priceNum,
          market: stockModal.market,
          is_active: stockModal.isActive
        };

        await api.post("/admin/stocks", payload, getAuthHeaders());
        toast.success(`Stock ${symbolClean} added successfully`);
      } else {
        const payload = {
          company_name: stockModal.companyName.trim(),
          current_price: priceNum,
          market: stockModal.market,
          is_active: stockModal.isActive
        };

        await api.put(`/admin/stocks/${stockModal.stockId}`, payload, getAuthHeaders());
        toast.success(`Stock ${stockModal.symbol} updated successfully`);
      }

      setStockModal(prev => ({ ...prev, isOpen: false }));
      fetchStocks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save stock details");
    } finally {
      setStockModal(prev => ({ ...prev, loading: false }));
    }
  }

  function requestStatusToggle(stock) {
    setStatusConfirmation({
      isOpen: true,
      source: "table",
      stock,
      symbol: stock.symbol,
      nextStatus: !stock.is_active,
      loading: false
    });
  }

  function requestModalStatusToggle() {
    const nextStatus = !stockModal.isActive;

    if (stockModal.mode === "add") {
      setStockModal(prev => ({ ...prev, isActive: nextStatus }));
      return;
    }

    setStatusConfirmation({
      isOpen: true,
      source: "modal",
      stock: null,
      symbol: stockModal.symbol,
      nextStatus,
      loading: false
    });
  }

  async function confirmStatusToggle() {
    if (statusConfirmation.loading) return;

    if (statusConfirmation.source === "modal") {
      setStockModal(prev => ({ ...prev, isActive: statusConfirmation.nextStatus }));
      setStatusConfirmation(prev => ({ ...prev, isOpen: false }));
      return;
    }

    const stock = statusConfirmation.stock;
    if (!stock) return;

    try {
      setStatusConfirmation(prev => ({ ...prev, loading: true }));
      const payload = {
        company_name: stock.company_name,
        current_price: stock.current_price,
        market: stock.market,
        is_active: statusConfirmation.nextStatus
      };

      await api.put(`/admin/stocks/${stock.id}`, payload, getAuthHeaders());
      toast.success(`Stock ${stock.symbol} ${statusConfirmation.nextStatus ? "enabled" : "disabled"} successfully`);
      setStatusConfirmation(prev => ({ ...prev, isOpen: false }));
      fetchStocks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to toggle stock status");
    } finally {
      setStatusConfirmation(prev => ({ ...prev, loading: false }));
    }
  }

  // Open delete confirmation modal
  function handleOpenDelete(stockId, symbol) {
    setDeleteModal({
      isOpen: true,
      stockId,
      symbol,
      loading: false
    });
  }

  // Confirm delete stock
  async function handleDeleteConfirm() {
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      await api.delete(`/admin/stocks/${deleteModal.stockId}`, getAuthHeaders());
      toast.success(`Stock ${deleteModal.symbol} deleted successfully`);
      setDeleteModal(prev => ({ ...prev, isOpen: false }));
      fetchStocks();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete stock");
    } finally {
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Search, Filter, Sort Controls */}
      <div className="theme-card rounded-2xl p-6 shadow">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-wrap gap-3 items-center">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search stocks by symbol or company name..."
                value={search}
                onChange={handleSearchChange}
                className="w-full px-4 py-2.5 rounded-xl border focus:outline-none transition-all placeholder:opacity-50 text-sm"
                style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
              />
            </div>

            {/* Filter by Status */}
            <select
              value={status}
              onChange={handleStatusChange}
              className="px-3 py-2.5 rounded-xl border focus:outline-none text-sm cursor-pointer"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <option value="">All Statuses</option>
              <option value="enabled">Enabled Only</option>
              <option value="disabled">Disabled Only</option>
            </select>

            {/* Sort Attributes */}
            <select
              value={sortBy}
              onChange={handleSortByChange}
              className="px-3 py-2.5 rounded-xl border focus:outline-none text-sm cursor-pointer"
              style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <option value="symbol">Sort by Symbol</option>
              <option value="company_name">Sort by Company</option>
              <option value="price">Sort by Price</option>
            </select>

            {/* Toggle Sort Direction */}
            <button
              onClick={toggleSortOrder}
              className="p-2.5 rounded-xl border transition hover:bg-surface cursor-pointer flex items-center justify-center"
              style={{ borderColor: "var(--border)" }}
              title={`Sorting: ${sortOrder === "asc" ? "Ascending" : "Descending"}`}
            >
              {sortOrder === "asc" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h9m5-1v12m0 0l-4-4m4 4l4-4" />
                </svg>
              )}
            </button>
          </div>

          {/* Add Stock Action */}
          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 flex items-center gap-2 cursor-pointer"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add New Stock
          </button>
        </div>
      </div>

      {/* Stocks catalog table */}
      <div className="theme-card rounded-2xl overflow-hidden shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead>
              <tr className="bg-surface/50 text-left text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Stock Symbol</th>
                <th className="px-6 py-4">Company Name</th>
                <th className="px-6 py-4">Market</th>
                <th className="px-6 py-4">Current Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Last Updated</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border" style={{ color: "var(--text)" }}>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm opacity-50">
                    Loading stocks catalog...
                  </td>
                </tr>
              ) : stocks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-sm opacity-50">
                    No stocks matching the search criteria.
                  </td>
                </tr>
              ) : (
                stocks.map((stock) => (
                  <tr key={stock.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md font-bold text-xs bg-accent/15 text-accent border border-accent/20">
                        {stock.symbol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                      {stock.company_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm opacity-80">
                      {stock.market || "NSE"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-emerald-400">
                      ₹{formatMoney(stock.current_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={stock.is_active}
                        aria-label={`${stock.is_active ? "Disable" : "Enable"} ${stock.symbol}`}
                        onClick={() => requestStatusToggle(stock)}
                        className={`inline-flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs font-bold transition cursor-pointer ${
                          stock.is_active
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                        }`}
                        title={stock.is_active ? "Click to Disable stock" : "Click to Enable stock"}
                      >
                        <span className={`relative h-5 w-9 rounded-full transition-colors ${
                          stock.is_active ? "bg-emerald-500" : "bg-rose-500/35"
                        }`}>
                          <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            stock.is_active ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </span>
                        {stock.is_active ? "Enabled" : "Disabled"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs opacity-75">
                      {formatDateTime(stock.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      <div className="flex items-center justify-center gap-2">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(stock)}
                          className="p-2 rounded-lg hover:bg-surface text-sky-400 border border-transparent hover:border-border transition cursor-pointer"
                          title="Edit Stock Details / Override Price"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleOpenDelete(stock.id, stock.symbol)}
                          className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500 border border-transparent hover:border-rose-500/20 transition cursor-pointer"
                          title="Delete Stock"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pages > 1 && (
          <div className="p-4 border-t flex items-center justify-between" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            <span className="text-xs opacity-75">
              Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total stocks)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                  page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-card cursor-pointer"
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                Previous
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                  page >= pages ? "opacity-40 cursor-not-allowed" : "hover:bg-card cursor-pointer"
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- ADD / EDIT STOCK DIALOG --- */}
      {stockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl border animate-in fade-in zoom-in duration-200"
            style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">
                {stockModal.mode === "add" ? "Add New Stock Asset" : `Edit Stock ${stockModal.symbol}`}
              </h3>
              <button
                onClick={() => setStockModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg hover:bg-surface transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-4 text-sm">
              {/* Symbol (Disabled on edit mode) */}
              <div className="space-y-1">
                <label className="font-semibold block opacity-85">Stock Symbol</label>
                <input
                  type="text"
                  placeholder="e.g. RELIANCE, TCS, INFY"
                  required
                  disabled={stockModal.mode === "edit"}
                  value={stockModal.symbol}
                  onChange={(e) => setStockModal(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none transition-all placeholder:opacity-55 disabled:opacity-50"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Company Name */}
              <div className="space-y-1">
                <label className="font-semibold block opacity-85">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Reliance Industries Limited"
                  required
                  value={stockModal.companyName}
                  onChange={(e) => setStockModal(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none transition-all placeholder:opacity-55"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Market Exchange */}
              <div className="space-y-1">
                <label className="font-semibold block opacity-85">Market / Exchange</label>
                <input
                  type="text"
                  placeholder="e.g. NSE, BSE, NASDAQ"
                  required
                  value={stockModal.market}
                  onChange={(e) => setStockModal(prev => ({ ...prev, market: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none transition-all placeholder:opacity-55"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Current Price */}
              <div className="space-y-1">
                <label className="font-semibold block opacity-85">
                  {stockModal.mode === "add" ? "Initial Stock Price (₹)" : "Manual Price Override (₹)"}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  required
                  value={stockModal.currentPrice}
                  onChange={(e) => setStockModal(prev => ({ ...prev, currentPrice: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border focus:outline-none transition-all placeholder:opacity-55"
                  style={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
                />
              </div>

              {/* Trading status toggle */}
              <div
                className={`flex items-center justify-between gap-4 rounded-2xl border p-4 transition-colors ${
                  stockModal.isActive
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold">Trading status</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                      stockModal.isActive
                        ? "bg-emerald-500/15 text-emerald-500"
                        : "bg-rose-500/15 text-rose-500"
                    }`}>
                      {stockModal.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs opacity-60">
                    {stockModal.isActive ? "Users can select and trade this stock." : "This stock is disabled for users."}
                  </p>
                </div>
                <button
                  id="modal-is-active"
                  type="button"
                  role="switch"
                  aria-checked={stockModal.isActive}
                  aria-label="Enable stock for user trading"
                  onClick={requestModalStatusToggle}
                  className={`relative h-9 w-16 shrink-0 rounded-full border-2 shadow-inner transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    stockModal.isActive
                      ? "border-emerald-400 bg-emerald-500 focus:ring-emerald-400"
                      : "border-rose-400 bg-rose-500/30 focus:ring-rose-400"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-7 w-7 rounded-full bg-white shadow-lg transition-transform ${
                      stockModal.isActive ? "translate-x-7" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Actions buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStockModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-2.5 rounded-xl border text-sm font-bold transition hover:bg-surface cursor-pointer"
                  style={{ borderColor: "var(--border)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockModal.loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90 cursor-pointer flex items-center justify-center"
                  style={{ backgroundColor: "var(--accent)" }}
                >
                  {stockModal.loading ? "Saving..." : "Save Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE CONFIRMATION DIALOG --- */}
      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        title="Delete Stock Asset?"
        message={`Are you absolutely sure you want to delete stock symbol ${deleteModal.symbol}? This action is irreversible and will permanently delete the stock definition.`}
        confirmText={deleteModal.loading ? "Deleting..." : "Delete Stock"}
        onCancel={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleDeleteConfirm}
      />
      <ConfirmDialog
        isOpen={statusConfirmation.isOpen}
        title={`${statusConfirmation.nextStatus ? "Enable" : "Disable"} ${statusConfirmation.symbol}?`}
        message={
          statusConfirmation.nextStatus
            ? "This stock will become active and users will be able to select and trade it."
            : "This stock will become inactive and users will no longer be able to select or trade it."
        }
        confirmText={
          statusConfirmation.loading
            ? "Updating..."
            : statusConfirmation.nextStatus
              ? "Yes, Enable"
              : "Yes, Disable"
        }
        tone={statusConfirmation.nextStatus ? "default" : "danger"}
        onCancel={() => {
          if (!statusConfirmation.loading) {
            setStatusConfirmation(prev => ({ ...prev, isOpen: false }));
          }
        }}
        onConfirm={confirmStatusToggle}
      />
    </div>
  );
}
