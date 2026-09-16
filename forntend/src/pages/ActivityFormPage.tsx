import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { Toast } from '@/components/toast';
import { createActivity, fetchActivityById, updateActivity } from '@/lib/activityApi';
import { fetchCustomers, type CustomerApiRecord } from '@/lib/customerApi';
import { fetchProductsForSuppliers } from '@/lib/supplierApi';

const activityTypeOptions = ['Meeting', 'Call', 'Email', 'Demo', 'Site Visit', 'Follow-up', 'Support', 'Other'];
const responseOptions = ['Positive', 'Negative', 'Pending', 'No Response'];
const followUpOptions = ['Required', 'Not Required', 'Completed', 'Pending'];
const sourceOfLeadOptions = ['Website', 'Manual', 'Referral', 'Campaign', 'LinkedIn', 'Facebook', 'Instagram', 'Email Campaign', 'Cold Call', 'Other'];
const tagResourceOptions = ['Admin', 'Anaya Patel', 'Rahul Sharma', 'Rhea Shah', 'Maya Nair', 'System'];

const initialState = {
  customerName: '',
  contactPerson: '',
  designation: '',
  email: '',
  mobileNo: '',
  activityType: '',
  activityDate: new Date().toISOString().slice(0, 10),
  followUpDate: '',
  location: '',
  response: 'Pending',
  followUp: 'Required',
  tagResource: '',
  sourceOfLead: 'Manual',
  product: '',
  customerRequirements: '',
  customerRemarks: '',
  assignedUser: 'Admin',
  company: '',
  priority: 'Medium',
  campaign: '',
  leadId: '',
  leadIdLabel: '',
  createdBy: 'Admin',
  lastModifiedBy: 'Admin',
  status: 'Open',
};

export default function ActivityFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState(initialState);
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lead = (location.state as { lead?: any; activity?: any } | null)?.lead ?? null;
  const passedActivity = (location.state as { activity?: any } | null)?.activity ?? null;

  useEffect(() => {
    const loadLookupData = async () => {
      try {
        const customerResponse = await fetchCustomers({ limit: 300 });
        setCustomers(customerResponse.data ?? []);
      } catch {
        setCustomers([]);
      }

      try {
        const productOptions = await fetchProductsForSuppliers();
        setProducts(productOptions);
      } catch {
        setProducts([]);
      }
    };

    void loadLookupData();
  }, []);

  useEffect(() => {
    if (lead) {
      setForm((prev) => ({
        ...prev,
        customerName: lead.companyName || '',
        company: lead.companyName || '',
        contactPerson: lead.contactPerson || '',
        designation: lead.designation || '',
        email: lead.email || '',
        mobileNo: lead.mobile || '',
        sourceOfLead: lead.sourceOfLead || 'Manual',
        customerRequirements: lead.customerRequirements || '',
        customerRemarks: lead.remarks || '',
        assignedUser: lead.assignedTo || 'Admin',
        campaign: lead.campaignName || '',
        priority: lead.priority || 'Medium',
        leadId: lead.leadId || lead._id || '',
        leadIdLabel: lead.leadId || lead._id || '',
      }));
    }
  }, [lead]);

  useEffect(() => {
    if (!isEditMode || !id) return;

    const loadActivity = async () => {
      try {
        const response = await fetchActivityById(id);
        const activity = response?.data ?? null;
        if (!activity) return;
        setForm({
          customerName: activity.customerName || '',
          contactPerson: activity.contactPerson || '',
          designation: activity.designation || '',
          email: activity.email || '',
          mobileNo: activity.mobileNo || '',
          activityType: activity.activityType || '',
          activityDate: activity.activityDate || new Date().toISOString().slice(0, 10),
          followUpDate: activity.followUpDate || '',
          location: activity.location || '',
          response: activity.response || 'Pending',
          followUp: activity.followUp || 'Required',
          tagResource: activity.tagResource || '',
          sourceOfLead: activity.sourceOfLead || 'Manual',
          product: activity.product || '',
          customerRequirements: activity.customerRequirements || '',
          customerRemarks: activity.customerRemarks || '',
          assignedUser: activity.assignedUser || 'Admin',
          company: activity.company || '',
          priority: activity.priority || 'Medium',
          campaign: activity.campaign || '',
          leadId: activity.leadId || '',
          leadIdLabel: activity.leadIdLabel || '',
          createdBy: activity.createdBy || 'Admin',
          lastModifiedBy: activity.lastModifiedBy || 'Admin',
          status: activity.status || 'Open',
        });
      } catch {
        setToast('Unable to load activity details');
      }
    };

    void loadActivity();
  }, [id, isEditMode]);

  useEffect(() => {
    if (passedActivity) {
      setForm((prev) => ({ ...prev, ...passedActivity }));
    }
  }, [passedActivity]);

  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    customers.forEach((customer) => {
      const name = customer.companyName || customer.customerName || '';
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [customers]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerSelect = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const normalizedValue = event.target.value;
    setForm((prev) => ({ ...prev, customerName: normalizedValue }));

    const customer = customers.find((item) => (item.companyName || item.customerName || '') === normalizedValue);
    if (!customer) return;

    const primaryContact = customer.contacts?.[0];
    setForm((prev) => ({
      ...prev,
      company: customer.companyName || customer.customerName || '',
      customerName: normalizedValue,
      contactPerson: primaryContact?.name || '',
      designation: primaryContact?.designation || '',
      email: primaryContact?.email || customer.email || '',
      mobileNo: primaryContact?.phone || customer.phone || '',
      assignedUser: customer.createdBy || prev.assignedUser,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.customerName.trim() || !form.activityType.trim() || !form.activityDate || !form.product.trim()) {
      setToast('Customer / Partner Name, Activity Type, Activity Date, and Product are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        customerName: form.customerName.trim(),
        company: form.company || form.customerName || '',
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        mobileNo: form.mobileNo.trim(),
        createdBy: form.createdBy || 'Admin',
        lastModifiedBy: form.lastModifiedBy || 'Admin',
      };

      const response = isEditMode && id
        ? await updateActivity(id, payload)
        : await createActivity(payload);

      if (!response.success) {
        setToast(response.message || 'Unable to save activity');
        return;
      }

      setToast('Activity created successfully.');
      navigate('/sales/activities', {
        state: {
          message: 'Activity created successfully.',
          refresh: true,
        },
      });
    } catch (error: any) {
      setToast(error?.response?.data?.message || 'Unable to save activity');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
          <button onClick={() => navigate('/sales/activities')} className="mb-3 flex items-center gap-2 text-sm font-medium text-[#111827]">
          <ArrowLeft className="h-4 w-4" /> Back to Activities
        </button>
        <h1 className="crm-page-heading">{isEditMode ? 'Edit Activity' : 'Add Activity'}</h1>
        {/* <p className="text-sm text-gray-600">Create and track activity records for customers, partners, and leads.</p> */}
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Customer / Partner Name *</span>
            <input list="customer-options" value={form.customerName} onChange={handleCustomerSelect} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
            <datalist id="customer-options">
              {customerOptions.map((name) => <option key={name} value={name} />)}
            </datalist>
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
            <span className="text-sm font-semibold text-gray-700">Mobile No</span>
            <input name="mobileNo" value={form.mobileNo} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Activity Type *</span>
            <select name="activityType" value={form.activityType} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              <option value="">Select</option>
              {activityTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Activity Date *</span>
            <input type="date" name="activityDate" value={form.activityDate} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Follow-up Date</span>
            <input type="date" name="followUpDate" value={form.followUpDate} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Location</span>
            <input name="location" value={form.location} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Response</span>
            <select name="response" value={form.response} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {responseOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Follow Up</span>
            <select name="followUp" value={form.followUp} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {followUpOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Tag Resource</span>
            <input list="tag-resource-options" name="tagResource" value={form.tagResource} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
            <datalist id="tag-resource-options">
              {tagResourceOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Source Of Lead</span>
            <select name="sourceOfLead" value={form.sourceOfLead} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {sourceOfLeadOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Product *</span>
            <select name="product" value={form.product} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              <option value="">Select</option>
              {products.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>

          <label className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-semibold text-gray-700">Customer Requirements</span>
            <textarea name="customerRequirements" value={form.customerRequirements} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-semibold text-gray-700">Customer Remarks</span>
            <textarea name="customerRemarks" value={form.customerRemarks} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B] disabled:opacity-70">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Submit'}
          </button>
          <button type="button" onClick={() => setForm(initialState)} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </form>

      {toast && <Toast message={toast} type="info" onClose={() => setToast(null)} />}
    </div>
  );
}
