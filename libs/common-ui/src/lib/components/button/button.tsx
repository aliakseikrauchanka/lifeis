import { CSSProperties, ReactNode, MouseEvent } from 'react';
import Button from '@mui/joy/Button';
import { DefaultColorPalette, DefaultVariantProp } from '@mui/joy/styles/types';

export interface IOwnButtonProps {
  type?: 'button' | 'submit' | 'reset';
  color?: DefaultColorPalette;
  // TODO: understand how to override styels better History
  style?: CSSProperties | undefined;
  className?: string;
  children: ReactNode;
  variant?: DefaultVariantProp;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export function OwnButton({ children, type, onClick, style, className, disabled, color, variant }: IOwnButtonProps) {
  return (
    <Button
      type={type}
      disabled={disabled}
      sx={{ padding: '0.2rem', minHeight: 'initial' }}
      onClick={onClick}
      style={style}
      className={className}
      color={color}
      variant={variant}
    >
      {children}
    </Button>
  );
}

export default OwnButton;
