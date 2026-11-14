import type { DoseSlot, FoodTiming, SupportedLanguage } from '../types';

export interface LanguageOption {
  code: SupportedLanguage;
  nativeName: string;
  englishName: string;
  regionHint: string;
  greetingSpeech: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    regionHint: 'Simple 6th-grade English',
    greetingSpeech:
      'Namaste! Welcome to MediSathi. I will read your medicines aloud and remind you on time. Please confirm with your doctor or pharmacist.',
  },
  {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    regionHint: 'सरल हिंदी में सुनें',
    greetingSpeech:
      'नमस्ते! मेडीसाथी में आपका स्वागत है। मैं आपकी दवाइयों की जानकारी आसान भाषा में पढ़कर सुनाऊंगा। कृपया अपने डॉक्टर या फ़ार्मासिस्ट से पुष्टि जरूर करें।',
  },
  {
    code: 'as',
    nativeName: 'অসমীয়া',
    englishName: 'Assamese',
    regionHint: 'সহজ অসমীয়াত শুনক',
    greetingSpeech:
      'নমস্কাৰ! মেডি-সাথীলৈ স্বাগতম। মই আপোনাৰ দৰৱৰ বিষয়ে সহজ ভাষাত পঢ়ি শুনাম। অনুগ্ৰহ কৰি আপোনাৰ চিকিৎসক বা ফাৰ্মাচিষ্টৰ সৈতে নিশ্চিত কৰি ল’ব।',
  },
  {
    code: 'bn',
    nativeName: 'বাংলা',
    englishName: 'Bengali',
    regionHint: 'সহজ বাংলায় শুনুন',
    greetingSpeech:
      'নমস্কার! মেডি-সাথীতে স্বাগতম। আমি আপনার ওষুধের নিয়ম সহজ ভাষায় পড়ে শোনাব। অনুগ্রহ করে আপনার ডাক্তার বা ফার্মাসিস্টের সাথে নিশ্চিত করে নিন।',
  },
];

export interface UIStrings {
  appTagline: string;
  tabs: {
    today: string;
    scan: string;
    medicines: string;
    caregiver: string;
  };
  listenPage: string;
  playAll: string;
  stopAudio: string;
  play: string;
  mandatoryDoctorLine: string;
  onboardingTitle: string;
  onboardingSubtitle: string;
  disclaimerTitle: string;
  disclaimerBody: string;
  privacyNote: string;
  continueBtn: string;
  slots: Record<DoseSlot, string>;
  food: Record<FoodTiming, string>;
  status: {
    pending: string;
    taken: string;
    skipped: string;
    missed: string;
  };
  takenBtn: string;
  skipBtn: string;
  streakLabel: string;
  days: string;
  reminderBannerTitle: string;
  scanTitle: string;
  scanSubtitle: string;
  takePhotoBtn: string;
  uploadPhotoBtn: string;
  orTrySample: string;
  readingRx: string;
  confirmTitle: string;
  confirmSubtitle: string;
  lowConfAlert: string;
  confirmSaveBtn: string;
  usedFor: string;
  howAndWhen: string;
  whatToAvoid: string;
  whenToCallDoctor: string;
  safetyTitle: string;
  noSafetyIssues: string;
  askQuestionBtn: string;
  caregiverTitle: string;
  todayAdherence: string;
  weeklySummary: string;
  alertFeedTitle: string;
  fastForwardBtn: string;
  demoModeLabel: string;
  janAushadhiTitle: string;
  janAushadhiNotChecked: string;
  elderlyModeLabel: string;
  callCaregiverBtn: string;
  emergencyBtn: string;
  emergencyModalTitle: string;
  emergencyModalBody: string;
}

export const TRANSLATIONS: Record<SupportedLanguage, UIStrings> = {
  en: {
    appTagline: 'Your voice medicine helper',
    tabs: {
      today: 'Today',
      scan: 'Scan Rx',
      medicines: 'Medicines',
      caregiver: 'Caregiver',
    },
    listenPage: 'Listen',
    playAll: 'Play all',
    stopAudio: 'Stop',
    play: 'Listen',
    mandatoryDoctorLine: 'Please confirm with your doctor or pharmacist.',
    onboardingTitle: 'Choose your language',
    onboardingSubtitle: 'Tap a language to hear MediSathi speak clearly',
    disclaimerTitle: 'Important Safety Note',
    disclaimerBody:
      'MediSathi helps explain your prescription in simple words. It never diagnoses illness, prescribes medicine, or changes your dose.',
    privacyNote: 'Privacy: Prescription photos are processed only to read your medicines and are not stored on our server.',
    continueBtn: 'Start Using MediSathi',
    slots: { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' },
    food: {
      before_food: 'Before food',
      after_food: 'After food',
      with_food: 'With food',
      any: 'With water',
    },
    status: {
      pending: 'Due today',
      taken: 'Taken',
      skipped: 'Skipped',
      missed: 'Missed (60m+)',
    },
    takenBtn: 'Taken',
    skipBtn: 'Skip',
    streakLabel: 'Day Streak',
    days: 'days',
    reminderBannerTitle: 'Time for your dose',
    scanTitle: 'Scan your prescription',
    scanSubtitle: 'Take a clear photo, upload from gallery, or try a sample prescription below.',
    takePhotoBtn: 'Camera Photo',
    uploadPhotoBtn: 'Upload Image',
    orTrySample: 'Try 3 realistic Indian prescriptions',
    readingRx: 'Reading your prescription carefully… please wait a moment.',
    confirmTitle: 'Check & confirm medicines',
    confirmSubtitle: 'OCR can make mistakes. Please verify names and timings before saving.',
    lowConfAlert: 'Some handwriting looked unclear. Please check highlighted items carefully.',
    confirmSaveBtn: 'Confirm & Explain Medicines',
    usedFor: 'What it is used for',
    howAndWhen: 'How & when to take',
    whatToAvoid: 'What to avoid',
    whenToCallDoctor: 'When to call a doctor',
    safetyTitle: 'Medicine Safety Checks',
    noSafetyIssues: 'No duplicates or known interactions found inside our 32-medicine reference list.',
    askQuestionBtn: 'Ask a question by voice',
    caregiverTitle: 'Caregiver & ASHA Dashboard',
    todayAdherence: "Today's Adherence",
    weeklySummary: '7-Day Adherence',
    alertFeedTitle: '60-Minute Missed-Dose Alerts',
    fastForwardBtn: 'Fast-Forward Missed Dose',
    demoModeLabel: 'Demo Mode (Cached instant responses)',
    janAushadhiTitle: 'Jan Aushadhi Generic Alternative',
    janAushadhiNotChecked: 'Jan Aushadhi generic price not checked — ask your local pharmacist.',
    elderlyModeLabel: 'Picture Mode',
    callCaregiverBtn: 'Call My Caregiver',
    emergencyBtn: 'Emergency',
    emergencyModalTitle: 'Emergency Alert Sent',
    emergencyModalBody: 'We notified your primary caregiver and prepared a direct phone call.',
  },
  hi: {
    appTagline: 'आपकी आवाज़ वाला दवा साथी',
    tabs: {
      today: 'आज',
      scan: 'पर्ची स्कैन',
      medicines: 'दवाइयां',
      caregiver: 'देखभाल',
    },
    listenPage: 'सुनें',
    playAll: 'सभी सुनें',
    stopAudio: 'रोकें',
    play: 'सुनें',
    mandatoryDoctorLine: 'कृपया अपने डॉक्टर या फ़ार्मासिस्ट से पुष्टि जरूर करें।',
    onboardingTitle: 'अपनी भाषा चुनें',
    onboardingSubtitle: 'आवाज़ सुनने के लिए अपनी भाषा पर टैप करें',
    disclaimerTitle: 'जरूरी सुरक्षा सूचना',
    disclaimerBody:
      'मेडीसाथी केवल आपकी पर्ची को आसान शब्दों में समझाता है। यह बीमारी की जांच नहीं करता और न ही दवा की खुराक बदलता है।',
    privacyNote: 'गोपनीयता: आपकी पर्ची की फोटो केवल पढ़ने के लिए उपयोग होती है और सर्वर पर जमा नहीं की जाती।',
    continueBtn: 'मेडीसाथी शुरू करें',
    slots: { morning: 'सुबह', afternoon: 'दोपहर', night: 'रात' },
    food: {
      before_food: 'खाने से पहले',
      after_food: 'खाने के बाद',
      with_food: 'खाने के साथ',
      any: 'पानी के साथ',
    },
    status: {
      pending: 'बाकी है',
      taken: 'ले ली',
      skipped: 'छोड़ी',
      missed: 'चूक गई (60मि+)',
    },
    takenBtn: 'दवा ली',
    skipBtn: 'छोड़ें',
    streakLabel: 'लगातार दिन',
    days: 'दिन',
    reminderBannerTitle: 'दवा लेने का समय हो गया है',
    scanTitle: 'पर्ची की फोटो लें',
    scanSubtitle: 'कैमरे से फोटो खींचें, गैलरी से चुनें, या नीचे दिए सैंपल आज़माएं।',
    takePhotoBtn: 'कैमरा फोटो',
    uploadPhotoBtn: 'फोटो चुनें',
    orTrySample: '3 सैंपल पर्ची आज़माएं',
    readingRx: 'आपकी पर्ची पढ़ी जा रही है… कृपया थोड़ा रुकें।',
    confirmTitle: 'दवाइयों की जांच करें',
    confirmSubtitle: 'लिखावट पढ़ने में गलती हो सकती है। सेव करने से पहले नाम और समय जांच लें।',
    lowConfAlert: 'कुछ अक्षर साफ नहीं दिख रहे हैं। कृपया जांचकर सही करें।',
    confirmSaveBtn: 'पुष्टि करें और समझें',
    usedFor: 'यह किस काम आती है',
    howAndWhen: 'कैसे और कब लें',
    whatToAvoid: 'क्या सावधानी रखें',
    whenToCallDoctor: 'डॉक्टर से कब संपर्क करें',
    safetyTitle: 'दवा सुरक्षा जांच',
    noSafetyIssues: 'हमारी 32 दवाओं की सूची में कोई दोहरी या टकराव वाली दवा नहीं मिली।',
    askQuestionBtn: 'बोलकर सवाल पूछें',
    caregiverTitle: 'देखभालकर्ता और आशा डैशबोर्ड',
    todayAdherence: 'आज की खुराक',
    weeklySummary: '7-दिन का रिकॉर्ड',
    alertFeedTitle: '60-मिनट छूटी खुराक अलर्ट',
    fastForwardBtn: 'छूटी खुराक अलर्ट टेस्ट करें',
    demoModeLabel: 'डेमो मोड (तेज़ ऑफलाइन उत्तर)',
    janAushadhiTitle: 'जन औषधि सस्ता विकल्प',
    janAushadhiNotChecked: 'जन औषधि मूल्य उपलब्ध नहीं — अपने फ़ार्मासिस्ट से पूछें।',
    elderlyModeLabel: 'चित्र मोड (कम पढ़ाई)',
    callCaregiverBtn: 'देखभालकर्ता को कॉल करें',
    emergencyBtn: 'आपात मदद',
    emergencyModalTitle: 'आपात संदेश भेजा गया',
    emergencyModalBody: 'हमने आपके देखभालकर्ता को तुरंत संदेश भेज दिया है। नीचे कॉल दबाएं।',
  },
  as: {
    appTagline: 'আপোনাৰ কণ্ঠৰ দৰৱৰ সংগী',
    tabs: {
      today: 'আজি',
      scan: 'স্কেন',
      medicines: 'দৰৱ',
      caregiver: 'যত্ন',
    },
    listenPage: 'শুনক',
    playAll: 'সকলো শুনক',
    stopAudio: 'ৰখোৱা',
    play: 'শুনক',
    mandatoryDoctorLine: 'অনুগ্ৰহ কৰি আপোনাৰ চিকিৎসক বা ফাৰ্মাচিষ্টৰ সৈতে নিশ্চিত কৰি ল’ব।',
    onboardingTitle: 'আপোনাৰ ভাষা বাছক',
    onboardingSubtitle: 'শব্দ শুনিবলৈ এটা ভাষাত টেপ কৰক',
    disclaimerTitle: 'গুৰুত্বপূৰ্ণ সুৰক্ষা বাৰ্তা',
    disclaimerBody:
      'মেডি-সাথীয়ে কেৱল আপোনাৰ প্ৰেছক্ৰিপচন সহজ ভাষাত বুজাই দিয়ে। ই ৰোগ নিৰ্ণয় নকৰে বা দৰৱৰ পালি সলনি নকৰে।',
    privacyNote: 'গোপনীয়তা: আপোনাৰ প্ৰেছক্ৰিপচনৰ ফটো কেৱল পঢ়িবলৈহে ব্যৱহাৰ কৰা হয়।',
    continueBtn: 'মেডি-সাথী আৰম্ভ কৰক',
    slots: { morning: 'ৰাতিপুৱা', afternoon: 'দুপৰীয়া', night: 'ৰাতি' },
    food: {
      before_food: 'খোৱাৰ আগতে',
      after_food: 'খোৱাৰ পাছত',
      with_food: 'আহাৰৰ সৈতে',
      any: 'পানীৰ সৈতে',
    },
    status: {
      pending: 'বাকী আছে',
      taken: 'খালে',
      skipped: 'এৰিলে',
      missed: 'পাহৰিলে (৬০মি+)',
    },
    takenBtn: 'খালোঁ',
    skipBtn: 'বাদ দিওঁ',
    streakLabel: 'ধাৰাবাহিক দিন',
    days: 'দিন',
    reminderBannerTitle: 'দৰৱ খোৱাৰ সময় হৈছে',
    scanTitle: 'প্ৰেছক্ৰিপচন স্কেন কৰক',
    scanSubtitle: 'ফটো তোলক, গেলাৰীৰ পৰা দিয়ক বা তলৰ নমুনা চাওক।',
    takePhotoBtn: 'কেমেৰা ফটো',
    uploadPhotoBtn: 'ফটো বাছক',
    orTrySample: '৩খন নমুনা প্ৰেছক্ৰিপচন চাওক',
    readingRx: 'আপোনাৰ প্ৰেছক্ৰিপচন পঢ়া হৈ আছে… অনুগ্ৰহ কৰি অলপ অপেক্ষা কৰক।',
    confirmTitle: 'দৰৱসমূহ পৰীক্ষা কৰক',
    confirmSubtitle: 'হাতেলিখা পঢ়াত ভুল হ’ব পাৰে। নিশ্চিত কৰি আগবাঢ়ক।',
    lowConfAlert: 'কিছুমান নাম স্পষ্ট নহয়। অনুগ্ৰহ কৰি পৰীক্ষা কৰক।',
    confirmSaveBtn: 'নিশ্চিত কৰক আৰু বুজক',
    usedFor: 'কিহৰ বাবে ব্যৱহাৰ হয়',
    howAndWhen: 'কেনেকৈ আৰু কেতিয়া খাব',
    whatToAvoid: 'কি সাৱধানতা মানিব',
    whenToCallDoctor: 'কেতিয়া চিকিৎসকক মাতিব',
    safetyTitle: 'দৰৱ সুৰক্ষা পৰীক্ষা',
    noSafetyIssues: 'আমাৰ ৩২টা দৰৱৰ তালিকাত কোনো সমস্যা পোৱা নগ’ল।',
    askQuestionBtn: 'কথাৰে প্ৰশ্ন সোধক',
    caregiverTitle: 'পৰিচৰ্যা আৰু আশা ডেশ্বব’ৰ্ড',
    todayAdherence: 'আজিৰ নিয়মীয়া হাৰ',
    weeklySummary: '৭ দিনৰ সাৰাংশ',
    alertFeedTitle: '৬০ মিনিটৰ সতৰ্কবাণী',
    fastForwardBtn: 'সতৰ্কবাণী পৰীক্ষা কৰক',
    demoModeLabel: 'ডেম’ ম’ড',
    janAushadhiTitle: 'জন ঔষধি সস্তা জেনেৰিক বিকল্প',
    janAushadhiNotChecked: 'জন ঔষধিৰ দাম পৰীক্ষা কৰা হোৱা নাই — ফাৰ্মাচিষ্টক সোধক।',
    elderlyModeLabel: 'ছবি ম’ড (পঢ়া-শুনা অবিহনে)',
    callCaregiverBtn: 'পৰিচৰ্যা কৰোঁতাক ফোন কৰক',
    emergencyBtn: 'জৰুৰী সহায়',
    emergencyModalTitle: 'জৰুৰী বাৰ্তা পঠিওৱা হ’ল',
    emergencyModalBody: 'আপোনাৰ পৰিচৰ্যা কৰোঁতালৈ জৰুৰী বাৰ্তা পঠিওৱা হৈছে। ফোন কৰিবলৈ তলত টিপক।',
  },
  bn: {
    appTagline: 'আপনার কণ্ঠের ওষুধের সাথী',
    tabs: {
      today: 'আজ',
      scan: 'স্ক্যান',
      medicines: 'ওষুধ',
      caregiver: 'যত্ন',
    },
    listenPage: 'শুনুন',
    playAll: 'সব শুনুন',
    stopAudio: 'থামান',
    play: 'শুনুন',
    mandatoryDoctorLine: 'অনুগ্রহ করে আপনার ডাক্তার বা ফার্মাসিস্টের সাথে নিশ্চিত করে নিন।',
    onboardingTitle: 'আপনার ভাষা বেছে নিন',
    onboardingSubtitle: 'কথা শুনতে আপনার ভাষায় ট্যাপ করুন',
    disclaimerTitle: 'গুরুত্বপূর্ণ সুরক্ষা বার্তা',
    disclaimerBody:
      'মেডি-সাথী শুধু আপনার প্রেসক্রিপশন সহজ ভাষায় বুঝিয়ে দেয়। এটি রোগ নির্ণয় করে না বা ওষুধের ডোজ বদলায় না।',
    privacyNote: 'গোপনীয়তা: প্রেসক্রিপশনের ছবি শুধু পড়ার জন্যই ব্যবহার করা হয়, সার্ভারে জমা রাখা হয় না।',
    continueBtn: 'মেডি-সাথী শুরু করুন',
    slots: { morning: 'সকাল', afternoon: 'দুপুর', night: 'রাত' },
    food: {
      before_food: 'খাওয়ার আগে',
      after_food: 'খাওয়ার পরে',
      with_food: 'খাওয়ার সাথে',
      any: 'পানির সাথে',
    },
    status: {
      pending: 'বাকি আছে',
      taken: 'খাওয়া হয়েছে',
      skipped: 'বাদ দেওয়া',
      missed: 'মিস হয়েছে (৬০মি+)',
    },
    takenBtn: 'খেয়েছি',
    skipBtn: 'বাদ দিন',
    streakLabel: 'টানা দিন',
    days: 'দিন',
    reminderBannerTitle: 'ওষুধ খাওয়ার সময় হয়েছে',
    scanTitle: 'প্রেসক্রিপশন স্ক্যান করুন',
    scanSubtitle: 'ছবি তুলুন, গ্যালারি থেকে দিন বা নিচের নমুনা দেখুন।',
    takePhotoBtn: 'ক্যামেরা ছবি',
    uploadPhotoBtn: 'ছবি বাছুন',
    orTrySample: '৩টি নমুনা প্রেসক্রিপশন দেখুন',
    readingRx: 'আপনার প্রেসক্রিপশন পড়া হচ্ছে… অনুগ্রহ করে একটু অপেক্ষা করুন।',
    confirmTitle: 'ওষুধগুলো যাচাই করুন',
    confirmSubtitle: 'হাতের লেখা পড়তে ভুল হতে পারে। সেভ করার আগে নাম ও সময় দেখে নিন।',
    lowConfAlert: 'কিছু লেখা অস্পষ্ট মনে হয়েছে। অনুগ্রহ করে মিলিয়ে নিন।',
    confirmSaveBtn: 'নিশ্চিত করুন ও জানুন',
    usedFor: 'কী কাজে লাগে',
    howAndWhen: 'কীভাবে ও কখন খাবেন',
    whatToAvoid: 'কী কী এড়িয়ে চলবেন',
    whenToCallDoctor: 'কখন ডাক্তার ডাকবেন',
    safetyTitle: 'ওষুধ নিরাপত্তা যাচাই',
    noSafetyIssues: 'আমাদের ৩২টি ওষুধের তালিকায় কোনো ক্ষতিকর মিল পাওয়া যায়নি।',
    askQuestionBtn: 'কথা বলে প্রশ্ন করুন',
    caregiverTitle: 'যত্নকারী ও আশা ড্যাশবোর্ড',
    todayAdherence: 'আজকের নিয়ম মানা',
    weeklySummary: '৭ দিনের হিসাব',
    alertFeedTitle: '৬০-মিনিট মিসড ডোজ অ্যালার্ট',
    fastForwardBtn: 'মিসড ডোজ অ্যালার্ট পরীক্ষা',
    demoModeLabel: 'ডেমো মোড',
    janAushadhiTitle: 'জন ঔষধি সাশ্রয়ী জেনেরিক বিকল্প',
    janAushadhiNotChecked: 'জন ঔষধি দাম যাচাই করা হয়নি — ফার্মাসিস্টকে জিজ্ঞাসা করুন।',
    elderlyModeLabel: 'ছবি মোড (পড়া ছাড়াই)',
    callCaregiverBtn: 'যত্নকারীকে কল করুন',
    emergencyBtn: 'জরুরি সাহায্য',
    emergencyModalTitle: 'জরুরি বার্তা পাঠানো হয়েছে',
    emergencyModalBody: 'আপনার যত্নকারীকে জরুরি বার্তা পাঠানো হয়েছে। কল করতে নিচে ট্যাপ করুন।',
  },
};
