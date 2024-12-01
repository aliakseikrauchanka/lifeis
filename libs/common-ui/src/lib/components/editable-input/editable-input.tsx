'use client';

import React, { useState } from 'react';
import { Textarea, Typography } from '@mui/joy';

interface EditableInputProps {
  initialValue: string;
  isDisabled?: boolean;
  onValueChange: (newPrefix: string) => void;
  onToggle?: (isEditing: boolean) => void;
}

export const EditableInput: React.FC<EditableInputProps> = ({ initialValue, isDisabled, onValueChange, onToggle }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue);

  const handleInputClick = () => {
    setIsEditing(true);
    onToggle?.(true);
  };

  const handleBlurTextarea = () => {
    setIsEditing(false);
    onToggle?.(false);

    if (inputValue) {
      onValueChange(inputValue);
    } else {
      setInputValue(initialValue);
    }
  };

  return isEditing ? (
    <Textarea
      disabled={isDisabled}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onBlur={handleBlurTextarea}
      autoFocus
      sx={{
        padding: '0rem',
        minHeight: 'initial',
      }}
    />
  ) : (
    <Typography
      noWrap
      onClick={handleInputClick}
      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
      title={inputValue}
    >
      {inputValue}
    </Typography>
  );
};
