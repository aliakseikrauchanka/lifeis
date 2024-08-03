import React, { useState } from 'react';
import { Textarea, Typography } from '@mui/joy';

interface EditableInputProps {
  initialValue: string;
  onValueChange: (newPrefix: string) => void;
}

export const EditableInput: React.FC<EditableInputProps> = ({ initialValue, onValueChange }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [prefix, setPrefix] = useState(initialValue);

  const handleInputClick = () => setIsEditing(true);

  const handleBlurTextarea = () => {
    setIsEditing(false);
    if (prefix) {
      onValueChange(prefix);
    } else {
      setPrefix(initialValue);
    }
  };

  return isEditing ? (
    <Textarea
      value={prefix}
      onChange={(e) => setPrefix(e.target.value)}
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
    >
      {prefix}
    </Typography>
  );
};
