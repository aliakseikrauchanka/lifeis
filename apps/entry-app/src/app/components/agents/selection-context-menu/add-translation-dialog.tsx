import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Input, Modal, ModalDialog, ToggleButtonGroup, Typography } from '@mui/joy';
import { LanguageSelector } from '@lifeis/common-ui';
import {
  detectLanguage,
  fetchTranslation,
  saveTranslation,
  TranslationExample,
} from '../../../api/translations/translations.api';

interface AddTranslationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  defaultOriginalLanguage: string;
}

export const AddTranslationDialog: React.FC<AddTranslationDialogProps> = ({
  open,
  onClose,
  selectedText,
  defaultOriginalLanguage,
}) => {
  const [originalText, setOriginalText] = useState('');
  const [originalLanguage, setOriginalLanguage] = useState(defaultOriginalLanguage);
  const [translationLanguage, setTranslationLanguage] = useState('');
  const [translations, setTranslations] = useState<string[]>([]);
  const [selectedTranslations, setSelectedTranslations] = useState<string[]>([]);
  const [examples, setExamples] = useState<TranslationExample[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // On open: snapshot text, detect language, reset other state
  useEffect(() => {
    if (!open) return;
    const text = selectedText;
    setOriginalText(text);
    setTranslationLanguage('');
    setTranslations([]);
    setSelectedTranslations([]);
    setExamples([]);

    setDetecting(true);
    detectLanguage(text)
      .then((code) => {
        setOriginalLanguage(code);
        if (code === 'ru-RU') {
          setTranslationLanguage('pl');
        } else {
          setTranslationLanguage('ru-RU');
        }
      })
      .catch(() => setOriginalLanguage(defaultOriginalLanguage))
      .finally(() => setDetecting(false));
  }, [open]);

  // Fetch immediately when languages change
  useEffect(() => {
    if (!translationLanguage || !originalText) return;
    setLoading(true);
    fetchTranslation(originalText, translationLanguage, originalLanguage)
      .then(({ translations: ts, examples: ex }) => {
        setTranslations(ts);
        setSelectedTranslations([]);
        setExamples(ex);
      })
      .finally(() => setLoading(false));
  }, [translationLanguage, originalLanguage]);

  // Debounced fetch when edited text changes
  useEffect(() => {
    if (!translationLanguage || !originalText) return;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchTranslation(originalText, translationLanguage, originalLanguage)
        .then(({ translations: ts, examples: ex }) => {
          setTranslations(ts);
          setSelectedTranslations([]);
          setExamples(ex);
        })
        .finally(() => setLoading(false));
    }, 600);
    return () => clearTimeout(timer);
  }, [originalText]);

  const handleSubmit = async () => {
    if (!selectedTranslations.length || !originalLanguage || !translationLanguage) return;
    setSaving(true);
    try {
      await Promise.all(
        selectedTranslations.map((t) =>
          saveTranslation({ original: originalText, translation: t, originalLanguage, translationLanguage }),
        ),
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTranslationLanguage('');
    setTranslations([]);
    setSelectedTranslations([]);
    setExamples([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <ModalDialog
        sx={{
          width: 460,
          maxWidth: 'min(460px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
        }}
      >
        <Typography level="title-md">Add translation</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <Input value={originalText} onChange={(e) => setOriginalText(e.target.value)} />

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography level="body-sm" sx={{ minWidth: 60 }}>From</Typography>
            {detecting ? (
              <CircularProgress size="sm" />
            ) : (
              <LanguageSelector
                languageCode={originalLanguage}
                handleLanguageChange={(_, v) => v && setOriginalLanguage(v)}
              />
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography level="body-sm" sx={{ minWidth: 60 }}>To</Typography>
            <LanguageSelector
              languageCode={translationLanguage}
              handleLanguageChange={(_, v) => v && setTranslationLanguage(v)}
            />
          </Box>

          {loading ? (
            <CircularProgress size="sm" />
          ) : translations.length > 0 && (
            <>
              <Typography level="body-xs" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                Select translations
              </Typography>
              <ToggleButtonGroup
                value={selectedTranslations}
                onChange={(_, newValue) => setSelectedTranslations(newValue)}
                sx={{ flexWrap: 'wrap', gap: 0.5 }}
              >
                {translations.map((t) => (
                  <Button key={t} value={t} size="sm" variant="outlined" sx={{ fontWeight: 'normal' }}>
                    {t}
                  </Button>
                ))}
              </ToggleButtonGroup>

              {examples.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  <Typography level="body-xs" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Examples
                  </Typography>
                  {examples.map((ex, i) => (
                    <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      <Typography level="body-sm">{ex.original}</Typography>
                      <Typography level="body-sm" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                        {ex.translated}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="plain" color="neutral" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={saving}
              disabled={!selectedTranslations.length || !originalLanguage || !translationLanguage}
            >
              Save{selectedTranslations.length > 1 ? ` (${selectedTranslations.length})` : ''}
            </Button>
          </Box>
        </Box>
      </ModalDialog>
    </Modal>
  );
};
