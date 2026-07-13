'use client';

import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/components/providers/locale-provider';

export function LocaleSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, toggleLocale, t } = useLocale();
  const nextLabel = locale === 'en' ? '中文' : 'English';

  return (
    <Button variant="outline" size={compact ? 'icon' : 'sm'} onClick={toggleLocale} title={`${t('Language')}: ${nextLabel}`} aria-label={`${t('Language')}: ${nextLabel}`}>
      <Languages className="h-4 w-4" />
      {!compact && <span className="ml-1">{nextLabel}</span>}
    </Button>
  );
}
