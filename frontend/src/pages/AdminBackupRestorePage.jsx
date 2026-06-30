import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../api/api";
import { getAuthHeaders } from "../api/authApi";
import Navbar from "../components/Navbar";

export default function AdminBackupRestorePage() {
  const [backups, setBackups] = useState([]);
  const [lastBackup, setLastBackup] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Restore state
  const [fileToRestore, setFileToRestore] = useState(null);
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const fileInputRef = useRef(null);

  // Delete state
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.is_admin) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const fetchBackups = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/backups", getAuthHeaders());
      setBackups(res.data?.history || []);
      setLastBackup(res.data?.last_backup || null);
    } catch (error) {
      console.error("Failed to load backups history", error);
      toast.error(error.response?.data?.detail || "Failed to load backups history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setBackingUp(true);
      toast.info("Generating database backup, please wait...");
      await api.post("/admin/backups", {}, getAuthHeaders());
      toast.success("Database backup generated successfully!");
      fetchBackups();
    } catch (error) {
      console.error("Backup failed", error);
      toast.error(error.response?.data?.detail || "Database backup failed");
    } finally {
      setBackingUp(false);
    }
  };

  const handleDownload = async (filename) => {
    try {
      toast.info(`Downloading ${filename}...`);
      const res = await api.get(`/admin/backups/${filename}`, {
        responseType: "blob",
        ...getAuthHeaders()
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Download started");
    } catch (error) {
      toast.error("Failed to download backup file");
    }
  };

  const handleDeleteClick = (filename) => {
    setFileToDelete(filename);
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      await api.delete(`/admin/backups/${fileToDelete}`, getAuthHeaders());
      toast.success("Backup file deleted successfully");
      fetchBackups();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete backup file");
    } finally {
      setShowConfirmDelete(false);
      setFileToDelete(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith(".sql")) {
        toast.error("Invalid file format. Please upload a .sql file.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setFileToRestore(file);
      setShowConfirmRestore(true);
    }
  };

  const handleConfirmRestore = async () => {
    if (!fileToRestore) return;
    setShowConfirmRestore(false);
    setRestoring(true);

    const formData = new FormData();
    formData.append("file", fileToRestore);

    try {
      toast.info("Restoring database, please do not refresh or close the page...");
      await api.post("/admin/backups/restore", formData, {
        headers: {
          ...getAuthHeaders().headers,
          "Content-Type": "multipart/form-data"
        }
      });
      toast.success("Database restored successfully!");
      fetchBackups();
    } catch (error) {
      console.error("Restore failed", error);
      toast.error(error.response?.data?.detail || "Failed to restore database. Verify file integrity.");
    } finally {
      setRestoring(false);
      setFileToRestore(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="page-bg">
      <Navbar />

      <div className="theme-main p-5 max-w-7xl mx-auto space-y-6">
        
        {/* Header Title Card */}
        <div className="theme-card rounded-2xl p-6 shadow border" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                🗄️ Database Backup & Restore
              </h1>
              <p className="mt-2 opacity-70">
                Safely backup system tables, users, watchlists, trades, settings, and restore previous states.
              </p>
            </div>
            
            <div className="text-sm border rounded-xl px-4 py-2.5 flex flex-col justify-center bg-black/5" style={{ borderColor: "var(--border)" }}>
              <span className="font-semibold opacity-70">Last Successful Backup</span>
              <span className="font-mono text-xs mt-0.5 font-bold">
                {lastBackup 
                  ? new Date(lastBackup).toLocaleString("en-IN", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit", second: "2-digit"
                    })
                  : "Never"}
              </span>
            </div>
          </div>
        </div>

        {/* Action Panel: Create & Restore */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Create Backup Action Card */}
          <div className="theme-card rounded-2xl p-6 shadow border flex flex-col justify-between" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                📥 Generate Database Backup
              </h2>
              <p className="mt-2 text-sm opacity-70 leading-relaxed">
                Creates a timestamped snapshot of all application tables, users, roles, stocks, and logs. You will be able to download and reuse this file to restore the database.
              </p>
            </div>
            
            <div className="mt-6">
              <button
                type="button"
                disabled={backingUp || restoring || loading}
                onClick={handleCreateBackup}
                className="w-full md:w-auto rounded-xl bg-accent text-white px-5 py-3 text-sm font-bold shadow hover:bg-accent/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                style={{ background: "var(--accent)" }}
              >
                {backingUp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating Snapshot...
                  </>
                ) : (
                  <>📥 Create Backup</>
                )}
              </button>
            </div>
          </div>

          {/* Restore Database Action Card */}
          <div className="theme-card rounded-2xl p-6 shadow border flex flex-col justify-between" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                📤 Restore Database State
              </h2>
              <p className="mt-2 text-sm opacity-70 leading-relaxed">
                Upload a previously downloaded SQL backup file. This operation will wipe the existing database tables and restore the records exactly as they were captured in the backup.
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <input
                type="file"
                accept=".sql"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                disabled={backingUp || restoring || loading}
              />
              <button
                type="button"
                disabled={backingUp || restoring || loading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full md:w-auto rounded-xl border px-5 py-3 text-sm font-bold hover:bg-black/5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                style={{ borderColor: "var(--border)" }}
              >
                {restoring ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                    Restoring State...
                  </>
                ) : (
                  <>📤 Upload & Restore</>
                )}
              </button>
            </div>
          </div>

        </div>

        {/* Backups History Table */}
        <div className="theme-card rounded-2xl p-6 shadow border space-y-4" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
          <h2 className="text-2xl font-bold">Backup History Log</h2>
          
          {loading ? (
            <div className="py-12 flex flex-col justify-center items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" style={{ borderColor: "var(--accent)" }}></div>
              <span className="font-semibold text-sm opacity-70">Fetching backup logs...</span>
            </div>
          ) : backups.length === 0 ? (
            <div className="py-16 text-center opacity-65 border-2 border-dashed rounded-xl" style={{ borderColor: "var(--border)" }}>
              🗄️ No generated backups found. Click "Create Backup" to save your first snapshot.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="bg-black/5 border-b" style={{ borderColor: "var(--border)" }}>
                    <th className="py-3.5 px-4 font-bold">Filename</th>
                    <th className="py-3.5 px-4 font-bold">File Size</th>
                    <th className="py-3.5 px-4 font-bold">Created By</th>
                    <th className="py-3.5 px-4 font-bold">Date & Time</th>
                    <th className="py-3.5 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ divideColor: "var(--border)" }}>
                  {backups.map((bk) => (
                    <tr key={bk.filename} className="hover:bg-black/5 transition">
                      <td className="py-3.5 px-4 font-semibold font-mono text-xs">{bk.filename}</td>
                      <td className="py-3.5 px-4 font-medium">{formatSize(bk.size_bytes)}</td>
                      <td className="py-3.5 px-4">{bk.created_by}</td>
                      <td className="py-3.5 px-4">
                        {new Date(bk.created_at).toLocaleString("en-IN", {
                          year: "numeric", month: "short", day: "numeric",
                          hour: "2-digit", minute: "2-digit", second: "2-digit"
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(bk.filename)}
                          className="rounded-lg border px-2.5 py-1 text-xs font-bold transition hover:bg-black/5 cursor-pointer"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteClick(bk.filename)}
                          className="rounded-lg border border-red-500/20 text-red-500 px-2.5 py-1 text-xs font-bold transition hover:bg-red-500/10 cursor-pointer"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal: Restore Backup */}
      {showConfirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="theme-card rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div className="text-center space-y-2">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-xl font-bold text-rose-500">Confirm Database Overwrite</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                You are about to restore the database from <span className="font-mono font-bold text-xs">{fileToRestore?.name}</span>. This will completely overwrite the existing data.
              </p>
              <div className="p-3 bg-rose-500/10 text-rose-500 text-xs font-semibold rounded-xl text-left border border-rose-500/20">
                CRITICAL WARNING: Any changes made after this backup was created will be permanently lost. This action is irreversible.
              </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmRestore(false);
                  setFileToRestore(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer transition"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                className="rounded-xl bg-red-500 text-white px-5 py-2 text-sm font-bold shadow hover:bg-red-600 cursor-pointer transition"
              >
                Yes, Restore Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Backup */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="theme-card rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-4 animate-in fade-in zoom-in-95 duration-150" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text)" }}>
            <div className="text-center space-y-2">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-xl font-bold">Delete Backup File</h3>
              <p className="text-sm opacity-80 leading-relaxed">
                Are you sure you want to permanently delete the backup file <span className="font-mono font-bold text-xs">{fileToDelete}</span>? This will free up server storage space.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowConfirmDelete(false);
                  setFileToDelete(null);
                }}
                className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-black/5 cursor-pointer transition"
                style={{ borderColor: "var(--border)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-500 text-white px-5 py-2 text-sm font-bold shadow hover:bg-red-600 cursor-pointer transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
