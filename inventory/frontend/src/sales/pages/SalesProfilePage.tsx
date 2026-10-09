'use client'

import { useEffect, useState } from 'react'
import { Camera, Check, UserRound } from 'lucide-react'
import { fetchCurrentEmployeeProfile, updateCurrentEmployeeProfile, type EmployeeRecord } from '@/sales/lib/employeeApi'

const fieldClassName = 'mt-2 w-full rounded-lg border border-[#E7E3DA] bg-[#F8F7F3] px-3 py-2.5 text-sm text-[#1F1D1A] outline-none transition focus:border-[#B8B0A0] focus:ring-2 focus:ring-[#E7E3DA]'
const readOnlyClassName = `${fieldClassName} cursor-not-allowed text-[#6B6657]`
const toDateInput = (value?: string | null) => value ? String(value).slice(0, 10) : ''

const base = (import.meta.env.VITE_API_URL || '').replace(/\/api$/, '')

export default function SalesProfilePage() {
  const [profile, setProfile] = useState<EmployeeRecord | null>(null)
  const [contactNo, setContactNo] = useState('')
  const [dateOfJoin, setDateOfJoin] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [signature, setSignature] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const applyProfile = (employee: EmployeeRecord) => {
    setProfile(employee)
    setContactNo(employee.contactNo || employee.phone || '')
    setDateOfJoin(toDateInput(employee.dateOfJoin || employee.joiningDate))
    setDateOfBirth(toDateInput(employee.dateOfBirth))
    setSignature(employee.signature || '')
    setPhotoPreview(employee.profilePhoto
      ? /^https?:\/\//i.test(employee.profilePhoto) ? employee.profilePhoto : `${apiRoot}${employee.profilePhoto}`
      : '')
  }

  useEffect(() => {
    let isCurrent = true
    void fetchCurrentEmployeeProfile()
      .then((employee) => { if (isCurrent) applyProfile(employee) })
      .catch((loadError) => { if (isCurrent) setError(loadError instanceof Error ? loadError.message : 'Unable to load your profile.') })
      .finally(() => { if (isCurrent) setIsLoading(false) })
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    if (!photoFile) return
    const previewUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [photoFile])

  const fullName = profile?.employeeName || profile?.fullName || ''
  const profilePhotoUrl = photoPreview || (profile?.profilePhoto ? `${apiRoot}${profile.profilePhoto}` : '')

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (password && password !== confirmPassword) {
      setError('Password and confirmation do not match.')
      return
    }

    const formData = new FormData()
    formData.append('contactNo', contactNo)
    formData.append('dateOfJoin', dateOfJoin)
    formData.append('dateOfBirth', dateOfBirth)
    formData.append('signature', signature)
    formData.append('password', password)
    formData.append('confirmPassword', confirmPassword)
    if (photoFile) formData.append('profilePhoto', photoFile)

    setIsSaving(true)
    try {
      const updatedProfile = await updateCurrentEmployeeProfile(formData)
      applyProfile(updatedProfile)
      setPhotoFile(null)
      setPassword('')
      setConfirmPassword('')
      setNotice('Profile updated.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update your profile.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl py-5 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#1F1D1A] sm:text-3xl">My Profile</h1>
      </div>

      {isLoading ? <div className="rounded-xl border border-[#E7E3DA] bg-white p-6 text-sm text-[#6B6657]">Loading profile...</div> : null}
      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</div> : null}
      {notice ? <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700" role="status"><Check className="h-4 w-4" />{notice}</div> : null}
      {!isLoading && profile ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-xl border border-[#E7E3DA] bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-[#F0EEE7] bg-[#E7E3DA] text-[#6B6657]">
                {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile photo" className="h-full w-full object-cover" /> : <span className="text-3xl font-semibold">{fullName.slice(0, 2).toUpperCase() || <UserRound className="h-8 w-8" />}</span>}
              </div>
              <h2 className="mt-5 break-words text-lg font-semibold text-[#1F1D1A]">{fullName || profile.email}</h2>
              <p className="mt-1 break-all text-sm text-[#6B6657]">{profile.email}</p>
              <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#E7E3DA] bg-white px-4 py-2 text-sm font-medium text-[#1F1D1A] hover:bg-[#F8F7F3]">
                <Camera className="h-4 w-4" />
                Profile Photo
                <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => setPhotoFile(event.target.files?.[0] || null)} />
              </label>
            </div>
          </aside>

          <section className="rounded-xl border border-[#E7E3DA] bg-white shadow-sm">
            <div className="border-b border-[#EFECE5] px-5 pt-5 sm:px-7 sm:pt-6">
              <div className="border-b-2 border-[#1F1D1A] pb-3 text-sm font-semibold text-[#1F1D1A]">Personal Details</div>
            </div>

            <div className="p-5 sm:p-7">
              {!profile.canUpdate ? <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No Employee record is linked to this Admin login, so there is no Employee profile record to update.</div> : null}
              <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-[#1F1D1A]">Full Name<input value={fullName} readOnly className={readOnlyClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Contact No.<input type="tel" value={contactNo} onChange={(event) => setContactNo(event.target.value)} className={fieldClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter new password" className={fieldClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Email<input type="email" value={profile.email} readOnly className={readOnlyClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Confirm Password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className={fieldClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Date of Joining<input type="date" value={dateOfJoin} onChange={(event) => setDateOfJoin(event.target.value)} className={fieldClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A]">Date of Birth<input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} className={fieldClassName} /></label>
                <label className="block text-sm font-medium text-[#1F1D1A] sm:col-span-2">Signature<textarea rows={3} value={signature} onChange={(event) => setSignature(event.target.value)} className={fieldClassName} /></label>
              </div>

              <div className="mt-7 flex justify-end border-t border-[#EFECE5] pt-5">
                <button type="submit" disabled={isSaving || !profile.canUpdate} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1F1D1A] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2B2925] disabled:cursor-not-allowed disabled:opacity-60">
                  <UserRound className="h-4 w-4" />
                  {isSaving ? 'Updating...' : 'Update'}
                </button>
              </div>
            </div>
          </section>
        </form>
      ) : null}
    </div>
  )
}