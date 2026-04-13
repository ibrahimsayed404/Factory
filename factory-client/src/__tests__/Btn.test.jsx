import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Btn } from '../components/ui';

describe('Btn component', () => {
  it('renders with label and handles click', async () => {
    const onClick = jest.fn();
    render(<Btn onClick={onClick}>Click me</Btn>);
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it('is accessible by keyboard', async () => {
    const onClick = jest.fn();
    render(<Btn onClick={onClick}>Press</Btn>);
    const button = screen.getByRole('button', { name: /press/i });
    button.focus();
    expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalled();
  });
});
