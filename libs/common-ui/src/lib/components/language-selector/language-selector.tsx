import React, { RefObject } from 'react';
import { Select, Option } from '@mui/joy';
import { SxProps } from '@mui/system';

interface LanguageSelectorProps {
  languageCode: string;
  selectRef?: RefObject<HTMLDivElement>;
  handleLanguageChange: (event: any, newLanguageValue: string | null) => void;
  handleLanguageClose?: () => void;
  sx?: SxProps;
}
export const LanguageSelector = ({
  languageCode,
  selectRef,
  sx = {},
  handleLanguageChange,
  handleLanguageClose = () => void {},
}: LanguageSelectorProps) => {
  return (
    <Select
      slotProps={{ root: { ref: selectRef } }}
      value={languageCode}
      onChange={handleLanguageChange}
      onClose={handleLanguageClose}
      sx={{ minWidth: 120, minHeight: '1.75rem', ...sx }}
    >
      <Option value="pl">pl</Option>
      <Option value="ru-RU">ru</Option>
      <Option value="en-US">en</Option>
      <Option value="de-DE">de</Option>
      <Option value="lt-LT">lt</Option>
      <Option value="cs-CZ">cs</Option>
      <Option value="fr-FR">fr</Option>
      <Option value="sr-RS">sr</Option>
      <Option value="">reset</Option>
    </Select>
  );
};
