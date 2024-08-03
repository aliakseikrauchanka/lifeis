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
    onValueChange(prefix);
  };

  return isEditing ? (
    <Textarea value={prefix} onChange={(e) => setPrefix(e.target.value)} onBlur={handleBlurTextarea} autoFocus />
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
