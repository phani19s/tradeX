function ConfirmDialog({
  isOpen,
  title = "Are you sure?",
  message = "Please confirm this action.",
  confirmText = "Confirm",
  cancelText = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const confirmClass =
    tone === "danger"
      ? "bg-rose-500 text-white hover:bg-rose-600"
      : "text-white hover:opacity-90";

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-[28px] border p-6 shadow-2xl"
        style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border text-2xl font-black shadow-lg"
            style={{
              borderColor: tone === "danger" ? "rgb(244 63 94 / 0.28)" : "var(--border)",
              background: tone === "danger" ? "rgb(244 63 94 / 0.12)" : "var(--accent-soft)",
              color: tone === "danger" ? "rgb(244 63 94)" : "var(--accent)",
            }}
          >
            !
          </div>
          <h3 className="text-2xl font-black">{title}</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 opacity-70">{message}</p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border px-4 py-3 text-sm font-bold transition hover:opacity-80"
            style={{ borderColor: "var(--border)" }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-bold shadow-lg transition ${confirmClass}`}
            style={tone === "danger" ? undefined : { background: "var(--accent)" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
