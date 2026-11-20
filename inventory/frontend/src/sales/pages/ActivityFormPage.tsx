import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';
import { Toast } from '@/sales/components/toast';
import { checkActivityCompany, createActivity, fetchActivityById, updateActivity } from '@/sales/lib/activityApi';
import { fetchCustomers, type CustomerApiRecord } from '@/sales/lib/customerApi';
import { fetchEmployees, type EmployeeRecord } from '@/sales/lib/employeeApi';
import { fetchProductsForSuppliers } from '@/sales/lib/supplierApi';
import { PHONE_ERROR_MESSAGE, isValidPhoneNumber, sanitizePhoneInput } from '@/sales/lib/phone';
import { getStoredAuth } from '@/sales/lib/auth';

const activityTypeOptions = ['Meeting', 'Call', 'Email', 'Demo', 'Site Visit', 'Follow-up', 'Support', 'Other'];
const statusOptions = ['Open', 'Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show', 'Completed', 'Cancelled'];
const responseOptions = ['Positive', 'Negative', 'Pending', 'No Response'];
const followUpOptions = ['Required', 'Not Required', 'Completed', 'Pending'];
const sourceOfLeadOptions = ['Website', 'Manual', 'Referral', 'Campaign', 'LinkedIn', 'Facebook', 'Instagram', 'Email Campaign', 'Cold Call', 'Other'];
const tagResourceOptions = ['Admin', 'Anaya Patel', 'Rahul Sharma', 'Rhea Shah', 'Maya Nair', 'System'];
type RequiredFieldName = 'assignedUserId' | 'customerName' | 'activityType' | 'activityDate' | 'product';
type RequiredFieldErrors = Partial<Record<RequiredFieldName, string>>;

const getTodayInKolkata = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
};

const initialState = {
  customerName: '',
  contactPerson: '',
  designation: '',
  email: '',
  mobileNo: '',
  activityType: '',
  activityDate: getTodayInKolkata(),
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
  assignedUserId: '',
  company: '',
  priority: 'Medium',
  campaign: '',
  leadId: '',
  leadIdLabel: '',
  createdBy: 'Admin',
  lastModifiedBy: 'Admin',
  status: 'Open',
};

const createInitialState = () => ({
  ...initialState,
  createdBy: getStoredAuth()?.user.name || 'Admin',
  lastModifiedBy: getStoredAuth()?.user.name || 'Admin',
});

export default function ActivityFormPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditMode = Boolean(id);
  const [form, setForm] = useState(createInitialState);
  const [customers, setCustomers] = useState<CustomerApiRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeesError, setEmployeesError] = useState('');
  const [products, setProducts] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('info');
  const [requiredFieldErrors, setRequiredFieldErrors] = useState<RequiredFieldErrors>({});
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);
  const customerNameRef = useRef<HTMLInputElement>(null);
  const assignedUserRef = useRef<HTMLSelectElement>(null);
  const activityTypeRef = useRef<HTMLSelectElement>(null);
  const activityDateRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLSelectElement>(null);
  const isCompletedReadOnly = isEditMode
    && form.status === 'Completed'
    && getStoredAuth()?.user.role !== 'admin';
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

      try {
        const employeeResponse = await fetchEmployees({ limit: 1000, status: 'Active', department: 'Sales' });
        setEmployees(employeeResponse.data || []);
        setEmployeesError('');
      } catch {
        setEmployees([]);
        setEmployeesError('Unable to load active Sales employees. Please try again.');
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
        assignedUserId: lead.assignedToId || '',
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
          activityDate: activity.activityDate || getTodayInKolkata(),
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
          assignedUserId: activity.assignedUserId || '',
          company: activity.company || '',
          priority: activity.priority || 'Medium',
          campaign: activity.campaign || '',
          leadId: activity.leadId || '',
          leadIdLabel: activity.leadIdLabel || '',
          createdBy: activity.createdBy || 'Admin',
          lastModifiedBy: activity.lastModifiedBy || 'Admin',
          status: ['Pending', 'Overdue'].includes(activity.status) ? 'Open' : activity.status || 'Open',
        });
      } catch {
        setToast('Unable to load activity details');
      }
    };

    void loadActivity();
  }, [id, isEditMode]);

  useEffect(() => {
    if (form.assignedUserId || !form.assignedUser) return;
    const assignedEmployee = employees.find((employee) =>
      (employee.employeeName || employee.fullName || employee.email).toLowerCase()
        === form.assignedUser.toLowerCase(),
    );
    if (assignedEmployee) {
      setForm((previous) => ({ ...previous, assignedUserId: assignedEmployee._id }));
    }
  }, [employees, form.assignedUser, form.assignedUserId]);

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
    if (name === 'assignedUserId') {
      const employee = employees.find((item) => item._id === value);
      setForm((previous) => ({
        ...previous,
        assignedUserId: value,
        assignedUser: employee?.employeeName || employee?.fullName || employee?.email || '',
      }));
      if (value) setRequiredFieldErrors((previous) => ({ ...previous, assignedUserId: undefined }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
    if (['customerName', 'activityType', 'activityDate', 'product'].includes(name) && value.trim()) {
      setRequiredFieldErrors((previous) => ({ ...previous, [name]: undefined }));
    }
  };

  const handleCustomerSelect = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const normalizedValue = event.target.value;
    setForm((prev) => ({ ...prev, customerName: normalizedValue, company: normalizedValue }));
    if (normalizedValue.trim()) {
      setRequiredFieldErrors((previous) => ({ ...previous, customerName: undefined }));
    }

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
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submittingRef.current) return;

    const errors: RequiredFieldErrors = {};
    if (!form.assignedUserId) errors.assignedUserId = 'Please select an employee.';
    if (!form.customerName.trim()) errors.customerName = 'Please fill this field.';
    if (!form.activityType.trim()) errors.activityType = 'Please select an activity type.';
    if (!form.activityDate) errors.activityDate = 'Please select an activity date.';
    if (!form.product.trim()) errors.product = 'Please select a product.';
    setRequiredFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstInvalidField = (Object.keys(errors) as RequiredFieldName[])[0];
      const fieldRefs = {
        assignedUserId: assignedUserRef,
        customerName: customerNameRef,
        activityType: activityTypeRef,
        activityDate: activityDateRef,
        product: productRef,
      };
      fieldRefs[firstInvalidField].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fieldRefs[firstInvalidField].current?.focus({ preventScroll: true });
      return;
    }
    if (['Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show'].includes(form.status) && !form.followUpDate) {
      setToast(`${form.status} requires a Follow-Up Date.`);
      setToastType('error');
      return;
    }
    if (['Rescheduled / No-Show', 'Cancelled'].includes(form.status) && !form.customerRemarks.trim()) {
      setToast(`${form.status} requires a reason in Remarks.`);
      setToastType('error');
      return;
    }
    if (form.mobileNo.trim() && !isValidPhoneNumber(form.mobileNo)) {
      setToast(PHONE_ERROR_MESSAGE);
      setToastType('error');
      return;
    }

    submittingRef.current = true;
    setSaving(true);
    setToast(null);
    try {
      const { createdBy: _createdBy, ...activityFields } = form;
      const payload = {
        ...activityFields,
        customerName: form.customerName.trim(),
        company: (form.company || form.customerName).trim(),
        contactPerson: form.contactPerson.trim(),
        email: form.email.trim(),
        mobileNo: form.mobileNo.trim(),
        assignedUserId: form.assignedUserId,
        assignedUser: form.assignedUser,
        lastModifiedBy: form.lastModifiedBy || 'Admin',
      };

      if (!isEditMode) {
        const duplicateCheck = await checkActivityCompany(payload.company);
        if (duplicateCheck.exists) {
          setToast('This company already exists.');
          setToastType('error');
          return;
        }
      }

      const response = isEditMode && id
        ? await updateActivity(id, payload)
        : await createActivity(payload);

      if (!response.success) {
        setToast(response.message || 'Unable to save activity');
        setToastType('error');
        return;
      }

      const message = isEditMode ? 'Activity updated successfully.' : 'Activity created successfully.';
      navigate('/sales/activities', {
        state: {
          message,
          refresh: true,
          toastType: 'success',
        },
      });
    } catch (error: any) {
      setToast(error?.response?.data?.message || 'Unable to save activity');
      setToastType('error');
    } finally {
      submittingRef.current = false;
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
        {isCompletedReadOnly ? <p role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">This activity is completed and locked. Only an administrator can reopen or modify it.</p> : null}
        <fieldset disabled={isCompletedReadOnly} className="contents">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Assigned To <span className="required-asterisk">*</span></span>
            <select ref={assignedUserRef} name="assignedUserId" value={form.assignedUserId} onChange={handleChange} aria-invalid={Boolean(requiredFieldErrors.assignedUserId)} className={`w-full rounded-lg border px-3 py-2.5 text-sm ${requiredFieldErrors.assignedUserId ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200' : 'border-[#EFECE5]'}`}>
              <option value="">Select Sales employee</option>
              {form.assignedUserId && !employees.some((employee) => employee._id === form.assignedUserId)
                ? <option value={form.assignedUserId}>{form.assignedUser || 'Previously assigned employee'}</option>
                : null}
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>{employee.employeeName || employee.fullName || employee.email}</option>
              ))}
            </select>
            {requiredFieldErrors.assignedUserId ? <span role="alert" className="block text-xs text-red-600">{requiredFieldErrors.assignedUserId}</span> : null}
            {employeesError ? <span role="alert" className="block text-xs text-red-600">{employeesError}</span> : null}
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Customer / Partner Name <span className="required-asterisk">*</span></span>
            <input ref={customerNameRef} name="customerName" list="customer-options" value={form.customerName} onChange={handleCustomerSelect} aria-invalid={Boolean(requiredFieldErrors.customerName)} className={`w-full rounded-lg border px-3 py-2.5 text-sm ${requiredFieldErrors.customerName ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200' : 'border-[#EFECE5]'}`} />
            <datalist id="customer-options">
              {customerOptions.map((name) => <option key={name} value={name} />)}
            </datalist>
            {requiredFieldErrors.customerName ? <span role="alert" className="block text-xs text-red-600">{requiredFieldErrors.customerName}</span> : null}
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
            <input name="mobileNo" value={form.mobileNo} onChange={(event) => setForm((prev) => ({ ...prev, mobileNo: sanitizePhoneInput(event.target.value) }))} inputMode="numeric" maxLength={10} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Activity Type <span className="required-asterisk">*</span></span>
            <select ref={activityTypeRef} name="activityType" value={form.activityType} onChange={handleChange} aria-invalid={Boolean(requiredFieldErrors.activityType)} className={`w-full rounded-lg border px-3 py-2.5 text-sm ${requiredFieldErrors.activityType ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200' : 'border-[#EFECE5]'}`}>
              <option value="">Select</option>
              {activityTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {requiredFieldErrors.activityType ? <span role="alert" className="block text-xs text-red-600">{requiredFieldErrors.activityType}</span> : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Activity Date <span className="required-asterisk">*</span></span>
            <input ref={activityDateRef} type="date" name="activityDate" value={form.activityDate} onChange={handleChange} aria-invalid={Boolean(requiredFieldErrors.activityDate)} className={`w-full rounded-lg border px-3 py-2.5 text-sm ${requiredFieldErrors.activityDate ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200' : 'border-[#EFECE5]'}`} />
            {requiredFieldErrors.activityDate ? <span role="alert" className="block text-xs text-red-600">{requiredFieldErrors.activityDate}</span> : null}
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Follow-up Date{['Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show'].includes(form.status) ? <span className="required-asterisk"> *</span> : null}</span>
            <input type="date" name="followUpDate" value={form.followUpDate} onChange={handleChange} required={['Follow-Up Required', 'Awaiting Client', 'Rescheduled / No-Show'].includes(form.status)} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-gray-700">Activity Status <span className="required-asterisk">*</span></span>
            <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm">
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
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
            <span className="text-sm font-semibold text-gray-700">Product <span className="required-asterisk">*</span></span>
            <select ref={productRef} name="product" value={form.product} onChange={handleChange} aria-invalid={Boolean(requiredFieldErrors.product)} className={`w-full rounded-lg border px-3 py-2.5 text-sm ${requiredFieldErrors.product ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200' : 'border-[#EFECE5]'}`}>
              <option value="">Select</option>
              {products.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            {requiredFieldErrors.product ? <span role="alert" className="block text-xs text-red-600">{requiredFieldErrors.product}</span> : null}
          </label>

          <label className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-semibold text-gray-700">Customer Requirements</span>
            <textarea name="customerRequirements" value={form.customerRequirements} onChange={handleChange} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>

          <label className="space-y-2 md:col-span-2 xl:col-span-3">
            <span className="text-sm font-semibold text-gray-700">Customer Remarks{['Rescheduled / No-Show', 'Cancelled'].includes(form.status) ? <span className="required-asterisk"> *</span> : null}</span>
            <textarea name="customerRemarks" value={form.customerRemarks} onChange={handleChange} required={['Rescheduled / No-Show', 'Cancelled'].includes(form.status)} rows={3} className="w-full rounded-lg border border-[#EFECE5] px-3 py-2.5 text-sm" />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1E293B] disabled:opacity-70">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Submit'}
          </button>
          <button type="button" onClick={() => setForm(createInitialState())} className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#F2EFE8] px-4 py-2.5 text-sm font-medium text-gray-700">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
        </fieldset>
      </form>

      {toast && <Toast message={toast} type={toastType} onClose={() => setToast(null)} />}
    </div>
  );
}
