import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, Input, Modal, ModalDialog, ToggleButtonGroup, Typography } from '@mui/joy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { LanguageSelector } from '@lifeis/common-ui';
import {
  detectLanguage,
  fetchTranslation,
  saveTranslation,
  TranslationExample,
} from '../../../api/translations/translations.api';
import { speak } from '../all-agents.helpers';

interface AddTranslationDialogProps {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  defaultOriginalLanguage: string;
}

const PLAY_BTN_SX = {
  borderRadius: '50%',
  bgcolor: '#7c3aed',
  color: 'white',
  '&:hover': { bgcolor: '#6d28d9' },
  minWidth: 20,
  minHeight: 20,
  width: 20,
  height: 20,
  p: 0,
};

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
  const audioRef = useRef<HTMLAudioElement>(null);

  const playText = (text: string, languageCode: string) => {
    speak(text, languageCode, (audioUrl) => {
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        audioRef.current.onended = () => URL.revokeObjectURL(audioUrl);
      }
    });
  };

  const handleDetectAndTranslate = async () => {
    if (!originalText) return;
    setDetecting(true);
    let detectedLang = originalLanguage;
    try {
      detectedLang = await detectLanguage(originalText);
      setOriginalLanguage(detectedLang);
      // if (!translationLanguage) {
        setTranslationLanguage(detectedLang === 'ru-RU' ? 'pl' : 'ru-RU');
      // }
    } catch {
      // keep existing language
    } finally {
      setDetecting(false);
    }
    if (!translationLanguage) return; // translationLanguage will be set above, effect will fire
    setLoading(true);
    fetchTranslation(originalText, translationLanguage, detectedLang)
      .then(({ translations: ts, examples: ex }) => {
        setTranslations(ts);
        setSelectedTranslations([]);
        setExamples(ex);
      })
      .finally(() => setLoading(false));
  };

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
        setTranslationLanguage(code === 'ru-RU' ? 'pl' : 'ru-RU');
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
    <>
      <Modal open={open} onClose={handleClose}>
        <ModalDialog
          sx={{
            width: 460,
            maxWidth: 'min(460px, calc(100vw - 32px))',
            height: 560,
            maxHeight: 'calc(100vh - 32px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <Typography level="title-md" sx={{ flexShrink: 0 }}>Add translation</Typography>

          {/* Scrollable body */}
          <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1, pr: 0.5 }}>
            <Input
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleDetectAndTranslate();
              }}
              endDecorator={
                <Button size="sm" variant="soft" onClick={handleDetectAndTranslate} disabled={detecting || loading || !originalText} sx={{ bgcolor: '#7c3aed', color: 'white', '&:hover': { bgcolor: '#6d28d9' } }}>
                  {detecting ? <CircularProgress size="sm" /> : 'Translate'}
                </Button>
              }
            />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                <Typography level="body-sm">From</Typography>
                <LanguageSelector
                  languageCode={originalLanguage}
                  handleLanguageChange={(_, v) => v && setOriginalLanguage(v)}
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                <Typography level="body-sm">To</Typography>
                <LanguageSelector
                  languageCode={translationLanguage}
                  handleLanguageChange={(_, v) => v && setTranslationLanguage(v)}
                />
              </Box>
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
                  sx={{ flexWrap: 'wrap', gap: 0.5, '--ButtonGroup-separatorColor': 'transparent' }}
                >
                  {translations.map((t, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'center' }}>
                      <Button value={t} size="sm" variant="outlined" sx={{ fontWeight: 'normal', border: 'none', '&:not(:first-of-type)': { border: 'none' } }}>
                        {t}
                      </Button>
                      <IconButton size="sm" variant="plain" onClick={() => playText(t, translationLanguage)} sx={{ borderRadius: '50%', minWidth: 20, minHeight: 20, width: 20, height: 20, p: 0 }}>
                        <PlayArrowIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Box>
                  ))}
                </ToggleButtonGroup>

                {examples.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Typography level="body-xs" sx={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                      Examples
                    </Typography>
                    {examples.map((ex, i) => (
                      <Box key={i} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography level="body-sm">{ex.original}</Typography>
                          <IconButton size="sm" variant="plain" onClick={() => playText(ex.original, originalLanguage)} sx={PLAY_BTN_SX}>
                            <PlayArrowIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography level="body-sm" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                            {ex.translated}
                          </Typography>
                          <IconButton size="sm" variant="plain" onClick={() => playText(ex.translated, translationLanguage)} sx={PLAY_BTN_SX}>
                            <PlayArrowIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Fixed footer */}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexShrink: 0, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button variant="plain" color="neutral" onClick={handleClose}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              loading={saving}
              disabled={!selectedTranslations.length || !originalLanguage || !translationLanguage}
            >
              Save{selectedTranslations.length > 1 ? ` (${selectedTranslations.length})` : ''}
            </Button>
          </Box>
        </ModalDialog>
      </Modal>
      <audio ref={audioRef}><source type="audio/mpeg" /></audio>
    </>
  );
};
