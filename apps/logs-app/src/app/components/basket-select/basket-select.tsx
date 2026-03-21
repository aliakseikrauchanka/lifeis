import React from 'react';
import { MenuItem, Select } from '@mui/material';
import css from './basket-select.module.scss';

export interface BasketSelectProps {
  baskets: { _id: string; name: string }[];
  value: string;
  onChange: (basketId: string) => void;
  className?: string;
}

export const BasketSelect = ({ baskets, value, onChange, className }: BasketSelectProps) => (
  <Select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    displayEmpty
    size="small"
    variant="outlined"
    className={className ?? css.basketSelect}
    renderValue={(v) => (v ? baskets.find((b) => b._id === v)?.name ?? v : 'Basket (all)')}
  >
    <MenuItem value="">All</MenuItem>
    {baskets.map((b) => (
      <MenuItem key={b._id} value={b._id}>
        {b.name}
      </MenuItem>
    ))}
  </Select>
);
