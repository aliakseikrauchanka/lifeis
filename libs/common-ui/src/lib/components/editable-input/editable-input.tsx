import React, { useState } from 'react';
import { Textarea, Typography } from '@mui/joy';

interface EditableInputProps {
  initialValue: string;
  onValueChange: (newPrefix: string) => void;
}

export const EditableInput: React.FC<EditableInputProps> = ({ initialValue, onValueChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(initialValue);

  const handleInputClick = () => setIsEditing(true);

  const handleBlurTextarea = () => {
    setIsEditing(false);
    if (inputValue) {
      onValueChange(inputValue);
    } else {
      setInputValue(initialValue);
    }
  };

  return isEditing ? (
    <Textarea
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
