import { useEffect } from 'react';
import { useAudioDevices } from '@lifeis/common-ui';
import { Check, Headphones, Languages, Mic, User, X } from 'lucide-react';
import { useState } from 'react';
import { APP_LEVELS, useAppLevel } from '../hooks/use-app-level';
import { useAppLanguages } from '../hooks/use-app-languages';
import { LANGUAGE_OPTIONS } from '../constants/language-options';
import type { CefrLevel } from '../api/srs.api';
import { Button } from './ui/button';
import { useI18n } from '../i18n/i18n-context';
import { INTERFACE_LOCALES, type InterfaceLocale } from '../i18n/interface-locale';
import type { MessageKey } from '../i18n/messages';

interface DeviceListItem {
  deviceId: string;
  label: string;
}

function DeviceRadioList({
  devices,
  currentId,
  onSelect,
  defaultLabel,
  unnamedLabel,
}: {
  devices: DeviceListItem[];
  currentId: string;
  onSelect: (id: string) => void;
  defaultLabel: string;
  unnamedLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-md border divide-y">
      <button
        type="button"
        onClick={() => onSelect('')}
        className={`flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-violet-50 ${
          !currentId ? 'text-violet-900 font-medium' : 'text-foreground'
        }`}
      >
        <span className="w-4 inline-flex justify-center">
          {!currentId && <Check className="h-3 w-3" />}
        </span>
        {defaultLabel}
      </button>
      {devices.map((d) => (
        <button
          key={d.deviceId}
          type="button"
          onClick={() => onSelect(d.deviceId)}
          className={`flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-violet-50 truncate ${
            currentId === d.deviceId ? 'text-violet-900 font-medium' : 'text-foreground'
          }`}
          title={d.label}
        >
          <span className="w-4 inline-flex justify-center shrink-0">
            {currentId === d.deviceId && <Check className="h-3 w-3" />}
          </span>
          <span className="truncate">{d.label || unnamedLabel}</span>
        </button>
      ))}
    </div>
  );
}

export function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const {
    inputDevices,
    inputDeviceId,
    setInputDeviceId,
    outputDevices,
    outputDeviceId,
    setOutputDeviceId,
  } = useAudioDevices();
  const [level, setLevel] = useAppLevel();
  const { nativeLanguage, trainingLanguage, setNativeLanguage, setTrainingLanguage } = useAppLanguages();
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('profile.openTitle')}
        className="flex items-center justify-center h-7 w-7 rounded-lg text-violet-700 hover:text-violet-900 hover:bg-violet-500/8 transition-colors"
      >
        <User className="h-4 w-4" />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            className="relative flex flex-col w-full max-w-md max-h-[85vh] bg-background rounded-lg shadow-lg border overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-menu-title"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <h3 id="profile-menu-title" className="text-base font-semibold">
                {t('profile.title')}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} title={t('profile.close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col gap-5 p-4 overflow-y-auto flex-1 min-h-0">
              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Languages className="h-3.5 w-3.5" /> {t('profile.sectionUiLanguage')}
                </h4>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                  <label htmlFor="profile-ui-lang" className="text-sm text-foreground">
                    {t('profile.interfaceLanguage')}
                  </label>
                  <select
                    id="profile-ui-lang"
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as InterfaceLocale)}
                    className="h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    {INTERFACE_LOCALES.map((code) => (
                      <option key={code} value={code}>
                        {t(`uiLang.${code}` as MessageKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Languages className="h-3.5 w-3.5" /> {t('profile.sectionLanguages')}
                </h4>
                <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
                  <label htmlFor="profile-training-lang" className="text-sm text-foreground">
                    {t('profile.training')}
                  </label>
                  <select
                    id="profile-training-lang"
                    value={trainingLanguage}
                    onChange={(e) => setTrainingLanguage(e.target.value)}
                    className="h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="profile-native-lang" className="text-sm text-foreground">
                    {t('profile.native')}
                  </label>
                  <select
                    id="profile-native-lang"
                    value={nativeLanguage}
                    onChange={(e) => setNativeLanguage(e.target.value)}
                    className="h-9 px-2 text-sm rounded-md border border-input bg-background"
                  >
                    {LANGUAGE_OPTIONS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                {nativeLanguage === trainingLanguage ? (
                  <p className="text-xs text-amber-700">{t('profile.sameLangWarning')}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('profile.pairHint')}</p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t('profile.sectionLevel')}
                </h4>
                <div className="flex flex-wrap gap-1">
                  {APP_LEVELS.map((l: CefrLevel) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                        level === l
                          ? 'bg-violet-500 border-violet-500 text-white'
                          : 'bg-background border-input text-foreground hover:bg-violet-50'
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('profile.levelHint')}</p>
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Mic className="h-3.5 w-3.5" /> {t('profile.sectionMic')}
                </h4>
                {inputDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('profile.noMics')}</p>
                ) : (
                  <DeviceRadioList
                    devices={inputDevices}
                    currentId={inputDeviceId}
                    onSelect={setInputDeviceId}
                    defaultLabel={t('profile.defaultDevice')}
                    unnamedLabel={t('profile.unnamedDevice')}
                  />
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h4 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <Headphones className="h-3.5 w-3.5" /> {t('profile.sectionOutput')}
                </h4>
                {outputDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('profile.noOutputs')}</p>
                ) : (
                  <DeviceRadioList
                    devices={outputDevices}
                    currentId={outputDeviceId}
                    onSelect={setOutputDeviceId}
                    defaultLabel={t('profile.defaultDevice')}
                    unnamedLabel={t('profile.unnamedDevice')}
                  />
                )}
              </section>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t shrink-0">
              <Button size="sm" onClick={() => setOpen(false)}>
                {t('profile.done')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
