import { CSSProperties, ReactNode, MouseEvent } from 'react';
import Button from '@mui/joy/Button';

export interface IOwnButtonProps {
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties | undefined;
  children: ReactNode;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function OwnButton({ children, type, onClick, style, disabled }: IOwnButtonProps) {
  return (
    <Button
      type={type}
      disabled={disabled}
      sx={{ padding: '0.2rem', minHeight: 'initial' }}
      onClick={onClick}
      style={style}
    >
      {children}
    </Button>
  );
}

export default OwnButton;
