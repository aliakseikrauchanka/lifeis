import React, { useState } from 'react';
import { OwnButton } from '@lifeis/common-ui';
import { createBasket } from '../../api/baskets/baskets.api';
import { Box, Stack, TextField } from '@mui/material';
import css from './basket-form.module.scss';

interface IBasketFormProps {
  onSubmit: () => void;
}

const BasketForm = ({ onSubmit }: IBasketFormProps) => {
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createBasket(name);
      setName('');
      onSubmit();
    } catch (error) {
      console.error('Error creating basket:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box className={css.formContainer}>
        <TextField
          className={css.inputWhiteBg}
          size="small"
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter basket name"
          required
          fullWidth
        />
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
          <OwnButton type="submit" disabled={!name}>
            Create Basket
          </OwnButton>
        </Stack>
      </Box>
    </form>
  );
};

export default BasketForm;
