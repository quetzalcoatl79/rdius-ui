'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type Locale = 'fr' | 'en';

const translations = {
  fr: {
    // Nav
    'nav.dashboard': 'Tableau de bord',
    'nav.users': 'Utilisateurs',
    'nav.groups': 'Groupes',
    'nav.nas': 'Équipements NAS',
    'nav.logs': 'Journaux',
    'nav.servers': 'Serveurs',
    'nav.audit': "Journal d'audit",
    'nav.settings': 'Paramètres',
    'nav.guide': 'Guide',
    'nav.logout': 'Déconnexion',
    'nav.openMenu': 'Ouvrir le menu',
    'nav.closeMenu': 'Fermer le menu',

    // Header
    'header.search': 'Rechercher...',

    // Roles
    'role.super_admin': 'Super Admin',
    'role.admin': 'Admin',
    'role.operator': 'Opérateur',
    'role.viewer': 'Lecteur',

    // Dashboard
    'dashboard.title': 'Tableau de bord',
    'dashboard.subtitle': "Vue d'ensemble de votre infrastructure RADIUS",
    'dashboard.users': 'Utilisateurs',
    'dashboard.usersDesc': 'Comptes RADIUS enregistrés',
    'dashboard.activeSessions': 'Sessions actives',
    'dashboard.activeSessionsDesc': 'Connexions en cours',
    'dashboard.nasEquipment': 'Équipements NAS',
    'dashboard.nasEquipmentDesc': "Points d'accès configurés",
    'dashboard.recentFailures': 'Échecs récents',
    'dashboard.recentFailuresDesc': "Échecs d'authentification (1h)",
    'dashboard.authRates': "Taux d'authentification",
    'dashboard.trafficPerNas': 'Trafic par NAS',
    'dashboard.topUsers': 'Top utilisateurs',
    'dashboard.byTraffic': 'Par trafic',
    'dashboard.byTime': 'Par temps',
    'dashboard.noData': 'Aucune donnée disponible',
    'dashboard.success': 'Succès',
    'dashboard.failures': 'Échecs',
    'dashboard.incoming': 'Entrant',
    'dashboard.outgoing': 'Sortant',
    'dashboard.user': 'Utilisateur',
    'dashboard.totalTraffic': 'Trafic total',
    'dashboard.sessionTime': 'Temps de session',

    // Login
    'login.title': 'Radius UI',
    'login.subtitle': 'Interface de gestion FreeRADIUS',
    'login.heading': 'Connexion',
    'login.description': 'Entrez vos identifiants pour accéder au tableau de bord.',
    'login.email': 'Email',
    'login.password': 'Mot de passe',
    'login.submit': 'Se connecter',
    'login.submitting': 'Connexion en cours...',
    'login.invalidCredentials': 'Identifiants invalides. Veuillez réessayer.',

    // Common
    'common.loading': 'Chargement...',
    'common.redirecting': 'Redirection vers la connexion...',
    'theme.light': 'Passer en mode clair',
    'theme.dark': 'Passer en mode sombre',
  },
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.users': 'Users',
    'nav.groups': 'Groups',
    'nav.nas': 'NAS Equipment',
    'nav.logs': 'Logs',
    'nav.servers': 'Servers',
    'nav.audit': 'Audit Trail',
    'nav.settings': 'Settings',
    'nav.guide': 'Guide',
    'nav.logout': 'Log out',
    'nav.openMenu': 'Open menu',
    'nav.closeMenu': 'Close menu',

    // Header
    'header.search': 'Search...',

    // Roles
    'role.super_admin': 'Super Admin',
    'role.admin': 'Admin',
    'role.operator': 'Operator',
    'role.viewer': 'Viewer',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'Overview of your RADIUS infrastructure',
    'dashboard.users': 'Users',
    'dashboard.usersDesc': 'Registered RADIUS accounts',
    'dashboard.activeSessions': 'Active Sessions',
    'dashboard.activeSessionsDesc': 'Ongoing connections',
    'dashboard.nasEquipment': 'NAS Equipment',
    'dashboard.nasEquipmentDesc': 'Configured access points',
    'dashboard.recentFailures': 'Recent Failures',
    'dashboard.recentFailuresDesc': 'Auth failures (1h)',
    'dashboard.authRates': 'Authentication Rates',
    'dashboard.trafficPerNas': 'Traffic per NAS',
    'dashboard.topUsers': 'Top Users',
    'dashboard.byTraffic': 'By traffic',
    'dashboard.byTime': 'By time',
    'dashboard.noData': 'No data available',
    'dashboard.success': 'Success',
    'dashboard.failures': 'Failures',
    'dashboard.incoming': 'Incoming',
    'dashboard.outgoing': 'Outgoing',
    'dashboard.user': 'User',
    'dashboard.totalTraffic': 'Total traffic',
    'dashboard.sessionTime': 'Session time',

    // Login
    'login.title': 'Radius UI',
    'login.subtitle': 'FreeRADIUS Management Interface',
    'login.heading': 'Sign In',
    'login.description': 'Enter your credentials to access the dashboard.',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.submitting': 'Signing in...',
    'login.invalidCredentials': 'Invalid credentials. Please try again.',

    // Common
    'common.loading': 'Loading...',
    'common.redirecting': 'Redirecting to login...',
    'theme.light': 'Switch to light mode',
    'theme.dark': 'Switch to dark mode',
  },
} as const;

type TranslationKey = keyof typeof translations.fr;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>(null!);

export const useI18n = () => useContext(I18nContext);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('radius-ui-locale') as Locale) || 'fr';
    }
    return 'fr';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== 'undefined') {
      localStorage.setItem('radius-ui-locale', l);
      document.documentElement.lang = l;
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[locale][key] ?? key;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
