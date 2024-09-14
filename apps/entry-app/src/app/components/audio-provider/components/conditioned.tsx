import React from 'react';

interface ConditionedProps {
  is: boolean;
  children: React.ReactNode;
}

export const Conditioned: React.FC<ConditionedProps> = ({ is, children }) => {
  if (is) {
    return <>{children}</>;
  }
  return null;
};
