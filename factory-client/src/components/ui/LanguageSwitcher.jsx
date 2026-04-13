/* eslint-disable react/prop-types */
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

const normalizeLanguage = (value) => {
  const lang = String(value || '').trim().toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  return 'en';
};

export const LanguageSwitcher = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();
  const [lang, setLang] = useState(language);

  useEffect(() => {
    setLang(language);
  }, [language]);

  const selectLanguage = (nextLang) => {
    const normalized = normalizeLanguage(nextLang);
    setLang(normalized);
    setLanguage(normalized);
  };

  const buttonStyle = (active) => ({
    border: '1px solid var(--border)',
    background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
    color: active ? 'var(--accent)' : 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    padding: compact ? '4px 8px' : '6px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    minWidth: compact ? 42 : 54,
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button type="button" onClick={() => selectLanguage('en')} style={buttonStyle(lang === 'en')} aria-pressed={lang === 'en'}>
        EN
      </button>
      <button type="button" onClick={() => selectLanguage('ar')} style={buttonStyle(lang === 'ar')} aria-pressed={lang === 'ar'}>
        العربية
      </button>
    </div>
  );
};
