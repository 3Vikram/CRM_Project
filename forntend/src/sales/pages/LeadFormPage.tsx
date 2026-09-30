import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Save } from 'lucide-react';
import { Toast } from '@/components/toast';
import { createLead, fetchLeadById, updateLead } from '@/lib/leadApi';
import { fetchEmployees, type EmployeeRecord } from '@/lib/employeeApi';

const initialState = {
  companyName: '',
  contactPerson: '',
  designation: '',
  email: '',
  mobile: '',
  followUpDate: '',
  assignedTo: '',
  sourceOfLead: 'Manual',
  customerRequirements: '',
  remarks: '',
};

export default function LeadFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);

  const validate = useMemo(() => {
    const nextErrors: Record<string, string> = {};
    if (!form.companyName.trim()) nextErrors.companyName = 'Company name is required';
    if (!form.contactPerson.trim()) nextErrors.contactPerson = 'Contact person is required';
    if (!form.email.trim()) nextErrors.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Please enter a valid email';
    if (!form.mobile.trim()) nextErrors.mobile = 'Mobile is required';
    else if (!/^\+?[0-9\s-]{7,15}$/.test(form.mobile)) nextErrors.mobile = 'Please enter a valid mobile number';
    return nextErrors;
  }, [form]);

  useEffect(() => {
    void fetchEmployees({ limit: 1000, status: 'Active' })
      .then((response) => setEmployees(response.data || []))
      .catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    setErrors(validate);
  }, [validate]);

  useEffect(() => {
    if (!isEditMode || !id) return;

    const loadLead = async () => {
      try {
        const lead = await fetchLeadById(id);
        if (!lead) return;
        setForm({
          companyName: lead.companyName || '',
          contactPerson: lead.contactPerson || '',
          designation: lead.designation || '',
          email: lead.email || '',
          mobile: lead.mobile || '',
          followUpDate: lead.followUpDate || '',
          assignedTo: lead.assignedTo || '',
          sourceOfLead: lead.sourceOfLead || 'Manual',
          customerRequirements: lead.customerRequirements || '',
          remarks: lead.remarks || '',
        });
      } catch {
        setToast('Unable to load lead details for editing');
      }
    };

    void loadLead();
  }, [id, isEditMode]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (Object.keys(validate).length > 0) {
      setToast('Please fix the highlighted validation errors');
      return;
    }

    try {
      const payload = {
        ...form,
        createdBy: 'System',
        createdDate: new Date().toISOString(),
        leadStatus: 'New',
        leadScore: 0,
        priority: 'Low',
        openCount: 0,
        sourceOfLead: form.sourceOfLead || 'Manual',
      };

      if (isEditMode && id) {
        await updateLead(id, payload);
        setToast('Lead updated successfully');
      } else {
        await createLead(payload);
        setToast('Lead saved successfully');
      }
      navigate('/sales/leads');
    } catch {
      setToast('Unable to save lead');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/sales/leads')} className="mb-3 flex items-center gap-2 text-sm font-medium text-[#111827]">
          <ArrowLeft className="h-4 w-4" /> Back to Leads
        </button>
        <h1 className="crm-page-heading">{isEditMode ? 'Edit Lead' : 'Add Lead'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Company Name</span>
            <input name="companyName" value={form.companyName} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Contact Person</span>
            <input name="contactPerson" value={form.contactPerson} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Designation</span>
            <input name="designation" value={form.designation} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Email</span>
            <input name="email" value={form.email} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Mobile Number</span>
            <input name="mobile" value={form.mobile} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Assign To</span>
            <select name="assignedTo" value={form.assignedTo} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              <option value="">Select Employee</option>
              {employees.map((employee) => {
                const employeeName = employee.employeeName || employee.fullName || employee.email;
                return <option key={employee._id} value={employeeName}>{employeeName}</option>;
              })}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Follow-up Date</span>
            <input type="date" name="followUpDate" value={form.followUpDate} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Source Of Lead</span>
            <select name="sourceOfLead" value={form.sourceOfLead} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              <option value="Manual">Manual</option>
              <option value="Mail Campaign">Mail Campaign</option>
              <option value="Website">Website</option>
              <option value="Referral">Referral</option>
            </select>
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">Customer Requirements</span>
            <textarea name="customerRequirements" value={form.customerRequirements} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-gray-700">Remarks</span>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B]">
            <Save className="h-4 w-4" /> Submit
          </button>
          <button type="button" onClick={() => setForm(initialState)} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="button" onClick={() => navigate('/sales/leads')} className="rounded-lg border border-[#EFECE5] px-4 py-2.5 text-sm font-medium text-gray-700">Cancel</button>
        </div>
      </form>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  );
}
