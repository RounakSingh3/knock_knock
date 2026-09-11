export interface Language {
    code: string;
    name: string;
    nativeName: string;
    flag: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', flag: '🇮🇳' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷' },
    { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
    { code: 'zh-CN', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
    { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
    { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
    { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
    { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
    { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
    { code: 'tl', name: 'Filipino', nativeName: 'Tagalog', flag: '🇵🇭' },
    { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
    { code: 'sw', name: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
    { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
    { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
    { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
    { code: 'ms', name: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
    { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', flag: '🇳🇵' },
];

export const getLanguage = (code: string): Language => {
    const clean = (code || 'en').toLowerCase().split('-')[0];
    return (
        SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase() === code.toLowerCase()) ||
        SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase().startsWith(clean)) ||
        SUPPORTED_LANGUAGES[0]
    );
};

export const getUserLanguage = (): string => {
    try {
        const saved = localStorage.getItem('knock_user_lang');
        if (saved) return saved;

        const navLang = navigator.language ? navigator.language.split('-')[0] : 'en';
        const match = SUPPORTED_LANGUAGES.find(l => l.code.toLowerCase().startsWith(navLang.toLowerCase()));
        return match ? match.code : 'en';
    } catch {
        return 'en';
    }
};

export const setUserLanguage = (code: string): void => {
    try {
        localStorage.setItem('knock_user_lang', code);
    } catch (e) {
        console.error('Failed to save language preference:', e);
    }
};

// In-memory cache for ultra-fast translations (avoids duplicate network queries)
const translationCache = new Map<string, string>();

/**
 * Translates text into target language using Google Translate GTX endpoint with MyMemory fallback.
 */
export async function translateText(
    text: string,
    targetLang: string = 'en',
    sourceLang: string = 'auto'
): Promise<{ translatedText: string; detectedSource: string }> {
    if (!text || !text.trim()) {
        return { translatedText: text, detectedSource: '' };
    }

    const trimmed = text.trim();
    const cacheKey = `${sourceLang}:${targetLang}:${trimmed}`;
    if (translationCache.has(cacheKey)) {
        return { translatedText: translationCache.get(cacheKey)!, detectedSource: sourceLang };
    }

    // Attempt 1: Google Translate GTX endpoint (free, real-time, no key required)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(trimmed)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data[0])) {
                const translated = data[0].map((chunk: any) => chunk[0]).join('');
                const detected = data[2] || sourceLang;
                if (translated) {
                    translationCache.set(cacheKey, translated);
                    return { translatedText: translated, detectedSource: detected };
                }
            }
        }
    } catch (googleErr) {
        console.warn('[Translate] Primary Google GTX translation failed, trying fallback:', googleErr);
    }

    // Attempt 2: MyMemory Translation API fallback
    try {
        const sl = sourceLang === 'auto' ? 'autodetect' : sourceLang;
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=${sl}|${encodeURIComponent(targetLang)}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data?.responseData?.translatedText) {
                const translated = data.responseData.translatedText;
                translationCache.set(cacheKey, translated);
                return { translatedText: translated, detectedSource: sourceLang };
            }
        }
    } catch (fallbackErr) {
        console.error('[Translate] Fallback MyMemory translation failed:', fallbackErr);
    }

    // If both fail, return original text safely
    return { translatedText: text, detectedSource: sourceLang };
}

// UI strings dictionary for Login & Sign-Up localization
export interface LoginStrings {
    createAccount: string;
    welcomeBack: string;
    username: string;
    usernamePlaceholder: string;
    usernameAvailable: string;
    usernameTaken: string;
    fullName: string;
    fullNamePlaceholder: string;
    dob: string;
    gender: string;
    selectGender: string;
    male: string;
    female: string;
    other: string;
    preferNotToSay: string;
    password: string;
    submitCreate: string;
    submitSignIn: string;
    alreadyHaveAccount: string;
    dontHaveAccount: string;
    signInLink: string;
    signUpLink: string;
    preferredLanguage: string;
    selectLanguage: string;
}

export const LOGIN_TRANSLATIONS: Record<string, LoginStrings> = {
    en: {
        createAccount: 'Create your account',
        welcomeBack: 'Welcome back',
        username: 'Username',
        usernamePlaceholder: 'cool_username',
        usernameAvailable: 'Username is available!',
        usernameTaken: 'Username is already taken',
        fullName: 'Full Name',
        fullNamePlaceholder: 'John Doe',
        dob: 'Date of Birth',
        gender: 'Gender',
        selectGender: 'Select gender',
        male: 'Male',
        female: 'Female',
        other: 'Other',
        preferNotToSay: 'Prefer not to say',
        password: 'Password',
        submitCreate: 'Create Account',
        submitSignIn: 'Sign In',
        alreadyHaveAccount: 'Already have an account?',
        dontHaveAccount: "Don't have an account?",
        signInLink: 'Sign In',
        signUpLink: 'Sign Up',
        preferredLanguage: 'Preferred Language',
        selectLanguage: 'Language',
    },
    es: {
        createAccount: 'Crea tu cuenta',
        welcomeBack: 'Bienvenido de nuevo',
        username: 'Nombre de usuario',
        usernamePlaceholder: 'tu_usuario',
        usernameAvailable: '¡Nombre de usuario disponible!',
        usernameTaken: 'El nombre de usuario ya está en uso',
        fullName: 'Nombre completo',
        fullNamePlaceholder: 'Juan Pérez',
        dob: 'Fecha de nacimiento',
        gender: 'Género',
        selectGender: 'Selecciona género',
        male: 'Masculino',
        female: 'Femenino',
        other: 'Otro',
        preferNotToSay: 'Prefiero no decirlo',
        password: 'Contraseña',
        submitCreate: 'Crear Cuenta',
        submitSignIn: 'Iniciar Sesión',
        alreadyHaveAccount: '¿Ya tienes una cuenta?',
        dontHaveAccount: '¿No tienes una cuenta?',
        signInLink: 'Inicia Sesión',
        signUpLink: 'Regístrate',
        preferredLanguage: 'Idioma preferido',
        selectLanguage: 'Idioma',
    },
    hi: {
        createAccount: 'अपना खाता बनाएं',
        welcomeBack: 'वापसी पर स्वागत है',
        username: 'यूज़रनेम',
        usernamePlaceholder: 'apna_username',
        usernameAvailable: 'यूज़रनेम उपलब्ध है!',
        usernameTaken: 'यह यूज़रनेम पहले से लिया जा चुका है',
        fullName: 'पूरा नाम',
        fullNamePlaceholder: 'राहुल शर्मा',
        dob: 'जन्म तिथि',
        gender: 'लिंग',
        selectGender: 'लिंग चुनें',
        male: 'पुरुष',
        female: 'महिला',
        other: 'अन्य',
        preferNotToSay: 'बताना नहीं चाहते',
        password: 'पासवर्ड',
        submitCreate: 'खाता बनाएं',
        submitSignIn: 'साइन इन करें',
        alreadyHaveAccount: 'क्या आपके पास पहले से खाता है?',
        dontHaveAccount: 'खाता नहीं है?',
        signInLink: 'साइन इन करें',
        signUpLink: 'साइन अप करें',
        preferredLanguage: 'पसंदीदा भाषा',
        selectLanguage: 'भाषा',
    },
    fr: {
        createAccount: 'Créez votre compte',
        welcomeBack: 'Bienvenue de retour',
        username: "Nom d'utilisateur",
        usernamePlaceholder: 'votre_pseudo',
        usernameAvailable: "Nom d'utilisateur disponible !",
        usernameTaken: "Ce nom d'utilisateur est déjà pris",
        fullName: 'Nom complet',
        fullNamePlaceholder: 'Jean Dupont',
        dob: 'Date de naissance',
        gender: 'Genre',
        selectGender: 'Sélectionnez le genre',
        male: 'Homme',
        female: 'Femme',
        other: 'Autre',
        preferNotToSay: 'Préfère ne pas le dire',
        password: 'Mot de passe',
        submitCreate: 'Créer un compte',
        submitSignIn: 'Se connecter',
        alreadyHaveAccount: 'Vous avez déjà un compte ?',
        dontHaveAccount: "Vous n'avez pas de compte ?",
        signInLink: 'Se connecter',
        signUpLink: "S'inscrire",
        preferredLanguage: 'Langue préférée',
        selectLanguage: 'Langue',
    },
    de: {
        createAccount: 'Konto erstellen',
        welcomeBack: 'Willkommen zurück',
        username: 'Benutzername',
        usernamePlaceholder: 'benutzername',
        usernameAvailable: 'Benutzername ist verfügbar!',
        usernameTaken: 'Benutzername ist bereits vergeben',
        fullName: 'Vollständiger Name',
        fullNamePlaceholder: 'Max Mustermann',
        dob: 'Geburtsdatum',
        gender: 'Geschlecht',
        selectGender: 'Geschlecht wählen',
        male: 'Männlich',
        female: 'Weiblich',
        other: 'Andere',
        preferNotToSay: 'Keine Angabe',
        password: 'Passwort',
        submitCreate: 'Konto erstellen',
        submitSignIn: 'Anmelden',
        alreadyHaveAccount: 'Bereits ein Konto?',
        dontHaveAccount: 'Noch kein Konto?',
        signInLink: 'Anmelden',
        signUpLink: 'Registrieren',
        preferredLanguage: 'Bevorzugte Sprache',
        selectLanguage: 'Sprache',
    },
    ar: {
        createAccount: 'إنشاء حساب جديد',
        welcomeBack: 'مرحبًا بعودتك',
        username: 'اسم المستخدم',
        usernamePlaceholder: 'اسم_المستخدم',
        usernameAvailable: 'اسم المستخدم متاح!',
        usernameTaken: 'اسم المستخدم مستخدم بالفعل',
        fullName: 'الاسم الكامل',
        fullNamePlaceholder: 'محمد أحمد',
        dob: 'تاريخ الميلاد',
        gender: 'الجنس',
        selectGender: 'اختر الجنس',
        male: 'ذكر',
        female: 'أنثى',
        other: 'آخر',
        preferNotToSay: 'أفضل عدم التحديد',
        password: 'كلمة المرور',
        submitCreate: 'إنشاء الحساب',
        submitSignIn: 'تسجيل الدخول',
        alreadyHaveAccount: 'هل لديك حساب بالفعل؟',
        dontHaveAccount: 'ليس لديك حساب؟',
        signInLink: 'تسجيل الدخول',
        signUpLink: 'إنشاء حساب',
        preferredLanguage: 'اللغة المفضلة',
        selectLanguage: 'اللغة',
    },
    'zh-CN': {
        createAccount: '创建您的账户',
        welcomeBack: '欢迎回来',
        username: '用户名',
        usernamePlaceholder: 'yonghuming',
        usernameAvailable: '用户名可用！',
        usernameTaken: '用户名已被占用',
        fullName: '全名',
        fullNamePlaceholder: '张伟',
        dob: '出生日期',
        gender: '性别',
        selectGender: '选择性别',
        male: '男',
        female: '女',
        other: '其他',
        preferNotToSay: '保密',
        password: '密码',
        submitCreate: '创建账户',
        submitSignIn: '登录',
        alreadyHaveAccount: '已有账户？',
        dontHaveAccount: '还没有账户？',
        signInLink: '登录',
        signUpLink: '注册',
        preferredLanguage: '首选语言',
        selectLanguage: '语言',
    },
    ja: {
        createAccount: 'アカウントを作成',
        welcomeBack: 'おかえりなさい',
        username: 'ユーザー名',
        usernamePlaceholder: 'username',
        usernameAvailable: 'ユーザー名は利用可能です！',
        usernameTaken: 'このユーザー名は既に使用されています',
        fullName: '氏名',
        fullNamePlaceholder: '山田 太郎',
        dob: '生年月日',
        gender: '性別',
        selectGender: '性別を選択',
        male: '男性',
        female: '女性',
        other: 'その他',
        preferNotToSay: '回答しない',
        password: 'パスワード',
        submitCreate: 'アカウント作成',
        submitSignIn: 'ログイン',
        alreadyHaveAccount: 'すでにアカウントをお持ちですか？',
        dontHaveAccount: 'アカウントをお持ちでないですか？',
        signInLink: 'ログイン',
        signUpLink: '新規登録',
        preferredLanguage: '希望の言語',
        selectLanguage: '言語',
    },
    pt: {
        createAccount: 'Crie sua conta',
        welcomeBack: 'Bem-vindo de volta',
        username: 'Nome de usuário',
        usernamePlaceholder: 'seu_usuario',
        usernameAvailable: 'Nome de usuário disponível!',
        usernameTaken: 'Nome de usuário já está em uso',
        fullName: 'Nome completo',
        fullNamePlaceholder: 'Carlos Silva',
        dob: 'Data de nascimento',
        gender: 'Gênero',
        selectGender: 'Selecione o gênero',
        male: 'Masculino',
        female: 'Feminino',
        other: 'Outro',
        preferNotToSay: 'Prefiro não dizer',
        password: 'Senha',
        submitCreate: 'Criar Conta',
        submitSignIn: 'Entrar',
        alreadyHaveAccount: 'Já tem uma conta?',
        dontHaveAccount: 'Não tem uma conta?',
        signInLink: 'Entrar',
        signUpLink: 'Cadastre-se',
        preferredLanguage: 'Idioma de preferência',
        selectLanguage: 'Idioma',
    },
    ru: {
        createAccount: 'Создайте аккаунт',
        welcomeBack: 'С возвращением',
        username: 'Имя пользователя',
        usernamePlaceholder: 'username',
        usernameAvailable: 'Имя пользователя доступно!',
        usernameTaken: 'Это имя пользователя уже занято',
        fullName: 'Полное имя',
        fullNamePlaceholder: 'Иван Иванов',
        dob: 'Дата рождения',
        gender: 'Пол',
        selectGender: 'Выберите пол',
        male: 'Мужской',
        female: 'Женский',
        other: 'Другой',
        preferNotToSay: 'Не указывать',
        password: 'Пароль',
        submitCreate: 'Создать аккаунт',
        submitSignIn: 'Войти',
        alreadyHaveAccount: 'Уже есть аккаунт?',
        dontHaveAccount: 'Нет аккаунта?',
        signInLink: 'Войти',
        signUpLink: 'Регистрация',
        preferredLanguage: 'Предпочитаемый язык',
        selectLanguage: 'Язык',
    },
    it: {
        createAccount: 'Crea il tuo account',
        welcomeBack: 'Bentornato',
        username: 'Nome utente',
        usernamePlaceholder: 'nome_utente',
        usernameAvailable: 'Nome utente disponibile!',
        usernameTaken: 'Nome utente già occupato',
        fullName: 'Nome e cognome',
        fullNamePlaceholder: 'Mario Rossi',
        dob: 'Data di nascita',
        gender: 'Genere',
        selectGender: 'Seleziona genere',
        male: 'Maschio',
        female: 'Femmina',
        other: 'Altro',
        preferNotToSay: 'Preferisco non dirlo',
        password: 'Password',
        submitCreate: 'Crea Account',
        submitSignIn: 'Accedi',
        alreadyHaveAccount: 'Hai già un account?',
        dontHaveAccount: 'Non hai un account?',
        signInLink: 'Accedi',
        signUpLink: 'Registrati',
        preferredLanguage: 'Lingua preferita',
        selectLanguage: 'Lingua',
    },
    ko: {
        createAccount: '계정 만들기',
        welcomeBack: '다시 오신 것을 환영합니다',
        username: '사용자 이름',
        usernamePlaceholder: 'username',
        usernameAvailable: '사용 가능한 사용자 이름입니다!',
        usernameTaken: '이미 사용 중인 사용자 이름입니다',
        fullName: '성명',
        fullNamePlaceholder: '홍길동',
        dob: '생년월일',
        gender: '성별',
        selectGender: '성별 선택',
        male: '남성',
        female: '여성',
        other: '기타',
        preferNotToSay: '밝히지 않음',
        password: '비밀번호',
        submitCreate: '계정 생성',
        submitSignIn: '로그인',
        alreadyHaveAccount: '이미 계정이 있으신가요?',
        dontHaveAccount: '계정이 없으신가요?',
        signInLink: '로그인',
        signUpLink: '회원가입',
        preferredLanguage: '선호 언어',
        selectLanguage: '언어',
    },
};

export const getLoginStrings = (langCode: string): LoginStrings => {
    return LOGIN_TRANSLATIONS[langCode] || LOGIN_TRANSLATIONS.en;
};
