const messages = {
  en: {
    'errors.internal': 'Internal server error',
    'errors.validation_failed': 'Validation failed',
    'errors.no_token': 'No token provided',
    'errors.invalid_or_expired_token': 'Invalid or expired token',
    'errors.admin_required': 'Admin access required',
    'errors.invite_required': 'Registration requires a valid invite code',
    'errors.email_registered': 'Email already registered',
    'errors.invalid_credentials': 'Invalid credentials',
    'errors.missing_refresh_token': 'Missing refresh token',
    'errors.invalid_refresh_token': 'Invalid refresh token',
    'errors.user_not_found': 'User not found',
    'errors.too_many_requests': 'Too many requests. Please try again shortly.',
    'errors.route_not_found': 'Route not found',
    'auth.logged_out': 'Logged out',
  },
  ar: {
    'errors.internal': 'حدث خطأ داخلي في الخادم',
    'errors.validation_failed': 'فشل التحقق من صحة البيانات',
    'errors.no_token': 'لم يتم إرسال رمز التحقق',
    'errors.invalid_or_expired_token': 'رمز التحقق غير صالح أو منتهي الصلاحية',
    'errors.admin_required': 'صلاحية المدير مطلوبة',
    'errors.invite_required': 'يتطلب التسجيل رمز دعوة صالح',
    'errors.email_registered': 'البريد الإلكتروني مسجل بالفعل',
    'errors.invalid_credentials': 'بيانات تسجيل الدخول غير صحيحة',
    'errors.missing_refresh_token': 'رمز التحديث مفقود',
    'errors.invalid_refresh_token': 'رمز التحديث غير صالح',
    'errors.user_not_found': 'المستخدم غير موجود',
    'errors.too_many_requests': 'طلبات كثيرة جدا. يرجى المحاولة بعد قليل.',
    'errors.route_not_found': 'المسار غير موجود',
    'auth.logged_out': 'تم تسجيل الخروج',
  },
};

const supportedLanguages = new Set(['en', 'ar']);

const normalizeLanguage = (languageCandidate) => {
  if (!languageCandidate || typeof languageCandidate !== 'string') return 'en';
  const short = languageCandidate.trim().toLowerCase().split('-')[0];
  return supportedLanguages.has(short) ? short : 'en';
};

const detectLanguage = (req) => {
  const queryLang = req.query?.lang;
  if (queryLang) return normalizeLanguage(queryLang);

  const explicitHeader = req.headers['x-lang'];
  if (explicitHeader) return normalizeLanguage(explicitHeader);

  const acceptLanguage = req.headers['accept-language'];
  if (!acceptLanguage) return 'en';

  const firstLang = String(acceptLanguage).split(',')[0];
  return normalizeLanguage(firstLang);
};

const translate = (lang, key, fallback = '') => {
  const safeLang = normalizeLanguage(lang);
  return messages[safeLang][key] || messages.en[key] || fallback || key;
};

const translateValidationMessage = (lang, message) => {
  const safeLang = normalizeLanguage(lang);
  if (safeLang !== 'ar') return message;

  const mapped = {
    'valid email is required': 'مطلوب بريد إلكتروني صحيح',
    'password is required': 'كلمة المرور مطلوبة',
    'password must be at least 8 characters': 'يجب أن تكون كلمة المرور 8 أحرف على الأقل',
    'name is required': 'الاسم مطلوب',
    'id must be a positive integer': 'يجب أن يكون المعرف رقما صحيحا موجبا',
  };

  return mapped[message] || message;
};

const translateKnownErrorMessage = (lang, message) => {
  const safeLang = normalizeLanguage(lang);
  if (safeLang !== 'ar') return message;

  const mapped = {
    'Route not found': 'المسار غير موجود',
    'Employee not found': 'الموظف غير موجود',
    'Inventory item not found': 'عنصر المخزون غير موجود',
    'File not found': 'الملف غير موجود',
    'Invalid filename': 'اسم الملف غير صالح',
    'HTTP 429': 'طلبات كثيرة جدا. يرجى المحاولة بعد قليل.',
  };

  return mapped[message] || message;
};

module.exports = {
  detectLanguage,
  normalizeLanguage,
  translate,
  translateValidationMessage,
  translateKnownErrorMessage,
};
