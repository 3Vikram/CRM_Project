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
import {
  CHART,
  BankPayment,
  PurchaseInvoice,
  PurchaseLine,
  Voucher,
  VoucherLine,
  accountType,
  exportCsv,
  id,
  invoiceTotals,
  ledgerEntries,
  money,
  outstanding,
  paymentStatus,
  profitLoss,
  today,
  trialBalance,
  validateInvoice,
  validateVoucher,
} from "@/lib/accounting";

export function JournalRegisterPage() {
  const { companyId, data, setData } = useAccounting();
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [error, setError] = useState("");
  const create = () => {
    setError("");
    setEditing({
      id: id(),
      companyId,
      number: `JR-${String(data.vouchers.length + 1).padStart(4, "0")}`,
      invoiceNumber: "",
      date: today(),
      reference: "",
      narration: "",
      lines: [
        newVoucherLine("debit", "Rent Expense"),
        newVoucherLine("credit", "Cash"),
      ],
      status: "draft",
    });
  };
  const save = (post: boolean) => {
    if (!editing) return;
    const err = validateVoucher(editing);
    if (post && err) {
      setError(err);
      return;
    }
    const entry = { ...editing, status: post ? "posted" : editing.status };
    setData({
      ...data,
      vouchers: data.vouchers.some((v) => v.id === entry.id)
        ? data.vouchers.map((v) => (v.id === entry.id ? entry : v))
        : [entry, ...data.vouchers],
    });
    setEditing(null);
  };
  const updateLine = (index: number, changes: Partial<VoucherLine>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      lines: editing.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...changes } : line,
      ),
    });
  };
  const totalDebit =
    editing?.lines.reduce((sum, line) => sum + line.debit, 0) ?? 0;
  const totalCredit =
    editing?.lines.reduce((sum, line) => sum + line.credit, 0) ?? 0;
  const difference = Math.abs(totalDebit - totalCredit);
  return (
    <div className="space-y-6">
      <Header
        title="Journal Register"
        description="Record invoice-linked debit and credit entries by item or account."
        action={
          <button className={button} onClick={create}>
            <Plus className="w-4" />
            New Journal Entry
          </button>
        }
      />
      <Table
        headers={[
          "Journal No.",
          "Invoice No.",
          "Date",
          "Items / Accounts",
          "Reference",
          "Debit",
          "Credit",
          "Status",
          "Actions",
        ]}
      >
        <>
          {data.vouchers.map((v) => {
            const debit = v.lines.reduce((sum, line) => sum + line.debit, 0),
              credit = v.lines.reduce((sum, line) => sum + line.credit, 0),
              items = [
                ...new Set(v.lines.map((line) => line.account).filter(Boolean)),
              ].join(", ");
            return (
              <tr key={v.id}>
                <td>{v.number}</td>
                <td>{v.invoiceNumber || "—"}</td>
                <td>{v.date}</td>
                <td>{items || "—"}</td>
                <td>{v.reference || "—"}</td>
                <td>{money(debit)}</td>
                <td>{money(credit)}</td>
                <td>
                  <Status value={v.status} />
                </td>
                <td className="space-x-1">
                  {v.status === "draft" && (
                    <>
                      <button
                        className={secondary}
                        onClick={() => {
                          setError("");
                          setEditing(v);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className={secondary}
                        onClick={() =>
                          setData({
                            ...data,
                            vouchers: data.vouchers.filter(
                              (x) => x.id !== v.id,
                            ),
                          })
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {v.status === "posted" && (
                    <button
                      className={secondary}
                      onClick={() =>
                        setData({
                          ...data,
                          vouchers: data.vouchers.map((x) =>
                            x.id === v.id ? { ...x, status: "cancelled" } : x,
                          ),
                        })
                      }
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </>
      </Table>
      {!data.vouchers.length && (
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
              message="Posting creates an immutable ledger entry."
              error={error}
              secondaryLabel="Save as draft"
              primaryLabel="Post journal"
              onSecondary={() => save(false)}
              onPrimary={() => save(true)}
            />
          }
        >
          <div className="space-y-5">
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Journal number">
                <input
                  className={input}
                  value={editing.number}
                  onChange={(e) =>
                    setEditing({ ...editing, number: e.target.value })
                  }
                />
              </Field>
              <Field label="Invoice number">
                <input
                  className={input}
                  placeholder="e.g. INV-1042"
                  value={editing.invoiceNumber || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, invoiceNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Journal date">
                <input
                  type="date"
                  className={input}
                  value={editing.date}
                  onChange={(e) =>
                    setEditing({ ...editing, date: e.target.value })
                  }
                />
              </Field>
              <Field label="Reference">
                <input
                  className={input}
                  placeholder="Optional reference"
                  value={editing.reference}
                  onChange={(e) =>
                    setEditing({ ...editing, reference: e.target.value })
                  }
                />
              </Field>
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
                  {editing.lines.map((line, index) => {
                    const amount =
                      line.entryType === "credit" ? line.credit : line.debit;
                    return (
                      <tr className="border-t border-[#EEEAE2]" key={line.id}>
                        <td className="p-2">
                          <select
                            className={input}
                            value={line.account}
                            onChange={(e) =>
                              updateLine(index, { account: e.target.value })
                            }
                          >
                            <option value="">Select item</option>
                            {CHART.map((account) => (
                              <option key={account.name} value={account.name}>
                                {account.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            className={input}
                            placeholder="Item details"
                            value={line.description}
                            onChange={(e) =>
                              updateLine(index, { description: e.target.value })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <select
                            className={input}
                            value={line.entryType}
                            onChange={(e) => {
                              const entryType = e.target.value as
                                "debit" | "credit";
                              updateLine(index, {
                                entryType,
                                debit: entryType === "debit" ? amount : 0,
                                credit: entryType === "credit" ? amount : 0,
                              });
                            }}
                          >
                            <option value="debit">Debit</option>
                            <option value="credit">Credit</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className={input}
                            placeholder="0.00"
                            value={amount || ""}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              updateLine(index, {
                                debit: line.entryType === "debit" ? value : 0,
                                credit: line.entryType === "credit" ? value : 0,
                              });
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <button
                            aria-label="Remove journal line"
                            className="mt-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              setEditing({
                                ...editing,
                                lines: editing.lines.filter(
                                  (_, lineIndex) => lineIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              className={`mt-3 ${secondary}`}
              onClick={() =>
                setEditing({
                  ...editing,
                  lines: [...editing.lines, newVoucherLine()],
                })
              }
            >
              <Plus className="mr-1 inline w-3" />
              Add item
            </button>
            <Field label="Notes / narration">
              <textarea
                className={textarea}
                placeholder="Describe the reason for this journal entry..."
                value={editing.narration}
                onChange={(e) =>
                  setEditing({ ...editing, narration: e.target.value })
                }
              />
            </Field>
            <div
              className={`grid gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center ${difference < 0.005 && totalDebit > 0 ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}
            >
              <div>
                <div className="text-xs text-gray-500">Total debit</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">
                  {money(totalDebit)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Total credit</div>
                <div className="mt-0.5 text-lg font-bold tabular-nums">
                  {money(totalCredit)}
                </div>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${difference < 0.005 && totalDebit > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
              >
                {difference < 0.005 && totalDebit > 0
                  ? "Balanced"
                  : `Difference ${money(difference)}`}
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
function Header({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
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
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${c}`}>{value}</span>
  );
}
function Modal({
  children,
  onClose,
  title,
  description,
  documentNumber,
  icon,
  footer,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  description: string;
  documentNumber: string;
  icon: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/55 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="accounting-dialog-title"
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/50 bg-white shadow-[0_32px_90px_rgba(28,25,23,0.28)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-5 border-b border-[#EAE6DD] bg-gradient-to-r from-white to-[#FAF8F4] px-5 py-4 sm:px-7 sm:py-5">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white shadow-sm">
              {icon}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="accounting-dialog-title"
                  className="font-serif text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl"
                >
                  {title}
                </h2>
                <span className="rounded-full border border-[#DED8CC] bg-white px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide text-gray-600">
                  {documentNumber}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-5 text-gray-500">
                {description}
              </p>
            </div>
          </div>
          <button
            aria-label="Close dialog"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-500 transition hover:bg-[#F0EDE6] hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FCFBF9] px-5 py-5 sm:px-7 sm:py-6">
          {children}
        </div>
        <div className="shrink-0 border-t border-[#E5E1D8] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          {footer}
        </div>
      </div>
    </div>
  );
}
function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E7E2D8] bg-white p-4 shadow-[0_1px_2px_rgba(28,25,23,0.04)] sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          {description && (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
function DialogFooter({
  message,
  error,
  secondaryLabel,
  primaryLabel,
  onSecondary,
  onPrimary,
}: {
  message: string;
  error?: string;
  secondaryLabel: string;
  primaryLabel: string;
  onSecondary: () => void;
  onPrimary: () => void;
}) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
        <div className="flex shrink-0 gap-2">
          <button className={secondary} onClick={onSecondary}>
            {secondaryLabel}
          </button>
          <button className={button} onClick={onPrimary}>
            {primaryLabel}
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
const newLine = (): PurchaseLine => ({
  id: id(),
  description: "",
  quantity: 1,
  rate: 0,
  gstRate: 18,
  account: "Purchases",
});
const newVoucherLine = (
  entryType: "debit" | "credit" = "debit",
  account = "",
): VoucherLine => ({
  id: id(),
  account,
  entryType,
  debit: 0,
  credit: 0,
  description: "",
});
export function PurchaseInvoicePage() {
  const { data, setData } = useAccounting();
  const [editing, setEditing] = useState<PurchaseInvoice | null>(null);
  const [error, setError] = useState("");
  const fresh = (): PurchaseInvoice => ({
    id: id(),
    number: `PI-${String(data.purchaseInvoices.length + 1).padStart(4, "0")}`,
    vendor: "",
    gstin: "",
    vendorInvoiceNumber: "",
    invoiceDate: today(),
    dueDate: today(),
    taxMode: "intra",
    notes: "",
    lines: [newLine()],
    status: "draft",
  });
  const save = (post = false) => {
    if (!editing) return;
    const err = validateInvoice(data, editing);
    if (post && err) {
      setError(err);
      return;
    }
    const row = { ...editing, status: post ? "posted" : editing.status };
    setData({
      ...data,
      purchaseInvoices: data.purchaseInvoices.some((x) => x.id === row.id)
        ? data.purchaseInvoices.map((x) => (x.id === row.id ? row : x))
        : [row, ...data.purchaseInvoices],
    });
    setEditing(null);
  };
  return (
    <div className="space-y-6">
      <Header
        title="Purchase Invoice"
        description="Record vendor bills and post payable expenses."
        action={
          <button
            className={button}
            onClick={() => {
              setError("");
              setEditing(fresh());
            }}
          >
            <Plus className="w-4" />
            New Purchase Invoice
          </button>
        }
      />
      <Table
        headers={[
          "Invoice",
          "Vendor",
          "Date",
          "Due",
          "Total",
          "Paid",
          "Outstanding",
          "Payment",
          "Status",
          "Actions",
        ]}
      >
        <>
          {data.purchaseInvoices.map((x) => (
            <tr key={x.id}>
              <td>{x.vendorInvoiceNumber}</td>
              <td>{x.vendor}</td>
              <td>{x.invoiceDate}</td>
              <td>{x.dueDate}</td>
              <td>{money(invoiceTotals(x).total)}</td>
              <td>{money(invoiceTotals(x).total - outstanding(data, x))}</td>
              <td>{money(outstanding(data, x))}</td>
              <td>
                <Status value={paymentStatus(data, x)} />
              </td>
              <td>
                <Status value={x.status} />
              </td>
              <td className="space-x-1">
                {x.status === "draft" && (
                  <>
                    <button
                      className={secondary}
                      onClick={() => {
                        setError("");
                        setEditing(x);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className={secondary}
                      onClick={() => {
                        setEditing(x);
                        setTimeout(() => {}, 0);
                      }}
                    >
                      Post
                    </button>
                    <button
                      className={secondary}
                      onClick={() =>
                        setData({
                          ...data,
                          purchaseInvoices: data.purchaseInvoices.filter(
                            (i) => i.id !== x.id,
                          ),
                        })
                      }
                    >
                      Delete
                    </button>
                  </>
                )}
                {x.status === "posted" && (
                  <button
                    className={secondary}
                    onClick={() =>
                      setData({
                        ...data,
                        purchaseInvoices: data.purchaseInvoices.map((i) =>
                          i.id === x.id ? { ...i, status: "cancelled" } : i,
                        ),
                      })
                    }
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </>
      </Table>
      {!data.purchaseInvoices.length && (
        <Empty text="Create a purchase invoice to track vendor bills and payables." />
      )}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Purchase invoice"
          description="Capture the supplier bill, GST treatment, and expense lines before posting."
          documentNumber={editing.number}
          icon={<ReceiptText className="h-5 w-5" />}
          footer={
            <DialogFooter
              message="Posting updates purchases, GST, and accounts payable."
              error={error}
              secondaryLabel="Save as draft"
              primaryLabel="Post invoice"
              onSecondary={() => save(false)}
              onPrimary={() => save(true)}
            />
          }
        >
          <InvoiceForm value={editing} setValue={setEditing} />
        </Modal>
      )}
    </div>
  );
}
function InvoiceForm({
  value,
  setValue,
}: {
  value: PurchaseInvoice;
  setValue: (x: PurchaseInvoice) => void;
}) {
  const t = invoiceTotals(value);
  const set = (k: keyof PurchaseInvoice, v: string) =>
    setValue({ ...value, [k]: v });
  const line = (index: number, k: keyof PurchaseLine, v: string) => {
    const lines = value.lines.map((l, i) =>
      i === index
        ? {
            ...l,
            [k]: ["quantity", "rate", "gstRate"].includes(k) ? Number(v) : v,
          }
        : l,
    );
    setValue({ ...value, lines });
  };
  return (
    <div className="space-y-5">
      <Section
        title="Invoice details"
        description="Supplier identity, source invoice, dates, and tax treatment."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Purchase invoice number">
            <input
              className={input}
              value={value.number}
              onChange={(e) => set("number", e.target.value)}
            />
          </Field>
          <Field label="Vendor">
            <input
              className={input}
              value={value.vendor}
              onChange={(e) => set("vendor", e.target.value)}
            />
          </Field>
          <Field label="Vendor GSTIN">
            <input
              className={input}
              value={value.gstin}
              onChange={(e) => set("gstin", e.target.value)}
            />
          </Field>
          <Field label="Supplier invoice number">
            <input
              className={input}
              value={value.vendorInvoiceNumber}
              onChange={(e) => set("vendorInvoiceNumber", e.target.value)}
            />
          </Field>
          <Field label="Invoice date">
            <input
              type="date"
              className={input}
              value={value.invoiceDate}
              onChange={(e) => set("invoiceDate", e.target.value)}
            />
          </Field>
          <Field label="Due date">
            <input
              type="date"
              className={input}
              value={value.dueDate}
              onChange={(e) => set("dueDate", e.target.value)}
            />
          </Field>
          <Field label="Tax mode">
            <select
              className={input}
              value={value.taxMode}
              onChange={(e) => set("taxMode", e.target.value)}
            >
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
        action={
          <button
            className={secondary}
            onClick={() =>
              setValue({ ...value, lines: [...value.lines, newLine()] })
            }
          >
            <Plus className="h-4 w-4" />
            Add line
          </button>
        }
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
                <tr className="border-t border-[#EEEAE2] bg-white" key={l.id}>
                  <td className="px-3 pb-3 pt-1.5">
                    <input
                      className={input}
                      value={l.description}
                      onChange={(e) => line(i, "description", e.target.value)}
                    />
                  </td>
                  <td className="px-3 pb-3 pt-1.5">
                    <select
                      className={input}
                      value={l.account}
                      onChange={(e) => line(i, "account", e.target.value)}
                    >
                      {CHART.filter((a) => a.type === "Expense").map((a) => (
                        <option key={a.name}>{a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 pb-3 pt-1.5">
                    <input
                      type="number"
                      className={`${input} text-right tabular-nums`}
                      value={l.quantity}
                      onChange={(e) => line(i, "quantity", e.target.value)}
                    />
                  </td>
                  <td className="px-3 pb-3 pt-1.5">
                    <input
                      type="number"
                      className={`${input} text-right tabular-nums`}
                      value={l.rate}
                      onChange={(e) => line(i, "rate", e.target.value)}
                    />
                  </td>
                  <td className="px-3 pb-3 pt-1.5">
                    <input
                      type="number"
                      className={`${input} text-right tabular-nums`}
                      value={l.gstRate}
                      onChange={(e) => line(i, "gstRate", e.target.value)}
                    />
                  </td>
                  <td className="px-2 pb-3 pt-1.5 text-center">
                    <button
                      aria-label="Remove invoice line"
                      className="mt-1.5 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      onClick={() =>
                        setValue({
                          ...value,
                          lines: value.lines.filter((_, n) => n !== i),
                        })
                      }
                    >
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
        <Section
          title="Notes / narration"
          description="Optional context for approval and audit history."
        >
          <textarea
            className={textarea}
            placeholder="Add payment terms, delivery notes, or internal context..."
            value={value.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Section>
        <section className="rounded-2xl border border-[#DED8CC] bg-[#F4F1EA] p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Invoice summary
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
            <div className="text-gray-500">Taxable value</div>
            <div className="text-right font-semibold tabular-nums">
              {money(t.taxable)}
            </div>
            <div className="text-gray-500">CGST</div>
            <div className="text-right font-semibold tabular-nums">
              {money(t.cgst)}
            </div>
            <div className="text-gray-500">SGST</div>
            <div className="text-right font-semibold tabular-nums">
              {money(t.sgst)}
            </div>
            <div className="text-gray-500">IGST</div>
            <div className="text-right font-semibold tabular-nums">
              {money(t.igst)}
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between border-t border-[#D8D1C3] pt-4">
            <div>
              <div className="text-xs font-medium text-gray-500">
                Grand total
              </div>
              <div className="mt-1 font-serif text-2xl font-bold text-gray-950">
                {money(t.total)}
              </div>
            </div>
            <div className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
              GST {money(t.gst)}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
export function BankPaymentsPage() {
  const { data, setData } = useAccounting();
  const [editing, setEditing] = useState<BankPayment | null>(null);
  const [error, setError] = useState("");
  const fresh = (): BankPayment => ({
    id: id(),
    number: `BP-${String(data.bankPayments.length + 1).padStart(4, "0")}`,
    date: today(),
    payee: "",
    bankAccount: "Main Bank",
    category: "Rent Expense",
    linkedInvoiceId: "",
    mode: "Bank transfer",
    reference: "",
    amount: 0,
    narration: "",
    clearance: "Pending",
    status: "draft",
  });
  const save = (post: boolean) => {
    if (!editing) return;
    const inv = data.purchaseInvoices.find(
      (i) => i.id === editing.linkedInvoiceId,
    );
    if (!editing.payee || editing.amount <= 0)
      return setError("Payee and a positive amount are required.");
    if (inv && editing.amount > outstanding(data, inv) + 0.005)
      return setError("Payment exceeds invoice outstanding amount.");
    const x = { ...editing, status: post ? "posted" : editing.status };
    setData({
      ...data,
      bankPayments: data.bankPayments.some((p) => p.id === x.id)
        ? data.bankPayments.map((p) => (p.id === x.id ? x : p))
        : [x, ...data.bankPayments],
    });
    setEditing(null);
  };
  return (
    <div className="space-y-6">
      <Header
        title="Bank Payments"
        description="Record cash and bank payments, including purchase invoice settlements."
        action={
          <button
            className={button}
            onClick={() => {
              setError("");
              setEditing(fresh());
            }}
          >
            <Plus className="w-4" />
            New Payment
          </button>
        }
      />
      <Table
        headers={[
          "Number",
          "Date",
          "Payee",
          "Account",
          "Category",
          "Invoice",
          "Mode",
          "Amount",
          "Clearance",
          "Status",
          "Actions",
        ]}
      >
        <>
          {data.bankPayments.map((p) => (
            <tr key={p.id}>
              <td>{p.number}</td>
              <td>{p.date}</td>
              <td>{p.payee}</td>
              <td>{p.bankAccount}</td>
              <td>{p.category}</td>
              <td>
                {data.purchaseInvoices.find((i) => i.id === p.linkedInvoiceId)
                  ?.vendorInvoiceNumber || "—"}
              </td>
              <td>{p.mode}</td>
              <td>{money(p.amount)}</td>
              <td>
                <Status value={p.clearance} />
              </td>
              <td>
                <Status value={p.status} />
              </td>
              <td>
                {p.status === "draft" && (
                  <>
                    <button className={secondary} onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button
                      className={secondary}
                      onClick={() =>
                        setData({
                          ...data,
                          bankPayments: data.bankPayments.filter(
                            (x) => x.id !== p.id,
                          ),
                        })
                      }
                    >
                      Delete
                    </button>
                  </>
                )}
                {p.status === "posted" && (
                  <button
                    className={secondary}
                    onClick={() =>
                      setData({
                        ...data,
                        bankPayments: data.bankPayments.map((x) =>
                          x.id === p.id ? { ...x, status: "cancelled" } : x,
                        ),
                      })
                    }
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </>
      </Table>
      {!data.bankPayments.length && (
        <Empty text="Record a payment to update cash, bank, and payable balances." />
      )}
      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          title="Bank payment"
          description="Record the payee, settlement details, and bank clearance status."
          documentNumber={editing.number}
          icon={<Landmark className="h-5 w-5" />}
          footer={
            <DialogFooter
              message="Posting credits the selected cash or bank account."
              error={error}
              secondaryLabel="Save as draft"
              primaryLabel="Post payment"
              onSecondary={() => save(false)}
              onPrimary={() => save(true)}
            />
          }
        >
          <div className="space-y-5">
            <Section
              title="Payment details"
              description="Choose where the payment comes from and how it should be classified."
            >
              <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Payment date">
                  <input
                    type="date"
                    className={input}
                    value={editing.date}
                    onChange={(e) =>
                      setEditing({ ...editing, date: e.target.value })
                    }
                  />
                </Field>
                <Field label="Payee">
                  <input
                    className={input}
                    value={editing.payee}
                    onChange={(e) =>
                      setEditing({ ...editing, payee: e.target.value })
                    }
                  />
                </Field>
                <Field label="Bank account">
                  <select
                    className={input}
                    value={editing.bankAccount}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        bankAccount: e.target.value as "Cash" | "Main Bank",
                      })
                    }
                  >
                    <option>Cash</option>
                    <option>Main Bank</option>
                  </select>
                </Field>
                <Field label="Purpose / category">
                  <select
                    className={input}
                    value={editing.category}
                    onChange={(e) =>
                      setEditing({ ...editing, category: e.target.value })
                    }
                  >
                    {CHART.filter(
                      (a) =>
                        a.type === "Expense" ||
                        a.name === "Vendor Advances" ||
                        a.name === "Accounts Payable",
                    ).map((a) => (
                      <option key={a.name}>{a.name}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Linked purchase invoice">
                  <select
                    className={input}
                    value={editing.linkedInvoiceId}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        linkedInvoiceId: e.target.value,
                      })
                    }
                  >
                    <option value="">None</option>
                    {data.purchaseInvoices
                      .filter(
                        (i) =>
                          i.status === "posted" && outstanding(data, i) > 0,
                      )
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.vendorInvoiceNumber} · {i.vendor} ·{" "}
                          {money(outstanding(data, i))}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Mode">
                  <select
                    className={input}
                    value={editing.mode}
                    onChange={(e) =>
                      setEditing({ ...editing, mode: e.target.value })
                    }
                  >
                    {["Bank transfer", "UPI", "Cheque", "Cash", "Card"].map(
                      (x) => (
                        <option key={x}>{x}</option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Reference">
                  <input
                    className={input}
                    value={editing.reference}
                    onChange={(e) =>
                      setEditing({ ...editing, reference: e.target.value })
                    }
                  />
                </Field>
                <Field label="Amount">
                  <input
                    type="number"
                    className={input}
                    value={editing.amount || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, amount: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Clearance">
                  <select
                    className={input}
                    value={editing.clearance}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        clearance: e.target.value as "Pending" | "Cleared",
                      })
                    }
                  >
                    <option>Pending</option>
                    <option>Cleared</option>
                  </select>
                </Field>
              </div>
            </Section>
            <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
              <Section
                title="Narration"
                description="Optional note for the approver and bank reconciliation."
              >
                <textarea
                  className={textarea}
                  placeholder="What is this payment for?"
                  value={editing.narration}
                  onChange={(e) =>
                    setEditing({ ...editing, narration: e.target.value })
                  }
                />
              </Section>
              <section className="rounded-2xl border border-[#DED8CC] bg-[#F4F1EA] p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Payment summary
                </div>
                <div className="mt-4 text-xs text-gray-500">Amount to post</div>
                <div className="mt-1 font-serif text-3xl font-bold tracking-tight text-gray-950">
                  {money(editing.amount)}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">
                    {editing.bankAccount}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${editing.clearance === "Cleared" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    {editing.clearance}
                  </span>
                </div>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function LedgerPage() {
  const { data } = useAccounting();
  const [account, setAccount] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("9999-12-31");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    let r = ledgerEntries(data).filter(
      (x) =>
        (!account || x.account === account) &&
        x.date >= start &&
        x.date <= end &&
        (!search ||
          `${x.reference} ${x.party} ${x.narration}`
            .toLowerCase()
            .includes(search.toLowerCase())),
    );
    let run = 0;
    return r.map((x) => ({ ...x, balance: (run += x.debit - x.credit) }));
  }, [data, account, start, end, search]);
  const debit = rows.reduce((s, x) => s + x.debit, 0),
    credit = rows.reduce((s, x) => s + x.credit, 0);
  return (
    <div className="space-y-6">
      <Header
        title="Ledger"
        description="Trace posted transactions by account."
        action={
          <button
            className={button}
            disabled={!rows.length}
            onClick={() =>
              exportCsv(
                "ledger.csv",
                [
                  "Date",
                  "Source",
                  "Reference",
                  "Party",
                  "Narration",
                  "Debit",
                  "Credit",
                  "Balance",
                ],
                rows.map((x) => [
                  x.date,
                  x.source,
                  x.reference,
                  x.party,
                  x.narration,
                  x.debit,
                  x.credit,
                  x.balance,
                ]),
              )
            }
          >
            <Download className="w-4" />
            Export CSV
          </button>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <select
          className={input}
          value={account}
          onChange={(e) => setAccount(e.target.value)}
        >
          <option value="">All accounts</option>
          {CHART.map((a) => (
            <option key={a.name}>{a.name}</option>
          ))}
        </select>
        <input
          type="date"
          className={input}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="date"
          className={input}
          value={end === "9999-12-31" ? "" : end}
          onChange={(e) => setEnd(e.target.value || "9999-12-31")}
        />
        <input
          className={input}
          placeholder="Search reference, party..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="text-sm">
        Total debit {money(debit)} · Total credit {money(credit)} · Closing
        balance {money(debit - credit)}
      </div>
      <Table
        headers={[
          "Date",
          "Source",
          "Reference",
          "Party",
          "Narration",
          "Debit",
          "Credit",
          "Running balance",
        ]}
      >
        <>
          {rows.map((x, i) => (
            <tr key={i}>
              <td>{x.date}</td>
              <td>{x.source}</td>
              <td>{x.reference}</td>
              <td>{x.party}</td>
              <td>{x.narration}</td>
              <td>{money(x.debit)}</td>
              <td>{money(x.credit)}</td>
              <td>{money(x.balance)}</td>
            </tr>
          ))}
        </>
      </Table>
      {!rows.length && (
        <Empty text="Post an invoice, voucher, or payment to see ledger entries." />
      )}
    </div>
  );
}

export function ProfitLossPage() {
  const { data } = useAccounting();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("9999-12-31");
  const p = profitLoss(data, start, end);
  return (
    <div className="space-y-6">
      <Header
        title="Profit & Loss"
        description="Income and expense statement from posted transactions."
        action={
          <button
            className={button}
            onClick={() =>
              exportCsv(
                "profit-loss.csv",
                ["Account", "Type", "Amount"],
                p.rows.map((r) => [r.account, r.type, r.value]),
              )
            }
          >
            <Download className="w-4" />
            Export CSV
          </button>
        }
      />
      <div className="flex gap-3">
        <input
          type="date"
          className={input}
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <input
          type="date"
          className={input}
          value={end === "9999-12-31" ? "" : end}
          onChange={(e) => setEnd(e.target.value || "9999-12-31")}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Total income" value={money(p.income)} />
        <Card title="Total expenses" value={money(p.expenses)} />
        <Card
          title={p.net >= 0 ? "Net profit" : "Net loss"}
          value={money(p.net)}
        />
      </div>
      <Table headers={["Account", "Type", "Amount"]}>
        <>
          {p.rows.map((r) => (
            <tr key={r.account}>
              <td>{r.account}</td>
              <td>{r.type}</td>
              <td>{money(r.value)}</td>
            </tr>
          ))}
        </>
      </Table>
      {!p.rows.length && (
        <Empty text="Post income or expense transactions to generate P & L." />
      )}
    </div>
  );
}

export function ReportsPage() {
  const { data } = useAccounting();
  const [tab, setTab] = useState("Trial Balance");
  const [asOf, setAsOf] = useState(today());
  const tb = trialBalance(data, asOf);
  const purchases = data.purchaseInvoices.filter(
    (i) => i.status === "posted" && i.invoiceDate <= asOf,
  );
  const pays = data.bankPayments.filter(
    (p) => p.status === "posted" && p.date <= asOf,
  );
  const rows =
    tab === "Trial Balance"
      ? tb
      : tab === "Purchase Register"
        ? purchases
        : tab === "Bank Payment Register"
          ? pays
          : tab === "Accounts Payable"
            ? purchases.filter((i) => outstanding(data, i) > 0)
            : tb;
  const headers =
    tab === "Trial Balance"
      ? ["Account", "Debit", "Credit"]
      : tab === "Purchase Register"
        ? [
            "Invoice",
            "Vendor",
            "Date",
            "Due",
            "Taxable",
            "GST",
            "Total",
            "Paid",
            "Outstanding",
          ]
        : tab === "Bank Payment Register"
          ? [
              "Payment",
              "Date",
              "Payee",
              "Account",
              "Mode",
              "Reference",
              "Amount",
              "Clearance",
            ]
          : tab === "Accounts Payable"
            ? [
                "Vendor",
                "Invoice",
                "Date",
                "Due",
                "Total",
                "Paid",
                "Outstanding",
                "Days overdue",
              ]
            : ["Account", "Type", "Debit", "Credit", "Closing"];
  const csv = rows.map((r: any) =>
    tab === "Trial Balance"
      ? [r.account, r.debit, r.credit]
      : tab === "Purchase Register"
        ? [
            r.vendorInvoiceNumber,
            r.vendor,
            r.invoiceDate,
            r.dueDate,
            invoiceTotals(r).taxable,
            invoiceTotals(r).gst,
            invoiceTotals(r).total,
            invoiceTotals(r).total - outstanding(data, r),
            outstanding(data, r),
          ]
        : tab === "Bank Payment Register"
          ? [
              r.number,
              r.date,
              r.payee,
              r.bankAccount,
              r.mode,
              r.reference,
              r.amount,
              r.clearance,
            ]
          : tab === "Accounts Payable"
            ? [
                r.vendor,
                r.vendorInvoiceNumber,
                r.invoiceDate,
                r.dueDate,
                invoiceTotals(r).total,
                invoiceTotals(r).total - outstanding(data, r),
                outstanding(data, r),
                Math.max(
                  0,
                  Math.floor(
                    (Date.parse(asOf) - Date.parse(r.dueDate)) / 86400000,
                  ),
                ),
              ]
            : [r.account, r.type, r.debit, r.credit, r.debit - r.credit],
  );
  return (
    <div className="space-y-6">
      <Header
        title="Reports"
        description="Registers, balances, and statutory-ready summaries."
        action={
          <button
            className={button}
            onClick={() =>
              exportCsv(
                `${tab.replaceAll(" ", "-").toLowerCase()}.csv`,
                headers,
                csv,
              )
            }
          >
            <Download className="w-4" />
            Export CSV
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        {[
          "Trial Balance",
          "Purchase Register",
          "Bank Payment Register",
          "Accounts Payable",
          "Account Balances",
        ].map((x) => (
          <button
            key={x}
            className={x === tab ? button : secondary}
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
        <input
          type="date"
          className={`${input} ml-auto max-w-44`}
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
      </div>
      <Table headers={headers}>
        <>
          {rows.map((r: any, i) => (
            <tr key={i}>
              {csv[i].map((v: any, j: number) => (
                <td key={j}>{typeof v === "number" ? money(v) : v}</td>
              ))}
            </tr>
          ))}
        </>
      </Table>
      {!rows.length && (
        <Empty text="Post accounting transactions to populate reports." />
      )}
    </div>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-auto rounded-lg border border-[#EFECE5] bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-[#F7F5F0] text-xs uppercase text-gray-500">
          <tr>
            {headers.map((h) => (
              <th className="whitespace-nowrap px-3 py-2" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <>{children}</>
        </tbody>
      </table>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
      {text}
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-[13px] font-semibold text-gray-700">
      {label}
      {children}
    </label>
  );
}
function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#EFECE5] bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{title}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
