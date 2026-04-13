/* eslint-disable react/prop-types */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useFetch } from '../hooks/useFetch';

function Harness({ fetcher, dep }) {
  const { data, loading, error } = useFetch(fetcher, [dep]);
  return (
    <div>
      <span data-testid="loading">{loading ? 'yes' : 'no'}</span>
      <span data-testid="data">{data || ''}</span>
      <span data-testid="error">{error || ''}</span>
    </div>
  );
}

describe('useFetch', () => {
  it('loads successful data', async () => {
    const fetcher = jest.fn().mockResolvedValue('ok');
    render(<Harness fetcher={fetcher} dep="a" />);

    expect(screen.getByTestId('loading')).toHaveTextContent('yes');

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('data')).toHaveTextContent('ok');
    expect(screen.getByTestId('error')).toHaveTextContent('');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('surfaces fetch errors', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('boom'));
    render(<Harness fetcher={fetcher} dep="a" />);

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('no');
    });

    expect(screen.getByTestId('error')).toHaveTextContent('boom');
  });
});
