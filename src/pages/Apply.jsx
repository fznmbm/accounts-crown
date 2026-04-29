import { useState } from "react";
import { supabase } from "../lib/supabase";
import { CONFIG } from "../config";

const uid = () => `${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;

function Section({ title }) {
  return (
    <div className="border-b border-gray-700 pb-1 mb-4">
      <h2 className="text-base font-bold text-white">{title}</h2>
    </div>
  );
}

function Field({ label, required, error, children, hint }) {
  return (
    <div data-error={error ? true : undefined}>
      <label className="block text-sm font-medium text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-500 mb-1">{hint}</p>}
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const EMPTY_REF = {
  name: "",
  address: "",
  phone: "",
  relationship: "",
  email: "",
};

const EMPTY = {
  positionType: "",
  fullName: "",
  email: "",
  phone: "",
  currentAddress: "",
  previousAddress: "",
  niNumber: "",
  nationality: "",
  hasUkDrivingLicence: false,
  requiresWorkPermit: false,
  workPermitNumber: "",
  hasConvictions: false,
  convictionDetails: "",
  dbsRegistered: false,
  dbsName: "",
  dbsDob: "",
  dbsCertNumber: "",
  dbsUpdateId: "",
  refs: [{ ...EMPTY_REF }, { ...EMPTY_REF }],
  declarationAgreed: false,
  declarationName: "",
  declarationDate: new Date().toISOString().split("T")[0],
};

export default function Apply() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const f = (k) => (e) => {
    const val =
      e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((p) => ({ ...p, [k]: val }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: "" }));
  };

  const updateRef = (i, k, v) => {
    setForm((p) => {
      const refs = [...p.refs];
      refs[i] = { ...refs[i], [k]: v };
      return { ...p, refs };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.positionType) e.positionType = "Please select a position";
    if (!form.fullName?.trim()) e.fullName = "Required";
    if (!form.email?.trim()) e.email = "Required";
    if (!form.phone?.trim()) e.phone = "Required";
    if (!form.currentAddress?.trim()) e.currentAddress = "Required";
    if (!form.niNumber?.trim()) e.niNumber = "Required";
    if (!form.nationality?.trim()) e.nationality = "Required";
    if (form.requiresWorkPermit && !form.workPermitNumber?.trim())
      e.workPermitNumber = "Required if work permit needed";
    if (form.hasConvictions && !form.convictionDetails?.trim())
      e.convictionDetails = "Please provide details";
    if (form.dbsRegistered) {
      if (!form.dbsName?.trim()) e.dbsName = "Required";
      if (!form.dbsDob) e.dbsDob = "Required";
      if (!form.dbsCertNumber?.trim()) e.dbsCertNumber = "Required";
    }
    form.refs.forEach((r, i) => {
      if (!r.name?.trim()) e[`ref${i}_name`] = "Required";
      if (!r.address?.trim()) e[`ref${i}_address`] = "Required";
      if (!r.phone?.trim()) e[`ref${i}_phone`] = "Required";
      if (!r.relationship?.trim()) e[`ref${i}_relationship`] = "Required";
    });
    if (!form.declarationAgreed)
      e.declarationAgreed = "You must agree to the declaration";
    if (!form.declarationName?.trim()) e.declarationName = "Required";
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      // Scroll to first error
      setTimeout(
        () =>
          document
            .querySelector("[data-error]")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        50,
      );
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const record = {
        id: uid(),
        target_user_id: CONFIG.ownerUserId,
        position_type: form.positionType,
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
        current_address: form.currentAddress,
        previous_address: form.previousAddress || null,
        ni_number: form.niNumber,
        nationality: form.nationality,
        has_uk_driving_licence: form.hasUkDrivingLicence,
        requires_work_permit: form.requiresWorkPermit,
        work_permit_number: form.workPermitNumber || null,
        work_permit_doc_url: null,
        has_convictions: form.hasConvictions,
        conviction_details: form.convictionDetails || null,
        dbs_registered: form.dbsRegistered,
        dbs_name: form.dbsName || null,
        dbs_dob: form.dbsDob || null,
        dbs_cert_number: form.dbsCertNumber || null,
        dbs_update_id: form.dbsUpdateId || null,
        applicant_refs: form.refs,
        declaration_agreed: form.declarationAgreed,
        declaration_name: form.declarationName,
        declaration_date: form.declarationDate,
        status: "pending",
        admin_notes: null,
        created_at: Date.now(),
      };
      const { error } = await supabase
        .from("staff_applications")
        .insert(record);
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        "Submission failed: " + (err.message || "Please try again."),
      );
    }
    setSubmitting(false);
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold text-white">
            Application Submitted
          </h1>
          <p className="text-gray-400">
            Thank you for applying to {CONFIG.companyName}. We have received
            your application and will be in touch shortly.
          </p>
          <p className="text-sm text-gray-500">You can close this window.</p>
        </div>
      </div>
    );
  }

  const inputCls = (errKey) =>
    `w-full px-3 py-2.5 rounded-lg bg-gray-800 border text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
      errors[errKey] ? "border-red-500" : "border-gray-600"
    }`;

  return (
    <div className="min-h-screen bg-gray-950 py-6 sm:py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white">
            {CONFIG.companyName} Application Form
          </h1>
        </div>

        {/* Position */}
        <div className="space-y-4">
          <Section title="Position" />
          <Field label="Position" required error={errors.positionType}>
            <div className="flex gap-6 mt-1">
              {["driver", "pa"].map((v) => (
                <label
                  key={v}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="positionType"
                    value={v}
                    checked={form.positionType === v}
                    onChange={f("positionType")}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className="text-sm text-gray-300 capitalize">
                    {v === "driver" ? "Driver" : "PA"}
                  </span>
                </label>
              ))}
            </div>
          </Field>
        </div>

        {/* Personal Information */}
        <div className="space-y-4">
          <Section title="Personal Information" />
          <Field label="Full Name" required error={errors.fullName}>
            <input
              className={inputCls("fullName")}
              value={form.fullName}
              onChange={f("fullName")}
              placeholder="As it appears on official documents"
            />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input
              className={inputCls("email")}
              type="email"
              value={form.email}
              onChange={f("email")}
            />
          </Field>
          <Field label="Phone Number" required error={errors.phone}>
            <input
              className={inputCls("phone")}
              type="tel"
              value={form.phone}
              onChange={f("phone")}
            />
          </Field>
          <Field label="Current Address" required error={errors.currentAddress}>
            <input
              className={inputCls("currentAddress")}
              value={form.currentAddress}
              onChange={f("currentAddress")}
            />
          </Field>
          <Field
            label="Previous Address"
            hint="If at current address for less than 5 years"
            error={errors.previousAddress}
          >
            <input
              className={inputCls("previousAddress")}
              value={form.previousAddress}
              onChange={f("previousAddress")}
            />
          </Field>
          <Field
            label="National Insurance Number"
            required
            error={errors.niNumber}
          >
            <input
              className={inputCls("niNumber")}
              value={form.niNumber}
              onChange={f("niNumber")}
              placeholder="e.g. AB 12 34 56 C"
            />
          </Field>
          <Field label="Nationality" required error={errors.nationality}>
            <input
              className={inputCls("nationality")}
              value={form.nationality}
              onChange={f("nationality")}
            />
          </Field>
        </div>

        {/* Work Eligibility */}
        <div className="space-y-4">
          <Section title="Work Eligibility" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasUkDrivingLicence}
              onChange={f("hasUkDrivingLicence")}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300">
              Do you hold a full current UK driving license?
            </span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiresWorkPermit}
              onChange={f("requiresWorkPermit")}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300">
              Do you require a permit to work in the UK?
            </span>
          </label>
          {form.requiresWorkPermit && (
            <div className="ml-7 space-y-3">
              <Field
                label="Work Permit Number"
                required
                error={errors.workPermitNumber}
              >
                <input
                  className={inputCls("workPermitNumber")}
                  value={form.workPermitNumber}
                  onChange={f("workPermitNumber")}
                />
              </Field>
            </div>
          )}
        </div>

        {/* Conviction Information */}
        <div className="space-y-4">
          <Section title="Conviction Information" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.hasConvictions}
              onChange={f("hasConvictions")}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300">
              Do you have any convictions?
            </span>
          </label>
          {form.hasConvictions && (
            <Field
              label="Please provide details"
              required
              error={errors.convictionDetails}
            >
              <textarea
                className={inputCls("convictionDetails") + " resize-none"}
                rows={3}
                value={form.convictionDetails}
                onChange={f("convictionDetails")}
                placeholder="Please give details of any convictions, cautions or pending prosecutions…"
              />
            </Field>
          )}
        </div>

        {/* DBS Information */}
        <div className="space-y-4">
          <Section title="DBS Information" />
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.dbsRegistered}
              onChange={f("dbsRegistered")}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-300">
              Are you registered with the DBS Update Service?
            </span>
          </label>
          {form.dbsRegistered && (
            <div className="ml-7 space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <Field
                label="Name (as it appears on DBS Certificate)"
                required
                error={errors.dbsName}
              >
                <input
                  className={inputCls("dbsName")}
                  value={form.dbsName}
                  onChange={f("dbsName")}
                />
              </Field>
              <Field label="Date of Birth" required error={errors.dbsDob}>
                <input
                  className={inputCls("dbsDob")}
                  type="date"
                  value={form.dbsDob}
                  onChange={f("dbsDob")}
                />
              </Field>
              <Field
                label="DBS Certificate Number"
                required
                error={errors.dbsCertNumber}
              >
                <input
                  className={inputCls("dbsCertNumber")}
                  value={form.dbsCertNumber}
                  onChange={f("dbsCertNumber")}
                />
              </Field>
              <Field label="DBS Update Service ID" error={errors.dbsUpdateId}>
                <input
                  className={inputCls("dbsUpdateId")}
                  value={form.dbsUpdateId}
                  onChange={f("dbsUpdateId")}
                />
              </Field>
            </div>
          )}
        </div>

        {/* References */}
        <div className="space-y-4">
          <Section title="References" />
          {form.refs.map((ref, i) => (
            <div
              key={i}
              className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-4"
            >
              <h3 className="text-sm font-semibold text-white">
                Reference {i + 1}
              </h3>
              <Field label="Name" required error={errors[`ref${i}_name`]}>
                <input
                  className={inputCls(`ref${i}_name`)}
                  value={ref.name}
                  onChange={(e) => updateRef(i, "name", e.target.value)}
                />
              </Field>
              <Field label="Address" required error={errors[`ref${i}_address`]}>
                <input
                  className={inputCls(`ref${i}_address`)}
                  value={ref.address}
                  onChange={(e) => updateRef(i, "address", e.target.value)}
                />
              </Field>
              <Field label="Phone" required error={errors[`ref${i}_phone`]}>
                <input
                  className={inputCls(`ref${i}_phone`)}
                  value={ref.phone}
                  onChange={(e) => updateRef(i, "phone", e.target.value)}
                />
              </Field>
              <Field
                label="Relationship to Applicant"
                required
                error={errors[`ref${i}_relationship`]}
              >
                <input
                  className={inputCls(`ref${i}_relationship`)}
                  value={ref.relationship}
                  onChange={(e) => updateRef(i, "relationship", e.target.value)}
                />
              </Field>
              <Field label="Email" error={errors[`ref${i}_email`]}>
                <input
                  className={inputCls(`ref${i}_email`)}
                  type="email"
                  value={ref.email}
                  onChange={(e) => updateRef(i, "email", e.target.value)}
                />
              </Field>
            </div>
          ))}
        </div>

        {/* Declaration */}
        <div className="space-y-4">
          <Section title="Declaration" />
          <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 text-sm text-gray-300 leading-relaxed">
            I declare that the information provided in this application is true
            and complete to the best of my knowledge. I understand that any
            false statements or omissions may result in rejection of my
            application or dismissal if employed. I authorize{" "}
            {CONFIG.companyName} to verify all information provided and conduct
            relevant background checks.
          </div>
          <label
            className="flex items-start gap-3 cursor-pointer"
            data-error={errors.declarationAgreed ? true : undefined}
          >
            <input
              type="checkbox"
              checked={form.declarationAgreed}
              onChange={f("declarationAgreed")}
              className="w-4 h-4 rounded accent-blue-500 mt-0.5 flex-shrink-0"
            />
            <span className="text-sm text-gray-300">
              I agree to the above declaration
            </span>
          </label>
          {errors.declarationAgreed && (
            <p className="text-xs text-red-400">{errors.declarationAgreed}</p>
          )}
          <Field label="Full Name" required error={errors.declarationName}>
            <input
              className={inputCls("declarationName")}
              value={form.declarationName}
              onChange={f("declarationName")}
            />
          </Field>
          <Field label="Date" required error={errors.declarationDate}>
            <input
              className={inputCls("declarationDate")}
              type="date"
              value={form.declarationDate}
              onChange={f("declarationDate")}
            />
          </Field>
        </div>

        {/* Submit */}
        {submitError && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            {submitError}
          </div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            Please fix the errors above before submitting.
          </div>
        )}

        <div className="pb-10">
          <button
            onClick={submit}
            disabled={submitting}
            className="w-full sm:w-auto sm:float-right px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors text-sm"
          >
            {submitting ? "Submitting…" : "Submit Application"}
          </button>
        </div>
      </div>
    </div>
  );
}
