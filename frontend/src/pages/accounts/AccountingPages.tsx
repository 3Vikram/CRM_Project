import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  Download,
  Landmark,
  Plus,
  ReceiptText,
  Trash2,
  X,
} from "lucide-react";
import { useAccounting } from "@/components/accounts/accounting-context";
import { Toast } from "@/components/toast";
import { exportCsv, money, today } from "@/lib/accounting";
import {
  type BankPayment,
  type BankPaymentInput,
  type Ledger,
  type PurchaseInvoice,
  type PurchaseInvoiceInput,
  type Voucher,
  type VoucherLineInput,
  useBankPayments,
  useCancelBankPayment,
  useCancelDraftVoucher,
  useCancelPurchaseInvoice,
  useCreateBankPayment,
  useCreatePurchaseInvoice,
  useCreateVoucher,
  useLedgerReport,
  useLedgers,
  usePostBankPayment,
  usePostPurchaseInvoice,
  usePostVoucherDirect,
  useProfitLoss,
  usePurchaseInvoices,
  useSetBankPaymentClearance,
  useUpdateBankPayment,
  useUpdatePurchaseInvoice,
  useUpdateVoucher,
  useVouchers,
} from "@/lib/queries/accounting";

// A single-amount working copy of a voucher line for the journal register
// editor. `side` decides which of debit/credit the amount posts as.
type EditableVoucherLine = { key: string; ledgerId: string; side: "debit" | "credit"; amount: number; narration: string };
const newVoucherLine = (side: "debit" | "credit" = "debit", ledgerId = ""): EditableVoucherLine => ({
  key: Math.random().toString(36).slice(2), ledgerId, side, amount: 0, narration: "",
});
type EditableVoucher = { id?: string; number: string; invoiceReference: string; date: string; reference: string; narration: string; lines: EditableVoucherLine[] };

// Row actions (Post/Cancel/Delete on an already-saved item) fire outside the
// edit dialog, so they can't use its inline `error` banner — this surfaces
// their failures instead of letting the button silently do nothing.
function rowActionError(setter: (message: string) => void, fallback: string) {
  return (err: unknown) => setter(err instanceof Error ? err.message : fallback);
}

function ledgerName(ledgers: Ledger[] | undefined, id: string) {
  return ledgers?.find((l) => l.id === id)?.name ?? "";
}

export function JournalRegisterPage() {
  const { companyId } = useAccounting();
  const { data: ledgers } = useLedgers(companyId);
  const { data: vouchers, isLoading } = useVouchers(companyId, "journal");
  const createVoucher = useCreateVoucher(companyId);
  const updateVoucher = useUpdateVoucher(companyId);
  const postDirect = usePostVoucherDirect(companyId);
  const cancelDraft = useCancelDraftVoucher(companyId);
  const [editing, setEditing] = useState<EditableVoucher | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState("");

  const create = () => {
    setError("");
    setEditing({
      number: `JR-${String((vouchers?.length ?? 0) + 1).padStart(4, "0")}`,
      invoiceReference: "", date: today(), reference: "", narration: "",
      lines: [newVoucherLine("debit"), newVoucherLine("credit")],
    });
  };
  const edit = (v: Voucher) => {
    setError("");
    setEditing({
      id: v.id, number: v.voucherNumber, invoiceReference: v.invoiceReference ?? "", date: v.voucherDate,
      reference: v.externalReference ?? "", narration: v.narration,
      lines: v.lines.map((l) => ({ key: l.id, ledgerId: l.ledgerId, side: Number(l.credit) > 0 ? "credit" : "debit", amount: Number(l.credit) > 0 ? Number(l.credit) : Number(l.debit), narration: l.narration })),
    });
  };
  const updateLine = (index: number, changes: Partial<EditableVoucherLine>) => {
    if (!editing) return;
    setEditing({ ...editing, lines: editing.lines.map((line, i) => (i === index ? { ...line, ...changes } : line)) });
  };
  const totalDebit = editing?.lines.filter((l) => l.side === "debit").reduce((sum, l) => sum + l.amount, 0) ?? 0;
  const totalCredit = editing?.lines.filter((l) => l.side === "credit").reduce((sum, l) => sum + l.amount, 0) ?? 0;
  const difference = Math.abs(totalDebit - totalCredit);

  const save = async (post: boolean) => {
    if (!editing) return;
    if (editing.lines.length < 2 || editing.lines.some((l) => !l.ledgerId || l.amount <= 0)) {
      setError("Add at least two items, each with an account and a positive amount.");
      return;
    }
    if (difference > 0.005) {
      setError("Debit and credit totals must balance.");
      return;
    }
    const input = {
      voucherType: "journal", voucherDate: editing.date, narration: editing.narration,
      externalReference: editing.reference || undefined, invoiceReference: editing.invoiceReference || undefined,
      lines: editing.lines.map<VoucherLineInput>((l) => ({ ledgerId: l.ledgerId, side: l.side, amount: l.amount.toFixed(4), narration: l.narration || undefined })),
    };
    setBusy(true);
    setError("");
    try {
      const voucher = editing.id
        ? await updateVoucher.mutateAsync({ voucherId: editing.id, input })
        : await createVoucher.mutateAsync(input);
      if (post) await postDirect.mutateAsync(voucher.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save journal entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {rowError && <Toast message={rowError} type="error" onClose={() => setRowError("")} />}
      <Header
        title="Journal Register"
        description="Record invoice-linked debit and credit entries by item or account."
        action={<button className={button} onClick={create}><Plus className="w-4" />New Journal Entry</button>}
      />
      {isLoading && <Empty text="Loading journal entries…" />}
      {!isLoading && (
        <Table headers={["Journal No.", "Invoice No.", "Date", "Items / Accounts", "Reference", "Debit", "Credit", "Status", "Actions"]}>
          <>
            {vouchers?.map((v) => {
              const debit = v.lines.reduce((sum, l) => sum + Number(l.debit), 0);
              const credit = v.lines.reduce((sum, l) => sum + Number(l.credit), 0);
              const items = [...new Set(v.lines.map((l) => ledgerName(ledgers, l.ledgerId)).filter(Boolean))].join(", ");
              return (
                <tr key={v.id}>
                  <td>{v.voucherNumber}</td>
                  <td>{v.invoiceReference || "—"}</td>
                  <td>{v.voucherDate}</td>
                  <td>{items || "—"}</td>
                  <td>{v.externalReference || "—"}</td>
                  <td>{money(debit)}</td>
                  <td>{money(credit)}</td>
                  <td><Status value={v.status} /></td>
                  <td className="space-x-1">
                    {v.status === "draft" && (
                      <>
                        <button className={secondary} onClick={() => edit(v)}>Edit</button>
                        <button className={secondary} onClick={() => cancelDraft.mutate(v.id, { onError: rowActionError(setRowError, "Could not delete journal entry") })}>Delete</button>
                      </>
                    )}
                    {v.status === "posted" && <Status value="Posted — see Reports to reverse" />}
                  </td>
                </tr>
              );
            })}
          </>
        </Table>
      )}
      {!isLoading && !vouchers?.length && (
        <Empty text="Create a journal entry for rent, salaries, utilities, adjustments, and other debit or credit transactions." />
      )}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Journal entry"
          description="Build a balanced debit and credit entry, then post it to the ledger."
          documentNumber={editing.number}
          icon={<BookOpenCheck className="h-5 w-5" />}
          footer={
            <DialogFooter
              message="Posting creates an immutable ledger entry." error={error} busy={busy}
              secondaryLabel="Save as draft" primaryLabel="Post journal"
              onSecondary={() => save(false)} onPrimary={() => save(true)}
            />
          }
        >
          <div className="space-y-5">
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Journal number"><input className={input} value={editing.number} onChange={(e) => setEditing({ ...editing, number: e.target.value })} /></Field>
              <Field label="Invoice number"><input className={input} placeholder="e.g. INV-1042" value={editing.invoiceReference} onChange={(e) => setEditing({ ...editing, invoiceReference: e.target.value })} /></Field>
              <Field label="Journal date"><input type="date" className={input} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
              <Field label="Reference"><input className={input} placeholder="Optional reference" value={editing.reference} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} /></Field>
            </div>
            <div className="overflow-auto rounded-2xl border border-[#E7E2D8] bg-white">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="bg-[#F6F3ED]">
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    <th className="px-2 py-2">Item / account</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Debit / Credit</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {editing.lines.map((line, index) => (
                    <tr className="border-t border-[#EEEAE2]" key={line.key}>
                      <td className="p-2">
                        <select className={input} value={line.ledgerId} onChange={(e) => updateLine(index, { ledgerId: e.target.value })}>
                          <option value="">Select item</option>
                          {ledgers?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td className="p-2"><input className={input} placeholder="Item details" value={line.narration} onChange={(e) => updateLine(index, { narration: e.target.value })} /></td>
                      <td className="p-2">
                        <select className={input} value={line.side} onChange={(e) => updateLine(index, { side: e.target.value as "debit" | "credit" })}>
                          <option value="debit">Debit</option>
                          <option value="credit">Credit</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" step="0.01" className={input} placeholder="0.00" value={line.amount || ""} onChange={(e) => updateLine(index, { amount: Number(e.target.value) })} />
                      </td>
                      <td className="p-2">
                        <button aria-label="Remove journal line" className="mt-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                          onClick={() => setEditing({ ...editing, lines: editing.lines.filter((_, i) => i !== index) })}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className={`mt-3 ${secondary}`} onClick={() => setEditing({ ...editing, lines: [...editing.lines, newVoucherLine()] })}>
              <Plus className="mr-1 inline w-3" />Add item
            </button>
            <Field label="Notes / narration">
              <textarea className={textarea} placeholder="Describe the reason for this journal entry..." value={editing.narration} onChange={(e) => setEditing({ ...editing, narration: e.target.value })} />
            </Field>
            <div className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center ${difference < 0.005 && totalDebit > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
              <div>
                <div className="text-xs text-gray-500">Total debit</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{money(totalDebit)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total credit</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">{money(totalCredit)}</div>
              </div>
              <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${difference < 0.005 && totalDebit > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {difference < 0.005 && totalDebit > 0 ? "Balanced" : `Difference ${money(difference)}`}
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const input =
  "mt-1.5 h-11 w-full rounded-xl border border-[#DCD7CD] bg-white px-3.5 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-[#C9C2B5] focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10";
const textarea = `${input} h-auto min-h-24 resize-y py-3`;
const button =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const secondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#D9D4C9] bg-white px-4 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#BEB6A8] hover:bg-[#F8F6F1] focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2";

function Header({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-4xl font-serif font-bold text-gray-900">{title}</h1>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      </div>
      {action}
    </div>
  );
}
function Status({ value }: { value: string }) {
  const c =
    value === "posted" || value === "Paid" || value === "Cleared"
      ? "bg-emerald-50 text-emerald-700"
      : value === "cancelled"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs ${c}`}>{value}</span>;
}
function Modal({ children, onClose, title, description, documentNumber, icon, footer }: {
  children: React.ReactNode; onClose: () => void; title: string; description: string;
  documentNumber: string; icon: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/55 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="accounting-dialog-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-[0_32px_90px_rgba(28,25,23,0.28)]">
        <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#EAE6DD] bg-gradient-to-r from-white to-[#FAF8F4] px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">{icon}</div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="accounting-dialog-title" className="font-serif text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">{title}</h2>
                <span className="rounded-full border border-[#DED8CC] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-gray-600">{documentNumber}</span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">{description}</p>
            </div>
          </div>
          <button aria-label="Close dialog" onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-[#F0EDE6] hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FCFBF9] px-5 py-5 sm:px-7 sm:py-6">{children}</div>
        <div className="shrink-0 border-t border-[#E5E1D8] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">{footer}</div>
      </div>
    </div>
  );
}
function Section({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E7E2D8] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function DialogFooter({ message, error, busy, secondaryLabel, primaryLabel, onSecondary, onPrimary }: {
  message: string; error?: string; busy?: boolean; secondaryLabel: string; primaryLabel: string; onSecondary: () => void; onPrimary: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className={secondary} disabled={busy} onClick={onSecondary}>{secondaryLabel}</button>
          <button className={button} disabled={busy} onClick={onPrimary}>{busy ? "Saving…" : primaryLabel}</button>
        </div>
      </div>
      {error && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">{error}</div>}
    </div>
  );
}

// --- Purchase Invoice ------------------------------------------------------

type EditablePurchaseLine = { key: string; description: string; quantity: number; rate: number; gstRate: number; ledgerId: string };
const newPurchaseLine = (defaultLedgerId = ""): EditablePurchaseLine => ({ key: Math.random().toString(36).slice(2), description: "", quantity: 1, rate: 0, gstRate: 18, ledgerId: defaultLedgerId });
type EditablePurchaseInvoice = {
  id?: string; number: string; vendor: string; vendorGstin: string; vendorInvoiceNumber: string;
  invoiceDate: string; dueDate: string; taxMode: "intra" | "inter" | "none"; notes: string; lines: EditablePurchaseLine[];
};

function purchaseTotals(lines: EditablePurchaseLine[], taxMode: "intra" | "inter" | "none") {
  const taxable = lines.reduce((s, l) => s + (l.quantity || 0) * (l.rate || 0), 0);
  const gst = lines.reduce((s, l) => s + ((l.quantity || 0) * (l.rate || 0) * (l.gstRate || 0)) / 100, 0);
  return { taxable, cgst: taxMode === "intra" ? gst / 2 : 0, sgst: taxMode === "intra" ? gst / 2 : 0, igst: taxMode === "inter" ? gst : 0, gst: taxMode === "none" ? 0 : gst, total: taxable + (taxMode === "none" ? 0 : gst) };
}

export function PurchaseInvoicePage() {
  const { companyId } = useAccounting();
  const { data: ledgers } = useLedgers(companyId);
  const { data: invoices, isLoading } = usePurchaseInvoices(companyId);
  const createInvoice = useCreatePurchaseInvoice(companyId);
  const updateInvoice = useUpdatePurchaseInvoice(companyId);
  const postInvoice = usePostPurchaseInvoice(companyId);
  const cancelInvoice = useCancelPurchaseInvoice(companyId);
  const [editing, setEditing] = useState<EditablePurchaseInvoice | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState("");
  const expenseLedgers = ledgers?.filter((l) => l.nature === "expense") ?? [];

  const fresh = (): EditablePurchaseInvoice => ({
    number: `PI-${String((invoices?.length ?? 0) + 1).padStart(4, "0")}`, vendor: "", vendorGstin: "",
    vendorInvoiceNumber: "", invoiceDate: today(), dueDate: today(), taxMode: "intra", notes: "",
    lines: [newPurchaseLine(expenseLedgers.find((l) => l.name === "Purchases")?.id)],
  });
  const edit = (x: PurchaseInvoice) => {
    setError("");
    setEditing({
      id: x.id, number: x.number, vendor: x.vendor, vendorGstin: x.vendorGstin ?? "", vendorInvoiceNumber: x.vendorInvoiceNumber,
      invoiceDate: x.invoiceDate, dueDate: x.dueDate ?? "", taxMode: x.taxMode, notes: x.notes,
      lines: x.lines.map((l) => ({ key: l.id, description: l.description, quantity: l.quantity, rate: l.rate, gstRate: l.gstRate, ledgerId: l.ledgerId })),
    });
  };

  const save = async (post: boolean) => {
    if (!editing) return;
    if (!editing.vendor.trim() || !editing.vendorInvoiceNumber.trim() || !editing.invoiceDate) {
      setError("Vendor, supplier invoice number and invoice date are required.");
      return;
    }
    if (!editing.lines.length || editing.lines.some((l) => !l.ledgerId || !l.description.trim() || l.quantity <= 0 || l.rate <= 0)) {
      setError("Add at least one valid line with an account, positive quantity and rate.");
      return;
    }
    const input: PurchaseInvoiceInput = {
      number: editing.number, vendor: editing.vendor, vendorGstin: editing.vendorGstin || undefined,
      vendorInvoiceNumber: editing.vendorInvoiceNumber, invoiceDate: editing.invoiceDate, dueDate: editing.dueDate || undefined,
      taxMode: editing.taxMode, notes: editing.notes,
      lines: editing.lines.map((l) => ({ description: l.description, quantity: l.quantity, rate: l.rate, gstRate: l.gstRate, ledgerId: l.ledgerId })),
    };
    setBusy(true);
    setError("");
    try {
      const saved = editing.id ? await updateInvoice.mutateAsync({ id: editing.id, input }) : await createInvoice.mutateAsync(input);
      if (post) await postInvoice.mutateAsync(saved.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save purchase invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {rowError && <Toast message={rowError} type="error" onClose={() => setRowError("")} />}
      <Header
        title="Purchase Invoice"
        description="Record vendor bills and post payable expenses."
        action={<button className={button} onClick={() => { setError(""); setEditing(fresh()); }}><Plus className="w-4" />New Purchase Invoice</button>}
      />
      {isLoading && <Empty text="Loading purchase invoices…" />}
      {!isLoading && (
        <Table headers={["Invoice", "Vendor", "Date", "Due", "Total", "Paid", "Outstanding", "Payment", "Status", "Actions"]}>
          <>
            {invoices?.map((x) => (
              <tr key={x.id}>
                <td>{x.vendorInvoiceNumber}</td>
                <td>{x.vendor}</td>
                <td>{x.invoiceDate}</td>
                <td>{x.dueDate || "—"}</td>
                <td>{money(x.totals.total)}</td>
                <td>{money(x.paidAmount)}</td>
                <td>{money(x.outstanding)}</td>
                <td>{x.paymentStatus ? <Status value={x.paymentStatus} /> : "—"}</td>
                <td><Status value={x.status} /></td>
                <td className="space-x-1">
                  {x.status === "draft" && (
                    <>
                      <button className={secondary} onClick={() => edit(x)}>Edit</button>
                      <button className={secondary} onClick={() => postInvoice.mutate(x.id, { onError: rowActionError(setRowError, "Could not post purchase invoice") })}>Post</button>
                      <button className={secondary} onClick={() => cancelInvoice.mutate({ id: x.id }, { onError: rowActionError(setRowError, "Could not delete purchase invoice") })}>Delete</button>
                    </>
                  )}
                  {x.status === "posted" && <button className={secondary} onClick={() => cancelInvoice.mutate({ id: x.id, reason: "Cancelled from Purchase Invoice register" }, { onError: rowActionError(setRowError, "Could not cancel purchase invoice") })}>Cancel</button>}
                </td>
              </tr>
            ))}
          </>
        </Table>
      )}
      {!isLoading && !invoices?.length && <Empty text="Create a purchase invoice to track vendor bills and payables." />}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Purchase invoice"
          description="Capture the supplier bill, GST treatment, and expense lines before posting."
          documentNumber={editing.number}
          icon={<ReceiptText className="h-5 w-5" />}
          footer={
            <DialogFooter
              message="Posting updates purchases, GST, and accounts payable." error={error} busy={busy}
              secondaryLabel="Save as draft" primaryLabel="Post invoice"
              onSecondary={() => save(false)} onPrimary={() => save(true)}
            />
          }
        >
          <InvoiceForm value={editing} setValue={setEditing} expenseLedgers={expenseLedgers} />
        </Modal>
      )}
    </div>
  );
}

function InvoiceForm({ value, setValue, expenseLedgers }: { value: EditablePurchaseInvoice; setValue: (x: EditablePurchaseInvoice) => void; expenseLedgers: Ledger[] }) {
  const t = purchaseTotals(value.lines, value.taxMode);
  const set = <K extends keyof EditablePurchaseInvoice>(k: K, v: EditablePurchaseInvoice[K]) => setValue({ ...value, [k]: v });
  const line = (index: number, changes: Partial<EditablePurchaseLine>) => setValue({ ...value, lines: value.lines.map((l, i) => (i === index ? { ...l, ...changes } : l)) });
  return (
    <div className="space-y-5">
      <Section title="Invoice details" description="Supplier identity, source invoice, dates, and tax treatment.">
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Purchase invoice number"><input className={input} value={value.number} onChange={(e) => set("number", e.target.value)} /></Field>
          <Field label="Vendor"><input className={input} value={value.vendor} onChange={(e) => set("vendor", e.target.value)} /></Field>
          <Field label="Vendor GSTIN"><input className={input} value={value.vendorGstin} onChange={(e) => set("vendorGstin", e.target.value)} /></Field>
          <Field label="Supplier invoice number"><input className={input} value={value.vendorInvoiceNumber} onChange={(e) => set("vendorInvoiceNumber", e.target.value)} /></Field>
          <Field label="Invoice date"><input type="date" className={input} value={value.invoiceDate} onChange={(e) => set("invoiceDate", e.target.value)} /></Field>
          <Field label="Due date"><input type="date" className={input} value={value.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
          <Field label="Tax mode">
            <select className={input} value={value.taxMode} onChange={(e) => set("taxMode", e.target.value as EditablePurchaseInvoice["taxMode"])}>
              <option value="intra">Intra-state (CGST + SGST)</option>
              <option value="inter">Inter-state (IGST)</option>
              <option value="none">No GST</option>
            </select>
          </Field>
        </div>
      </Section>
      <Section
        title="Expense lines"
        description={`${value.lines.length} ${value.lines.length === 1 ? "line" : "lines"} on this invoice`}
        action={<button className={secondary} onClick={() => setValue({ ...value, lines: [...value.lines, newPurchaseLine()] })}><Plus className="h-4 w-4" />Add line</button>}
      >
        <div className="overflow-auto rounded-xl border border-[#E7E2D8]">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-[#F6F3ED] text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3 text-right">Qty</th>
                <th className="px-3 py-3 text-right">Rate</th>
                <th className="px-3 py-3 text-right">GST %</th>
                <th className="w-14 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {value.lines.map((l, i) => (
                <tr className="border-t border-[#EEEAE2] bg-white" key={l.key}>
                  <td className="px-3 pb-3 pt-1.5"><input className={input} value={l.description} onChange={(e) => line(i, { description: e.target.value })} /></td>
                  <td className="px-3 pb-3 pt-1.5">
                    <select className={input} value={l.ledgerId} onChange={(e) => line(i, { ledgerId: e.target.value })}>
                      <option value="">Select account</option>
                      {expenseLedgers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 pb-3 pt-1.5"><input type="number" className={`${input} text-right tabular-nums`} value={l.quantity} onChange={(e) => line(i, { quantity: Number(e.target.value) })} /></td>
                  <td className="px-3 pb-3 pt-1.5"><input type="number" className={`${input} text-right tabular-nums`} value={l.rate} onChange={(e) => line(i, { rate: Number(e.target.value) })} /></td>
                  <td className="px-3 pb-3 pt-1.5"><input type="number" className={`${input} text-right tabular-nums`} value={l.gstRate} onChange={(e) => line(i, { gstRate: Number(e.target.value) })} /></td>
                  <td className="px-2 pb-3 pt-1.5 text-center">
                    <button aria-label="Remove invoice line" className="mt-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() => setValue({ ...value, lines: value.lines.filter((_, n) => n !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <Section title="Notes / narration" description="Optional context for approval and audit history.">
          <textarea className={textarea} placeholder="Add payment terms, delivery notes, or internal context..." value={value.notes} onChange={(e) => set("notes", e.target.value)} />
        </Section>
        <section className="rounded-2xl border border-[#DED8CC] bg-[#F4F1EA] p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Invoice summary</div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
            <div className="text-gray-500">Taxable value</div><div className="text-right font-semibold tabular-nums">{money(t.taxable)}</div>
            <div className="text-gray-500">CGST</div><div className="text-right font-semibold tabular-nums">{money(t.cgst)}</div>
            <div className="text-gray-500">SGST</div><div className="text-right font-semibold tabular-nums">{money(t.sgst)}</div>
            <div className="text-gray-500">IGST</div><div className="text-right font-semibold tabular-nums">{money(t.igst)}</div>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-[#D8D1C3] pt-4">
            <div>
              <div className="text-xs font-medium text-gray-500">Grand total</div>
              <div className="mt-1 font-serif text-2xl font-bold text-gray-950">{money(t.total)}</div>
            </div>
            <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">GST {money(t.gst)}</div>
          </div>
        </section>
      </div>
    </div>
  );
}

// --- Bank Payments -----------------------------------------------------------

type EditableBankPayment = {
  id?: string; number: string; date: string; payee: string; bankLedgerId: string; categoryLedgerId: string;
  linkedInvoiceId: string; mode: string; reference: string; amount: number; narration: string;
};

export function BankPaymentsPage() {
  const { companyId } = useAccounting();
  const { data: ledgers } = useLedgers(companyId);
  const { data: payments, isLoading } = useBankPayments(companyId);
  const { data: invoices } = usePurchaseInvoices(companyId);
  const createPayment = useCreateBankPayment(companyId);
  const updatePayment = useUpdateBankPayment(companyId);
  const postPayment = usePostBankPayment(companyId);
  const cancelPayment = useCancelBankPayment(companyId);
  const setClearance = useSetBankPaymentClearance(companyId);
  const [editing, setEditing] = useState<EditableBankPayment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState("");

  const bankLedgers = ledgers?.filter((l) => l.name === "Cash" || l.name === "Main Bank") ?? [];
  const categoryLedgers = ledgers?.filter((l) => l.nature === "expense" || l.name === "Vendor Advances" || l.name === "Accounts Payable") ?? [];
  const payableLedgerId = ledgers?.find((l) => l.name === "Accounts Payable")?.id ?? "";
  const openInvoices = invoices?.filter((i) => i.status === "posted" && i.outstanding > 0) ?? [];

  const fresh = (): EditableBankPayment => ({
    number: `BP-${String((payments?.length ?? 0) + 1).padStart(4, "0")}`, date: today(), payee: "",
    bankLedgerId: bankLedgers.find((l) => l.name === "Main Bank")?.id ?? "", categoryLedgerId: categoryLedgers.find((l) => l.name === "Rent Expense")?.id ?? "",
    linkedInvoiceId: "", mode: "Bank transfer", reference: "", amount: 0, narration: "",
  });
  const edit = (p: BankPayment) => {
    setError("");
    setEditing({
      id: p.id, number: p.number, date: p.paymentDate, payee: p.payee, bankLedgerId: p.bankLedgerId,
      categoryLedgerId: p.categoryLedgerId ?? "", linkedInvoiceId: p.linkedPurchaseInvoiceId ?? "",
      mode: p.mode, reference: p.reference, amount: Number(p.amount), narration: p.narration,
    });
  };

  const save = async (post: boolean) => {
    if (!editing) return;
    const linkedInvoice = invoices?.find((i) => i.id === editing.linkedInvoiceId);
    if (!editing.payee.trim() || editing.amount <= 0) { setError("Payee and a positive amount are required."); return; }
    if (!editing.linkedInvoiceId && !editing.categoryLedgerId) { setError("Choose a purpose/category, or link a purchase invoice."); return; }
    if (linkedInvoice && editing.amount > linkedInvoice.outstanding + 0.005) { setError("Payment exceeds invoice outstanding amount."); return; }
    const input: BankPaymentInput = {
      number: editing.number, paymentDate: editing.date, payee: editing.payee, bankLedgerId: editing.bankLedgerId,
      categoryLedgerId: editing.linkedInvoiceId ? undefined : (editing.categoryLedgerId || undefined),
      linkedPurchaseInvoiceId: editing.linkedInvoiceId || undefined, mode: editing.mode, reference: editing.reference,
      amount: editing.amount, narration: editing.narration,
    };
    setBusy(true);
    setError("");
    try {
      const saved = editing.id ? await updatePayment.mutateAsync({ id: editing.id, input }) : await createPayment.mutateAsync(input);
      if (post) await postPayment.mutateAsync(saved.id);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bank payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {rowError && <Toast message={rowError} type="error" onClose={() => setRowError("")} />}
      <Header
        title="Bank Payments"
        description="Record cash and bank payments, including purchase invoice settlements."
        action={<button className={button} onClick={() => { setError(""); setEditing(fresh()); }}><Plus className="w-4" />New Payment</button>}
      />
      {isLoading && <Empty text="Loading bank payments…" />}
      {!isLoading && (
        <Table headers={["Number", "Date", "Payee", "Account", "Category", "Invoice", "Mode", "Amount", "Clearance", "Status", "Actions"]}>
          <>
            {payments?.map((p) => (
              <tr key={p.id}>
                <td>{p.number}</td>
                <td>{p.paymentDate}</td>
                <td>{p.payee}</td>
                <td>{ledgerName(ledgers, p.bankLedgerId)}</td>
                <td>{p.categoryLedgerId ? ledgerName(ledgers, p.categoryLedgerId) : "—"}</td>
                <td>{invoices?.find((i) => i.id === p.linkedPurchaseInvoiceId)?.vendorInvoiceNumber || "—"}</td>
                <td>{p.mode}</td>
                <td>{money(Number(p.amount))}</td>
                <td>
                  <button className="hover:underline" onClick={() => setClearance.mutate({ id: p.id, clearance: p.clearance === "Cleared" ? "Pending" : "Cleared" }, { onError: rowActionError(setRowError, "Could not update clearance") })}>
                    <Status value={p.clearance} />
                  </button>
                </td>
                <td><Status value={p.status} /></td>
                <td className="space-x-1">
                  {p.status === "draft" && (
                    <>
                      <button className={secondary} onClick={() => edit(p)}>Edit</button>
                      <button className={secondary} onClick={() => postPayment.mutate(p.id, { onError: rowActionError(setRowError, "Could not post bank payment") })}>Post</button>
                      <button className={secondary} onClick={() => cancelPayment.mutate({ id: p.id }, { onError: rowActionError(setRowError, "Could not delete bank payment") })}>Delete</button>
                    </>
                  )}
                  {p.status === "posted" && <button className={secondary} onClick={() => cancelPayment.mutate({ id: p.id, reason: "Cancelled from Bank Payments register" }, { onError: rowActionError(setRowError, "Could not cancel bank payment") })}>Cancel</button>}
                </td>
              </tr>
            ))}
          </>
        </Table>
      )}
      {!isLoading && !payments?.length && <Empty text="Record a payment to update cash, bank, and payable balances." />}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Bank payment"
          description="Record the payee, settlement details, and bank clearance status."
          documentNumber={editing.number}
          icon={<Landmark className="h-5 w-5" />}
          footer={
            <DialogFooter
              message="Posting credits the selected cash or bank account." error={error} busy={busy}
              secondaryLabel="Save as draft" primaryLabel="Post payment"
              onSecondary={() => save(false)} onPrimary={() => save(true)}
            />
          }
        >
          <div className="space-y-5">
            <Section title="Payment details" description="Choose where the payment comes from and how it should be classified.">
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Payment date"><input type="date" className={input} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
                <Field label="Payee"><input className={input} value={editing.payee} onChange={(e) => setEditing({ ...editing, payee: e.target.value })} /></Field>
                <Field label="Bank account">
                  <select className={input} value={editing.bankLedgerId} onChange={(e) => setEditing({ ...editing, bankLedgerId: e.target.value })}>
                    {bankLedgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </Field>
                <Field label="Purpose / category">
                  <select className={input} disabled={Boolean(editing.linkedInvoiceId)} value={editing.linkedInvoiceId ? payableLedgerId : editing.categoryLedgerId} onChange={(e) => setEditing({ ...editing, categoryLedgerId: e.target.value })}>
                    {categoryLedgers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </Field>
                <Field label="Linked purchase invoice">
                  <select className={input} value={editing.linkedInvoiceId} onChange={(e) => setEditing({ ...editing, linkedInvoiceId: e.target.value })}>
                    <option value="">None</option>
                    {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.vendorInvoiceNumber} · {i.vendor} · {money(i.outstanding)}</option>)}
                  </select>
                </Field>
                <Field label="Mode">
                  <select className={input} value={editing.mode} onChange={(e) => setEditing({ ...editing, mode: e.target.value })}>
                    {["Bank transfer", "UPI", "Cheque", "Cash", "Card"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Reference"><input className={input} value={editing.reference} onChange={(e) => setEditing({ ...editing, reference: e.target.value })} /></Field>
                <Field label="Amount"><input type="number" className={input} value={editing.amount || ""} onChange={(e) => setEditing({ ...editing, amount: Number(e.target.value) })} /></Field>
              </div>
            </Section>
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Section title="Narration" description="Optional note for the approver and bank reconciliation.">
                <textarea className={textarea} placeholder="What is this payment for?" value={editing.narration} onChange={(e) => setEditing({ ...editing, narration: e.target.value })} />
              </Section>
              <section className="rounded-2xl border border-[#DED8CC] bg-[#F4F1EA] p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Payment summary</div>
                <div className="mt-4 text-xs text-gray-500">Amount to post</div>
                <div className="mt-1 font-serif text-3xl font-bold tracking-tight text-gray-950">{money(editing.amount)}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">{ledgerName(ledgers, editing.bankLedgerId)}</span>
                </div>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// --- Ledger / P&L / Reports -------------------------------------------------

export function LedgerPage() {
  const { companyId } = useAccounting();
  const { data: ledgers } = useLedgers(companyId);
  const [ledgerId, setLedgerId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("9999-12-31");
  const [search, setSearch] = useState("");
  const { data: report, isLoading } = useLedgerReport(companyId, ledgerId, start || undefined, end);
  const rows = useMemo(() => {
    const term = search.toLowerCase();
    return (report?.rows ?? []).filter((x) => !term || `${x.externalReference ?? ""} ${x.party} ${x.narration}`.toLowerCase().includes(term));
  }, [report, search]);
  const debit = rows.reduce((s, x) => s + Number(x.debit), 0);
  const credit = rows.reduce((s, x) => s + Number(x.credit), 0);

  return (
    <div className="space-y-6">
      <Header
        title="Ledger"
        description="Trace posted transactions by account."
        action={
          <button className={button} disabled={!rows.length} onClick={() => exportCsv("ledger.csv",
            ["Date", "Source", "Reference", "Party", "Narration", "Debit", "Credit", "Balance"],
            rows.map((x) => [x.voucherDate, x.source, x.invoiceReference || x.externalReference || x.voucherNumber, x.party, x.narration, x.debit, x.credit, x.runningBalance]))}>
            <Download className="w-4" />Export CSV
          </button>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <select className={input} value={ledgerId} onChange={(e) => setLedgerId(e.target.value)}>
          <option value="">Select an account</option>
          {ledgers?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="date" className={input} value={end === "9999-12-31" ? "" : end} onChange={(e) => setEnd(e.target.value || "9999-12-31")} />
        <input className={input} placeholder="Search reference, party..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {!ledgerId && <Empty text="Select an account to view its ledger." />}
      {ledgerId && isLoading && <Empty text="Loading ledger…" />}
      {ledgerId && !isLoading && (
        <>
          <div className="text-sm">Total debit {money(debit)} · Total credit {money(credit)} · Closing balance {money(debit - credit)}</div>
          <Table headers={["Date", "Source", "Reference", "Party", "Narration", "Debit", "Credit", "Running balance"]}>
            <>
              {rows.map((x, i) => (
                <tr key={i}>
                  <td>{x.voucherDate}</td>
                  <td>{x.source}</td>
                  <td>{x.invoiceReference || x.externalReference || x.voucherNumber}</td>
                  <td>{x.party}</td>
                  <td>{x.narration || x.voucherNarration}</td>
                  <td>{money(Number(x.debit))}</td>
                  <td>{money(Number(x.credit))}</td>
                  <td>{money(Number(x.runningBalance))}</td>
                </tr>
              ))}
            </>
          </Table>
          {!rows.length && <Empty text="Post an invoice, voucher, or payment to see ledger entries." />}
        </>
      )}
    </div>
  );
}

export function ProfitLossPage() {
  const { companyId } = useAccounting();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState(today());
  const { data: p, isLoading } = useProfitLoss(companyId, start || undefined, end);
  return (
    <div className="space-y-6">
      <Header
        title="Profit & Loss"
        description="Income and expense statement from posted transactions."
        action={
          <button className={button} disabled={!p?.rows.length} onClick={() => p && exportCsv("profit-loss.csv", ["Account", "Type", "Amount"], p.rows.map((r) => [r.name, r.nature, r.amount]))}>
            <Download className="w-4" />Export CSV
          </button>
        }
      />
      <div className="flex gap-3">
        <input type="date" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
        <input type="date" className={input} value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      {isLoading && <Empty text="Loading profit & loss…" />}
      {p && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card title="Total income" value={money(Number(p.totals.income))} />
            <Card title="Total expenses" value={money(Number(p.totals.expenses))} />
            <Card title={Number(p.totals.profit) >= 0 ? "Net profit" : "Net loss"} value={money(Number(p.totals.profit))} />
          </div>
          <Table headers={["Account", "Type", "Amount"]}>
            <>
              {p.rows.map((r) => (
                <tr key={r.ledgerId}><td>{r.name}</td><td>{r.nature}</td><td>{money(Number(r.amount))}</td></tr>
              ))}
            </>
          </Table>
          {!p.rows.length && <Empty text="Post income or expense transactions to generate P & L." />}
        </>
      )}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-lg border border-[#EFECE5] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#F7F5F0] text-xs uppercase text-gray-500">
          <tr>{headers.map((h) => <th className="whitespace-nowrap px-3 py-2" key={h}>{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100"><>{children}</></tbody>
      </table>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">{text}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-[13px] font-semibold text-gray-700">{label}{children}</label>;
}
function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EFECE5] bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
