import React, { useState } from 'react';
import { motion } from 'framer-motion';
import NavBar from '../components/NavBar';
import PageBackground from '../components/PageBackground';

const CONTACT_EMAIL = 'contact.kaushikmohite@gmail.com';
const CONTACT_PHONE = '+91 6303539703';

const BHK_OPTIONS  = ['2 BHK', '3 BHK', '4 BHK', '5 BHK / Penthouse'];
const TOWER_OPTIONS = ['Tower Aureum (A)', 'Tower Regalis (B)', 'Not decided yet'];

export default function ContactPage({ selection, onBack }) {
  const [form, setForm] = useState({
    name:    '',
    phone:   '',
    email:   '',
    tower:   selection?.tower?.name || '',
    bhk:     selection?.flat?.type  || '',
    query:   '',
  });
  const [sent, setSent] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* mailto: — opens the user's email client pre-filled.
     No backend or API key needed; works on all devices. */
  const handleSubmit = (e) => {
    e.preventDefault();

    // 1. Helper function to format your React state into strings Netlify understands
    const encode = (data) => {
      return Object.keys(data)
        .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(data[key]))
        .join("&");
    };

    // 2. Silently send the details directly to Netlify's backend processor
    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: encode({ 
        "form-name": "apartment-enquiry", 
        ...form 
      })
    })
    .then(() => {
      // 3. Once Netlify receives it safely, trigger your success state visual
      setSent(true);
    })
    .catch(error => {
      alert("There was an issue sending your enquiry. Please try again.");
      console.error("Netlify form submission error:", error);
    });
  };

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
    >
      <PageBackground src="/assets/images/bg_walkthrough.png" intensity="heavy" />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <NavBar step={6} onBack={onBack} />

        <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
          <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* ── Left: Contact info ── */}
            <motion.div
              className="flex flex-col gap-5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div>
                <p className="text-[#c49a3c] text-xs tracking-[0.35em] uppercase mb-2">Get In Touch</p>
                <h2 className="text-white text-4xl font-light" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Enquire Now
                </h2>
                <div className="w-10 h-px bg-[#c49a3c]/60 mt-3" />
              </div>

              <p className="text-white/50 text-sm leading-relaxed">
                Our sales team is ready to assist you. Fill in the form and we'll reach out within 24 hours.
              </p>

              {/* Contact cards */}
              {[
                { icon: '✉', label: 'Email Us', value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
                { icon: '📞', label: 'Call Us', value: CONTACT_PHONE, href: `tel:${CONTACT_PHONE}` },
              ].map(item => (
                <motion.a
                  key={item.label}
                  href={item.href}
                  className="glass-dark border border-white/8 rounded-xl p-4 flex items-center gap-4 hover:border-[#c49a3c]/50 transition-colors duration-300 group"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="text-white/35 text-xs uppercase tracking-wider">{item.label}</p>
                    <p className="text-white text-sm font-light group-hover:text-[#c49a3c] transition-colors">
                      {item.value}
                    </p>
                  </div>
                </motion.a>
              ))}

              {/* Selection summary */}
              {(selection?.tower || selection?.flat) && (
                <div className="glass-dark rounded-xl p-4 border border-[#c49a3c]/20">
                  <p className="text-[#c49a3c] text-xs tracking-widest uppercase mb-2">Your Selection</p>
                  {selection.tower && <p className="text-white/60 text-sm">🏗 {selection.tower.name}</p>}
                  {selection.floor  && <p className="text-white/60 text-sm">📐 Floor {selection.floor}</p>}
                  {selection.flat   && <p className="text-white/60 text-sm">🏠 Unit {selection.flat.unit} · {selection.flat.type}</p>}
                </div>
              )}
            </motion.div>

            {/* ── Right: Form ── */}
            <motion.div
              className="glass-dark rounded-2xl border border-white/8 p-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              {sent ? (
                <motion.div
                  className="flex flex-col items-center justify-center h-full gap-4 text-center py-8"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div className="w-16 h-16 rounded-full border-2 border-[#c49a3c] flex items-center justify-center text-3xl">
                    ✓
                  </div>
                  <p className="text-[#c49a3c] text-sm tracking-widest uppercase">Email Opened</p>
                  <p className="text-white/50 text-sm">
                    Your email client has been opened with the enquiry pre-filled. Just hit Send!
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="mt-2 text-white/30 text-xs tracking-widest uppercase hover:text-white/60 transition-colors"
                  >
                    Send Another
                  </button>
                </motion.div>
              ) : (
                <form  name="apartment-enquiry" 
                      method="POST" 
                      data-netlify="true" 
                      onSubmit={handleSubmit} 
                      className="flex flex-col gap-4"
                    >
                      {/* Add this hidden input right here */}
                      <input type="hidden" name="form-name" value="apartment-enquiry" />
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Send Enquiry</p>

                  {/* Name + Phone */}
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Full Name *" value={form.name} onChange={v => set('name', v)} required />
                    <Field label="Phone *" value={form.phone} onChange={v => set('phone', v)} type="tel" required />
                  </div>

                  <Field label="Your Email" value={form.email} onChange={v => set('email', v)} type="email" />

                  {/* Tower + BHK */}
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Tower" value={form.tower} onChange={v => set('tower', v)} options={TOWER_OPTIONS} />
                    <SelectField label="Type"  value={form.bhk}   onChange={v => set('bhk', v)}   options={BHK_OPTIONS}   />
                  </div>

                  <Field label="Your Query" value={form.query} onChange={v => set('query', v)} multiline />

                  <motion.button
                    type="submit"
                    disabled={!form.name || !form.phone}
                    className="w-full py-3.5 bg-[#c49a3c] text-black text-sm tracking-[0.2em] uppercase font-semibold rounded-lg hover:bg-[#d4af6e] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 relative overflow-hidden group mt-1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative">Send Enquiry →</span>
                  </motion.button>

                  <p className="text-white/20 text-[10px] text-center">
                    Opens your email app pre-filled · No account needed
                  </p>
                </form>
              )}
            </motion.div>

          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Small reusable input ── */
function Field({ label, value, onChange, type = 'text', required, multiline }) {
  const base = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    padding: '8px 12px',
    transition: 'border-color 0.2s',
  };
  return (
    <div className="flex flex-col gap-1">
      <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {label}
      </label>
      {multiline
        ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)}
            style={{ ...base, resize: 'none' }}
            onFocus={e => e.target.style.borderColor = '#c49a3c'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
        : <input type={type} value={value} onChange={e => onChange(e.target.value)} required={required}
            style={base}
            onFocus={e => e.target.style.borderColor = '#c49a3c'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
      }
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {label}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, color: value ? '#fff' : 'rgba(255,255,255,0.3)',
          fontSize: 13, width: '100%', padding: '8px 12px', outline: 'none',
        }}
      >
        <option value="" style={{ background: '#111' }}>Select…</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#111' }}>{o}</option>)}
      </select>
    </div>
  );
}
