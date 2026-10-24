import React, { useState } from 'react';
import {
  BookOpen,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ShieldAlert,
  Wrench,
  Radio,
  Terminal,
  Layers,
  Eye,
  Check,
  Copy,
} from 'lucide-react';
import eegPlacementImg from '../assets/eeg_placement.jpg';

export const InstructionsPanel: React.FC = () => {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string>('diagram');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#07090D] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-8 select-text">
      {/* 1. Header & Navigation Hub */}
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1C2331]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <BookOpen className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Hardware Setup & Electrode Instructions
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/40 text-cyan-300 font-mono font-medium">
                  BioAmp EXG Pill
                </span>
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Official guide for assembling, wiring, and placing the 3-lead prefrontal EEG brain-computer interface
              for Project KAI.
            </p>
          </div>

          {/* Quick Hardware Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F141E] border border-cyan-500/30 text-cyan-300 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Arduino Uno R4 Minima</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F141E] border border-purple-500/30 text-purple-300 text-xs font-mono">
              <Radio className="w-3.5 h-3.5 text-purple-400" />
              <span>512 Hz @ 12-bit ADC</span>
            </div>
          </div>
        </div>

        {/* Quick Jump Navigation Bar */}
        <div className="flex flex-wrap gap-2 pt-1 pb-2">
          {[
            { id: 'diagram', label: 'Electrode Diagram', icon: Eye },
            { id: 'components', label: 'Required Components', icon: Layers },
            { id: 'placement', label: 'Electrode Placement', icon: Activity },
            { id: 'wiring', label: 'Hardware Wiring', icon: Zap },
            { id: 'software', label: 'Software Setup', icon: Terminal },
            { id: 'troubleshooting', label: 'Troubleshooting', icon: Wrench },
            { id: 'safety', label: 'Safety & Limits', icon: ShieldAlert },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'bg-[#10141B] hover:bg-[#161D28] text-slate-400 hover:text-slate-200 border border-[#1C2331]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Visual Electrode Placement Diagram Showcase */}
      <section id="diagram" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-cyan-500/30 rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.6)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                Visual Reference: 3-Lead BioAmp EEG Montage
              </h2>
            </div>
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified Frontal-Mastoid Differential Montage
            </span>
          </div>

          {/* Prominent High-Resolution Image Container */}
          <div className="relative w-full rounded-xl overflow-hidden bg-[#05070B] border border-[#1C2331] flex items-center justify-center p-2 sm:p-4">
            <img
              src={eegPlacementImg}
              alt="Electrode placement for EEG Electroencephalography using BioAmp EXG Pill"
              className="w-full max-w-4xl max-h-[540px] h-auto object-contain rounded-lg shadow-2xl transition duration-300"
            />
          </div>

          {/* Diagram Key Callouts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="p-3 rounded-xl bg-[#090C12] border border-red-500/30 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-red-400 font-mono">IN+ (Red Lead)</span>
                <p className="text-[11px] text-slate-300">
                  Active Positive Input: Placed directly at the <strong>center of the forehead (Fpz)</strong>.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#090C12] border border-slate-700 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-slate-200 mt-1 shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-200 font-mono">IN− (Black Lead)</span>
                <p className="text-[11px] text-slate-300">
                  Reference Input: Placed on the <strong>left earlobe or left mastoid</strong> bone.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#090C12] border border-yellow-500/30 flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-yellow-400 mt-1 shrink-0 shadow-[0_0_8px_rgba(234,179,8,0.8)]" />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-yellow-400 font-mono">REF (Yellow Lead)</span>
                <p className="text-[11px] text-slate-300">
                  Ground Reference: Placed on the <strong>right earlobe or right mastoid</strong> bone.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Required Components */}
      <section id="components" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-[#1C2331] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Layers className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              1. Required Hardware Components
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            All components listed below are verified against the physical build and repository implementation in{' '}
            <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono text-xs">
              arduino_code.ino
            </code>{' '}
            and{' '}
            <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded font-mono text-xs">
              web_bridge.py
            </code>
            .
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-[#090C12] text-slate-400 font-mono">
                  <th className="py-2.5 px-3">Component</th>
                  <th className="py-2.5 px-3">Specification / Model</th>
                  <th className="py-2.5 px-3">Role in Project KAI</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">Arduino Uno R4 Minima</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">32-bit RA4M1 ARM Cortex-M4, 48 MHz</td>
                  <td className="py-2.5 px-3">
                    Configures 12-bit ADC (<code className="text-cyan-300">analogReadResolution(12)</code>) and sample
                    timing at exact 512 Hz (<code className="text-cyan-300">1953 µs</code> interval).
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified in Firmware
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">BioAmp EXG Pill</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">Upside Down Labs (v1.0 or v1.0b)</td>
                  <td className="py-2.5 px-3">
                    Analog front-end instrumentation amplifier. Provides bandpass filtering (0.5–44 Hz) and 242x gain
                    for microvolt biopotentials.
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">Biomedical Electrodes</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">Standard Ag/AgCl Gel Adhesive or Ear Clips</td>
                  <td className="py-2.5 px-3">
                    3 electrodes required: 1x active forehead electrode, 2x earlobe reference/ground clips.
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">BioAmp Electrode Cable</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">3-wire snap lead cable (JST to Snap)</td>
                  <td className="py-2.5 px-3">
                    Connects snap electrodes to the BioAmp EXG Pill input header (Red: IN+, Black: IN−, Yellow: REF).
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">USB-C Data Cable</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">USB Type-C to Type-A (or Type-C)</td>
                  <td className="py-2.5 px-3">
                    Powers the Arduino and provides 115,200 baud USB serial CDC communication to the host computer.
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">Jumper Wires</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">3x Female-to-Male (or Male-to-Male)</td>
                  <td className="py-2.5 px-3">
                    Connects BioAmp EXG Pill pins (<code className="text-cyan-300">VCC, GND, OUT</code>) to Arduino
                    headers (<code className="text-cyan-300">5V, GND, A0</code>).
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 font-mono text-[10px]">
                      Verified
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-900/40">
                  <td className="py-2.5 px-3 font-semibold text-white">Skin Prep Wipes</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400">70% Isopropyl Alcohol pads</td>
                  <td className="py-2.5 px-3">
                    Degreases forehead and earlobes prior to electrode adhesion to lower skin-electrode impedance.
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono text-[10px]">
                      Recommended
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 4. Electrode Placement & Skin Preparation */}
      <section id="placement" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-[#1C2331] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              2. Electrode Placement & Skin Preparation
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Step-by-Step Placement Guide */}
            <div className="space-y-3 bg-[#090C12] p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider">
                Step-by-Step Placement Routine
              </h3>
              <ol className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    <strong>Clean Skin Thoroughly:</strong> Use an alcohol swab to vigorously scrub the forehead center
                    (Fpz) and both earlobes for 10 seconds. Remove all oil, moisture, and dead skin.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                    2
                  </span>
                  <span>
                    <strong>Allow to Dry:</strong> Wait 20–30 seconds for the alcohol to completely evaporate. Do not
                    apply electrodes to wet alcohol as it degrades gel conductivity.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                    3
                  </span>
                  <span>
                    <strong>Place IN+ (Red):</strong> Peel the adhesive backing from an electrode and place it firmly in
                    the <strong>center of the forehead</strong>, approximately 1.5 cm above the bridge of the nose.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                    4
                  </span>
                  <span>
                    <strong>Place IN− (Black):</strong> Attach an electrode or snap ear-clip to the{' '}
                    <strong>left earlobe</strong> (or the bony mastoid area immediately behind the left ear).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-950 border border-cyan-800/60 text-cyan-300 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                    5
                  </span>
                  <span>
                    <strong>Place REF (Yellow):</strong> Attach an electrode or snap ear-clip to the{' '}
                    <strong>right earlobe</strong> (or right mastoid bone). This provides the common-mode ground
                    reference.
                  </span>
                </li>
              </ol>
            </div>

            {/* Crucial Scientific Distinction */}
            <div className="space-y-3 bg-[#090C12] p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-amber-300 font-mono uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Illustrated Montage vs. Medical Standard
              </h3>

              <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-white">Why the Illustrated Montage Works:</strong> By referencing the
                  forehead (Fpz) against the earlobe (A1/A2), the BioAmp EXG Pill measures the potential difference
                  between active prefrontal cortical neurons and an electrically quiet reference site, capturing clean
                  Theta, Alpha, and Beta wave dynamics.
                </p>

                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-200">
                  <strong className="text-rose-300 block mb-0.5">Why the "Old Placement" Failed (Crossed Out):</strong>
                  Placing both electrodes on the forehead captures muscle tension from the frontalis muscle and ocular
                  corneoretinal dipoles (eye blinks) rather than genuine brainwaves, causing severe saturation.
                </div>

                <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40 text-blue-200">
                  <strong className="text-blue-300 block mb-0.5">Distinction from Clinical Medical EEGs:</strong>
                  Medical diagnostic EEG systems follow the full <strong>10–20 or 10–10 International System</strong>{' '}
                  with 19–64+ channels across frontal, central, temporal, parietal, and occipital lobes with contact
                  impedance verified &lt; 5 kΩ. This single-channel setup is for <strong>affective biofeedback</strong>,
                  not neurological diagnosis.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Hardware Connections & Wiring */}
      <section id="wiring" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-[#1C2331] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm sm:text-base font-semibold text-slate-100">
                3. Hardware Wiring & Pin Connections
              </h2>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">100% Verified in Source Code</span>
          </div>

          <p className="text-xs sm:text-sm text-slate-300">
            Connect the BioAmp EXG Pill pins to the Arduino Uno R4 Minima according to the verified table below.
            <strong className="text-amber-300"> Never invent wiring or guess pins.</strong>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wiring Table */}
            <div className="overflow-x-auto bg-[#090C12] rounded-xl border border-slate-800 p-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-mono">
                    <th className="py-2.5 px-3">BioAmp EXG Pin</th>
                    <th className="py-2.5 px-3">Arduino Pin</th>
                    <th className="py-2.5 px-3">Function</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 text-red-400 font-bold">VCC</td>
                    <td className="py-2.5 px-3 text-red-300 font-bold">5V (or 3.3V)</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">Regulated DC Power</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-slate-400 font-bold">GND</td>
                    <td className="py-2.5 px-3 text-slate-300 font-bold">GND</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">System Ground Reference</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-cyan-400 font-bold">OUT</td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">A0 (Analog In)</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400">Amplified EEG Voltage Signal</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Code Verification Snippet */}
            <div className="bg-[#090C12] rounded-xl border border-slate-800 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">
                  Firmware Verification:{' '}
                  <span className="text-cyan-300 font-semibold">KAI-Counselor-main/arduino_code.ino</span>
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `/* Project KAI: High-Precision 512 Hz EEG Sampler */\nconst unsigned long SAMPLE_INTERVAL_US = 1953; // ~512 Hz\n\nvoid setup() {\n  Serial.begin(115200);\n  analogReadResolution(12); // 12-bit ADC (0 - 4095)\n}\n\nvoid loop() {\n  unsigned long currentMicros = micros();\n  if (currentMicros - lastSampleTime >= SAMPLE_INTERVAL_US) {\n    lastSampleTime += SAMPLE_INTERVAL_US;\n    int eegValue = analogRead(A0); // Read BioAmp on pin A0\n    Serial.println(eegValue);\n  }\n}`,
                      'ino_code'
                    )
                  }
                  className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {copiedCode === 'ino_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode === 'ino_code' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre className="bg-[#05070B] p-3 rounded-lg text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-900 leading-relaxed">
                <code>{`void setup() {
  Serial.begin(115200);      // High-speed serial transport
  analogReadResolution(12);  // 12-bit ADC (0 - 4095 counts)
}

void loop() {
  if (currentMicros - lastSampleTime >= 1953) { // 512 Hz timer
    int eegValue = analogRead(A0);             // Verified: Pin A0
    Serial.println(eegValue);
  }
}`}</code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Software Setup & Run Instructions */}
      <section id="software" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-[#1C2331] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              4. Software Setup & Starting EEG Mode
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[#090C12] p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-300 flex items-center justify-center font-mono text-xs">
                1
              </span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Flash Arduino</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Open Arduino IDE. Load{' '}
                <code className="text-cyan-300 font-mono">KAI-Counselor-main/arduino_code.ino</code>. Select board{' '}
                <strong>Arduino Uno R4 Minima</strong>. Hit Upload.
              </p>
            </div>

            <div className="bg-[#090C12] p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-300 flex items-center justify-center font-mono text-xs">
                2
              </span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Confirm COM Port</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Open Windows Device Manager &rarr; Ports (COM & LPT). Note the assigned port (e.g.,{' '}
                <code className="text-cyan-300 font-mono">COM10</code>). In{' '}
                <code className="text-cyan-300 font-mono">web_bridge.py</code>, port is set to COM10 by default.
              </p>
            </div>

            <div className="bg-[#090C12] p-4 rounded-xl border border-slate-800 space-y-2">
              <span className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800/60 text-emerald-300 flex items-center justify-center font-mono text-xs">
                3
              </span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Start Web Suite</h3>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Double-click <code className="text-cyan-300 font-mono">start_web.bat</code> in root, or run{' '}
                <code className="text-cyan-300 font-mono">python web_bridge.py</code>. Navigate to{' '}
                <strong>http://localhost:8000</strong> and switch to the <strong>EEG</strong> tab.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Troubleshooting Guide */}
      <section id="troubleshooting" className="max-w-6xl mx-auto space-y-4">
        <div className="bg-[#0D1117] border border-[#1C2331] rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Wrench className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              5. Comprehensive Troubleshooting Guide
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#090C12] border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-bold font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Issue: Disconnected Arduino / Port Not Found</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Remedy:</strong> Re-plug USB-C cable directly into a motherboard USB port (avoid unpowered USB
                hubs). Check Windows Device Manager to ensure the driver is recognized as "Arduino Uno R4 Minima".
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090C12] border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Issue: Serial Port Busy / Access Denied</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Remedy:</strong> Close the Arduino IDE Serial Monitor or Serial Plotter. Only one program can
                read COM10 at a time. Restart <code className="text-cyan-300 font-mono">start_web.bat</code>.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090C12] border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 text-xs font-bold font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Issue: Flatline or 0 / 4095 Clamped Signals</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Remedy:</strong> Check that electrode gel has not dried out. Verify that the Jumper wire from{' '}
                <code className="text-cyan-300 font-mono">OUT</code> is securely plugged into pin{' '}
                <code className="text-cyan-300 font-mono">A0</code>. If hardware is absent, enable{' '}
                <strong>Dev Test Mode</strong> in the EEG Training Panel.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#090C12] border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold font-mono">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Issue: Excessive 50/60 Hz Noise Spikes</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                <strong>Remedy:</strong> Ensure the <strong>REF (Yellow)</strong> electrode on the right earlobe has
                firm skin contact. Avoid touching AC power adapters or ungrounded metal laptop chassis during readings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Safety & Device Limitations */}
      <section id="safety" className="max-w-6xl mx-auto space-y-4 pb-8">
        <div className="bg-[#0D1117] border border-amber-500/30 rounded-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-100">
              6. Safety Precautions & Prototype Limitations
            </h2>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-amber-200 space-y-1">
              <strong className="text-amber-300 block text-xs">Electrical Safety Regulations:</strong>
              The BioAmp EXG Pill must strictly be powered from low-voltage DC (3.3V or 5V) derived from a standard
              USB-isolated microcontroller. <strong>NEVER</strong> connect electrode leads to AC power, function
              generators, or unisolated benchtop power supplies.
            </div>

            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-800/40 text-rose-200 space-y-1">
              <strong className="text-rose-300 block text-xs">Non-Medical Educational Disclaimer:</strong>
              Project KAI is an affective computing, biofeedback, and human-computer interaction demonstration created
              for hackathons and research evaluations. It is <strong>NOT a clinical diagnostic medical device</strong>{' '}
              and must not be used for medical diagnosis, clinical treatment of mental disorders, or neurological
              monitoring.
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 space-y-1">
              <strong className="text-slate-300 block text-xs">Data Authenticity Requirement:</strong>
              Never present simulated signals from Dev Test Mode as authentic biological EEG recordings during jury
              evaluations. KAI's web interface clearly flags live hardware vs. simulation telemetry.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
