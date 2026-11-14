# MediSathi — 3-Minute Demo Script

**Setup check before going on stage:** Ensure the app is running on `http://localhost:3000`. Clear `localStorage` once (`localStorage.clear()`) if you want to show the first-launch language onboarding screen live.

---

### 0:00 – 0:30 | First Launch, Language & Safety Framing
1. Show the **Language Onboarding** screen with four large native-script buttons (**English, हिन्दी, অসমীয়া, বাংলা**).
2. Tap **অসমীয়া (Assamese)** or **हिन्दी (Hindi)** — MediSathi immediately speaks a warm welcome in that language.
3. Point out the **Important Safety Note** and **Privacy Note** (*never diagnoses, never changes doses, images not stored on server*), then tap **Start Using MediSathi**.

### 0:30 – 1:15 | Scan Prescription + Editable Verification (P0)
1. Tap the **Scan Rx** tab. Point out Camera Photo, Upload Image, and the **3 realistic Indian sample prescriptions**.
2. Tap **Sample 2: Fever & Throat Infection (PHC OPD)**.
3. Show the **Check & confirm medicines** screen side-by-side with the prescription photo:
   - Point out the **amber low-confidence warning** on `Tab Cetirizine 10mg` showing OCR is never trusted blindly.
   - Tap **Confirm & Explain Medicines** (3 taps total from scan to explanation!).

### 1:15 – 2:00 | Plain-Language Explanations + Voice Playback + Safety Warnings (P0 + P1)
1. MediSathi opens the **Medicines** tab with 6th-grade explanations (*What it is used for*, *How & when to take*, *What to avoid*, *When to call a doctor*) ending with **"Please confirm with your doctor or pharmacist."**
2. Tap **Play** on `Cap Omeprazole` (or **Play All**) to hear the spoken explanation in the patient's chosen language.
3. Now switch to **Scan Rx** -> tap **Sample 3: Joint Pain & Fever OPD (Safety Check Demo)** -> **Confirm & Explain Medicines**.
4. Highlight the **Red High Safety Alert cards** that appear immediately:
   - **Duplicate ingredient: Ibuprofen & Paracetamol** (`Combiflam` + `Ibuprofen` + `Paracetamol`)
   - **Drug-Drug Interaction**: `Ibuprofen + Aspirin` bleeding risk.
   - Tap the speaker icon on the warning card to hear the spoken alert.

### 2:00 – 2:40 | Daily Dose Timeline & Voice Q&A (P0 + P2)
1. Tap the **Today** tab. Show the **Morning / Afternoon / Night** timeline with sun/moon icons and the active reminder banner.
2. Tap **Taken** on a morning dose — watch the daily progress (`1 / 4 Taken`) and streak update immediately.
3. Return to **Medicines** -> tap **Ask a question by voice**, ask *"Can I take Omeprazole after breakfast?"*, and show the context-restricted answer spoken aloud.

### 2:40 – 3:00 | Caregiver Dashboard & 60-Min Missed-Dose Alert (P1)
1. Tap the **Caregiver** tab. Show **Today's Adherence %**, the **7-Day Adherence chart**, and **Demo Mode** toggle.
2. Tap **Fast-Forward Missed Dose** — within 1 second, a missed-dose escalation alert fires into the **60-Minute Missed-Dose Alerts** feed (or Twilio WhatsApp/SMS when configured) for caregiver **Meera Das**.
3. Close with: *"MediSathi makes every prescription understandable, speakable, and safer in the patient's own language — in 3 taps."*
